import { describe, expect, it } from "bun:test";
import { compileTestBinary } from "./compiled-contract-helpers";

interface PtyResult {
  exitCode: number;
  output: string;
  canonicalModeRestored: boolean;
  echoRestored: boolean;
}

function runCompiledPty(actions: string[]): PtyResult {
  const pythonScript = `
import json, os, pty, subprocess, time, select, fcntl, termios, struct

actions = json.loads(os.environ["RFAF_PTY_ACTIONS"])
binary = os.environ["RFAF_COMPILED_BINARY"]
master, slave = pty.openpty()
fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))

def preexec():
    os.setsid()
    fcntl.ioctl(slave, termios.TIOCSCTTY, 0)

env = dict(os.environ)
env['RFAF_NO_ALT_SCREEN'] = '1'
proc = subprocess.Popen(
    [binary, 'tests/fixtures/sample.txt'],
    stdin=slave,
    stdout=slave,
    stderr=slave,
    cwd='${process.cwd()}',
    env=env,
    preexec_fn=preexec,
    close_fds=True,
)
os.close(slave)

def drain(delay=0.3):
    time.sleep(delay)
    data = b''
    while True:
        r, _, _ = select.select([master], [], [], 0.05)
        if master not in r:
            break
        try:
            chunk = os.read(master, 65536)
            if not chunk:
                break
            data += chunk
        except OSError:
            break
    return data

output = drain(0.8)
for action in actions:
    if action == 'quit':
        os.write(master, b'q')
    output += drain(0.5)

try:
    proc.wait(timeout=5)
except Exception:
    proc.kill()
    proc.wait(timeout=5)

attrs = termios.tcgetattr(master)
lflag = attrs[3]

print(json.dumps({
    'exitCode': proc.returncode,
    'output': output.decode('utf-8', 'ignore'),
    'canonicalModeRestored': bool(lflag & termios.ICANON),
    'echoRestored': bool(lflag & termios.ECHO),
}))
`;

  const result = Bun.spawnSync(["python3", "-c", pythonScript], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RFAF_PTY_ACTIONS: JSON.stringify(actions),
      RFAF_COMPILED_BINARY: compileTestBinary(),
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(Buffer.from(result.stderr).toString("utf8"));
  }

  return JSON.parse(Buffer.from(result.stdout).toString("utf8")) as PtyResult;
}

describe("compiled runtime lifecycle PTY contract", () => {
  it("quits cleanly and restores terminal mode flags", () => {
    const result = runCompiledPty(["quit"]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("Press Space to start");
    expect(result.canonicalModeRestored).toBe(true);
    expect(result.echoRestored).toBe(true);
  });
});
