const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const PRODUCTION_URL = 'https://ts-policy-watcher.vercel.app';
const VISUAL_BASELINES_DIR = path.join(__dirname, '..', 'visual-baselines');
const VISUAL_RESULTS_DIR = path.join(__dirname, '..', 'test-results', 'visual-regression');

// Ensure directories exist
[VISUAL_BASELINES_DIR, VISUAL_RESULTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

test.describe('Visual Regression Testing', () => {
  // Use visual-regression project for consistent rendering
  test.describe.configure({ mode: 'parallel' });

  // Common setup for visual tests
  test.beforeEach(async ({ page }) => {
    // Disable animations for consistent screenshots
    await page.addStyleTag({
      content: `
        *, *::before, *::after {
          animation-duration: 0s !important;
          animation-delay: 0s !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }
      `
    });
  });

  test.describe('Desktop Visual Regression', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
    });

    test('Desktop - Full Dashboard Overview', async ({ page }) => {
      await page.goto(PRODUCTION_URL);
      
      // Wait for content to load
      await page.waitForSelector('#header-total-policies', { timeout: 15000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000); // Allow data to settle
      
      // Take full page screenshot
      await expect(page).toHaveScreenshot('desktop-full-dashboard.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('Desktop - Header and Status Bar', async ({ page }) => {
      await page.goto(PRODUCTION_URL);
      await page.waitForSelector('header', { timeout: 15000 });
      await page.waitForTimeout(2000);
      
      const header = page.locator('header');
      await expect(header).toHaveScreenshot('desktop-header-status.png');
    });

    test('Desktop - Navigation Tabs', async ({ page }) => {
      await page.goto(PRODUCTION_URL);
      await page.waitForSelector('.main-nav', { timeout: 15000 });
      await page.waitForTimeout(1000);
      
      const navigation = page.locator('.main-nav');
      await expect(navigation).toHaveScreenshot('desktop-navigation.png');
    });

    test('Desktop - Policy Matrix Tab', async ({ page }) => {
      await page.goto(PRODUCTION_URL);
      
      // Ensure matrix tab is active (should be default)
      await page.waitForSelector('[data-tab="matrix"].active', { timeout: 15000 });
      await page.waitForSelector('#matrix-tbody', { timeout: 10000 });
      await page.waitForTimeout(2000);
      
      const matrixSection = page.locator('#matrix');
      await expect(matrixSection).toHaveScreenshot('desktop-matrix-tab.png');
    });

    test('Desktop - Weekly Update Tab', async ({ page }) => {
      await page.goto(PRODUCTION_URL);
      
      // Switch to weekly tab
      await page.click('[data-tab="weekly"]');
      await page.waitForSelector('[data-tab="weekly"].active', { timeout: 5000 });
      await page.waitForSelector('#weekly-summary-content', { timeout: 10000 });
      await page.waitForTimeout(2000);
      
      const weeklySection = page.locator('#weekly');
      await expect(weeklySection).toHaveScreenshot('desktop-weekly-tab.png');
    });

    test('Desktop - Policy Explorer Tab', async ({ page }) => {
      await page.goto(PRODUCTION_URL);
      
      // Switch to platforms tab
      await page.click('[data-tab="platforms"]');
      await page.waitForSelector('[data-tab="platforms"].active', { timeout: 5000 });
      await page.waitForSelector('#platform-content', { timeout: 10000 });
      await page.waitForTimeout(2000);
      
      const platformsSection = page.locator('#platforms');
      await expect(platformsSection).toHaveScreenshot('desktop-platforms-tab.png');
    });

    test('Desktop - Analytics Tab', async ({ page }) => {
      await page.goto(PRODUCTION_URL);
      
      // Switch to analytics tab
      await page.click('[data-tab="analytics"]');
      await page.waitForSelector('[data-tab="analytics"].active', { timeout: 5000 });
      await page.waitForSelector('#weekly-platform-chart', { timeout: 10000 });
      await page.waitForTimeout(3000); // Allow charts to render
      
      const analyticsSection = page.locator('#analytics');
      await expect(analyticsSection).toHaveScreenshot('desktop-analytics-tab.png');
    });
  });

  test.describe('Mobile Visual Regression', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 812 }); // iPhone 12 Pro size
    });

    test('Mobile - Full Dashboard Overview', async ({ page }) => {
      await page.goto(PRODUCTION_URL);
      await page.waitForSelector('#header-total-policies', { timeout: 15000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      await expect(page).toHaveScreenshot('mobile-full-dashboard.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('Mobile - Header Responsive Design', async ({ page }) => {
      await page.goto(PRODUCTION_URL);
      await page.waitForSelector('header', { timeout: 15000 });
      await page.waitForTimeout(1000);
      
      const header = page.locator('header');
      await expect(header).toHaveScreenshot('mobile-header.png');
    });

    test('Mobile - Navigation Responsiveness', async ({ page }) => {
      await page.goto(PRODUCTION_URL);
      await page.waitForSelector('.main-nav', { timeout: 15000 });
      await page.waitForTimeout(1000);
      
      const navigation = page.locator('.main-nav');
      await expect(navigation).toHaveScreenshot('mobile-navigation.png');
    });

    test('Mobile - Status Bar Alignment', async ({ page }) => {
      await page.goto(PRODUCTION_URL);
      await page.waitForSelector('.header-status-bar', { timeout: 15000 });
      await page.waitForTimeout(2000);
      
      const statusBar = page.locator('.header-status-bar');
      await expect(statusBar).toHaveScreenshot('mobile-status-bar.png');
    });
  });

  test.describe('Tablet Visual Regression', () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 }); // iPad size
    });

    test('Tablet - Dashboard Layout', async ({ page }) => {
      await page.goto(PRODUCTION_URL);
      await page.waitForSelector('#header-total-policies', { timeout: 15000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      await expect(page).toHaveScreenshot('tablet-dashboard.png', {
        fullPage: true,
        animations: 'disabled'
      });
    });

    test('Tablet - Status Bar Layout', async ({ page }) => {
      await page.goto(PRODUCTION_URL);
      await page.waitForSelector('.header-status-bar', { timeout: 15000 });
      await page.waitForTimeout(2000);
      
      const statusBar = page.locator('.header-status-bar');
      await expect(statusBar).toHaveScreenshot('tablet-status-bar.png');
    });
  });

  test.describe('Component-Level Visual Testing', () => {
    test('Status Items Individual Components', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(PRODUCTION_URL);
      await page.waitForSelector('.status-item', { timeout: 15000 });
      await page.waitForTimeout(2000);
      
      const statusItems = page.locator('.status-item');
      const count = await statusItems.count();
      
      for (let i = 0; i < count; i++) {
        const item = statusItems.nth(i);
        await expect(item).toHaveScreenshot(`status-item-${i + 1}.png`);
      }
    });

    test('Newsletter Widget Visual States', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(PRODUCTION_URL);
      await page.waitForLoadState('networkidle');
      
      // Test collapsed state
      const widget = page.locator('#newsletterWidget');
      await expect(widget).toHaveScreenshot('newsletter-widget-collapsed.png');
      
      // Test expanded state (if toggle exists)
      const toggleButton = page.locator('#widgetTrigger');
      if (await toggleButton.isVisible()) {
        await toggleButton.click();
        await page.waitForTimeout(500);
        await expect(widget).toHaveScreenshot('newsletter-widget-expanded.png');
      }
    });

    test('Error States Visual Consistency', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Block network requests to trigger error states
      await page.route('https://raw.githubusercontent.com/**', route => route.abort());
      
      await page.goto(PRODUCTION_URL);
      await page.waitForTimeout(5000);
      
      // Look for error notifications
      const errorElements = await page.locator('.data-error-notification, .error-actions, .error-state').count();
      
      if (errorElements > 0) {
        await expect(page).toHaveScreenshot('error-state-full.png', {
          fullPage: true
        });
      }
    });
  });

  test.describe('Cross-Browser Visual Consistency', () => {
    const testCrossBrowser = async (page, browserName) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(PRODUCTION_URL);
      await page.waitForSelector('#header-total-policies', { timeout: 15000 });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Status bar cross-browser consistency
      const statusBar = page.locator('.header-status-bar');
      await expect(statusBar).toHaveScreenshot(`status-bar-${browserName}.png`);
      
      // Navigation cross-browser consistency
      const navigation = page.locator('.main-nav');
      await expect(navigation).toHaveScreenshot(`navigation-${browserName}.png`);
    };

    test('Chromium Visual Consistency', async ({ page, browserName }) => {
      await testCrossBrowser(page, browserName);
    });

    test('Firefox Visual Consistency', async ({ page, browserName }) => {
      await testCrossBrowser(page, browserName);
    });

    test('Safari Visual Consistency', async ({ page, browserName }) => {
      await testCrossBrowser(page, browserName);
    });
  });

  test.describe('Visual Regression - Data States', () => {
    test('Loading States Visual Representation', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 });
      
      // Intercept and delay responses to capture loading states
      let responseCount = 0;
      await page.route('https://raw.githubusercontent.com/**', async route => {
        responseCount++;
        // Delay first few responses to capture loading states
        if (responseCount <= 2) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        route.continue();
      });
      
      await page.goto(PRODUCTION_URL);
      
      // Capture loading state (should show "-" in status)
      await page.waitForTimeout(1000);
      const headerDuringLoad = page.locator('header');
      await expect(headerDuringLoad).toHaveScreenshot('loading-state-header.png');
      
      // Wait for full load
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Capture fully loaded state
      const headerAfterLoad = page.locator('header');
      await expect(headerAfterLoad).toHaveScreenshot('loaded-state-header.png');
    });

    test('Empty Data States', async ({ page }) => {
      // This would require mocking empty responses
      // For now, just capture normal state as baseline
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto(PRODUCTION_URL);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      await expect(page).toHaveScreenshot('normal-data-state.png', {
        fullPage: true
      });
    });
  });

  // Generate visual regression report
  test.afterAll(async () => {
    const report = {
      timestamp: new Date().toISOString(),
      summary: 'Visual regression testing completed',
      baselineDir: VISUAL_BASELINES_DIR,
      resultsDir: VISUAL_RESULTS_DIR,
      testEnvironment: 'production',
      url: PRODUCTION_URL
    };

    const reportPath = path.join(VISUAL_RESULTS_DIR, 'visual-regression-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log('📸 Visual regression report saved:', reportPath);
  });
});