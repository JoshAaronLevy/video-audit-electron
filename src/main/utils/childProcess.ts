import { spawn } from 'node:child_process';

export interface ChildProcessResult {
  ok: boolean;
  stdout: string;
  stderr: string;
  code: number | null;
  canceled: boolean;
  error?: string;
}

export function runChildProcess(
  command: string,
  args: string[],
  { signal }: { signal?: AbortSignal } = {}
): Promise<ChildProcessResult> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve({
        ok: false,
        stdout: '',
        stderr: '',
        code: null,
        canceled: true,
        error: 'Operation canceled.'
      });
      return;
    }

    const child = spawn(command, args);
    let settled = false;
    let stdout = '';
    let stderr = '';

    const finish = (result: ChildProcessResult): void => {
      if (settled) {
        return;
      }

      settled = true;
      signal?.removeEventListener('abort', abortHandler);
      resolve(result);
    };

    const abortHandler = (): void => {
      child.kill('SIGTERM');
      finish({
        ok: false,
        stdout,
        stderr,
        code: null,
        canceled: true,
        error: 'Operation canceled.'
      });
    };

    signal?.addEventListener('abort', abortHandler, { once: true });

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (error) => {
      finish({
        ok: false,
        stdout,
        stderr,
        code: null,
        canceled: false,
        error: error.message
      });
    });

    child.on('close', (code) => {
      finish({
        ok: code === 0,
        stdout,
        stderr,
        code,
        canceled: false,
        error: code === 0 ? undefined : stderr || `${command} exited with code ${code}`
      });
    });
  });
}
