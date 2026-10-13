const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

class E2ETestRunner {
    constructor() {
        this.browser = null;
        this.page = null;
        this.baseUrl = 'http://localhost:8888';
        this.testResults = {
            timestamp: new Date().toISOString(),
            summary: {
                total_tests: 0,
                passed: 0,
                failed: 0,
                errors: 0
            },
            results: []
        };
        this.screenshotDir = './visual_regression_tests';
        
        // Ensure screenshot directory exists
        if (!fs.existsSync(this.screenshotDir)) {
            fs.mkdirSync(this.screenshotDir, { recursive: true });
        }
    }

    async init() {
        console.log('🚀 Starting E2E Test Suite...');
        this.browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        this.page = await this.browser.newPage();
        
        // Set up error monitoring
        this.page.on('console', message => {
            if (message.type() === 'error') {
                console.log('❌ Console Error:', message.text());
            }
        });
        
        this.page.on('pageerror', error => {
            console.log('❌ Page Error:', error.message);
        });
    }

    async cleanup() {
        if (this.browser) {
            await this.browser.close();
        }
    }

    async waitForDashboardLoad() {
        // Wait for main elements to be visible
        await this.page.waitForSelector('header', { timeout: 10000 });
        await this.page.waitForSelector('main', { timeout: 10000 });
        await this.page.waitForSelector('.tab-buttons', { timeout: 10000 });
        
        // Wait for data to load by checking for specific elements
        await this.page.waitForFunction(() => {
            const headerPolicies = document.getElementById('header-total-policies');
            return headerPolicies && headerPolicies.textContent !== '-';
        }, { timeout: 15000 });
        
        // Give extra time for all data to settle
        await this.page.waitForTimeout(2000);
    }

    async runTest(testName, testFunction, viewport, tab = null) {
        console.log(`🧪 Running test: ${testName} (${viewport.name}${tab ? ` - ${tab}` : ''})`);
        
        try {
            await this.page.setViewport(viewport);
            await this.page.goto(this.baseUrl, { waitUntil: 'networkidle2' });
            await this.waitForDashboardLoad();
            
            if (tab) {
                await this.switchToTab(tab);
            }
            
            const result = await testFunction();
            const screenshotPath = `${this.screenshotDir}/${viewport.name.toLowerCase()}_${tab ? tab.toLowerCase().replace(/[^a-z]/g, '_') : 'overview'}.png`;
            
            await this.page.screenshot({
                path: screenshotPath,
                fullPage: true
            });
            
            this.testResults.results.push({
                viewport: viewport.name.toLowerCase(),
                tab: tab || 'Overview',
                screenshot: screenshotPath,
                tests: Array.isArray(result) ? result : [result]
            });
            
            const testCount = Array.isArray(result) ? result.length : 1;
            const passedCount = Array.isArray(result) ? result.filter(t => t.status === 'pass').length : (result.status === 'pass' ? 1 : 0);
            
            this.testResults.summary.total_tests += testCount;
            this.testResults.summary.passed += passedCount;
            this.testResults.summary.failed += (testCount - passedCount);
            
            console.log(`✅ ${testName} completed (${passedCount}/${testCount} passed)`);
            
        } catch (error) {
            console.log(`❌ ${testName} failed:`, error.message);
            this.testResults.summary.total_tests += 1;
            this.testResults.summary.errors += 1;
            
            this.testResults.results.push({
                viewport: viewport.name.toLowerCase(),
                tab: tab || 'Overview',
                screenshot: null,
                tests: [{
                    name: testName,
                    status: 'error',
                    details: error.message
                }]
            });
        }
    }

    async switchToTab(tabName) {
        const tabSelectors = {
            'Policy Matrix': '[data-tab="matrix"]',
            'ChangeLog': '[data-tab="changelog"]', 
            'Policy Explorer': '[data-tab="platforms"]',
            'Analytics & Logs': '[data-tab="analytics"]',
            'Weekly Update': '[data-tab="weekly"]'
        };
        
        const selector = tabSelectors[tabName];
        if (!selector) {
            throw new Error(`Unknown tab: ${tabName}`);
        }
        
        await this.page.click(selector);
        await this.page.waitForTimeout(1000); // Wait for tab switch animation
        
        // Wait for tab content to be visible
        const contentSelectors = {
            'Policy Matrix': '#matrix-tbody',
            'ChangeLog': '.changelog-container',
            'Policy Explorer': '.policies-container',
            'Analytics & Logs': '.analytics-container, .system-logs-container',
            'Weekly Update': '.weekly-summary-container'
        };
        
        const contentSelector = contentSelectors[tabName];
        if (contentSelector) {
            await this.page.waitForSelector(contentSelector, { timeout: 10000 });
        }
        
        await this.page.waitForTimeout(1000); // Additional wait for content to render
    }

