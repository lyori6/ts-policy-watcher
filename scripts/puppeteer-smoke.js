#!/usr/bin/env node
/**
 * Lightweight Puppeteer smoke test for the T&S Policy Watcher dashboard.
 *
 * Usage:
 *   node scripts/puppeteer-smoke.js [url] [--screenshot path]
 *
 * Defaults to http://localhost:3000 if no URL is provided. The script verifies
 * that the Policy Explorer cards and run history table render, printing a short
 * summary to stdout for quick sanity checks during incremental rollouts.
 */

const puppeteer = require('puppeteer');

async function run() {
  const args = process.argv.slice(2);
  const url = args.find(arg => !arg.startsWith('--')) || 'http://localhost:3000';
  const screenshotFlag = args.find(arg => arg.startsWith('--screenshot'));
  const screenshotPath = screenshotFlag ? screenshotFlag.split('=')[1] || 'puppeteer-smoke.png' : null;

  const timeoutFlag = args.find(arg => arg.startsWith('--timeout'));
  const timeout = timeoutFlag ? Number(timeoutFlag.split('=')[1]) || 60_000 : 60_000;

  console.log(`🚀 Starting Puppeteer smoke test for ${url}`);

  const browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });
  const page = await browser.newPage();

  try {
    // Use a less strict wait condition to avoid hanging on preview/prod where
    // long-lived connections (CDN/analytics/fonts) can keep the network busy.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    console.log('➡️  Navigated (domcontentloaded)');

    // Ensure the Policy Explorer tab is active before we look for cards
    const platformsTabSelector = '[data-tab="platforms"]';
    await page.waitForSelector(platformsTabSelector, { timeout });
    console.log('➡️  Platforms tab located');
    await page.click(platformsTabSelector);
    console.log('➡️  Platforms tab clicked');

    // Wait for Policy Explorer content to load
    await page.waitForSelector('.policy-card', { timeout });
    console.log('➡️  Policy cards detected');
    const policySamples = await page.$$eval('.policy-card h4', nodes => nodes.slice(0, 3).map(n => n.textContent.trim()));

    const historyModalEnabled = await page.evaluate(() => {
      return Boolean(window.policyDashboard && window.policyDashboard.historyModalEnabled);
    });

    // Switch to analytics tab to verify history renders
    await page.click('[data-tab="analytics"]');
    console.log('➡️  Analytics tab clicked');
    await page.waitForSelector('#history-table tbody tr', { timeout: 30_000 });
    const runEntries = await page.$$eval('#history-table tbody tr', rows => rows.length);
    console.log(`➡️  History rows detected: ${runEntries}`);

    console.log(`✅ Policy cards detected: ${policySamples.join(', ') || 'none found'}`);
    console.log(`✅ Run history rows rendered: ${runEntries}`);

    if (historyModalEnabled) {
      console.log('➡️  History modal enabled – running modal check');
      await page.click(platformsTabSelector);
      await page.waitForSelector('.policy-card', { timeout });
      await page.$eval('.policy-card', card => card.click());
      await page.waitForSelector('#policy-summary-modal .modal-content', { visible: true, timeout });
      await page.click('#policy-modal-history');
      await page.waitForSelector('#policy-history-modal .modal-content', { visible: true, timeout });
      await page.waitForSelector('#policy-history-list', { timeout });
      const entryCount = await page.$$eval('#policy-history-list .history-entry-button', nodes => nodes.length);
      if (entryCount > 0) {
        await page.click('#policy-history-list .history-entry-button');
        await page.waitForSelector('.history-entry-text', { timeout });
        console.log(`✅ Policy history modal rendered with ${entryCount} entr${entryCount === 1 ? 'y' : 'ies'}`);
      } else {
        console.log('⚠️ Policy history modal loaded but no entries were found.');
      }
      await page.click('#policy-history-modal .close-button');
      await page.click('#policy-summary-modal .close-button');
    } else {
      console.log('ℹ️  Policy history modal disabled in this environment; skipping modal check.');
    }

    if (screenshotPath) {
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 Screenshot captured at ${screenshotPath}`);
    }
  } catch (error) {
    console.error('❌ Puppeteer smoke test failed:', error);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

run();
