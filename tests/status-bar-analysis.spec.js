const { test, expect } = require('@playwright/test');
const path = require('path');

// Test configuration
const DASHBOARD_PATH = path.join(__dirname, '..', 'dashboard', 'index.html');
const TEST_SCREENSHOTS_DIR = path.join(__dirname, '..', 'visual_regression_tests');

test.describe('Status Bar Alignment Analysis', () => {
  let page;
  
  test.beforeEach(async ({ browser }) => {
    page = await browser.newPage();
    await page.goto(`file://${DASHBOARD_PATH}`);
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('Status Bar - Detailed Alignment Analysis', async () => {
    console.log('🔍 Analyzing status bar alignment and spacing...');
    
    // Take full header screenshot
    const header = await page.locator('header').first();
    if (await header.count() > 0) {
      await header.screenshot({ 
        path: `${TEST_SCREENSHOTS_DIR}/status_bar_full_header.png`
      });
    }
    
    // Analyze status bar container
    const statusBar = await page.locator('.header-status-bar').first();
    if (await statusBar.count() > 0) {
      const statusBarBox = await statusBar.boundingBox();
      console.log(`📏 Status bar dimensions: ${statusBarBox.width}x${statusBarBox.height}`);
      
      // Take detailed status bar screenshot
      await statusBar.screenshot({ 
        path: `${TEST_SCREENSHOTS_DIR}/status_bar_detailed.png`
      });
      
      // Analyze individual status items
      const statusItems = await page.locator('.status-item');
      const itemCount = await statusItems.count();
      console.log(`📊 Found ${itemCount} status items`);
      
      for (let i = 0; i < itemCount; i++) {
        const item = statusItems.nth(i);
        const itemBox = await item.boundingBox();
        
        // Get text content
        const numberElement = await item.locator('.status-number, .status-icon').first();
        const labelElement = await item.locator('.status-label').first();
        
        const numberText = await numberElement.textContent();
        const labelText = await labelElement.textContent();
        
        console.log(`📋 Item ${i + 1}: "${labelText}"`);
        console.log(`   📐 Dimensions: ${itemBox.width}x${itemBox.height}`);
        console.log(`   🔢 Number/Icon: "${numberText}"`);
        
        // Check spacing and padding
        const computedStyle = await item.evaluate(el => {
          const style = window.getComputedStyle(el);
          return {
            padding: style.padding,
            paddingTop: style.paddingTop,
            paddingBottom: style.paddingBottom,
            paddingLeft: style.paddingLeft,
            paddingRight: style.paddingRight,
            margin: style.margin,
            textAlign: style.textAlign,
            alignItems: style.alignItems,
            justifyContent: style.justifyContent,
            gap: style.gap
          };
        });
        
        console.log(`   🎨 Computed styles:`, computedStyle);
        
        // Check number/icon alignment
        if (await numberElement.count() > 0) {
          const numberBox = await numberElement.boundingBox();
          const numberStyle = await numberElement.evaluate(el => {
            const style = window.getComputedStyle(el);
            return {
              marginBottom: style.marginBottom,
              lineHeight: style.lineHeight,
              fontSize: style.fontSize,
              textAlign: style.textAlign
            };
          });
          console.log(`   🔢 Number element:`, numberStyle);
        }
        
        // Check label alignment
        if (await labelElement.count() > 0) {
          const labelBox = await labelElement.boundingBox();
          const labelStyle = await labelElement.evaluate(el => {
            const style = window.getComputedStyle(el);
            return {
              marginTop: style.marginTop,
              fontSize: style.fontSize,
              lineHeight: style.lineHeight,
              textAlign: style.textAlign
            };
          });
          console.log(`   🏷️  Label element:`, labelStyle);
        }
        
        // Take individual item screenshot
        await item.screenshot({ 
          path: `${TEST_SCREENSHOTS_DIR}/status_item_${i + 1}.png`
        });
        
        console.log('   ────────────────');
      }
    }
    
    // Test across different viewport sizes
    const viewports = [
      { name: 'desktop', width: 1280, height: 720 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 375, height: 667 }
    ];
    
    for (const viewport of viewports) {
      console.log(`📱 Testing status bar on ${viewport.name} (${viewport.width}px)`);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);
      
      const statusBar = await page.locator('.header-status-bar').first();
      if (await statusBar.count() > 0) {
        await statusBar.screenshot({ 
          path: `${TEST_SCREENSHOTS_DIR}/status_bar_${viewport.name}.png`
        });
        
        const statusBarBox = await statusBar.boundingBox();
        console.log(`   📐 ${viewport.name} dimensions: ${statusBarBox.width}x${statusBarBox.height}`);
      }
    }
    
    // Reset to desktop
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('Status Bar - Visual Spacing Issues Detection', async () => {
    console.log('👁️  Detecting visual spacing and alignment issues...');
    
    // Check for common alignment problems
    const statusItems = await page.locator('.status-item');
    const itemCount = await statusItems.count();
    
    const alignmentIssues = [];
    
    for (let i = 0; i < itemCount; i++) {
      const item = statusItems.nth(i);
      
      // Check if text is properly centered
      const isFlexCentered = await item.evaluate(el => {
        const style = window.getComputedStyle(el);
        return {
          display: style.display,
          flexDirection: style.flexDirection,
          alignItems: style.alignItems,
          justifyContent: style.justifyContent,
          textAlign: style.textAlign
        };
      });
      
      const numberElement = await item.locator('.status-number, .status-icon').first();
      const labelElement = await item.locator('.status-label').first();
      
      if (await numberElement.count() > 0 && await labelElement.count() > 0) {
        const numberBox = await numberElement.boundingBox();
        const labelBox = await labelElement.boundingBox();
        const itemBox = await item.boundingBox();
        
        // Check horizontal centering
        const numberCenterX = numberBox.x + numberBox.width / 2;
        const labelCenterX = labelBox.x + labelBox.width / 2;
        const itemCenterX = itemBox.x + itemBox.width / 2;
        
        const numberOffset = Math.abs(numberCenterX - itemCenterX);
        const labelOffset = Math.abs(labelCenterX - itemCenterX);
        
        if (numberOffset > 3 || labelOffset > 3) { // 3px tolerance
          alignmentIssues.push({
            item: i + 1,
            issue: 'horizontal_misalignment',
            numberOffset,
            labelOffset,
            details: { numberCenterX, labelCenterX, itemCenterX }
          });
        }
        
        // Check vertical spacing between number and label
        const verticalGap = labelBox.y - (numberBox.y + numberBox.height);
        if (verticalGap < 0 || verticalGap > 10) { // Check for overlap or excessive gap
          alignmentIssues.push({
            item: i + 1,
            issue: 'vertical_spacing',
            gap: verticalGap,
            details: { numberBottom: numberBox.y + numberBox.height, labelTop: labelBox.y }
          });
        }
      }
      
      console.log(`📊 Item ${i + 1} centering:`, isFlexCentered);
    }
    
    if (alignmentIssues.length > 0) {
      console.log('⚠️  Alignment issues detected:');
      alignmentIssues.forEach((issue, index) => {
        console.log(`   ${index + 1}. Item ${issue.item}: ${issue.issue}`);
        console.log(`      Details:`, issue.details);
      });
    } else {
      console.log('✅ No significant alignment issues detected');
    }
  });

  test('Status Bar - CSS Analysis', async () => {
    console.log('🎨 Analyzing CSS structure and potential improvements...');
    
    // Get the current CSS for status bar elements
    const cssAnalysis = await page.evaluate(() => {
      const statusBar = document.querySelector('.header-status-bar');
      const statusItem = document.querySelector('.status-item');
      const statusNumber = document.querySelector('.status-number, .status-icon');
      const statusLabel = document.querySelector('.status-label');
      
      const getStyles = (element, properties) => {
        if (!element) return null;
        const computed = window.getComputedStyle(element);
        const styles = {};
        properties.forEach(prop => {
          styles[prop] = computed[prop];
        });
        return styles;
      };
      
      return {
        statusBar: getStyles(statusBar, [
          'display', 'gap', 'background', 'borderRadius', 'padding', 'alignItems', 'boxShadow'
        ]),
        statusItem: getStyles(statusItem, [
          'display', 'flexDirection', 'alignItems', 'textAlign', 'padding', 'minWidth', 'flex'
        ]),
        statusNumber: getStyles(statusNumber, [
          'fontSize', 'fontWeight', 'color', 'marginBottom', 'lineHeight'
        ]),
        statusLabel: getStyles(statusLabel, [
          'fontSize', 'fontWeight', 'color', 'lineHeight', 'textTransform'
        ])
      };
    });
    
    console.log('📋 Current CSS Analysis:');
    console.log('   Status Bar:', cssAnalysis.statusBar);
    console.log('   Status Item:', cssAnalysis.statusItem);
    console.log('   Status Number:', cssAnalysis.statusNumber);
    console.log('   Status Label:', cssAnalysis.statusLabel);
  });

  test.afterEach(async () => {
    if (page) {
      await page.close();
    }
  });
});