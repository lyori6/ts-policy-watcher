const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }
  });
  
  const page = await context.newPage();
  await page.goto('http://localhost:8002');
  
  // Click on Policy Explorer tab
  await page.click('[data-tab="platforms"]');
  await page.waitForTimeout(1000);
  
  console.log('1. Initial state');
  await page.screenshot({ path: 'step1_initial.png' });
  
  // Scroll down past platform selector
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(1000);
  
  console.log('2. Scrolled down - platform selector should be sticky');
  await page.screenshot({ path: 'step2_scrolled_down.png' });
  
  // Scroll back up to reveal main nav
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(1000);
  
  console.log('3. Scrolled back up - main nav should be visible');
  await page.screenshot({ path: 'step3_scrolled_up.png' });
  
  // Scroll to middle position
  await page.evaluate(() => window.scrollTo(0, 300));
  await page.waitForTimeout(1000);
  
  console.log('4. Middle scroll position');
  await page.screenshot({ path: 'step4_middle.png' });
  
  console.log('Test complete. Check the step*.png files');
  
  await browser.close();
})();