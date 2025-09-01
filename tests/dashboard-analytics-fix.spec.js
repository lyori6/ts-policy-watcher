const { test, expect } = require('@playwright/test');
const path = require('path');

// Test configuration
const DASHBOARD_PATH = path.join(__dirname, '..', 'dashboard', 'index.html');
const TEST_SCREENSHOTS_DIR = path.join(__dirname, '..', 'visual_regression_tests');

test.describe('Dashboard Analytics Chart Fix', () => {
  let page;
  
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    
    // Load the dashboard HTML file directly
    await page.goto(`file://${DASHBOARD_PATH}`);
    
    // Wait for the page to fully load
    await page.waitForLoadState('domcontentloaded');
    
    // Wait a bit more for any dynamic content
    await page.waitForTimeout(2000);
  });

  test('Analytics Tab - Before Fix - Document Current Behavior', async () => {
    console.log('📸 Capturing current analytics behavior before fix...');
    
    // Navigate to analytics tab
    await page.click('[data-tab="analytics"]');
    await page.waitForTimeout(1000);
    
    // Wait for charts to load
    await page.waitForSelector('#weekly-platform-chart', { timeout: 5000 });
    
    // Take full page screenshot
    await page.screenshot({ 
      path: `${TEST_SCREENSHOTS_DIR}/analytics_before_fix_desktop.png`,
      fullPage: true 
    });
    
    // Take mobile viewport screenshot
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: `${TEST_SCREENSHOTS_DIR}/analytics_before_fix_mobile.png`,
      fullPage: true 
    });
    
    // Take tablet viewport screenshot  
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: `${TEST_SCREENSHOTS_DIR}/analytics_before_fix_tablet.png`,
      fullPage: true 
    });
    
    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    
    // Extract current chart data for validation
    const chartData = await page.evaluate(() => {
      // Try to access the dashboard data if available
      if (window.dashboard && window.dashboard.weeklySummariesData) {
        const weeks = Object.keys(window.dashboard.weeklySummariesData)
          .filter(k => !k.startsWith('_'));
        
        let totalChanges = 0;
        let totalUniquePolicies = 0;
        let weekDetails = [];
        
        weeks.forEach(weekKey => {
          const week = window.dashboard.weeklySummariesData[weekKey];
          if (week && week.changed_policies) {
            const weekChanges = week.changed_policies.length;
            const uniquePolicies = new Set(week.changed_policies.map(p => p.policy_key)).size;
            
            totalChanges += weekChanges;
            totalUniquePolicies += uniquePolicies;
            
            weekDetails.push({
              week: weekKey,
              totalChanges: weekChanges,
              uniquePolicies: uniquePolicies,
              difference: weekChanges - uniquePolicies
            });
          }
        });
        
        return {
          totalWeeks: weeks.length,
          totalChanges,
          totalUniquePolicies,
          accumulationDifference: totalChanges - totalUniquePolicies,
          weekDetails
        };
      }
      return null;
    });
    
    console.log('📊 Current Chart Data Analysis:', JSON.stringify(chartData, null, 2));
    
    // Log the accumulation issue if found
    if (chartData && chartData.accumulationDifference > 0) {
      console.log(`⚠️  ACCUMULATION DETECTED: ${chartData.accumulationDifference} extra changes due to duplicate commits`);
    }
  });

  test('Analytics Tab - Test All Functionality', async () => {
    console.log('🧪 Testing analytics tab functionality...');
    
    // Test tab navigation
    await page.click('[data-tab="analytics"]');
    await page.waitForTimeout(1000);
    
    // Check if analytics section is visible
    const analyticsSection = await page.locator('#analytics').isVisible();
    expect(analyticsSection).toBe(true);
    
    // Check for chart containers
    const weeklyChart = await page.locator('#weekly-platform-chart').isVisible();
    const platformChart = await page.locator('#platform-activity-chart').isVisible();
    
    console.log(`📈 Weekly Platform Chart visible: ${weeklyChart}`);
    console.log(`📊 Platform Activity Chart visible: ${platformChart}`);
    
    // Test responsive behavior
    const viewports = [
      { name: 'desktop', width: 1280, height: 720 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 667 }
    ];
    
    for (const viewport of viewports) {
      console.log(`📱 Testing ${viewport.name} viewport...`);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      // Check if charts are still visible and properly sized
      const chartVisible = await page.locator('#weekly-platform-chart').isVisible();
      expect(chartVisible).toBe(true);
    }
    
    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Other Tabs - Ensure No Regression', async () => {
    console.log('🔍 Testing other tabs for regression...');
    
    const tabs = ['matrix', 'platforms', 'weekly'];
    
    for (const tab of tabs) {
      console.log(`🗂️  Testing ${tab} tab...`);
      await page.click(`[data-tab="${tab}"]`);
      await page.waitForTimeout(1000);
      
      // Check if tab content is visible
      const tabContent = await page.locator(`#${tab}`).isVisible();
      expect(tabContent).toBe(true);
      
      // Take screenshot for visual regression
      await page.screenshot({ 
        path: `${TEST_SCREENSHOTS_DIR}/${tab}_functionality_check.png`,
        fullPage: true 
      });
    }
  });

  test('Data Loading and Error Handling', async () => {
    console.log('🔄 Testing data loading and error scenarios...');
    
    // Navigate to analytics
    await page.click('[data-tab="analytics"]');
    await page.waitForTimeout(1000);
    
    // Check for loading states or error messages
    const errorElements = await page.locator('.error, .loading, .chart-placeholder').count();
    console.log(`📋 Found ${errorElements} loading/error elements`);
    
    // Test JavaScript console for any errors
    const consoleMessages = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleMessages.push(msg.text());
      }
    });
    
    // Refresh and check for errors
    await page.reload();
    await page.waitForTimeout(2000);
    
    if (consoleMessages.length > 0) {
      console.log('❌ JavaScript errors detected:', consoleMessages);
    } else {
      console.log('✅ No JavaScript errors detected');
    }
  });

  test.afterEach(async () => {
    if (page) {
      await page.close();
    }
  });
});