// Custom reporter for enhanced test results
class CustomReporter {
  constructor(options = {}) {
    this.options = options;
    this.startTime = Date.now();
    this.results = {
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0
      }
    };
  }

  onBegin(config, suite) {
    console.log('🎬 Starting test execution...');
    console.log(`📍 Target: ${process.env.TARGET_URL || 'https://ts-policy-watcher.vercel.app'}`);
  }

  onTestEnd(test, result) {
    const status = result.status;
    this.results.summary.total++;
    
    if (status === 'passed') {
      this.results.summary.passed++;
      console.log(`✅ ${test.title}`);
    } else if (status === 'failed') {
      this.results.summary.failed++;
      console.log(`❌ ${test.title}`);
      if (result.error) {
        console.log(`   Error: ${result.error.message}`);
      }
    } else {
      this.results.summary.skipped++;
      console.log(`⏭️ ${test.title} (${status})`);
    }

    this.results.tests.push({
      title: test.title,
      status: status,
      duration: result.duration,
      error: result.error?.message,
      timestamp: new Date().toISOString()
    });
  }

  onEnd(result) {
    const duration = Date.now() - this.startTime;
    
    console.log('\n📊 Test Execution Summary:');
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Total: ${this.results.summary.total}`);
    console.log(`   ✅ Passed: ${this.results.summary.passed}`);
    console.log(`   ❌ Failed: ${this.results.summary.failed}`);
    console.log(`   ⏭️ Skipped: ${this.results.summary.skipped}`);
    
    // Save custom results
    const fs = require('fs');
    const path = require('path');
    
    const resultsDir = './test-results';
    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }
    
    const reportPath = path.join(resultsDir, 'custom-report.json');
    fs.writeFileSync(reportPath, JSON.stringify({
      ...this.results,
      duration,
      timestamp: new Date().toISOString()
    }, null, 2));
    
    console.log(`📄 Custom report saved: ${reportPath}`);
  }
}

module.exports = CustomReporter;