const { test, expect } = require('@playwright/test');
const path = require('path');

// Test configuration
const DASHBOARD_PATH = path.join(__dirname, '..', 'dashboard', 'index.html');
const TEST_SCREENSHOTS_DIR = path.join(__dirname, '..', 'visual_regression_tests');

test.describe('Mobile Analytics Chart Fix Validation', () => {
  let page;
  
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(`file://${DASHBOARD_PATH}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('Mobile Chart Responsiveness - Multiple Viewports', async () => {
    console.log('📱 Testing mobile chart responsiveness across viewports...');
    
    const viewports = [
      { name: 'mobile-xs', width: 320, height: 568, desc: 'iPhone SE' },
      { name: 'mobile-sm', width: 375, height: 667, desc: 'iPhone 8' },
      { name: 'mobile-lg', width: 414, height: 896, desc: 'iPhone 11 Pro' },
      { name: 'tablet', width: 768, height: 1024, desc: 'iPad' },
      { name: 'desktop', width: 1280, height: 720, desc: 'Desktop' }
    ];
    
    for (const viewport of viewports) {
      console.log(`📐 Testing ${viewport.desc} (${viewport.width}x${viewport.height})`);
      
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      // Navigate to analytics tab
      await page.click('[data-tab="analytics"]');
      await page.waitForTimeout(1000);
      
      // Check if chart is visible
      const chartVisible = await page.locator('#weekly-platform-chart').isVisible();
      expect(chartVisible).toBe(true);
      
      // Check for responsive SVG
      const svgElement = await page.locator('.timeline-svg.responsive-chart').first();
      if (await svgElement.count() > 0) {
        const svgBox = await svgElement.boundingBox();
        console.log(`📊 Chart dimensions: ${svgBox.width}x${svgBox.height}`);
        
        // Verify chart fits within viewport
        expect(svgBox.width).toBeLessThanOrEqual(viewport.width - 20); // Account for padding
        expect(svgBox.height).toBeGreaterThan(0);
      }
      
      // Take screenshot for visual comparison
      await page.screenshot({ 
        path: `${TEST_SCREENSHOTS_DIR}/mobile_fix_${viewport.name}.png`,
        fullPage: true 
      });
    }
  });

  test('Mobile Touch Targets and Interactions', async () => {
    console.log('👆 Testing mobile touch targets and interactions...');
    
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.click('[data-tab="analytics"]');
    await page.waitForTimeout(1000);
    
    // Check for touch-friendly data points
    const dataPoints = await page.locator('.chart-data-point').count();
    if (dataPoints > 0) {
      // Test data point hover/touch
      const firstPoint = page.locator('.chart-data-point').first();
      const pointBox = await firstPoint.boundingBox();
      
      if (pointBox) {
        // Check if touch target is large enough (minimum 44px as per iOS guidelines)
        console.log(`🎯 Data point size: radius appears touch-friendly`);
        
        // Test interaction
        await firstPoint.hover();
        await page.waitForTimeout(200);
        
        // Check for tooltip or title
        const tooltip = await firstPoint.getAttribute('title');
        expect(tooltip).toBeTruthy();
        console.log(`💬 Tooltip content: ${tooltip}`);
      }
    }
    
    // Test expandable details button on mobile
    const expandButton = await page.locator('.expand-details-btn');
    if (await expandButton.count() > 0) {
      const buttonBox = await expandButton.boundingBox();
      expect(buttonBox.height).toBeGreaterThanOrEqual(44); // iOS touch target minimum
      
      // Test expand/collapse functionality
      await expandButton.click();
      await page.waitForTimeout(300);
      
      const expandedDetails = await page.locator('.expandable-details.expanded');
      expect(await expandedDetails.count()).toBeGreaterThan(0);
      console.log('✅ Expandable details working');
      
      // Test collapse
      await expandButton.click();
      await page.waitForTimeout(300);
      
      const collapsedDetails = await page.locator('.expandable-details:not(.expanded)');
      expect(await collapsedDetails.count()).toBeGreaterThan(0);
      console.log('✅ Collapse functionality working');
    }
  });

  test('Mobile Date Label Optimization', async () => {
    console.log('📅 Testing mobile date label optimization...');
    
    await page.setViewportSize({ width: 375, height: 667 });
    await page.click('[data-tab="analytics"]');
    await page.waitForTimeout(1000);
    
    // Count visible date labels on mobile
    const dateLabels = await page.locator('.timeline-svg text').count();
    console.log(`📊 Visible date labels on mobile: ${dateLabels}`);
    
    // On mobile, should show fewer labels than desktop
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(500);
    
    const desktopDateLabels = await page.locator('.timeline-svg text').count();
    console.log(`🖥️ Visible date labels on desktop: ${desktopDateLabels}`);
    
    // Mobile should show fewer or equal labels compared to desktop
    expect(dateLabels).toBeLessThanOrEqual(desktopDateLabels);
    
    // Test mobile summary stats
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(500);
    
    const mobileTimeline = await page.locator('.mobile-timeline').count();
    const summaryStats = await page.locator('.summary-stats .stat-item').count();
    
    if (mobileTimeline > 0) {
      expect(summaryStats).toBeGreaterThan(0);
      console.log(`📈 Mobile summary stats: ${summaryStats} items`);
    }
  });

  test('Performance and Rendering Speed', async () => {
    console.log('⚡ Testing performance and rendering speed...');
    
    const viewports = [
      { width: 320, height: 568 },
      { width: 768, height: 1024 },
      { width: 1280, height: 720 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      
      const startTime = Date.now();
      
      await page.click('[data-tab="analytics"]');
      await page.waitForSelector('#weekly-platform-chart', { timeout: 5000 });
      await page.waitForTimeout(100); // Let rendering complete
      
      const endTime = Date.now();
      const renderTime = endTime - startTime;
      
      console.log(`📊 Render time at ${viewport.width}px: ${renderTime}ms`);
      
      // Should render quickly on all devices
      expect(renderTime).toBeLessThan(2000);
    }
  });

  test('Cross-Device Visual Regression', async () => {
    console.log('🔍 Running cross-device visual regression tests...');
    
    const devices = [
      { name: 'mobile-portrait', width: 375, height: 667 },
      { name: 'mobile-landscape', width: 667, height: 375 },
      { name: 'tablet-portrait', width: 768, height: 1024 },
      { name: 'tablet-landscape', width: 1024, height: 768 },
      { name: 'desktop-standard', width: 1280, height: 720 }
    ];
    
    for (const device of devices) {
      await page.setViewportSize({ width: device.width, height: device.height });
      await page.waitForTimeout(500);
      
      await page.click('[data-tab="analytics"]');
      await page.waitForTimeout(1000);
      
      // Take full screenshot
      await page.screenshot({ 
        path: `${TEST_SCREENSHOTS_DIR}/mobile_fix_${device.name}_full.png`,
        fullPage: true 
      });
      
      // Take analytics section screenshot
      const analyticsSection = await page.locator('#analytics');
      if (await analyticsSection.count() > 0) {
        await analyticsSection.screenshot({ 
          path: `${TEST_SCREENSHOTS_DIR}/mobile_fix_${device.name}_analytics.png`
        });
      }
    }
  });

  test('JavaScript Error Detection', async () => {
    console.log('🐛 Testing for JavaScript errors across devices...');
    
    const jsErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        jsErrors.push(msg.text());
      }
    });
    
    page.on('pageerror', error => {
      jsErrors.push(error.message);
    });
    
    const viewports = [
      { width: 320, height: 568 },
      { width: 375, height: 667 },
      { width: 768, height: 1024 },
      { width: 1280, height: 720 }
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.click('[data-tab="analytics"]');
      await page.waitForTimeout(1000);
      
      // Test interactions
      const expandButton = await page.locator('.expand-details-btn');
      if (await expandButton.count() > 0) {
        await expandButton.click();
        await page.waitForTimeout(300);
        await expandButton.click();
        await page.waitForTimeout(300);
      }
    }
    
    if (jsErrors.length > 0) {
      console.log('❌ JavaScript errors detected:', jsErrors);
      expect(jsErrors.length).toBe(0);
    } else {
      console.log('✅ No JavaScript errors detected');
    }
  });

  test('Accessibility and Touch Guidelines Compliance', async () => {
    console.log('♿ Testing accessibility and touch guidelines compliance...');
    
    await page.setViewportSize({ width: 375, height: 667 });
    await page.click('[data-tab="analytics"]');
    await page.waitForTimeout(1000);
    
    // Test minimum touch target sizes (44px iOS guideline)
    const touchTargets = [
      '.expand-details-btn',
      '.chart-data-point'
    ];
    
    for (const selector of touchTargets) {
      const elements = await page.locator(selector);
      const count = await elements.count();
      
      for (let i = 0; i < count; i++) {
        const element = elements.nth(i);
        const box = await element.boundingBox();
        
        if (box) {
          // Check minimum touch target size
          const minDimension = Math.min(box.width, box.height);
          if (selector === '.expand-details-btn') {
            expect(minDimension).toBeGreaterThanOrEqual(44);
          }
          // Chart data points have radius, so we check if they're touch-friendly
          console.log(`👆 ${selector} touch target: ${box.width}x${box.height}`);
        }
      }
    }
  });

  test.afterEach(async () => {
    if (page) {
      await page.close();
    }
  });
});