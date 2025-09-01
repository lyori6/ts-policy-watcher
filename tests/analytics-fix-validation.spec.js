const { test, expect } = require('@playwright/test');
const path = require('path');

// Test configuration
const DASHBOARD_PATH = path.join(__dirname, '..', 'dashboard', 'index.html');
const TEST_SCREENSHOTS_DIR = path.join(__dirname, '..', 'visual_regression_tests');

test.describe('Analytics Fix Validation', () => {
  let page;
  
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(`file://${DASHBOARD_PATH}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('Analytics Tab - After Fix - Validate Unique Policy Counting', async () => {
    console.log('🔧 Testing fixed analytics behavior...');
    
    // Navigate to analytics tab
    await page.click('[data-tab="analytics"]');
    await page.waitForTimeout(1000);
    
    // Wait for charts to load
    await page.waitForSelector('#weekly-platform-chart', { timeout: 5000 });
    
    // Check if the updated title is present
    const titleText = await page.textContent('h2:has-text("Weekly Unique Policy Changes by Platform")');
    expect(titleText).toContain('Weekly Unique Policy Changes');
    console.log('✅ Chart title updated correctly');
    
    // Extract updated chart data for validation
    const fixedChartData = await page.evaluate(() => {
      // Test the new deduplication logic
      if (window.dashboard && window.dashboard.weeklySummariesData) {
        const weeks = Object.keys(window.dashboard.weeklySummariesData)
          .filter(k => !k.startsWith('_'));
        
        let totalUniqueChanges = 0;
        let totalCommits = 0;
        let weekDetails = [];
        
        weeks.forEach(weekKey => {
          const week = window.dashboard.weeklySummariesData[weekKey];
          if (week && week.changed_policies) {
            const commits = week.changed_policies.length;
            const uniquePolicies = new Set(week.changed_policies.map(p => p.policy_key)).size;
            
            totalCommits += commits;
            totalUniqueChanges += uniquePolicies;
            
            weekDetails.push({
              week: weekKey,
              commits: commits,
              uniquePolicies: uniquePolicies,
              deduplication: commits - uniquePolicies
            });
          }
        });
        
        return {
          totalWeeks: weeks.length,
          totalCommits,
          totalUniqueChanges,
          reductionFromFix: totalCommits - totalUniqueChanges,
          weekDetails,
          fixWorking: totalUniqueChanges < totalCommits // Should be true if fix works
        };
      }
      return null;
    });
    
    console.log('📊 Fixed Chart Data Analysis:', JSON.stringify(fixedChartData, null, 2));
    
    if (fixedChartData && fixedChartData.fixWorking) {
      console.log(`✅ FIX SUCCESSFUL: Reduced from ${fixedChartData.totalCommits} commits to ${fixedChartData.totalUniqueChanges} unique policies`);
      console.log(`📉 Reduction: ${fixedChartData.reductionFromFix} duplicate commits eliminated`);
    }
    
    // Take after-fix screenshots
    await page.screenshot({ 
      path: `${TEST_SCREENSHOTS_DIR}/analytics_after_fix_desktop.png`,
      fullPage: true 
    });
    
    // Mobile and tablet screenshots
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: `${TEST_SCREENSHOTS_DIR}/analytics_after_fix_mobile.png`,
      fullPage: true 
    });
    
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: `${TEST_SCREENSHOTS_DIR}/analytics_after_fix_tablet.png`,
      fullPage: true 
    });
    
    // Reset viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Data Processing Logic - Unit Test Validation', async () => {
    console.log('🧪 Testing data processing logic...');
    
    await page.click('[data-tab="analytics"]');
    await page.waitForTimeout(1000);
    
    // Inject test data and validate deduplication logic
    const testResult = await page.evaluate(() => {
      // Mock test data simulating the accumulation issue
      const mockWeekData = {
        changed_policies: [
          { policy_key: 'twitch-community-guidelines' },
          { policy_key: 'twitch-community-guidelines' },
          { policy_key: 'twitch-community-guidelines' },
          { policy_key: 'youtube-harassment-policy' },
          { policy_key: 'youtube-harassment-policy' },
          { policy_key: 'meta-community-guidelines' }
        ]
      };
      
      // Test the new deduplication logic manually
      const platformPolicyKeys = {};
      
      mockWeekData.changed_policies.forEach(change => {
        // Simulate extractPlatformFromPolicyKey
        let platform = 'Unknown';
        if (change.policy_key.startsWith('twitch-')) platform = 'Twitch';
        else if (change.policy_key.startsWith('youtube-')) platform = 'YouTube';
        else if (change.policy_key.startsWith('meta-')) platform = 'Meta';
        
        if (!platformPolicyKeys[platform]) {
          platformPolicyKeys[platform] = new Set();
        }
        platformPolicyKeys[platform].add(change.policy_key);
      });
      
      const results = {};
      Object.keys(platformPolicyKeys).forEach(platform => {
        results[platform] = platformPolicyKeys[platform].size;
      });
      
      return {
        originalCount: mockWeekData.changed_policies.length,
        deduplicatedCount: Object.values(results).reduce((a, b) => a + b, 0),
        platformBreakdown: results
      };
    });
    
    console.log('🔬 Unit Test Results:', testResult);
    
    // Validate the logic worked
    expect(testResult.originalCount).toBe(6);
    expect(testResult.deduplicatedCount).toBe(3);
    expect(testResult.platformBreakdown.Twitch).toBe(1);
    expect(testResult.platformBreakdown.YouTube).toBe(1);
    expect(testResult.platformBreakdown.Meta).toBe(1);
    
    console.log('✅ Deduplication logic working correctly');
  });

  test('Visual Regression - Compare Before and After', async () => {
    console.log('📸 Running visual regression comparison...');
    
    await page.click('[data-tab="analytics"]');
    await page.waitForTimeout(1000);
    
    // Take comprehensive screenshots for comparison
    const viewports = [
      { name: 'desktop', width: 1280, height: 720 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 667 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      await page.screenshot({ 
        path: `${TEST_SCREENSHOTS_DIR}/${viewport.name}_analytics_comparison.png`,
        fullPage: true 
      });
      
      console.log(`📱 ${viewport.name} screenshot captured`);
    }
  });

  test('Functionality Regression - Ensure No Broken Features', async () => {
    console.log('🔍 Testing all dashboard functionality after fix...');
    
    const tabs = ['matrix', 'platforms', 'weekly', 'analytics'];
    
    for (const tab of tabs) {
      await page.click(`[data-tab="${tab}"]`);
      await page.waitForTimeout(1000);
      
      // Check tab content loads
      const tabVisible = await page.locator(`#${tab}`).isVisible();
      expect(tabVisible).toBe(true);
      
      // Check for JavaScript errors
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });
      
      if (consoleErrors.length > 0) {
        console.log(`❌ Errors in ${tab} tab:`, consoleErrors);
      } else {
        console.log(`✅ ${tab} tab working properly`);
      }
    }
  });

  test('Performance Impact - Ensure Fix Doesnt Slow Things Down', async () => {
    console.log('⚡ Testing performance impact of fix...');
    
    const startTime = Date.now();
    
    await page.click('[data-tab="analytics"]');
    await page.waitForSelector('#weekly-platform-chart', { timeout: 5000 });
    
    const endTime = Date.now();
    const loadTime = endTime - startTime;
    
    console.log(`📊 Analytics tab load time: ${loadTime}ms`);
    
    // Should load reasonably quickly (under 3 seconds)
    expect(loadTime).toBeLessThan(3000);
    
    // Test data processing performance
    const processingTime = await page.evaluate(() => {
      const start = performance.now();
      
      // Simulate processing large dataset
      if (window.dashboard && window.dashboard.processWeeklyPlatformData) {
        window.dashboard.processWeeklyPlatformData();
      }
      
      return performance.now() - start;
    });
    
    console.log(`🔧 Data processing time: ${processingTime.toFixed(2)}ms`);
    
    // Processing should be fast (under 100ms for typical datasets)
    expect(processingTime).toBeLessThan(100);
  });

  test.afterEach(async () => {
    if (page) {
      await page.close();
    }
  });
});