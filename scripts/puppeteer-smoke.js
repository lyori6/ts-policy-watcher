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

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout });

    // Ensure the Policy Explorer tab is active before we look for cards
    const platformsTabSelector = '[data-tab="platforms"]';
    await page.waitForSelector(platformsTabSelector, { timeout });
    await page.click(platformsTabSelector);

    // Wait for Policy Explorer content to load
    await page.waitForSelector('.policy-card', { timeout });
    const policySamples = await page.$$eval('.policy-card h4', nodes => nodes.slice(0, 3).map(n => n.textContent.trim()));

    // Switch to analytics tab to verify history renders
    await page.click('[data-tab="analytics"]');
    await page.waitForSelector('#history-table tbody tr', { timeout: 30_000 });
    const runEntries = await page.$$eval('#history-table tbody tr', rows => rows.length);

    console.log(`✅ Policy cards detected: ${policySamples.join(', ') || 'none found'}`);
    console.log(`✅ Run history rows rendered: ${runEntries}`);

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
