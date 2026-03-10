import { describe, expect, it } from "bun:test";
import { compileTestBinary } from "./compiled-contract-helpers";

interface SignalPtyResult {
  exitCode: number;
  canonicalModeRestored: boolean;
  echoRestored: boolean;
}

function runCompiledSignalPty(): SignalPtyResult {
  const pythonScript = `
import json, os, pty, subprocess, time, signal, fcntl, termios, struct

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

time.sleep(0.8)
os.killpg(proc.pid, signal.SIGINT)

try:
    proc.wait(timeout=5)
except Exception:
    proc.kill()
    proc.wait(timeout=5)

attrs = termios.tcgetattr(master)
lflag = attrs[3]

print(json.dumps({
    'exitCode': proc.returncode,
    'canonicalModeRestored': bool(lflag & termios.ICANON),
    'echoRestored': bool(lflag & termios.ECHO),
}))
`;

  const result = Bun.spawnSync(["python3", "-c", pythonScript], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RFAF_COMPILED_BINARY: compileTestBinary(),
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(Buffer.from(result.stderr).toString("utf8"));
  }

  return JSON.parse(Buffer.from(result.stdout).toString("utf8")) as SignalPtyResult;
}

describe("compiled signal cleanup PTY contract", () => {
  it("exits on SIGINT and restores terminal mode flags", () => {
    const result = runCompiledSignalPty();

    expect([0, -2].includes(result.exitCode)).toBe(true);
    expect(result.canonicalModeRestored).toBe(true);
    expect(result.echoRestored).toBe(true);
  });
});