    // Test Functions
    async testMatrixDisplay() {
        const matrixTable = await this.page.$('#matrix-tbody');
        const rows = await this.page.$$('#matrix-tbody tr');
        
        return {
            name: 'Matrix Display',
            status: matrixTable && rows.length > 0 ? 'pass' : 'fail',
            details: `Matrix table: ${!!matrixTable}, Rows: ${rows.length}`
        };
    }

    async testChangeLogPagination() {
        const paginationContainer = await this.page.$('.pagination');
        const paginationInfo = await this.page.$('.pagination-info');
        
        return {
            name: 'ChangeLog Pagination',
            status: paginationContainer && paginationInfo ? 'pass' : 'fail',
            details: `Pagination container: ${!!paginationContainer}, Info element: ${!!paginationInfo}`
        };
    }

    async testPolicyExplorer() {
        const tests = [];
        
        // Test pagination
        const paginationContainer = await this.page.$('.pagination');
        const paginationInfo = await this.page.$('.pagination-info');
        tests.push({
            name: 'Policy Explorer Pagination',
            status: paginationContainer && paginationInfo ? 'pass' : 'fail',
            details: `Pagination container: ${!!paginationContainer}, Info element: ${!!paginationInfo}`
        });
        
        // Test platform filtering
        try {
            await this.page.click('select[id*="platform"]');
            await this.page.select('select[id*="platform"]', 'tiktok');
            await this.page.waitForTimeout(500);
            
            const visibleCards = await this.page.$$('.policy-card:not([style*="display: none"])');
            tests.push({
                name: 'Platform Filtering',
                status: visibleCards.length > 0 ? 'pass' : 'fail',
                details: `Found ${visibleCards.length} policy cards after filtering`
            });
        } catch (error) {
            tests.push({
                name: 'Platform Filtering',
                status: 'fail',
                details: `Error testing filtering: ${error.message}`
            });
        }
        
        // Test read more buttons
        const readMoreButtons = await this.page.$$('.read-more-btn, .toggle-summary');
        tests.push({
            name: 'Read More Buttons',
            status: readMoreButtons.length > 0 ? 'pass' : 'fail',
            details: `Found ${readMoreButtons.length} read more buttons`
        });
        
        return tests;
    }

    async testAnalytics() {
        const tests = [];
        
        // Test system logs pagination
        const paginationContainer = await this.page.$('.pagination');
        const paginationInfo = await this.page.$('.pagination-info');
        tests.push({
            name: 'System Logs Pagination',
            status: paginationContainer && paginationInfo ? 'pass' : 'fail',
            details: `Pagination container: ${!!paginationContainer}, Info element: ${!!paginationInfo}`
        });
        
        // Test history filtering
        try {
            const filterDropdown = await this.page.$('select[id*="timeframe"], select[id*="filter"]');
            tests.push({
                name: 'History Filtering',
                status: filterDropdown ? 'pass' : 'fail',
                details: 'Filter dropdown functional'
            });
        } catch (error) {
            tests.push({
                name: 'History Filtering',
                status: 'fail',
                details: `Error testing filtering: ${error.message}`
            });
        }
        
        return tests;
    }

    async testDiagnostics() {
        const tests = [];
        
        // Test diagnostics button
        try {
            await this.page.click('.diagnostics-button');
            await this.page.waitForSelector('#diagnostic-modal', { timeout: 5000 });
            
            const modal = await this.page.$('#diagnostic-modal');
            tests.push({
                name: 'Diagnostics Modal',
                status: modal ? 'pass' : 'fail',
                details: 'Diagnostics modal opens successfully'
            });
            
            // Close modal
            await this.page.click('.close-button');
            await this.page.waitForTimeout(500);
            
        } catch (error) {
            tests.push({
                name: 'Diagnostics Modal',
                status: 'fail',
                details: `Error testing diagnostics: ${error.message}`
            });
        }
        
        return tests;
    }

    async testResponsiveness() {
        const tests = [];
        
        // Test mobile navigation
        const viewport = await this.page.viewport();
        if (viewport.width <= 768) {
            const nav = await this.page.$('.tab-buttons');
            const isVisible = await this.page.evaluate(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden';
            }, nav);
            
            tests.push({
                name: 'Mobile Navigation',
                status: isVisible ? 'pass' : 'fail',
                details: 'Tab navigation is visible on mobile'
            });
        }
        
