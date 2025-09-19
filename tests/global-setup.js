// Global setup for Playwright tests
const fs = require('fs');
const path = require('path');

async function globalSetup(config) {
  console.log('🌍 Global test setup starting...');
  
  // Ensure all test result directories exist
  const dirs = [
    './test-results',
    './test-results/screenshots', 
    './test-results/performance',
    './test-results/visual-regression',
    './test-results/status-debug',
    './test-results/reports'
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
  
  // Set up environment variables
  process.env.TEST_ENV = 'production';
  process.env.TARGET_URL = 'https://ts-policy-watcher.vercel.app';
  
  console.log('✅ Global setup complete');
}

module.exports = globalSetup;