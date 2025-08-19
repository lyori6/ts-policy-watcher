const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }
  });
  
  const page = await context.newPage();
  await page.goto('http://localhost:8002');
  await page.waitForTimeout(1000);
  
  // Scroll down to see the navigation
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(500);
  
  console.log('1. Navigation visible');
  await page.screenshot({ path: 'proper1_nav_visible.png' });
  
  // Click on Policy Explorer tab
  await page.click('[data-tab="platforms"]');
  await page.waitForTimeout(1000);
  
  console.log('2. Policy Explorer tab clicked');
  await page.screenshot({ path: 'proper2_policy_explorer.png' });
  
  // Scroll down to platform selector area
  await page.evaluate(() => window.scrollTo(0, 600));
  await page.waitForTimeout(1000);
  
  console.log('3. Scrolled to platform selector');
  await page.screenshot({ path: 'proper3_platform_selector.png' });
  
  // Scroll down more to make platform selector sticky
  await page.evaluate(() => window.scrollTo(0, 1000));
  await page.waitForTimeout(1000);
  
  console.log('4. Platform selector should be sticky');
  await page.screenshot({ path: 'proper4_platform_sticky.png' });
  
  // Scroll back up to reveal main nav
  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(1000);
  
  console.log('5. Scrolled back up - main nav should be visible');
  await page.screenshot({ path: 'proper5_main_nav_back.png' });
  
  console.log('Test complete!');
  
  await browser.close();
})();