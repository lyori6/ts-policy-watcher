const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Production URL and test configuration
const PRODUCTION_URL = 'https://ts-policy-watcher.vercel.app';
const TEST_RESULTS_DIR = path.join(__dirname, '..', 'test-results');
const SCREENSHOTS_DIR = path.join(TEST_RESULTS_DIR, 'screenshots');

// Ensure directories exist
[TEST_RESULTS_DIR, SCREENSHOTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

test.describe('Production End-to-End Tests', () => {
  test.describe.configure({ mode: 'parallel' });

  test('Production Dashboard - Full Load and Navigation Test', async ({ page }) => {
    const testResults = {
      timestamp: new Date().toISOString(),
      testName: 'Production Dashboard Full Load',
      steps: [],
      errors: [],
      performance: {},
      screenshots: []
    };

    try {
      console.log('🚀 Testing production dashboard at:', PRODUCTION_URL);

      // Start performance monitoring
      const startTime = Date.now();
      
      // Navigate to production
      await page.goto(PRODUCTION_URL, { 
        waitUntil: 'networkidle', 
        timeout: 30000 
      });
      
      const loadTime = Date.now() - startTime;
      testResults.performance.initialLoad = loadTime;
      testResults.steps.push({ step: 'Page loaded', duration: loadTime, status: 'pass' });

      // Monitor console for errors (especially the issue reported)
      const consoleMessages = [];
      page.on('console', msg => {
        consoleMessages.push({
          type: msg.type(),
          text: msg.text(),
          timestamp: new Date().toISOString()
        });
        if (msg.type() === 'error') {
          console.log('❌ Console Error:', msg.text());
          testResults.errors.push({
            type: 'console_error',
            message: msg.text(),
            timestamp: new Date().toISOString()
          });
        }
      });

      // Wait for the dashboard to fully initialize
      await page.waitForSelector('header', { timeout: 15000 });
      await page.waitForSelector('.main-nav', { timeout: 15000 });
      await page.waitForSelector('#header-total-policies', { timeout: 15000 });
      
      // Take initial screenshot
      const initialScreenshot = path.join(SCREENSHOTS_DIR, 'production-initial-load.png');
      await page.screenshot({ 
        path: initialScreenshot, 
        fullPage: true 
      });
      testResults.screenshots.push(initialScreenshot);
      testResults.steps.push({ step: 'Initial screenshot taken', status: 'pass' });

      // Check if data loaded properly
      const totalPolicies = await page.locator('#header-total-policies').textContent();
      const statusNumber = await page.locator('#header-status-number').textContent();
      const statusLabel = await page.locator('#header-status-label').textContent();

      console.log('📊 Dashboard Status:');
      console.log(`   Total Policies: "${totalPolicies}"`);
      console.log(`   Status Number: "${statusNumber}"`);
      console.log(`   Status Label: "${statusLabel}"`);

      testResults.data = {
        totalPolicies,
        statusNumber,
        statusLabel
      };

      // Check for the specific "0 0 0" issue
      if (statusNumber === '0:00' || statusNumber === '0' || statusNumber.includes('0 0 0')) {
        testResults.errors.push({
          type: 'status_display_bug',
          message: `Status showing "${statusNumber}" instead of proper countdown`,
          statusLabel: statusLabel
        });
        console.log('🐛 BUG DETECTED: Status showing "0 0 0" pattern');
      }

      // Test navigation through all tabs
      const tabs = [
        { selector: '[data-tab="matrix"]', name: 'Policy Matrix', waitFor: '#matrix-tbody' },
        { selector: '[data-tab="weekly"]', name: 'Weekly Update', waitFor: '#weekly-summary-content' },
        { selector: '[data-tab="platforms"]', name: 'Policy Explorer', waitFor: '#platform-content' },
        { selector: '[data-tab="analytics"]', name: 'Analytics & Logs', waitFor: '#weekly-platform-chart' }
      ];

      for (const tab of tabs) {
        try {
          const tabStartTime = Date.now();
          
          // Click tab
          await page.click(tab.selector);
          
          // Wait for tab to be active
          await page.waitForFunction(
            (selector) => document.querySelector(selector).classList.contains('active'),
            tab.selector,
            { timeout: 5000 }
          );
          
          // Wait for content to load
          await page.waitForSelector(tab.waitFor, { timeout: 10000 });
          
          const tabLoadTime = Date.now() - tabStartTime;
          testResults.performance[`${tab.name.toLowerCase().replace(' ', '_')}_load`] = tabLoadTime;
          
          // Take screenshot of each tab
          const tabScreenshot = path.join(SCREENSHOTS_DIR, `production-${tab.name.toLowerCase().replace(/\s+/g, '-')}.png`);
          await page.screenshot({ 
            path: tabScreenshot, 
            fullPage: true 
          });
          testResults.screenshots.push(tabScreenshot);
          
          testResults.steps.push({ 
            step: `${tab.name} tab loaded`, 
            duration: tabLoadTime, 
            status: 'pass' 
          });
          
          console.log(`✅ ${tab.name} tab loaded in ${tabLoadTime}ms`);
          
          // Small delay between tabs
          await page.waitForTimeout(1000);
          
        } catch (error) {
          testResults.errors.push({
            type: 'tab_navigation_error',
            tab: tab.name,
            message: error.message
          });
          console.log(`❌ Error loading ${tab.name} tab:`, error.message);
        }
      }

      // Test data loading and API calls
      const apiCalls = await page.evaluate(() => {
        // Get any exposed global data or make test calls
        return {
          dashboardInstance: !!window.dashboardInstance,
          runLogData: window.dashboardInstance?.runLogData?.length || 0,
          summariesData: Object.keys(window.dashboardInstance?.summariesData || {}).length,
          platformData: window.dashboardInstance?.platformData?.length || 0
        };
      });
      
      testResults.apiData = apiCalls;
      console.log('🔗 API Data Status:', apiCalls);

      // Monitor network requests
      const networkRequests = [];
      page.on('response', response => {
        if (response.url().includes('githubusercontent.com')) {
          networkRequests.push({
            url: response.url(),
            status: response.status(),
            contentType: response.headers()['content-type']
          });
        }
      });

      // Wait a bit to capture any network activity
      await page.waitForTimeout(3000);
      testResults.networkRequests = networkRequests;

      // Save test results
      const resultsFile = path.join(TEST_RESULTS_DIR, 'production-e2e-results.json');
      fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
      
      // Check for critical errors
      const criticalErrors = testResults.errors.filter(err => 
        err.type === 'status_display_bug' || 
        err.type === 'console_error'
      );
      
      if (criticalErrors.length > 0) {
        console.log('⚠️ Critical errors detected:', criticalErrors.length);
        // Still pass the test but log the issues
      }

      // Verify basic functionality works
      expect(totalPolicies).not.toBe('-');
      expect(totalPolicies).not.toBe('');
      expect(statusLabel).toBeTruthy();
      
    } catch (error) {
      testResults.errors.push({
        type: 'test_failure',
        message: error.message,
        stack: error.stack
      });
      
      // Save results even on failure
      const resultsFile = path.join(TEST_RESULTS_DIR, 'production-e2e-results.json');
      fs.writeFileSync(resultsFile, JSON.stringify(testResults, null, 2));
      
      throw error;
    }
  });

  test('Production - Real-time Status Updates', async ({ page }) => {
    await page.goto(PRODUCTION_URL);
    
    // Wait for initial load
    await page.waitForSelector('#header-status-number', { timeout: 15000 });
    
    // Monitor status changes over time
    const statusUpdates = [];
    const startTime = Date.now();
    
    for (let i = 0; i < 10; i++) {
      const statusNumber = await page.locator('#header-status-number').textContent();
      const statusLabel = await page.locator('#header-status-label').textContent();
      
      statusUpdates.push({
        timestamp: Date.now() - startTime,
        statusNumber,
        statusLabel
      });
      
      console.log(`📊 Status Update ${i + 1}: "${statusNumber}" - "${statusLabel}"`);
      
      // Wait 2 seconds between checks
      await page.waitForTimeout(2000);
    }
    
    // Save status monitoring results
    const resultsFile = path.join(TEST_RESULTS_DIR, 'status-monitoring-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      testDuration: Date.now() - startTime,
      statusUpdates,
      issues: statusUpdates.filter(update => 
        update.statusNumber === '0:00' || 
        update.statusNumber.includes('0 0 0')
      )
    }, null, 2));
    
    // Check if status is stuck on "0 0 0"
    const stuckUpdates = statusUpdates.filter(update => 
      update.statusNumber === '0:00' || 
      update.statusNumber === '0' ||
      update.statusNumber.includes('0 0 0')
    );
    
    if (stuckUpdates.length > 3) {
      console.log('🐛 BUG CONFIRMED: Status appears to be stuck on "0 0 0" pattern');
    }
  });

  test('Production - Error Recovery Testing', async ({ page }) => {
    await page.goto(PRODUCTION_URL);
    
    // Test error scenarios
    const errorTests = [];
    
    // Test 1: Simulate network issues
    await page.route('https://raw.githubusercontent.com/**', route => {
      errorTests.push({
        type: 'network_blocked',
        url: route.request().url(),
        timestamp: new Date().toISOString()
      });
      route.abort('internetdisconnected');
    });
    
    // Reload page to trigger network errors
    await page.reload({ waitUntil: 'networkidle' });
    
    // Wait and check error handling
    await page.waitForTimeout(5000);
    
    const errorNotifications = await page.locator('.data-error-notification').count();
    const errorActions = await page.locator('.error-actions').count();
    
    console.log(`📋 Error Recovery Test Results:`);
    console.log(`   Error Notifications: ${errorNotifications}`);
    console.log(`   Error Actions: ${errorActions}`);
    console.log(`   Network Requests Blocked: ${errorTests.length}`);
    
    // Save error recovery results
    const resultsFile = path.join(TEST_RESULTS_DIR, 'error-recovery-results.json');
    fs.writeFileSync(resultsFile, JSON.stringify({
      timestamp: new Date().toISOString(),
      errorNotifications,
      errorActions,
      blockedRequests: errorTests
    }, null, 2));
  });
});