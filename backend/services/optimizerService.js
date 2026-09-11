import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to workstation root & python script
const workstationRoot = path.join(__dirname, '../../');
const bridgeScript = path.join(workstationRoot, 'optimizer/api_bridge.py');

// Python executable paths: check Python 3.12 first, fallback to standard python
const pythonCmd = 'C:\\Program Files\\Python312\\python.exe';

export async function runOptimizer(payload) {
  return new Promise((resolve, reject) => {
    const pyProcess = spawn(pythonCmd, [bridgeScript], {
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

    pyProcess.on('close', (code) => {
      if (code !== 0) {
        console.warn(`Optimizer exited with code ${code}. Stderr: ${stderr}`);
        // Fallback gracefully if error
        return resolve({ status: 'FALLBACK', message: stderr });
      }
      try {
        const json = JSON.parse(stdout);
        resolve(json);
      } catch (err) {
        console.error('Failed to parse optimizer output:', stdout);
        resolve({ status: 'FALLBACK', raw: stdout });
      }
    });

    pyProcess.on('error', (err) => {
      console.warn('Could not spawn Python optimizer:', err.message);
      resolve({ status: 'FALLBACK', error: err.message });
    });

    pyProcess.stdin.write(JSON.stringify(payload));
    pyProcess.stdin.end();
  });
}
