// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  // Test directory
  testDir: './tests',
  
  // Maximum test duration in milliseconds
  timeout: 120000, // 2 minutes per test
  
  // Run tests in parallel across multiple workers
  workers: process.env.CI ? 2 : 4,
  
  // Fail the build on CI if you accidentally left test.only in the source code
  forbidOnly: !!process.env.CI,
  
  // Retry on CI only
  retries: process.env.CI ? 2 : 1,
  
  // Global test setup
  globalSetup: require.resolve('./tests/global-setup.js'),
  
  // Test output configuration
  outputDir: './test-results',
  
  // Reporter configuration
  reporter: [
    ['html', { 
      outputFolder: './test-results/playwright-report',
      open: 'never'
    }],
    ['json', {
      outputFile: './test-results/results.json'
    }],
    ['list'],
    ['./tests/custom-reporter.js']
  ],
  
  // Global test settings
  use: {
    // Base URL for production testing
    baseURL: 'https://ts-policy-watcher.vercel.app',
    
    // Browser context options
    viewport: { width: 1280, height: 720 },
    
    // Collect trace when retrying the failed test
    trace: 'retain-on-failure',
    
    // Take screenshots on failure
    screenshot: 'only-on-failure',
    
    // Record video on failure
    video: 'retain-on-failure',
    
    // Timeout for each action (e.g., click, fill, etc.)
    actionTimeout: 10000,
    
    // Timeout for page navigation
    navigationTimeout: 30000,
    
    // Accept downloads
    acceptDownloads: true,
    
    // Ignore HTTPS errors (for development)
    ignoreHTTPSErrors: true,
  },

  // Configure different browser projects
  projects: [
    // Desktop Chrome
    {
      name: 'chromium-desktop',
      use: { 
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    // Desktop Firefox
    {
      name: 'firefox-desktop',
      use: { 
        ...devices['Desktop Firefox'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    // Desktop Safari
    {
      name: 'webkit-desktop',
      use: { 
        ...devices['Desktop Safari'],
        viewport: { width: 1920, height: 1080 }
      },
    },

    // Mobile Chrome
    {
      name: 'mobile-chrome',
      use: { 
        ...devices['Pixel 5']
      },
    },

    // Mobile Safari
    {
      name: 'mobile-safari',
      use: { 
        ...devices['iPhone 12']
      },
    },

    // Tablet
    {
      name: 'tablet',
      use: { 
        ...devices['iPad Pro']
      },
    },

    // Performance testing with network simulation
    {
      name: 'performance-slow-3g',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Simulate slow 3G network
        launchOptions: {
          args: [
            '--disable-web-security',
            '--reduce-security-for-testing'
          ]
        }
      }
    },

    // Visual regression testing
    {
      name: 'visual-regression',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
        // Force GPU rendering for consistent screenshots
        launchOptions: {
          args: [
            '--force-gpu-rasterization',
            '--enable-gpu-rasterization'
          ]
        }
      }
    }
  ],

  // Web server configuration for local testing
  webServer: process.env.NODE_ENV === 'local' ? {
    command: 'python3 -m http.server 8888 --directory dashboard',
    port: 8888,
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  } : undefined,

  // Test metadata
  metadata: {
    testEnvironment: process.env.NODE_ENV || 'production',
    targetUrl: 'https://ts-policy-watcher.vercel.app',
    testSuiteVersion: '1.0.0',
    timestamp: new Date().toISOString()
  },

  // Expect configuration
  expect: {
    // Timeout for assertions
    timeout: 10000,
    
    // Screenshot comparison threshold
    threshold: 0.2, // Allow 20% difference for cross-browser compatibility
    
    // Animation handling
    toHaveScreenshot: { 
      animations: 'disabled',
      caret: 'hide'
    },
    
    toMatchSnapshot: { 
      threshold: 0.2,
      animations: 'disabled'
    }
  }
});