#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class ProductionTestRunner {
    constructor() {
        this.startTime = performance.now();
        this.results = {
            timestamp: new Date().toISOString(),
            environment: 'production',
            targetUrl: 'https://ts-policy-watcher.vercel.app',
            testSuites: [],
            summary: {
                totalTests: 0,
                passed: 0,
                failed: 0,
                skipped: 0,
                duration: 0
            },
            issues: [],
            artifacts: []
        };
        
        this.outputDir = path.join(__dirname, '..', 'test-results');
        this.reportDir = path.join(this.outputDir, 'reports');
        
        // Ensure directories exist
        [this.outputDir, this.reportDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    async runTestSuite(suiteName, specFile, project = 'chromium-desktop') {
        console.log(`\n🧪 Running ${suiteName}...`);
        const suiteStartTime = performance.now();
        
        try {
            const command = `npx playwright test ${specFile} --project=${project} --reporter=json`;
            console.log(`   Command: ${command}`);
            
            const output = execSync(command, { 
                cwd: path.join(__dirname, '..'),
                encoding: 'utf8',
                timeout: 300000 // 5 minutes timeout
            });
            
            const duration = performance.now() - suiteStartTime;
            
            // Try to parse Playwright JSON output
            let playwrightResults = null;
            try {
                const jsonOutput = output.split('\n').find(line => line.startsWith('{'));
                if (jsonOutput) {
                    playwrightResults = JSON.parse(jsonOutput);
                }
            } catch (parseError) {
                console.log('   ⚠️ Could not parse Playwright JSON output');
            }
            
            const suiteResult = {
                name: suiteName,
                specFile: specFile,
                project: project,
                status: 'passed',
                duration: Math.round(duration),
                output: output,
                playwrightResults: playwrightResults,
                timestamp: new Date().toISOString()
            };
            
            this.results.testSuites.push(suiteResult);
            this.results.summary.passed++;
            
            console.log(`   ✅ ${suiteName} completed in ${Math.round(duration)}ms`);
            
        } catch (error) {
            const duration = performance.now() - suiteStartTime;
            
            const suiteResult = {
                name: suiteName,
                specFile: specFile,
                project: project,
                status: 'failed',
                duration: Math.round(duration),
                error: error.message,
                output: error.stdout || error.output,
                timestamp: new Date().toISOString()
            };
            
            this.results.testSuites.push(suiteResult);
            this.results.summary.failed++;
            
            console.log(`   ❌ ${suiteName} failed: ${error.message}`);
        }
        
        this.results.summary.totalTests++;
    }

    async runAllTests() {
        console.log('🚀 Starting Production Test Suite');
        console.log(`📍 Target: ${this.results.targetUrl}`);
        console.log(`📅 Started: ${this.results.timestamp}\n`);

        // Test suites to run in order of priority
        const testSuites = [
            {
                name: 'Status Bar Debug (Critical)',
                spec: 'tests/status-bar-debug.spec.js',
                project: 'chromium-desktop',
                critical: true
            },
            {
                name: 'Production End-to-End',
                spec: 'tests/production-e2e.spec.js',
                project: 'chromium-desktop',
                critical: true
            },
            {
                name: 'Performance Analysis',
                spec: 'tests/performance.spec.js',
                project: 'performance-slow-3g',
                critical: false
            },
            {
                name: 'Visual Regression Desktop',
                spec: 'tests/visual-regression.spec.js',
                project: 'visual-regression',
                critical: false
            },
            {
                name: 'Cross-Browser Firefox',
                spec: 'tests/production-e2e.spec.js',
                project: 'firefox-desktop',
                critical: false
            },
            {
                name: 'Mobile Testing',
                spec: 'tests/production-e2e.spec.js',
                project: 'mobile-chrome',
                critical: false
            }
        ];

        // Run critical tests first
        const criticalTests = testSuites.filter(suite => suite.critical);
        const nonCriticalTests = testSuites.filter(suite => !suite.critical);

        console.log('🔥 Running critical tests first...');
        for (const suite of criticalTests) {
            await this.runTestSuite(suite.name, suite.spec, suite.project);
        }

        // Check if critical tests revealed the countdown issue
        await this.analyzeCriticalIssues();

        console.log('\n📋 Running additional test suites...');
        for (const suite of nonCriticalTests) {
            await this.runTestSuite(suite.name, suite.spec, suite.project);
        }
    }

    async analyzeCriticalIssues() {
        console.log('\n🔍 Analyzing critical test results...');
        
        // Check for countdown issue in results
        const statusDebugSuite = this.results.testSuites.find(suite => 
            suite.name.includes('Status Bar Debug')
        );
        
        if (statusDebugSuite) {
            // Look for specific patterns in output
            const output = statusDebugSuite.output || '';
            
            if (output.includes('BUG DETECTED') || output.includes('0 0 0')) {
                this.results.issues.push({
                    type: 'critical',
                    category: 'countdown_timer_bug',
                    description: 'Status bar showing "0 0 0" countdown issue detected',
                    evidence: 'Found in status bar debug test output',
                    severity: 'high',
                    source: 'status-bar-debug.spec.js'
                });
                
                console.log('🐛 CRITICAL ISSUE DETECTED: Countdown timer bug confirmed');
            }
            
            if (output.includes('SOLUTION IDENTIFIED')) {
                this.results.issues.push({
                    type: 'solution',
                    category: 'countdown_timer_fix',
                    description: 'Potential fix identified for countdown timer issue',
                    evidence: 'runData vs runLogData reference mismatch',
                    severity: 'solution',
                    source: 'status-bar-debug.spec.js'
                });
                
                console.log('💡 SOLUTION FOUND: runData vs runLogData reference issue');
            }
        }

        // Check for console errors in production tests
        const productionSuite = this.results.testSuites.find(suite => 
            suite.name.includes('Production End-to-End')
        );
        
        if (productionSuite && productionSuite.output) {
            const consoleErrorCount = (productionSuite.output.match(/Console Error:/g) || []).length;
            if (consoleErrorCount > 0) {
                this.results.issues.push({
                    type: 'error',
                    category: 'console_errors',
                    description: `${consoleErrorCount} console errors detected in production`,
                    severity: 'medium',
                    source: 'production-e2e.spec.js'
                });
            }
        }
    }

    generateSummaryReport() {
        this.results.summary.duration = Math.round(performance.now() - this.startTime);
        
        console.log('\n📊 TEST SUMMARY');
        console.log('═'.repeat(50));
        console.log(`🎯 Target URL: ${this.results.targetUrl}`);
        console.log(`⏱️  Total Duration: ${this.results.summary.duration}ms`);
        console.log(`📈 Total Tests: ${this.results.summary.totalTests}`);
        console.log(`✅ Passed: ${this.results.summary.passed}`);
        console.log(`❌ Failed: ${this.results.summary.failed}`);
        console.log(`⏭️  Skipped: ${this.results.summary.skipped}`);
        
        if (this.results.issues.length > 0) {
            console.log('\n🚨 ISSUES FOUND:');
            this.results.issues.forEach((issue, index) => {
                const icon = issue.type === 'critical' ? '🔥' : issue.type === 'solution' ? '💡' : '⚠️';
                console.log(`   ${icon} ${issue.description}`);
                if (issue.evidence) {
                    console.log(`      Evidence: ${issue.evidence}`);
                }
            });
        } else {
            console.log('\n✨ No critical issues detected');
        }

        // Save detailed results
        const resultsFile = path.join(this.reportDir, 'test-execution-summary.json');
        fs.writeFileSync(resultsFile, JSON.stringify(this.results, null, 2));
        
        // Generate HTML report
        this.generateHtmlReport();
        
        console.log(`\n📄 Detailed results saved to: ${resultsFile}`);
        console.log(`🌐 HTML report: ${path.join(this.reportDir, 'test-report.html')}`);
        
        return this.results;
    }

    generateHtmlReport() {
        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Production Test Results - ${new Date().toLocaleDateString()}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0; }
        .content { padding: 30px; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric-card { background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 20px; text-align: center; }
        .metric-number { font-size: 2em; font-weight: bold; margin-bottom: 5px; }
        .metric-label { color: #666; font-size: 0.9em; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .issue-card { border-left: 4px solid #dc3545; background: #fff5f5; padding: 15px; margin: 10px 0; border-radius: 0 6px 6px 0; }
        .solution-card { border-left: 4px solid #ffc107; background: #fffbf0; padding: 15px; margin: 10px 0; border-radius: 0 6px 6px 0; }
        .test-suite { border: 1px solid #e9ecef; border-radius: 6px; margin: 15px 0; overflow: hidden; }
        .test-header { background: #f8f9fa; padding: 15px; border-bottom: 1px solid #e9ecef; font-weight: bold; }
        .test-content { padding: 15px; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        pre { background: #f8f9fa; padding: 10px; border-radius: 4px; overflow-x: auto; font-size: 0.8em; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Production Test Results</h1>
            <p>Target: ${this.results.targetUrl}</p>
            <p>Executed: ${this.results.timestamp}</p>
            <p>Duration: ${this.results.summary.duration}ms</p>
        </div>
        
        <div class="content">
            <div class="summary-grid">
                <div class="metric-card">
                    <div class="metric-number">${this.results.summary.totalTests}</div>
                    <div class="metric-label">Total Tests</div>
                </div>
                <div class="metric-card">
                    <div class="metric-number passed">${this.results.summary.passed}</div>
                    <div class="metric-label">Passed</div>
                </div>
                <div class="metric-card">
                    <div class="metric-number failed">${this.results.summary.failed}</div>
                    <div class="metric-label">Failed</div>
                </div>
                <div class="metric-card">
                    <div class="metric-number">${this.results.issues.length}</div>
                    <div class="metric-label">Issues Found</div>
                </div>
            </div>

            ${this.results.issues.length > 0 ? `
            <h2>🚨 Issues Detected</h2>
            ${this.results.issues.map(issue => `
                <div class="${issue.type === 'solution' ? 'solution-card' : 'issue-card'}">
                    <h3>${issue.type === 'critical' ? '🔥' : issue.type === 'solution' ? '💡' : '⚠️'} ${issue.description}</h3>
                    ${issue.evidence ? `<p><strong>Evidence:</strong> ${issue.evidence}</p>` : ''}
                    <p><strong>Severity:</strong> ${issue.severity}</p>
                    <p><strong>Source:</strong> ${issue.source}</p>
                </div>
            `).join('')}
            ` : '<h2>✨ No Issues Detected</h2>'}

            <h2>📋 Test Suite Results</h2>
            ${this.results.testSuites.map(suite => `
                <div class="test-suite">
                    <div class="test-header">
                        <span class="status-${suite.status}">${suite.status === 'passed' ? '✅' : '❌'}</span>
                        ${suite.name} (${suite.duration}ms)
                    </div>
                    <div class="test-content">
                        <p><strong>Spec:</strong> ${suite.specFile}</p>
                        <p><strong>Project:</strong> ${suite.project}</p>
                        <p><strong>Duration:</strong> ${suite.duration}ms</p>
                        ${suite.error ? `<p><strong>Error:</strong> ${suite.error}</p>` : ''}
                        ${suite.output ? `
                            <details>
                                <summary>View Output</summary>
                                <pre>${suite.output.substring(0, 1000)}${suite.output.length > 1000 ? '...' : ''}</pre>
                            </details>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>
    </div>
</body>
</html>`;

        const htmlFile = path.join(this.reportDir, 'test-report.html');
        fs.writeFileSync(htmlFile, htmlContent);
    }
}

// CLI execution
if (require.main === module) {
    const runner = new ProductionTestRunner();
    
    runner.runAllTests()
        .then(() => runner.generateSummaryReport())
        .then((results) => {
            const exitCode = results.summary.failed > 0 ? 1 : 0;
            console.log(`\n${exitCode === 0 ? '🎉 All tests completed successfully!' : '⚠️ Some tests failed - check the report for details'}`);
            process.exit(exitCode);
        })
        .catch((error) => {
            console.error('❌ Test runner failed:', error);
            process.exit(1);
        });
}

module.exports = ProductionTestRunner;