import { compileTestBinary } from "./compiled-contract-helpers";

export interface CompiledPtyResult {
  exitCode: number;
  output: string;
  canonicalModeRestored: boolean;
  echoRestored: boolean;
  altScreenEntered: boolean;
  altScreenExited: boolean;
}

export function runCompiledPtySession(options: {
  action: "quit" | "sigint";
  disableAltScreen: boolean;
}): CompiledPtyResult {
  const pythonScript = `
import json, os, pty, subprocess, time, select, fcntl, termios, struct, signal

binary = os.environ["RFAF_COMPILED_BINARY"]
action = os.environ["RFAF_PTY_ACTION"]
disable_alt = os.environ.get("RFAF_DISABLE_ALT_SCREEN") == "1"
master, slave = pty.openpty()
fcntl.ioctl(master, termios.TIOCSWINSZ, struct.pack('HHHH', 24, 80, 0, 0))

def preexec():
    os.setsid()
    fcntl.ioctl(slave, termios.TIOCSCTTY, 0)

env = dict(os.environ)
if disable_alt:
    env['RFAF_NO_ALT_SCREEN'] = '1'
else:
    env.pop('RFAF_NO_ALT_SCREEN', None)

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

def drain_once(timeout=0.05):
    data = b''
    while True:
        r, _, _ = select.select([master], [], [], timeout)
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

def drain_until(timeout_s=3.0, needle=None):
    deadline = time.time() + timeout_s
    data = b''
    while time.time() < deadline:
        data += drain_once(0.05)
        if needle and needle in data:
            break
    return data

output = drain_until(3.0, b'Press Space to start')

if action == 'quit':
    os.write(master, b'q')
elif action == 'sigint':
    os.killpg(proc.pid, signal.SIGINT)

output += drain_until(2.5)

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
    'altScreenEntered': '\\u001b[?1049h' in output.decode('utf-8', 'ignore'),
    'altScreenExited': '\\u001b[?1049l' in output.decode('utf-8', 'ignore'),
}))
`;

  const result = Bun.spawnSync(["python3", "-c", pythonScript], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      RFAF_PTY_ACTION: options.action,
      RFAF_DISABLE_ALT_SCREEN: options.disableAltScreen ? "1" : "0",
      RFAF_COMPILED_BINARY: compileTestBinary(),
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  if (result.exitCode !== 0) {
    throw new Error(Buffer.from(result.stderr).toString("utf8"));
  }

  return JSON.parse(Buffer.from(result.stdout).toString("utf8")) as CompiledPtyResult;
}
