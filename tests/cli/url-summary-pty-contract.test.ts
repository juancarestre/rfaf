import { describe, expect, it } from "bun:test";

function stripAnsi(output: string): string {
  return output
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, "");
}

function runUrlSummaryPty(
  actions: string[],
  cliArgs: string[],
  scenario = "summary-success"
): { exitCode: number; output: string } {
  const pythonScript = `
import json, os, pty, subprocess, time, select, fcntl, termios, struct, tempfile
from pathlib import Path

actions = json.loads(os.environ["RFAF_PTY_ACTIONS"])
cli_args = json.loads(os.environ["RFAF_PTY_CLI_ARGS"])
scenario = os.environ.get("RFAF_URL_MOCK_SCENARIO", "summary-success")
master, slave = pty.openpty()
fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))

home = tempfile.mkdtemp(prefix='rfaf-url-summary-')
rfaf_dir = Path(home) / '.rfaf'
rfaf_dir.mkdir(parents=True, exist_ok=True)
(rfaf_dir / 'config.yaml').write_text('''llm:
  provider: openai
  model: gpt-4o-mini
defaults:
  timeout_ms: 5000
  max_retries: 0
''')

def preexec():
    os.setsid()
    fcntl.ioctl(slave, termios.TIOCSCTTY, 0)

env = dict(os.environ)
env['HOME'] = home
env['OPENAI_API_KEY'] = 'dummy'
env['RFAF_NO_ALT_SCREEN'] = '1'
env['RFAF_URL_MOCK_SCENARIO'] = scenario

proc = subprocess.Popen(
    ['bun', '--preload', './tests/fixtures/preload-url-mock.ts', 'src/cli/index.tsx', *cli_args],
    stdin=slave,
    stdout=slave,
    stderr=slave,
    cwd='${process.cwd()}',
    env=env,
    preexec_fn=preexec,
    close_fds=True,
)
os.close(slave)

def drain(delay=0.35):
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

output = drain(2.2)
for action in actions:
    if action == 'quit':
        try:
            os.write(master, b'q')
        except OSError:
            pass
    output += drain(0.5)

if proc.poll() is None:
    try:
        os.write(master, b'q')
    except OSError:
        pass
    output += drain(0.4)

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
      RFAF_PTY_CLI_ARGS: JSON.stringify(cliArgs),
      RFAF_URL_MOCK_SCENARIO: scenario,
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

describe("url + summary PTY contract", () => {
  it("loads url content, runs summary, and starts reading", () => {
    const result = runUrlSummaryPty(
      ["quit"],
      ["--summary=medium", "https://example.com/article"]
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("fetching article from https://example.com/article");
    expect(result.output).toContain("[ok] article loaded: Mock Article");
    expect(result.output).toContain("summary ready; starting RSVP");
    expect(result.output).toContain("[RSVP] Press Space to start");
  });

  it("supports url input with explicit scroll mode", () => {
    const result = runUrlSummaryPty(
      ["quit"],
      ["--mode=scroll", "https://example.com/article"],
      "success"
    );

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain("fetching article from https://example.com/article");
    expect(result.output).toContain("[ok] article loaded: Mock Article");
    expect(result.output).toContain("[Scroll] Press");
  });
});
