const puppeteer = require('puppeteer');
const path = require('path');

async function takeScreenshots() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Load the dashboard HTML file
    const filePath = 'file://' + path.resolve(__dirname, 'dashboard/index.html');
    await page.goto(filePath, { waitUntil: 'networkidle2' });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Click on Policy Explorer tab to switch to it
    await page.evaluate(() => {
        const tab = document.querySelector('[data-tab="platforms"]');
        if (tab) tab.click();
    });
    
    // Wait for Policy Explorer to load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Desktop screenshot (1200x800)
    await page.setViewport({ width: 1200, height: 800 });
    await page.screenshot({ 
        path: '/Users/lyor/ts-policy-watcher/policy-explorer-desktop.png',
        fullPage: true
    });
    
    // Mobile screenshot (375x667)
    await page.setViewport({ width: 375, height: 667 });
    await page.screenshot({ 
        path: '/Users/lyor/ts-policy-watcher/policy-explorer-mobile.png',
        fullPage: true
    });
    
    await browser.close();
    console.log('Screenshots saved successfully!');
}

takeScreenshots().catch(console.error);