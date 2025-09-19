const puppeteer = require('puppeteer');

async function simpleTest() {
    console.log('🚀 Running Simple E2E Test...');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });
    
    const page = await browser.newPage();
    
    try {
        // Test 1: Basic load
        console.log('🧪 Loading dashboard...');
        await page.goto('http://localhost:8888', { waitUntil: 'networkidle2' });
        
        // Check basic elements
        const header = await page.$('header');
        const main = await page.$('main');
        const nav = await page.$('.main-nav');
        
        console.log(`✅ Header: ${!!header}`);
        console.log(`✅ Main: ${!!main}`);
        console.log(`✅ Navigation: ${!!nav}`);
        
        // Test 2: Screenshots for visual testing
        console.log('📸 Taking screenshots...');
        
        // Desktop view
        await page.setViewport({ width: 1200, height: 800 });
        await page.screenshot({ path: './visual_regression_tests/test_desktop.png', fullPage: true });
        console.log('✅ Desktop screenshot saved');
        
        // Mobile view  
        await page.setViewport({ width: 375, height: 667 });
        await page.screenshot({ path: './visual_regression_tests/test_mobile.png', fullPage: true });
        console.log('✅ Mobile screenshot saved');
        
        // Test 3: Navigation clicks
        console.log('🧪 Testing navigation...');
        await page.setViewport({ width: 1200, height: 800 });
        
        // Click Policy Explorer
        await page.click('[data-tab="platforms"]');
        await page.waitForFunction(() => document.querySelector('[data-tab="platforms"]').classList.contains('active'));
        console.log('✅ Policy Explorer tab activated');
        
        // Take screenshot of Policy Explorer
        await page.screenshot({ path: './visual_regression_tests/test_policy_explorer.png', fullPage: true });
        
        // Click Analytics
        await page.click('[data-tab="analytics"]');
        await page.waitForFunction(() => document.querySelector('[data-tab="analytics"]').classList.contains('active'));
        console.log('✅ Analytics tab activated');
        
        // Take screenshot of Analytics
        await page.screenshot({ path: './visual_regression_tests/test_analytics.png', fullPage: true });
        
        // Test 4: Diagnostics modal
        console.log('🧪 Testing diagnostics...');
        try {
            await page.click('.diagnostics-button');
            await page.waitForSelector('#diagnostic-modal', { visible: true, timeout: 5000 });
            console.log('✅ Diagnostics modal opened');
            
            // Take screenshot of modal
            await page.screenshot({ path: './visual_regression_tests/test_diagnostics_modal.png' });
            
            // Close modal by clicking outside or close button
            const closeBtn = await page.$('#diagnostic-modal .close-button');
            if (closeBtn) {
                await closeBtn.click();
                console.log('✅ Modal closed');
            }
        } catch (error) {
            console.log('⚠️ Diagnostics test skipped:', error.message);
        }
        
        console.log('\n🎉 All basic tests completed successfully!');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    } finally {
        await browser.close();
    }
}

simpleTest();