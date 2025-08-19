const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }, // iPhone size
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
  });
  
  const page = await context.newPage();
  await page.goto('http://localhost:8002');
  
  // Click on Policy Explorer tab
  await page.click('[data-tab="platforms"]');
  
  // Wait for content to load
  await page.waitForTimeout(2000);
  
  // Take a screenshot
  await page.screenshot({ path: 'mobile_view_before_scroll.png' });
  
  // Scroll down to test sticky behavior
  await page.evaluate(() => {
    window.scrollTo(0, 800);
  });
  
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'mobile_view_after_scroll.png' });
  
  console.log('Screenshots taken. Check mobile_view_before_scroll.png and mobile_view_after_scroll.png');
  
  // Keep browser open for manual inspection
  await page.waitForTimeout(30000);
  
  await browser.close();
})();