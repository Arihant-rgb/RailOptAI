import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workstationRoot = path.join(__dirname, '../../');
const bridgeScript = path.join(workstationRoot, 'optimizer/api_bridge.py');

function pythonCandidates() {
  const extra = [];
  if (process.env.PYTHON_PATH) extra.push(process.env.PYTHON_PATH);
  extra.push(
    'C:\\Program Files\\Python312\\python.exe',
    'C:\\Program Files\\Python311\\python.exe',
    'py',
    'python',
    'python3'
  );
  return extra;
}

function spawnOnce(cmd, payload) {
  return new Promise((resolve) => {
    const args = cmd === 'py' ? ['-3', bridgeScript] : [bridgeScript];
    const pyProcess = spawn(cmd, args, {
      cwd: workstationRoot,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    pyProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    pyProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    pyProcess.on('error', (err) => {
      resolve({ ok: false, status: 'FALLBACK', error: err.message, cmd });
    });

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        return resolve({ ok: false, status: 'FALLBACK', message: stderr || `exit ${code}`, cmd });
      }
      try {
        const json = JSON.parse(stdout);
        if (json.status === 'ERROR') {
          return resolve({ ok: false, status: 'FALLBACK', ...json, cmd });
        }
        resolve({ ok: true, ...json, cmd });
      } catch {
        resolve({ ok: false, status: 'FALLBACK', raw: stdout, cmd });
      }
    });

    pyProcess.stdin.write(JSON.stringify(payload));
    pyProcess.stdin.end();
  });
}

export async function runOptimizer(payload) {
  for (const cmd of pythonCandidates()) {
    if (cmd.includes('\\') || cmd.includes('/')) {
      if (!fs.existsSync(cmd)) continue;
    }
    const result = await spawnOnce(cmd, payload);
    if (result.ok) return result;
  }
  return { status: 'FALLBACK', message: 'Python OR-Tools optimizer not available on this machine' };
}
