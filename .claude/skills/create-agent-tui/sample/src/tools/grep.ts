import { tool } from '@openrouter/agent/tool';
import { z } from 'zod';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const grepTool = tool({
  name: 'grep',
  description: 'Search file contents by regex pattern',
  inputSchema: z.object({
    pattern: z.string().describe('Regex pattern to search for'),
    path: z.string().optional().describe('Directory or file to search (default: cwd)'),
    glob: z.string().optional().describe('File filter, e.g. "*.ts"'),
    ignoreCase: z.boolean().optional(),
  }),
  execute: async ({ pattern, path, glob: fileGlob, ignoreCase }) => {
    const searchPath = path ?? process.cwd();
    const args = ['--no-heading', '--line-number', '--color=never'];
    if (ignoreCase) args.push('-i');
    if (fileGlob) args.push('--glob', fileGlob);
    args.push('--', pattern, searchPath);

    try {
      const { stdout } = await execFileAsync('rg', args, {
        maxBuffer: 256 * 1024,
        timeout: 30000,
      });
      const matches = stdout.split('\n').filter(Boolean).slice(0, 100).map((line) => {
        const match = line.match(/^(.+?):(\d+):(.*)$/);
        if (!match) return { raw: line };
        return { file: match[1], line: Number(match[2]), content: match[3] };
      });
      return { matches, total: matches.length };
    } catch (err: any) {
      if (err.code === 'ENOENT') return { error: 'ripgrep (rg) not found. Install: https://github.com/BurntSushi/ripgrep' };
      if (err.code === 1) return { matches: [], total: 0 };
      return { error: err.message };
    }
  },
});
