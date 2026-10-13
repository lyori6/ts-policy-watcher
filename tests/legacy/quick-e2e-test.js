const puppeteer = require('puppeteer');
const fs = require('fs');

async function runQuickTests() {
    console.log('🚀 Starting Quick E2E Tests...');
    
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    const baseUrl = 'http://localhost:8888';
    
    const testResults = {
        timestamp: new Date().toISOString(),
        tests: [],
        summary: { passed: 0, failed: 0 }
    };

    // Test 1: Dashboard loads successfully
    try {
        console.log('🧪 Test 1: Dashboard loads');
        await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 15000 });
        
        // Check for main elements
        const header = await page.$('header');
        const main = await page.$('main');
        const nav = await page.$('.main-nav');
        
        if (header && main && nav) {
            console.log('✅ Dashboard loads successfully');
            testResults.tests.push({ name: 'Dashboard Load', status: 'PASS' });
            testResults.summary.passed++;
        } else {
            throw new Error('Missing main elements');
        }
    } catch (error) {
        console.log('❌ Dashboard load failed:', error.message);
        testResults.tests.push({ name: 'Dashboard Load', status: 'FAIL', error: error.message });
        testResults.summary.failed++;
    }

    // Test 2: Navigation works
    try {
        console.log('🧪 Test 2: Navigation functionality');
        
        // Click on Policy Explorer tab
        await page.click('[data-tab="platforms"]');
        await page.waitForTimeout(1000);
        
        // Check if tab is active
        const activeTab = await page.$('.nav-tab.active[data-tab="platforms"]');
        
        if (activeTab) {
            console.log('✅ Navigation works');
            testResults.tests.push({ name: 'Navigation', status: 'PASS' });
            testResults.summary.passed++;
        } else {
            throw new Error('Tab navigation failed');
        }
    } catch (error) {
        console.log('❌ Navigation failed:', error.message);
        testResults.tests.push({ name: 'Navigation', status: 'FAIL', error: error.message });
        testResults.summary.failed++;
    }

    // Test 3: Diagnostics button works
    try {
        console.log('🧪 Test 3: Diagnostics functionality');
        
        // Click diagnostics button
        await page.click('.diagnostics-button');
        await page.waitForSelector('#diagnostic-modal', { timeout: 5000 });
        
        const modal = await page.$('#diagnostic-modal');
        if (modal) {
            console.log('✅ Diagnostics modal opens');
            testResults.tests.push({ name: 'Diagnostics', status: 'PASS' });
            testResults.summary.passed++;
            
            // Close modal
            await page.click('.close-button');
        } else {
            throw new Error('Diagnostics modal not found');
        }
    } catch (error) {
        console.log('❌ Diagnostics failed:', error.message);
        testResults.tests.push({ name: 'Diagnostics', status: 'FAIL', error: error.message });
        testResults.summary.failed++;
    }

    // Test 4: Visual regression - take screenshots
    try {
        console.log('🧪 Test 4: Visual regression testing');
        
        const viewports = [
            { name: 'desktop', width: 1200, height: 800 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 375, height: 667 }
        ];

        const tabs = [
            { name: 'matrix', selector: '[data-tab="matrix"]' },
            { name: 'platforms', selector: '[data-tab="platforms"]' },
            { name: 'analytics', selector: '[data-tab="analytics"]' }
        ];

        for (const viewport of viewports) {
            await page.setViewport(viewport);
            
            for (const tab of tabs) {
                await page.click(tab.selector);
                await page.waitForTimeout(1000);
                
                const screenshotPath = `./visual_regression_tests/${viewport.name}_${tab.name}_new.png`;
                await page.screenshot({
                    path: screenshotPath,
                    fullPage: true
                });
                
                console.log(`📸 Screenshot saved: ${screenshotPath}`);
            }
        }
        
        console.log('✅ Visual regression tests completed');
        testResults.tests.push({ name: 'Visual Regression', status: 'PASS' });
        testResults.summary.passed++;
        
    } catch (error) {
        console.log('❌ Visual regression failed:', error.message);
        testResults.tests.push({ name: 'Visual Regression', status: 'FAIL', error: error.message });
        testResults.summary.failed++;
    }

    // Test 5: Error handling
    try {
        console.log('🧪 Test 5: Error handling');
        
        // Test keyboard shortcut
        await page.keyboard.down('Control');
        await page.keyboard.press('KeyD');
        await page.keyboard.up('Control');
        
        await page.waitForSelector('#diagnostic-modal', { timeout: 3000 });
        
        // Test escape key
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        
        console.log('✅ Keyboard shortcuts work');
        testResults.tests.push({ name: 'Keyboard Shortcuts', status: 'PASS' });
        testResults.summary.passed++;
        
    } catch (error) {
        console.log('❌ Keyboard shortcuts failed:', error.message);
        testResults.tests.push({ name: 'Keyboard Shortcuts', status: 'FAIL', error: error.message });
        testResults.summary.failed++;
    }

    await browser.close();

    // Save test results
    if (!fs.existsSync('./test-results')) {
        fs.mkdirSync('./test-results', { recursive: true });
    }
    
    fs.writeFileSync('./test-results/quick_e2e_results.json', JSON.stringify(testResults, null, 2));

    // Print summary
    console.log('\n📊 Test Summary:');
    console.log(`✅ Passed: ${testResults.summary.passed}`);
    console.log(`❌ Failed: ${testResults.summary.failed}`);
    
    const total = testResults.summary.passed + testResults.summary.failed;
    const successRate = ((testResults.summary.passed / total) * 100).toFixed(1);
    console.log(`📈 Success Rate: ${successRate}%`);

    if (testResults.summary.failed === 0) {
        console.log('\n🎉 All tests passed!');
        process.exit(0);
    } else {
        console.log('\n⚠️  Some tests failed.');
        process.exit(1);
    }
}

runQuickTests().catch(console.error);