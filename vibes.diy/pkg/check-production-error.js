import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Capture console messages
  const consoleMessages = [];
  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    consoleMessages.push({ type, text });
    console.log(`[${type}]`, text);
  });

  // Capture page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    pageErrors.push(error.toString());
    console.error('Page error:', error.toString());
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
  });

  // Capture uncaught exceptions
  await page.addInitScript(() => {
    window.addEventListener('error', (e) => {
      console.error('Window error:', e.message, e.filename, e.lineno, e.colno);
    });
    window.addEventListener('unhandledrejection', (e) => {
      console.error('Unhandled rejection:', e.reason);
    });
  });

  console.log('Loading http://localhost:3334...');
  
  try {
    await page.goto('http://localhost:3334', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    });
    console.log('Page loaded successfully');
    
    // Wait a bit for any async errors
    await page.waitForTimeout(2000);
    
    // Check if the app loaded
    const appContent = await page.evaluate(() => {
      return {
        title: document.title,
        hasReactRoot: !!document.getElementById('root'),
        bodyText: document.body.innerText.substring(0, 200)
      };
    });
    
    console.log('App content:', appContent);
    
  } catch (error) {
    console.error('Error loading page:', error);
  }
  
  console.log('\n--- Summary ---');
  console.log('Console errors:', consoleMessages.filter(m => m.type === 'error'));
  console.log('Page errors:', pageErrors);
  
  if (pageErrors.length > 0 || consoleMessages.some(m => m.type === 'error' && m.text.includes('Assignment to constant'))) {
    console.log('\n✗ Found the "Assignment to constant variable" error!');
    process.exit(1);
  } else {
    console.log('\n✓ No critical errors found');
  }
  
  await browser.close();
})();