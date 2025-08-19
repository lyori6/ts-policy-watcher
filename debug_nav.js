const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 375, height: 667 }
  });
  
  const page = await context.newPage();
  await page.goto('http://localhost:8002');
  await page.waitForTimeout(2000);
  
  // Check if main nav exists
  const mainNav = await page.$('.main-nav');
  console.log('Main nav exists:', !!mainNav);
  
  if (mainNav) {
    const isVisible = await mainNav.isVisible();
    console.log('Main nav visible:', isVisible);
    
    const boundingBox = await mainNav.boundingBox();
    console.log('Main nav position:', boundingBox);
  }
  
  // Check nav tabs
  const navTabs = await page.$$('.nav-tab');
  console.log('Number of nav tabs:', navTabs.length);
  
  for (let i = 0; i < navTabs.length; i++) {
    const text = await navTabs[i].textContent();
    const isVisible = await navTabs[i].isVisible();
    console.log(`Tab ${i}: "${text}" - visible: ${isVisible}`);
  }
  
  // Take a full page screenshot
  await page.screenshot({ path: 'debug_full_page.png', fullPage: true });
  
  console.log('Full page screenshot saved as debug_full_page.png');
  
  await browser.close();
})();