import { describe, expect, it } from "bun:test";

const PTY_TEST_TIMEOUT_MS = 20_000;

function stripAnsi(output: string): string {
  return output
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, "");
}

function runHelpOverlayPty(actions: string[]): { exitCode: number; output: string } {
  const pythonScript = `
import json, os, pty, subprocess, time, select, fcntl, termios, struct

actions = json.loads(os.environ["RFAF_PTY_ACTIONS"])
run_cwd = os.environ.get("RFAF_PTY_CWD", os.getcwd())
master, slave = pty.openpty()
fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))

def preexec():
    os.setsid()
    fcntl.ioctl(slave, termios.TIOCSCTTY, 0)

env = dict(os.environ)
env['RFAF_NO_ALT_SCREEN'] = '1'
proc = subprocess.Popen(
    ['bun', 'run', 'src/cli/index.tsx', 'tests/fixtures/sample.txt'],
    stdin=slave,
    stdout=slave,
    stderr=slave,
    cwd=run_cwd,
    env=env,
    preexec_fn=preexec,
    close_fds=True,
)
os.close(slave)

def drain_after_action(max_wait=2.0, idle_ticks=4):
    deadline = time.monotonic() + max_wait
    idle = 0
    saw_output = False
    data = b''
    while time.monotonic() < deadline:
        r, _, _ = select.select([master], [], [], 0.05)
        if master in r:
            try:
                chunk = os.read(master, 65536)
            except OSError:
                break
            if not chunk:
                break
            data += chunk
            saw_output = True
            idle = 0
            continue
        if not saw_output:
            continue
        idle += 1
        if idle >= idle_ticks:
            break
    return data

output = drain_after_action(max_wait=3.0)
for action in actions:
    if action == 'help':
        os.write(master, b'?')
    elif action == 'close-help-esc':
        os.write(master, b'\x1b')
    elif action == 'close-help-toggle':
        os.write(master, b'?')
    elif action == 'quit':
        os.write(master, b'q')
    output += drain_after_action()

try:
    proc.wait(timeout=5)
except Exception:
    proc.kill()
    proc.wait(timeout=5)

print(json.dumps({
    'exitCode': proc.returncode,
    'output': output.decode('utf-8', 'ignore'),
}))
`;

  const result = Bun.spawnSync(["python3", "-c", pythonScript], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RFAF_PTY_ACTIONS: JSON.stringify(actions),
      RFAF_PTY_CWD: process.cwd(),
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(Buffer.from(result.stderr).toString("utf8"));
  }

  const parsed = JSON.parse(Buffer.from(result.stdout).toString("utf8")) as {
    exitCode: number;
    output: string;
  };

  return {
    exitCode: parsed.exitCode,
    output: stripAnsi(parsed.output),
  };
}

describe("help overlay toggle PTY contract", () => {
  it("opens and closes help with ?", () => {
    const result = runHelpOverlayPty(["help", "close-help-toggle", "quit"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("toggle help overlay");
    expect(result.output).toContain("Press Space to start");
  }, PTY_TEST_TIMEOUT_MS);

  it("closes help with Esc", () => {
    const result = runHelpOverlayPty(["help", "close-help-esc", "quit"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("close help overlay");
    expect(result.output).toContain("Press Space to start");
  }, PTY_TEST_TIMEOUT_MS);
});
