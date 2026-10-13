const { chromium } = require('playwright');

async function debugWeeklySummary() {
    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
        console.log('Navigating to dashboard...');
        await page.goto('http://localhost:3005/dashboard/index.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(3000);
        
        // Check if page loaded
        const title = await page.title();
        console.log('Page title:', title);
        
        // Take initial screenshot
        await page.screenshot({ path: 'debug_initial.png' });
        
        // Check if weekly tab exists
        const weeklyTab = await page.$('[data-tab="weekly"]');
        if (!weeklyTab) {
            console.log('Weekly tab not found, checking all nav tabs...');
            const navTabs = await page.$$eval('.nav-tab', tabs => 
                tabs.map(tab => ({ text: tab.textContent, dataTab: tab.getAttribute('data-tab') }))
            );
            console.log('Available tabs:', navTabs);
            return;
        }
        
        console.log('Clicking on Weekly Update tab...');
        await page.click('[data-tab="weekly"]');
        await page.waitForTimeout(3000);
        
        console.log('Checking week selector options...');
        const weekOptions = await page.$$eval('#week-selector option', options => 
            options.map(option => ({
                value: option.value,
                text: option.textContent
            }))
        );
        console.log('Available weeks:', weekOptions);
        
        // Look for August 14th week (should be Aug 9-15)
        const aug14Week = weekOptions.find(option => 
            option.text.includes('Aug 9') || 
            option.text.includes('Aug 14') || 
            option.value.includes('2025-08-09') ||
            option.value.includes('2025-08-14')
        );
        
        if (aug14Week) {
            console.log('Found August 14th week:', aug14Week);
            
            // Select that week
            await page.selectOption('#week-selector', aug14Week.value);
            await page.waitForTimeout(2000);
            
            // Check the summary content
            const summaryContent = await page.$eval('#weekly-summary-content', el => el.textContent);
            console.log('Summary content:', summaryContent);
            
            // Take a screenshot
            await page.screenshot({ path: 'debug_august14_summary.png', fullPage: true });
            console.log('Screenshot saved as debug_august14_summary.png');
            
        } else {
            console.log('August 14th week not found in dropdown');
        }
        
        // Check what data is actually loaded
        const weeklyData = await page.evaluate(() => {
            return window.dashboardInstance?.weeklySummariesData || {};
        });
        console.log('Weekly data keys:', Object.keys(weeklyData));
        
        // Check the specific Aug 9-15 week data
        const aug9to15Data = await page.evaluate(() => {
            return window.dashboardInstance?.weeklySummariesData?.['2025-08-09_to_2025-08-15'] || null;
        });
        console.log('Aug 9-15 data:', aug9to15Data);
        
    } catch (error) {
        console.error('Error:', error);
        await page.screenshot({ path: 'debug_error.png' });
    }
    
    await browser.close();
}

debugWeeklySummary();