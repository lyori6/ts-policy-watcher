const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const PRODUCTION_URL = 'https://ts-policy-watcher.vercel.app';
const TEST_RESULTS_DIR = path.join(__dirname, '..', 'test-results');
const DEBUG_SCREENSHOTS_DIR = path.join(TEST_RESULTS_DIR, 'status-debug');

// Ensure directories exist
[TEST_RESULTS_DIR, DEBUG_SCREENSHOTS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

test.describe('Status Bar Debug - "0 0 0" Countdown Issue', () => {
  test.describe.configure({ mode: 'serial' }); // Run these tests sequentially for better debugging

  test('Debug: Countdown Timer Logic and Data Loading Race Condition', async ({ page }) => {
    const debugResults = {
      timestamp: new Date().toISOString(),
      testName: 'Countdown Timer Debug',
      phases: [],
      dataLoadingTimeline: [],
      timerBehavior: [],
      javascriptErrors: [],
      codeAnalysis: {}
    };

    // Enhanced console monitoring
    page.on('console', msg => {
      const message = {
        type: msg.type(),
        text: msg.text(),
        timestamp: new Date().toISOString()
      };
      
      if (msg.type() === 'error') {
        debugResults.javascriptErrors.push(message);
      }
      
      // Capture specific dashboard debug messages
      if (msg.text().includes('🌐 Dashboard using branch:') || 
          msg.text().includes('Data loaded successfully:') ||
          msg.text().includes('🔍 Matrix rendering debug:')) {
        debugResults.dataLoadingTimeline.push(message);
        console.log('📋 Debug Message:', msg.text());
      }
    });

    try {
      console.log('🐛 Starting status bar countdown debug...');
      
      // Phase 1: Initial page load with detailed monitoring
      debugResults.phases.push({ phase: 'initial_load', startTime: Date.now() });
      
      await page.goto(PRODUCTION_URL, { waitUntil: 'domcontentloaded' });
      
      // Immediately check initial status values
      const initialStatus = await page.evaluate(() => {
        const statusNumber = document.getElementById('header-status-number');
        const statusLabel = document.getElementById('header-status-label');
        return {
          statusNumber: statusNumber ? statusNumber.textContent : 'not found',
          statusLabel: statusLabel ? statusLabel.textContent : 'not found',
          dashboardInstance: !!window.dashboardInstance,
          runData: window.dashboardInstance?.runData?.length || 0,
          runLogData: window.dashboardInstance?.runLogData?.length || 0
        };
      });
      
      debugResults.phases[0].initialStatus = initialStatus;
      console.log('📊 Initial Status (DOM loaded):', initialStatus);
      
      // Phase 2: Wait for network idle and check again
      debugResults.phases.push({ phase: 'network_idle', startTime: Date.now() });
      
      await page.waitForLoadState('networkidle');
      
      const afterNetworkStatus = await page.evaluate(() => {
        const statusNumber = document.getElementById('header-status-number');
        const statusLabel = document.getElementById('header-status-label');
        return {
          statusNumber: statusNumber ? statusNumber.textContent : 'not found',
          statusLabel: statusLabel ? statusLabel.textContent : 'not found',
          dashboardInstance: !!window.dashboardInstance,
          runData: window.dashboardInstance?.runData?.length || 0,
          runLogData: window.dashboardInstance?.runLogData?.length || 0
        };
      });
      
      debugResults.phases[1].afterNetworkStatus = afterNetworkStatus;
      console.log('📊 Status (after network idle):', afterNetworkStatus);
      
      // Phase 3: Deep dive into the JavaScript state
      const codeAnalysis = await page.evaluate(() => {
        const dashboard = window.dashboardInstance;
        if (!dashboard) return { error: 'Dashboard instance not found' };
        
        return {
          // Check the data containers (this is likely the bug source)
          runData: {
            exists: !!dashboard.runData,
            length: dashboard.runData?.length || 0,
            firstItem: dashboard.runData?.[0] ? {
              timestamp_utc: dashboard.runData[0].timestamp_utc,
              status: dashboard.runData[0].status
            } : null
          },
          runLogData: {
            exists: !!dashboard.runLogData,
            length: dashboard.runLogData?.length || 0,
            firstItem: dashboard.runLogData?.[0] ? {
              timestamp_utc: dashboard.runLogData[0].timestamp_utc,
              status: dashboard.runLogData[0].status
            } : null
          },
          // Check timer state
          countdownTimer: {
            exists: !!dashboard.countdownTimer,
            active: dashboard.countdownTimer !== null
          },
          // Test the problematic functions directly
          calculateSecondsResult: (() => {
            try {
              return dashboard.calculateSecondsUntilNextCheck();
            } catch (error) {
              return { error: error.message };
            }
          })(),
          formatCountdownResult: (() => {
            try {
              return dashboard.formatCountdownDisplay(0);
            } catch (error) {
              return { error: error.message };
            }
          })()
        };
      });
      
      debugResults.codeAnalysis = codeAnalysis;
      console.log('🔍 Code Analysis:', JSON.stringify(codeAnalysis, null, 2));
      
      // Phase 4: Monitor timer updates over time
      console.log('⏱️ Monitoring timer behavior for 30 seconds...');
      debugResults.phases.push({ phase: 'timer_monitoring', startTime: Date.now() });
      
      const monitoringStartTime = Date.now();
      const monitoringDuration = 30000; // 30 seconds
      
      while (Date.now() - monitoringStartTime < monitoringDuration) {
        const currentStatus = await page.evaluate(() => {
          const statusNumber = document.getElementById('header-status-number');
          const statusLabel = document.getElementById('header-status-label');
          const dashboard = window.dashboardInstance;
          
          return {
            timestamp: Date.now(),
            statusNumber: statusNumber ? statusNumber.textContent : 'not found',
            statusLabel: statusLabel ? statusLabel.textContent : 'not found',
            calculateSecondsResult: dashboard ? (() => {
              try {
                return dashboard.calculateSecondsUntilNextCheck();
              } catch (error) {
                return { error: error.message };
              }
            })() : 'no dashboard'
          };
        });
        
        debugResults.timerBehavior.push(currentStatus);
        
        // Log if we see the "0 0 0" issue
        if (currentStatus.statusNumber === '0:00' || 
            currentStatus.statusNumber === '0' ||
            currentStatus.statusNumber.includes('0 0 0')) {
          console.log('🐛 BUG DETECTED at', new Date().toISOString(), ':', currentStatus);
        }
        
        await page.waitForTimeout(2000); // Check every 2 seconds
      }
      
      // Phase 5: Test the fix by correcting the data reference
      console.log('🔧 Testing potential fix...');
      const fixTestResult = await page.evaluate(() => {
        const dashboard = window.dashboardInstance;
        if (!dashboard) return { error: 'No dashboard instance' };
        
        // The bug appears to be that calculateSecondsUntilNextCheck uses this.runData
        // but the constructor initializes this.runLogData. Let's test the fix:
        const originalRunData = dashboard.runData;
        
        // Apply the fix
        dashboard.runData = dashboard.runLogData;
        
        try {
          const fixedSeconds = dashboard.calculateSecondsUntilNextCheck();
          const fixedDisplay = dashboard.formatCountdownDisplay(fixedSeconds);
          
          return {
            originalRunDataLength: originalRunData ? originalRunData.length : 0,
            fixedRunDataLength: dashboard.runData ? dashboard.runData.length : 0,
            fixedSeconds: fixedSeconds,
            fixedDisplay: fixedDisplay,
            success: true
          };
        } catch (error) {
          return {
            error: error.message,
            success: false
          };
        }
      });
      
      debugResults.fixTestResult = fixTestResult;
      console.log('🔧 Fix Test Result:', fixTestResult);
      
      // Take final screenshot
      await page.screenshot({ 
        path: path.join(DEBUG_SCREENSHOTS_DIR, 'countdown-debug-final.png'),
        fullPage: true 
      });
      
      // Save comprehensive debug results
      const debugFile = path.join(TEST_RESULTS_DIR, 'countdown-debug-analysis.json');
      fs.writeFileSync(debugFile, JSON.stringify(debugResults, null, 2));
      
      console.log('📋 Debug analysis complete. Results saved to:', debugFile);
      
      // Test conclusion
      const hasCountdownIssue = debugResults.timerBehavior.some(entry => 
        entry.statusNumber === '0:00' || 
        entry.statusNumber === '0' ||
        entry.statusNumber.includes('0 0 0')
      );
      
      if (hasCountdownIssue) {
        console.log('🐛 CONFIRMED: Countdown timer issue reproduced');
      }
      
      // Check if the fix would work
      if (fixTestResult.success && fixTestResult.fixedSeconds > 0) {
        console.log('✅ SOLUTION IDENTIFIED: runData vs runLogData reference issue');
      }
      
    } catch (error) {
      debugResults.testError = {
        message: error.message,
        stack: error.stack
      };
      
      // Save results even on failure
      const debugFile = path.join(TEST_RESULTS_DIR, 'countdown-debug-analysis.json');
      fs.writeFileSync(debugFile, JSON.stringify(debugResults, null, 2));
      
      console.error('❌ Debug test failed:', error.message);
      throw error;
    }
  });

  test('Debug: Data Loading Timing Analysis', async ({ page }) => {
    const timingResults = {
      timestamp: new Date().toISOString(),
      loadingPhases: [],
      networkRequests: [],
      domUpdates: []
    };

    // Monitor network requests
    page.on('response', response => {
      if (response.url().includes('raw.githubusercontent.com')) {
        timingResults.networkRequests.push({
          url: response.url(),
          status: response.status(),
          timestamp: Date.now(),
          contentType: response.headers()['content-type'],
          size: response.headers()['content-length']
        });
        console.log('📡 GitHub API Call:', response.url(), response.status());
      }
    });

    // Monitor DOM changes to status elements
    await page.goto(PRODUCTION_URL);
    
    // Set up mutation observer for status elements
    await page.evaluate(() => {
      window.statusMutations = [];
      
      const statusNumber = document.getElementById('header-status-number');
      const statusLabel = document.getElementById('header-status-label');
      
      if (statusNumber) {
        const observer = new MutationObserver(mutations => {
          mutations.forEach(mutation => {
            if (mutation.type === 'childList' || mutation.type === 'characterData') {
              window.statusMutations.push({
                element: 'status-number',
                timestamp: Date.now(),
                newValue: statusNumber.textContent,
                mutationType: mutation.type
              });
            }
          });
        });
        
        observer.observe(statusNumber, { 
          childList: true, 
          subtree: true, 
          characterData: true 
        });
      }
    });

    // Wait and collect timing data
    await page.waitForTimeout(10000);

    const mutationData = await page.evaluate(() => window.statusMutations || []);
    timingResults.domUpdates = mutationData;

    console.log('📊 Timing Analysis:');
    console.log('   Network Requests:', timingResults.networkRequests.length);
    console.log('   DOM Updates:', timingResults.domUpdates.length);

    // Save timing analysis
    const timingFile = path.join(TEST_RESULTS_DIR, 'data-loading-timing.json');
    fs.writeFileSync(timingFile, JSON.stringify(timingResults, null, 2));
  });

  test('Debug: Cross-Browser Status Display Consistency', async ({ page, browserName }) => {
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);

    const statusInfo = await page.evaluate(() => {
      const statusNumber = document.getElementById('header-status-number');
      const statusLabel = document.getElementById('header-status-label');
      
      return {
        browser: navigator.userAgent,
        statusNumber: statusNumber ? statusNumber.textContent : null,
        statusLabel: statusLabel ? statusLabel.textContent : null,
        computedStyles: {
          statusNumber: statusNumber ? window.getComputedStyle(statusNumber) : null,
          statusLabel: statusLabel ? window.getComputedStyle(statusLabel) : null
        }
      };
    });

    // Take browser-specific screenshot
    await page.screenshot({ 
      path: path.join(DEBUG_SCREENSHOTS_DIR, `status-display-${browserName}.png`),
      clip: { x: 0, y: 0, width: 1200, height: 200 } // Focus on header area
    });

    console.log(`📱 ${browserName} Status:`, statusInfo.statusNumber, '-', statusInfo.statusLabel);

    // Save browser-specific results
    const browserFile = path.join(TEST_RESULTS_DIR, `status-consistency-${browserName}.json`);
    fs.writeFileSync(browserFile, JSON.stringify({
      browser: browserName,
      timestamp: new Date().toISOString(),
      statusInfo
    }, null, 2));
  });
});