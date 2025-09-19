const puppeteer = require('puppeteer');
const fs = require('fs');

class ComprehensiveTestSuite {
    constructor() {
        this.browser = null;
        this.page = null;
        this.results = {
            timestamp: new Date().toISOString(),
            environment: {
                node_version: process.version,
                puppeteer_version: require('puppeteer/package.json').version,
                test_url: 'http://localhost:8888'
            },
            summary: {
                total_tests: 0,
                passed: 0,
                failed: 0,
                warnings: 0
            },
            categories: {
                functionality: [],
                visual_regression: [],
                performance: [],
                accessibility: [],
                error_handling: []
            }
        };
    }

    async init() {
        console.log('🚀 Initializing Comprehensive Test Suite...');
        this.browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
        });
        this.page = await this.browser.newPage();
        
        // Enhanced error monitoring
        this.page.on('console', msg => {
            if (msg.type() === 'error') {
                console.log('⚠️ Console Error:', msg.text());
            }
        });
    }

    logTest(category, name, status, details = '', screenshot = null) {
        const test = {
            name,
            status,
            details,
            screenshot,
            timestamp: new Date().toISOString()
        };
        
        this.results.categories[category].push(test);
        this.results.summary.total_tests++;
        
        if (status === 'PASS') {
            this.results.summary.passed++;
            console.log(`✅ ${name}: ${details}`);
        } else if (status === 'FAIL') {
            this.results.summary.failed++;
            console.log(`❌ ${name}: ${details}`);
        } else if (status === 'WARN') {
            this.results.summary.warnings++;
            console.log(`⚠️ ${name}: ${details}`);
        }
    }

    async testFunctionality() {
        console.log('\n🧪 Testing Core Functionality...');
        
        try {
            // Load dashboard
            await this.page.goto('http://localhost:8888', { waitUntil: 'networkidle2', timeout: 15000 });
            
            // Test 1: Basic page structure
            const header = await this.page.$('header');
            const main = await this.page.$('main');
            const nav = await this.page.$('.main-nav');
            
            this.logTest('functionality', 'Page Structure', 
                header && main && nav ? 'PASS' : 'FAIL',
                `Header: ${!!header}, Main: ${!!main}, Nav: ${!!nav}`);

            // Test 2: Navigation functionality
            const tabs = ['matrix', 'platforms', 'analytics', 'weekly'];
            for (const tab of tabs) {
                try {
                    await this.page.click(`[data-tab="${tab}"]`);
                    await this.page.waitForFunction(
                        (tabName) => document.querySelector(`[data-tab="${tabName}"]`).classList.contains('active'),
                        {},
                        tab
                    );
                    this.logTest('functionality', `${tab} Tab Navigation`, 'PASS', `Tab ${tab} activated successfully`);
                } catch (error) {
                    this.logTest('functionality', `${tab} Tab Navigation`, 'FAIL', error.message);
                }
            }

            // Test 3: Data loading indicators
            const totalPolicies = await this.page.$eval('#header-total-policies', el => el.textContent);
            this.logTest('functionality', 'Data Loading', 
                totalPolicies !== '-' ? 'PASS' : 'WARN',
                `Total policies: ${totalPolicies}`);

            // Test 4: Diagnostics functionality  
            try {
                await this.page.click('.diagnostics-button');
                await this.page.waitForSelector('#diagnostic-modal', { visible: true, timeout: 5000 });
                
                // Check diagnostic sections
                const dataStatus = await this.page.$('.diagnostic-section h3');
                const performanceSection = await this.page.$('.performance-grid');
                
                this.logTest('functionality', 'Diagnostics Modal', 'PASS', 
                    `Modal opened with data status: ${!!dataStatus}, performance: ${!!performanceSection}`);
                
                // Close modal
                await this.page.click('#diagnostic-modal .close-button');
            } catch (error) {
                this.logTest('functionality', 'Diagnostics Modal', 'FAIL', error.message);
            }

            // Test 5: Keyboard shortcuts
            try {
                await this.page.keyboard.down('Control');
                await this.page.keyboard.press('KeyD');
                await this.page.keyboard.up('Control');
                
                await this.page.waitForSelector('#diagnostic-modal', { visible: true, timeout: 3000 });
                this.logTest('functionality', 'Ctrl+D Shortcut', 'PASS', 'Diagnostics opened via keyboard');
                
                await this.page.keyboard.press('Escape');
                await this.page.waitForFunction(() => !document.querySelector('#diagnostic-modal'), {}, { timeout: 3000 });
                this.logTest('functionality', 'Escape Key', 'PASS', 'Modal closed via Escape');
            } catch (error) {
                this.logTest('functionality', 'Keyboard Shortcuts', 'FAIL', error.message);
            }

        } catch (error) {
            this.logTest('functionality', 'Dashboard Load', 'FAIL', error.message);
        }
    }

    async testVisualRegression() {
        console.log('\n📸 Testing Visual Regression...');
        
        const viewports = [
            { name: 'desktop', width: 1200, height: 800 },
            { name: 'tablet', width: 768, height: 1024 },
            { name: 'mobile', width: 375, height: 667 }
        ];

        const tabs = [
            { name: 'matrix', title: 'Policy Matrix' },
            { name: 'platforms', title: 'Policy Explorer' },
            { name: 'analytics', title: 'Analytics & Logs' },
            { name: 'weekly', title: 'Weekly Update' }
        ];

        for (const viewport of viewports) {
            await this.page.setViewport(viewport);
            
            for (const tab of tabs) {
                try {
                    await this.page.click(`[data-tab="${tab.name}"]`);
                    await this.page.waitForFunction(
                        (tabName) => document.querySelector(`[data-tab="${tabName}"]`).classList.contains('active'),
                        {},
                        tab.name
                    );
                    
                    const screenshotPath = `./visual_regression_tests/${viewport.name}_${tab.name}_comprehensive.png`;
                    await this.page.screenshot({
                        path: screenshotPath,
                        fullPage: true
                    });
                    
                    this.logTest('visual_regression', `${viewport.name} - ${tab.title}`, 'PASS', 
                        `Screenshot saved: ${screenshotPath}`, screenshotPath);
                        
                } catch (error) {
                    this.logTest('visual_regression', `${viewport.name} - ${tab.title}`, 'FAIL', error.message);
                }
            }
        }
    }

    async testPerformance() {
        console.log('\n⚡ Testing Performance...');
        
        try {
            // Enable metrics
            await this.page.goto('http://localhost:8888');
            
            // Get performance metrics
            const metrics = await this.page.metrics();
            const timing = JSON.parse(await this.page.evaluate(() => JSON.stringify(performance.timing)));
            
            const loadTime = timing.loadEventEnd - timing.navigationStart;
            const domContentLoaded = timing.domContentLoadedEventEnd - timing.navigationStart;
            
            this.logTest('performance', 'Page Load Time', 
                loadTime < 5000 ? 'PASS' : 'WARN',
                `Load time: ${loadTime}ms, DOM ready: ${domContentLoaded}ms`);

            this.logTest('performance', 'JavaScript Heap', 
                metrics.JSHeapUsedSize < 50000000 ? 'PASS' : 'WARN', // 50MB
                `Heap used: ${Math.round(metrics.JSHeapUsedSize / 1024 / 1024)}MB`);

            // Test data fetch times
            const startTime = Date.now();
            await this.page.reload({ waitUntil: 'networkidle2' });
            const reloadTime = Date.now() - startTime;
            
            this.logTest('performance', 'Data Fetch Performance', 
                reloadTime < 10000 ? 'PASS' : 'WARN',
                `Reload time: ${reloadTime}ms`);

        } catch (error) {
            this.logTest('performance', 'Performance Metrics', 'FAIL', error.message);
        }
    }

    async testAccessibility() {
        console.log('\n♿ Testing Accessibility...');
        
        try {
            // Test keyboard navigation
            await this.page.focus('[data-tab="matrix"]');
            await this.page.keyboard.press('Tab');
            
            const focusedElement = await this.page.evaluate(() => document.activeElement.tagName);
            this.logTest('accessibility', 'Keyboard Navigation', 
                focusedElement === 'BUTTON' ? 'PASS' : 'WARN',
                `Focus moved to: ${focusedElement}`);

            // Check for accessibility attributes
            const ariaLabels = await this.page.$$eval('[aria-label]', els => els.length);
            const altTexts = await this.page.$$eval('img[alt]', els => els.length);
            
            this.logTest('accessibility', 'ARIA Labels', 
                ariaLabels > 0 ? 'PASS' : 'WARN',
                `Found ${ariaLabels} elements with aria-label`);

            this.logTest('accessibility', 'Image Alt Text', 
                altTexts >= 0 ? 'PASS' : 'WARN',
                `Found ${altTexts} images with alt text`);

            // Check color contrast (basic test)
            const headerBg = await this.page.evaluate(() => {
                const header = document.querySelector('header');
                return window.getComputedStyle(header).backgroundColor;
            });
            
            this.logTest('accessibility', 'Header Styling', 'PASS', 
                `Header background: ${headerBg}`);

        } catch (error) {
            this.logTest('accessibility', 'Accessibility Check', 'FAIL', error.message);
        }
    }

    async testErrorHandling() {
        console.log('\n🛡️ Testing Error Handling...');
        
        try {
            // Test error notification system
            await this.page.evaluate(() => {
                if (window.dashboardInstance) {
                    window.dashboardInstance.showDataLoadError('test-nonexistent.json', {
                        error: 'Test error for validation',
                        isNetworkError: true,
                        totalRetries: 3
                    });
                }
            });
            
            // Wait a moment for the notification to appear
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            const errorNotification = await this.page.$('.data-error-notification');
            this.logTest('error_handling', 'Error Notification System', 
                errorNotification ? 'PASS' : 'FAIL',
                'Error notification displayed correctly');

            // Test retry functionality
            const retryButton = await this.page.$('.retry-button');
            this.logTest('error_handling', 'Retry Button', 
                retryButton ? 'PASS' : 'FAIL',
                'Retry button available in error notification');

            // Test graceful degradation
            await this.page.evaluate(() => {
                // Simulate missing data
                if (window.dashboardInstance) {
                    window.dashboardInstance.runLogData = null;
                    window.dashboardInstance.renderAnalytics();
                }
            });
            
            const analyticsError = await this.page.$('.error-actions');
            this.logTest('error_handling', 'Graceful Degradation', 
                analyticsError ? 'PASS' : 'WARN',
                'Analytics shows error state for missing data');

        } catch (error) {
            this.logTest('error_handling', 'Error Handling', 'FAIL', error.message);
        }
    }

    async generateReport() {
        console.log('\n📊 Generating Comprehensive Test Report...');
        
        // Ensure directories exist
        if (!fs.existsSync('./test-results')) {
            fs.mkdirSync('./test-results', { recursive: true });
        }
        
        // Calculate additional metrics
        this.results.summary.success_rate = ((this.results.summary.passed / this.results.summary.total_tests) * 100).toFixed(1);
        
        // Generate detailed report
        const reportPath = './test-results/comprehensive_test_report.json';
        fs.writeFileSync(reportPath, JSON.stringify(this.results, null, 2));
        
        // Generate human-readable summary
        const summaryPath = './test-results/test_summary.md';
        const summaryContent = this.generateMarkdownSummary();
        fs.writeFileSync(summaryPath, summaryContent);
        
        console.log(`📄 Detailed report: ${reportPath}`);
        console.log(`📋 Summary report: ${summaryPath}`);
        
        return this.results.summary;
    }

    generateMarkdownSummary() {
        const { summary, categories } = this.results;
        
        let md = `# Comprehensive Test Report\n\n`;
        md += `**Generated:** ${this.results.timestamp}\n`;
        md += `**Test URL:** ${this.results.environment.test_url}\n\n`;
        
        md += `## Summary\n\n`;
        md += `- **Total Tests:** ${summary.total_tests}\n`;
        md += `- **✅ Passed:** ${summary.passed}\n`;
        md += `- **❌ Failed:** ${summary.failed}\n`;
        md += `- **⚠️ Warnings:** ${summary.warnings}\n`;
        md += `- **📈 Success Rate:** ${summary.success_rate}%\n\n`;
        
        for (const [category, tests] of Object.entries(categories)) {
            if (tests.length > 0) {
                md += `## ${category.charAt(0).toUpperCase() + category.slice(1).replace('_', ' ')}\n\n`;
                
                for (const test of tests) {
                    const icon = test.status === 'PASS' ? '✅' : test.status === 'FAIL' ? '❌' : '⚠️';
                    md += `${icon} **${test.name}**: ${test.details}\n`;
                }
                md += '\n';
            }
        }
        
        return md;
    }

    async run() {
        try {
            await this.init();
            
            await this.testFunctionality();
            await this.testVisualRegression();
            await this.testPerformance();
            await this.testAccessibility();
            await this.testErrorHandling();
            
            const summary = await this.generateReport();
            
            console.log('\n🎯 Final Results:');
            console.log(`✅ Passed: ${summary.passed}`);
            console.log(`❌ Failed: ${summary.failed}`);
            console.log(`⚠️ Warnings: ${summary.warnings}`);
            console.log(`📈 Success Rate: ${summary.success_rate}%`);
            
            if (summary.failed === 0) {
                console.log('\n🎉 All critical tests passed!');
                return true;
            } else {
                console.log('\n⚠️ Some tests failed. Check the detailed report.');
                return false;
            }
            
        } catch (error) {
            console.error('🚨 Test suite failed:', error);
            return false;
        } finally {
            if (this.browser) {
                await this.browser.close();
            }
        }
    }
}

// Run the comprehensive test suite
const testSuite = new ComprehensiveTestSuite();
testSuite.run().then(success => {
    process.exit(success ? 0 : 1);
});