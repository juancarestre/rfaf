import { describe, expect, it } from "bun:test";

const PTY_TEST_TIMEOUT_MS = 30_000;

function stripAnsi(output: string): string {
  return output
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\u001b\][^\u0007\u001b]*(?:\u0007|\u001b\\)/g, "");
}

function runConfigBootstrapPty(): {
  exitCode: number;
  output: string;
  configExists: boolean;
  configMode: string;
} {
  return runConfigBootstrapPtyWith({
    inputArgs: ["--summary=long", "tests/fixtures/ozzy.txt"],
    answer: "y",
    waitNeedle: "Press Space to start",
  });
}

function runConfigBootstrapPtyWith(input: {
  inputArgs: string[];
  answer: "y" | "n";
  waitNeedle: string;
}): {
  exitCode: number;
  output: string;
  configExists: boolean;
  configMode: string;
} {
  const cliArgs = JSON.stringify(input.inputArgs);
  const answerBytes = input.answer === "y" ? "y\\n" : "n\\n";
  const waitNeedle = input.waitNeedle;

  const pythonScript = `
import json, os, pty, subprocess, time, select, fcntl, termios, struct, tempfile, stat, signal
from pathlib import Path

master, slave = pty.openpty()
fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))

home = tempfile.mkdtemp(prefix='rfaf-config-bootstrap-')

def preexec():
    os.setsid()
    fcntl.ioctl(slave, termios.TIOCSCTTY, 0)

env = dict(os.environ)
env['HOME'] = home
env['GOOGLE_GENERATIVE_AI_API_KEY'] = 'dummy'
env['OPENAI_API_KEY'] = 'dummy'
env['RFAF_LLM_PROVIDER'] = 'openai'
env['RFAF_LLM_MODEL'] = 'gpt-4o-mini'
env['RFAF_NO_ALT_SCREEN'] = '1'
env['RFAF_SUMMARY_MOCK_SCENARIO'] = 'long-input-chunk-required'

proc = subprocess.Popen(
    ['bun', '--preload', './tests/fixtures/preload-summary-mock.ts', 'src/cli/index.tsx', *${cliArgs}],
    stdin=slave,
    stdout=slave,
    stderr=slave,
    cwd='${process.cwd()}',
    env=env,
    preexec_fn=preexec,
    close_fds=True,
)
os.close(slave)

def drain_until(timeout_s=3.0, needle=None):
    deadline = time.time() + timeout_s
    data = b''
    while time.time() < deadline:
        r, _, _ = select.select([master], [], [], 0.05)
        if master in r:
            try:
                chunk = os.read(master, 65536)
                if not chunk:
                    break
                data += chunk
            except OSError:
                break
        if needle and needle in data:
            break
    return data

output = drain_until(3.0, b'Create it now')

try:
    os.write(master, b'${answerBytes}')
except OSError:
    pass

output += drain_until(4.0, b'${waitNeedle}')

if proc.poll() is None:
    try:
        os.killpg(proc.pid, signal.SIGINT)
    except OSError:
        pass

output += drain_until(1.5)

try:
    proc.wait(timeout=5)
except Exception:
    proc.kill()
    proc.wait(timeout=5)

config_path = Path(home) / '.rfaf' / 'config.yaml'
config_exists = config_path.exists()
config_mode = format(stat.S_IMODE(config_path.stat().st_mode), 'o') if config_exists else ''

print(json.dumps({
    'exitCode': proc.returncode,
    'output': output.decode('utf-8', 'ignore'),
    'configExists': config_exists,
    'configMode': config_mode,
}))
`;

  const result = Bun.spawnSync(["python3", "-c", pythonScript], {
    cwd: process.cwd(),
    env: process.env,
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(Buffer.from(result.stderr).toString("utf8"));
  }

  const parsed = JSON.parse(Buffer.from(result.stdout).toString("utf8")) as {
    exitCode: number;
    output: string;
    configExists: boolean;
    configMode: string;
  };

  return {
    exitCode: parsed.exitCode,
    output: stripAnsi(parsed.output),
    configExists: parsed.configExists,
    configMode: parsed.configMode,
  };
}

describe("config bootstrap PTY contract", () => {
  it("offers to create missing default config and continues same run", () => {
    const result = runConfigBootstrapPty();

    expect(result.exitCode).toBe(-2);
    expect(result.output).toContain("[setup] Missing config");
    expect(result.output).toContain("[ok] Created config");
    expect(result.output).toContain("[next] Add your API key");
    expect(result.output).toContain("summary ready; starting RSVP");
    expect(result.output).toContain("[RSVP] Press Space to start");
    expect(result.configExists).toBe(true);
    expect(result.configMode).toBe("600");
  }, PTY_TEST_TIMEOUT_MS);

  it("fails fast on decline before ingest side-effects", () => {
    const result = runConfigBootstrapPtyWith({
      inputArgs: ["--summary=long", "https://example.com/article"],
      answer: "n",
      waitNeedle: "Config error: missing config file",
    });

    expect(result.output).toContain("[setup] Missing config");
    expect(result.output).toContain("Config error: missing config file");
    expect(result.output).not.toContain("fetching article from");
    expect(result.configExists).toBe(false);
  }, PTY_TEST_TIMEOUT_MS);
});
