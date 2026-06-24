import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const shellTool = tool({
  name: 'shell',
  description: 'Execute a shell command and return output',
  inputSchema: z.object({
    command: z.string().describe('Shell command to execute'),
    timeout: z.number().optional().describe('Timeout in seconds (default: 120)'),
  }),
  execute: async ({ command, timeout }) => {
    const timeoutMs = (timeout ?? 120) * 1000;
    const shell = process.env.SHELL || '/bin/bash';

    try {
      const { stdout, stderr } = await execFileAsync(shell, ['-c', command], {
        timeout: timeoutMs,
        maxBuffer: 256 * 1024,
      });
      const output = (stdout + stderr).trim();
      const lines = output.split('\n');
      const truncated = lines.length > 2000;
      return {
        output: truncated ? lines.slice(-2000).join('\n') : output,
        exitCode: 0,
        ...(truncated && { truncated: true }),
      };
    } catch (err: any) {
      if (err.killed) {
        return { output: err.stdout?.trim() ?? '', exitCode: null, timedOut: true };
      }
      return {
        output: ((err.stdout ?? '') + (err.stderr ?? '')).trim(),
        exitCode: err.code ?? 1,
      };
    }
  },
});
