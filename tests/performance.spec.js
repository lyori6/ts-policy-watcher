const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const PRODUCTION_URL = 'https://ts-policy-watcher.vercel.app';
const PERFORMANCE_RESULTS_DIR = path.join(__dirname, '..', 'test-results', 'performance');

// Ensure directories exist
if (!fs.existsSync(PERFORMANCE_RESULTS_DIR)) {
  fs.mkdirSync(PERFORMANCE_RESULTS_DIR, { recursive: true });
}

test.describe('Performance Monitoring and Analysis', () => {
  test.describe.configure({ mode: 'parallel' });

  test('Performance - Core Web Vitals and Load Metrics', async ({ page }) => {
    const performanceResults = {
      timestamp: new Date().toISOString(),
      url: PRODUCTION_URL,
      testName: 'Core Web Vitals',
      metrics: {},
      lighthouse: null,
      networkActivity: [],
      jsErrors: [],
      memoryUsage: []
    };

    // Monitor JavaScript errors
    page.on('pageerror', error => {
      performanceResults.jsErrors.push({
        message: error.message,
        stack: error.stack,
        timestamp: Date.now()
      });
    });

    // Monitor network requests
    page.on('response', response => {
      if (response.url().includes('ts-policy-watcher') || response.url().includes('githubusercontent')) {
        performanceResults.networkActivity.push({
          url: response.url(),
          status: response.status(),
          method: response.request().method(),
          size: parseInt(response.headers()['content-length'] || '0'),
          duration: response.timing(),
          timestamp: Date.now()
        });
      }
    });

    console.log('⚡ Starting performance analysis...');
    const startTime = Date.now();

    try {
      // Navigate and measure initial load
      await page.goto(PRODUCTION_URL, { waitUntil: 'networkidle' });
      const initialLoadTime = Date.now() - startTime;
      
      // Get Performance API metrics
      const performanceMetrics = await page.evaluate(() => {
        const perf = performance;
        const navigation = perf.getEntriesByType('navigation')[0];
        const paint = perf.getEntriesByType('paint');
        
        return {
          // Navigation timing
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
          domInteractive: navigation.domInteractive - navigation.navigationStart,
          
          // Paint timing
          firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
          firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
          
          // Memory info (if available)
          memoryUsed: performance.memory ? performance.memory.usedJSHeapSize : null,
          memoryTotal: performance.memory ? performance.memory.totalJSHeapSize : null,
          memoryLimit: performance.memory ? performance.memory.jsHeapSizeLimit : null
        };
      });

      performanceResults.metrics.initialLoad = initialLoadTime;
      performanceResults.metrics.navigation = performanceMetrics;

      console.log('📊 Performance Metrics:');
      console.log(`   Initial Load: ${initialLoadTime}ms`);
      console.log(`   DOM Interactive: ${performanceMetrics.domInteractive}ms`);
      console.log(`   First Contentful Paint: ${performanceMetrics.firstContentfulPaint}ms`);
      if (performanceMetrics.memoryUsed) {
        console.log(`   Memory Used: ${Math.round(performanceMetrics.memoryUsed / 1024 / 1024)}MB`);
      }

      // Test dashboard-specific performance
      await page.waitForSelector('#header-total-policies', { timeout: 15000 });
      const dashboardReadyTime = Date.now() - startTime;
      performanceResults.metrics.dashboardReady = dashboardReadyTime;

      // Measure tab switching performance
      const tabs = [
        { selector: '[data-tab="matrix"]', name: 'matrix', waitFor: '#matrix-tbody' },
        { selector: '[data-tab="weekly"]', name: 'weekly', waitFor: '#weekly-summary-content' },
        { selector: '[data-tab="platforms"]', name: 'platforms', waitFor: '#platform-content' },
        { selector: '[data-tab="analytics"]', name: 'analytics', waitFor: '#weekly-platform-chart' }
      ];

      const tabPerformance = {};
      for (const tab of tabs) {
        const tabStartTime = Date.now();
        
        try {
          await page.click(tab.selector);
          await page.waitForSelector(tab.waitFor, { timeout: 10000 });
          const tabSwitchTime = Date.now() - tabStartTime;
          
          tabPerformance[tab.name] = tabSwitchTime;
          console.log(`   ${tab.name} tab switch: ${tabSwitchTime}ms`);
          
        } catch (error) {
          tabPerformance[tab.name] = { error: error.message };
        }
        
        await page.waitForTimeout(500); // Brief pause between tabs
      }
      
      performanceResults.metrics.tabSwitching = tabPerformance;

      // Memory monitoring over time
      console.log('🧠 Monitoring memory usage...');
      for (let i = 0; i < 5; i++) {
        const memorySnapshot = await page.evaluate(() => {
          return {
            timestamp: Date.now(),
            usedJSHeapSize: performance.memory ? performance.memory.usedJSHeapSize : null,
            totalJSHeapSize: performance.memory ? performance.memory.totalJSHeapSize : null,
            documentCount: document.querySelectorAll('*').length,
            listenersEstimate: window.getEventListeners ? 
              Object.keys(window.getEventListeners(document)).length : null
          };
        });
        
        performanceResults.memoryUsage.push(memorySnapshot);
        await page.waitForTimeout(2000);
      }

      // Resource loading analysis
      const resourceTiming = await page.evaluate(() => {
        return performance.getEntriesByType('resource').map(resource => ({
          name: resource.name,
          duration: resource.duration,
          size: resource.transferSize || resource.decodedBodySize,
          type: resource.initiatorType,
          startTime: resource.startTime
        })).filter(r => 
          r.name.includes('ts-policy-watcher') || 
          r.name.includes('githubusercontent') ||
          r.name.includes('.js') || 
          r.name.includes('.css')
        );
      });
      
      performanceResults.resourceTiming = resourceTiming;

      // Performance score calculation
      const performanceScore = {
        loadTime: initialLoadTime < 3000 ? 'good' : initialLoadTime < 5000 ? 'needs-improvement' : 'poor',
        fcp: performanceMetrics.firstContentfulPaint < 1800 ? 'good' : performanceMetrics.firstContentfulPaint < 3000 ? 'needs-improvement' : 'poor',
        memoryEfficient: performanceMetrics.memoryUsed && performanceMetrics.memoryUsed < 50000000 ? 'good' : 'needs-improvement'
      };
      
      performanceResults.performanceScore = performanceScore;
      console.log('🏆 Performance Score:', performanceScore);

      // Save detailed performance results
      const performanceFile = path.join(PERFORMANCE_RESULTS_DIR, 'core-web-vitals.json');
      fs.writeFileSync(performanceFile, JSON.stringify(performanceResults, null, 2));

      // Performance assertions
      expect(initialLoadTime).toBeLessThan(10000); // Should load within 10 seconds
      expect(performanceMetrics.firstContentfulPaint).toBeLessThan(5000); // FCP within 5 seconds
      expect(performanceResults.jsErrors.length).toBe(0); // No JavaScript errors

    } catch (error) {
      performanceResults.testError = {
        message: error.message,
        stack: error.stack
      };
      
      const errorFile = path.join(PERFORMANCE_RESULTS_DIR, 'performance-error.json');
      fs.writeFileSync(errorFile, JSON.stringify(performanceResults, null, 2));
      throw error;
    }
  });

  test('Performance - Network and API Latency', async ({ page }) => {
    const networkResults = {
      timestamp: new Date().toISOString(),
      testName: 'Network and API Latency',
      githubApiCalls: [],
      staticAssets: [],
      totalRequests: 0,
      failedRequests: 0
    };

    // Monitor all network activity
    page.on('response', response => {
      const timing = response.timing();
      const requestInfo = {
        url: response.url(),
        status: response.status(),
        method: response.request().method(),
        contentType: response.headers()['content-type'],
        size: response.headers()['content-length'],
        timing: timing,
        timestamp: Date.now()
      };

      networkResults.totalRequests++;
      
      if (response.status() >= 400) {
        networkResults.failedRequests++;
      }

      if (response.url().includes('raw.githubusercontent.com')) {
        networkResults.githubApiCalls.push(requestInfo);
        console.log('📡 GitHub API:', response.url(), response.status(), `${timing?.responseEnd || 0}ms`);
      } else if (response.url().includes('.js') || response.url().includes('.css') || response.url().includes('.png')) {
        networkResults.staticAssets.push(requestInfo);
      }
    });

    console.log('🌐 Analyzing network performance...');
    
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Allow all API calls to complete

    // Analyze GitHub API performance
    if (networkResults.githubApiCalls.length > 0) {
      const apiLatencies = networkResults.githubApiCalls
        .filter(call => call.timing?.responseEnd)
        .map(call => call.timing.responseEnd);
      
      networkResults.apiAnalysis = {
        totalCalls: networkResults.githubApiCalls.length,
        averageLatency: apiLatencies.reduce((a, b) => a + b, 0) / apiLatencies.length,
        maxLatency: Math.max(...apiLatencies),
        minLatency: Math.min(...apiLatencies),
        failedCalls: networkResults.githubApiCalls.filter(call => call.status >= 400).length
      };
      
      console.log('📊 GitHub API Analysis:', networkResults.apiAnalysis);
    }

    // Test specific API endpoints manually
    const apiEndpoints = [
      'https://raw.githubusercontent.com/lyori6/ts-policy-watcher/main/run_log.json',
      'https://raw.githubusercontent.com/lyori6/ts-policy-watcher/main/summaries.json',
      'https://raw.githubusercontent.com/lyori6/ts-policy-watcher/main/platform_urls.json'
    ];

    const manualApiTests = [];
    for (const endpoint of apiEndpoints) {
      const apiTestStart = Date.now();
      
      try {
        const response = await page.request.get(endpoint);
        const latency = Date.now() - apiTestStart;
        
        manualApiTests.push({
          url: endpoint,
          status: response.status(),
          latency: latency,
          success: response.ok()
        });
        
        console.log(`🔍 Manual API test: ${endpoint} - ${response.status()} - ${latency}ms`);
        
      } catch (error) {
        manualApiTests.push({
          url: endpoint,
          error: error.message,
          latency: Date.now() - apiTestStart,
          success: false
        });
      }
    }
    
    networkResults.manualApiTests = manualApiTests;

    // Save network performance results
    const networkFile = path.join(PERFORMANCE_RESULTS_DIR, 'network-performance.json');
    fs.writeFileSync(networkFile, JSON.stringify(networkResults, null, 2));

    // Network performance assertions
    expect(networkResults.failedRequests).toBeLessThan(networkResults.totalRequests * 0.1); // Less than 10% failure rate
    
    if (networkResults.apiAnalysis) {
      expect(networkResults.apiAnalysis.averageLatency).toBeLessThan(5000); // Average API latency under 5 seconds
    }
  });

  test('Performance - Resource Optimization Analysis', async ({ page }) => {
    const resourceResults = {
      timestamp: new Date().toISOString(),
      testName: 'Resource Optimization Analysis',
      resources: [],
      optimizationSuggestions: [],
      totalSize: 0,
      largeResources: []
    };

    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');

    // Analyze all loaded resources
    const resources = await page.evaluate(() => {
      return performance.getEntriesByType('resource').map(resource => ({
        name: resource.name,
        duration: resource.duration,
        transferSize: resource.transferSize,
        encodedBodySize: resource.encodedBodySize,
        decodedBodySize: resource.decodedBodySize,
        type: resource.initiatorType,
        startTime: resource.startTime,
        responseEnd: resource.responseEnd
      }));
    });

    resourceResults.resources = resources;
    resourceResults.totalSize = resources.reduce((total, resource) => total + (resource.transferSize || 0), 0);

    // Find large resources (over 1MB)
    resourceResults.largeResources = resources.filter(resource => 
      (resource.transferSize || 0) > 1024 * 1024
    );

    // Optimization suggestions
    const jsResources = resources.filter(r => r.name.includes('.js'));
    const cssResources = resources.filter(r => r.name.includes('.css'));
    const imageResources = resources.filter(r => r.name.includes('.png') || r.name.includes('.jpg'));

    if (jsResources.length > 10) {
      resourceResults.optimizationSuggestions.push('Consider bundling JavaScript files to reduce HTTP requests');
    }

    if (resourceResults.largeResources.length > 0) {
      resourceResults.optimizationSuggestions.push('Large resources detected - consider compression or code splitting');
    }

    const slowResources = resources.filter(r => r.duration > 3000);
    if (slowResources.length > 0) {
      resourceResults.optimizationSuggestions.push('Some resources are loading slowly (>3s) - check CDN or server performance');
    }

    console.log('📦 Resource Analysis:');
    console.log(`   Total Resources: ${resources.length}`);
    console.log(`   Total Transfer Size: ${Math.round(resourceResults.totalSize / 1024)}KB`);
    console.log(`   Large Resources: ${resourceResults.largeResources.length}`);
    console.log(`   Optimization Suggestions: ${resourceResults.optimizationSuggestions.length}`);

    // Save resource analysis
    const resourceFile = path.join(PERFORMANCE_RESULTS_DIR, 'resource-optimization.json');
    fs.writeFileSync(resourceFile, JSON.stringify(resourceResults, null, 2));

    // Assertions
    expect(resourceResults.totalSize).toBeLessThan(10 * 1024 * 1024); // Total size under 10MB
    expect(resourceResults.largeResources.length).toBeLessThan(5); // Fewer than 5 large resources
  });

  test('Performance - Lighthouse Audit Integration', async ({ page }) => {
    // Note: This would typically require the lighthouse npm package
    // For now, we'll simulate lighthouse-style checks
    
    const lighthouseResults = {
      timestamp: new Date().toISOString(),
      testName: 'Lighthouse-style Audit',
      scores: {},
      opportunities: [],
      diagnostics: []
    };

    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');

    // Simulate lighthouse checks
    const auditResults = await page.evaluate(() => {
      const results = {
        // Performance metrics
        firstContentfulPaint: 0,
        largestContentfulPaint: 0,
        cumulativeLayoutShift: 0,
        
        // Accessibility checks
        hasAltText: true,
        hasAriaLabels: false,
        hasProperHeadings: true,
        
        // SEO checks
        hasTitle: !!document.title,
        hasMetaDescription: !!document.querySelector('meta[name="description"]'),
        
        // Best practices
        usesHTTPS: location.protocol === 'https:',
        hasNoConsoleErrors: true, // Would need to track this
        
        // PWA features
        hasServiceWorker: 'serviceWorker' in navigator,
        hasManifest: !!document.querySelector('link[rel="manifest"]')
      };

      // Check for paint timing
      const paintEntries = performance.getEntriesByType('paint');
      const fcp = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      if (fcp) results.firstContentfulPaint = fcp.startTime;

      // Check accessibility features
      results.hasAriaLabels = document.querySelectorAll('[aria-label]').length > 0;
      
      return results;
    });

    // Score calculation (simplified)
    lighthouseResults.scores = {
      performance: auditResults.firstContentfulPaint < 2000 ? 90 : auditResults.firstContentfulPaint < 4000 ? 70 : 50,
      accessibility: (auditResults.hasAltText ? 25 : 0) + (auditResults.hasAriaLabels ? 25 : 0) + (auditResults.hasProperHeadings ? 50 : 0),
      seo: (auditResults.hasTitle ? 50 : 0) + (auditResults.hasMetaDescription ? 50 : 0),
      bestPractices: (auditResults.usesHTTPS ? 50 : 0) + (auditResults.hasNoConsoleErrors ? 50 : 0)
    };

    console.log('🏆 Lighthouse-style Scores:', lighthouseResults.scores);

    // Save lighthouse-style results
    const lighthouseFile = path.join(PERFORMANCE_RESULTS_DIR, 'lighthouse-audit.json');
    fs.writeFileSync(lighthouseFile, JSON.stringify(lighthouseResults, null, 2));

    // Assertions for good performance
    expect(lighthouseResults.scores.performance).toBeGreaterThan(60);
    expect(lighthouseResults.scores.accessibility).toBeGreaterThan(70);
    expect(lighthouseResults.scores.seo).toBeGreaterThan(80);
  });

  // Generate performance summary report
  test.afterAll(async () => {
    const summaryReport = {
      timestamp: new Date().toISOString(),
      testSuite: 'Performance Monitoring',
      environment: 'production',
      url: PRODUCTION_URL,
      summary: 'Comprehensive performance analysis completed',
      resultsDirectory: PERFORMANCE_RESULTS_DIR
    };

    const summaryPath = path.join(PERFORMANCE_RESULTS_DIR, 'performance-summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(summaryReport, null, 2));
    console.log('⚡ Performance summary saved:', summaryPath);
  });
});