        // Test content scaling
        const main = await this.page.$('main');
        const isVisible = await this.page.evaluate(el => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        }, main);
        
        tests.push({
            name: 'Content Scaling',
            status: isVisible ? 'pass' : 'fail',
            details: 'Main content scales properly'
        });
        
        return tests;
    }

    async testKeyboardShortcuts() {
        const tests = [];
        
        // Test Ctrl+D shortcut
        try {
            await this.page.keyboard.down('Control');
            await this.page.keyboard.press('KeyD');
            await this.page.keyboard.up('Control');
            
            await this.page.waitForSelector('#diagnostic-modal', { timeout: 3000 });
            const modal = await this.page.$('#diagnostic-modal');
            
            tests.push({
                name: 'Ctrl+D Shortcut',
                status: modal ? 'pass' : 'fail',
                details: 'Ctrl+D opens diagnostics modal'
            });
            
            // Test Escape to close
            await this.page.keyboard.press('Escape');
            await this.page.waitForTimeout(500);
            
            const modalAfterEscape = await this.page.$('#diagnostic-modal');
            tests.push({
                name: 'Escape Shortcut',
                status: !modalAfterEscape ? 'pass' : 'fail',
                details: 'Escape closes modal'
            });
            
        } catch (error) {
            tests.push({
                name: 'Keyboard Shortcuts',
                status: 'fail',
                details: `Error testing shortcuts: ${error.message}`
            });
        }
        
        return tests;
    }

    async testErrorHandling() {
        const tests = [];
        
        // Test error notification system
        try {
            // Trigger a fetch error by requesting a non-existent URL
            await this.page.evaluate(() => {
                // Simulate a data loading error
                if (window.dashboardInstance) {
                    window.dashboardInstance.showDataLoadError('test-file.json', {
                        error: 'Test error',
                        isNetworkError: true,
                        totalRetries: 3
                    });
                }
            });
            
            await this.page.waitForTimeout(1000);
            const errorNotification = await this.page.$('.data-error-notification');
            
            tests.push({
                name: 'Error Notification',
                status: errorNotification ? 'pass' : 'fail',
                details: 'Error notification displays correctly'
            });
            
        } catch (error) {
            tests.push({
                name: 'Error Handling',
                status: 'fail',
                details: `Error testing error handling: ${error.message}`
            });
        }
        
        return tests;
    }

    async runAllTests() {
        const viewports = [
            { name: 'Mobile', width: 375, height: 667 },
            { name: 'Tablet', width: 768, height: 1024 },
            { name: 'Desktop', width: 1200, height: 800 }
        ];

        const tabs = ['Policy Matrix', 'ChangeLog', 'Policy Explorer', 'Analytics & Logs'];

        for (const viewport of viewports) {
            // Test each tab
            for (const tab of tabs) {
                switch (tab) {
                    case 'Policy Matrix':
                        await this.runTest('Matrix Display', () => this.testMatrixDisplay(), viewport, tab);
                        break;
                    case 'ChangeLog':
                        await this.runTest('ChangeLog Pagination', () => this.testChangeLogPagination(), viewport, tab);
                        break;
                    case 'Policy Explorer':
                        await this.runTest('Policy Explorer Tests', () => this.testPolicyExplorer(), viewport, tab);
                        break;
                    case 'Analytics & Logs':
                        await this.runTest('Analytics Tests', () => this.testAnalytics(), viewport, tab);
                        break;
                }
            }

            // Test responsive design
            await this.runTest('Responsiveness', () => this.testResponsiveness(), viewport);
        }

        // Test features that only need to run once
        await this.runTest('Diagnostics', () => this.testDiagnostics(), viewports[2]); // Desktop
        await this.runTest('Keyboard Shortcuts', () => this.testKeyboardShortcuts(), viewports[2]); // Desktop
        await this.runTest('Error Handling', () => this.testErrorHandling(), viewports[2]); // Desktop
    }

    async saveResults() {
        const reportPath = './test-results/e2e_test_report.json';
        
        // Ensure test-results directory exists
        if (!fs.existsSync('./test-results')) {
            fs.mkdirSync('./test-results', { recursive: true });
        }
        
        fs.writeFileSync(reportPath, JSON.stringify(this.testResults, null, 2));
        console.log(`📊 Test results saved to: ${reportPath}`);
        
        // Print summary
        console.log('\n📈 Test Summary:');
        console.log(`Total Tests: ${this.testResults.summary.total_tests}`);
        console.log(`✅ Passed: ${this.testResults.summary.passed}`);
        console.log(`❌ Failed: ${this.testResults.summary.failed}`);
        console.log(`🚨 Errors: ${this.testResults.summary.errors}`);
        
        const successRate = ((this.testResults.summary.passed / this.testResults.summary.total_tests) * 100).toFixed(1);
        console.log(`📊 Success Rate: ${successRate}%`);
    }

    async run() {
        try {
            await this.init();
            await this.runAllTests();
            await this.saveResults();
            
            if (this.testResults.summary.failed === 0 && this.testResults.summary.errors === 0) {
                console.log('\n🎉 All tests passed!');
                process.exit(0);
            } else {
                console.log('\n⚠️  Some tests failed. Check the report for details.');
                process.exit(1);
            }
            
        } catch (error) {
            console.error('🚨 Test runner failed:', error);
            process.exit(1);
        } finally {
            await this.cleanup();
        }
    }
}

// Run the tests
const testRunner = new E2ETestRunner();
testRunner.run();