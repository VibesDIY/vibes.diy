import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { resolve } from 'path';

const SAMPLE_DIR = resolve(import.meta.dirname, '..');
const SCREENSHOTS_DIR = resolve(SAMPLE_DIR, 'screenshots');
const PORT_BASE = 7750;
let portCounter = 0;

async function capture(name: string, cliArgs: string[]): Promise<void> {
  const port = PORT_BASE + (portCounter++);
  const ttyd = spawn('ttyd', [
    '--port', String(port), '--writable',
    'npx', 'tsx', 'src/cli.ts', ...cliArgs,
  ], { cwd: SAMPLE_DIR, stdio: 'ignore' });

  await new Promise((r) => setTimeout(r, 3000));

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({
    viewport: { width: 540, height: 360 },
    deviceScaleFactor: 2,
  });
  await page.goto(`http://localhost:${port}`);
  await page.waitForTimeout(8000);

  const outPath = resolve(SCREENSHOTS_DIR, `${name}.png`);
  await page.screenshot({ path: outPath, fullPage: false });
  console.log(`  saved ${name}.png`);

  await browser.close();
  ttyd.kill();
  await new Promise((r) => setTimeout(r, 1000));
}

async function main() {
  console.log('Banner:');
  process.stdout.write('  capturing banner...');
  await capture('banner', ['--model', 'anthropic/claude-sonnet-4.6']);

  console.log('\nTool display styles:');
  for (const style of ['emoji', 'grouped', 'minimal'] as const) {
    process.stdout.write(`  capturing ${style}...`);
    await capture(`tool-display-${style}`, ['--demo', '--tool-display', style]);
  }

  console.log('\nInput styles:');
  for (const style of ['block', 'bordered', 'plain'] as const) {
    process.stdout.write(`  capturing ${style}...`);
    await capture(`input-style-${style}`, ['--input', style]);
  }

  console.log('\nLoader styles:');
  for (const style of ['gradient', 'spinner', 'minimal'] as const) {
    process.stdout.write(`  capturing ${style}...`);
    await capture(`loader-${style}`, ['--demo-loader', '--loader-style', style]);
  }

  console.log('\nDone! 10 screenshots generated.');
}

main();
