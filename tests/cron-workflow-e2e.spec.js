// tests/cron-workflow-e2e.spec.js

const { test, expect } = require('@playwright/test');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

/**
 * End-to-End Tests for Policy Watcher Cron Job Workflow
 *
 * These tests validate the complete automation workflow:
 * 1. Policy change detection
 * 2. Snapshot updates
 * 3. Summary generation
 * 4. Branch management (main vs policy-changes)
 * 5. Dashboard integration
 */

test.describe('Policy Watcher Cron Job E2E Tests', () => {

  test.beforeAll(async () => {
    // Ensure we have the required environment setup
    console.log('Setting up E2E test environment...');
  });

  test('validates automation workflow creates CHORE commits on main branch', async () => {
    // This test simulates the 6-hour automation workflow

    // 1. Check that main branch contains CHORE commits
    const mainCommits = execSync('git log --oneline -10', { encoding: 'utf8' });
    const choreCommits = mainCommits.split('\n').filter(line => line.includes('CHORE:'));

    expect(choreCommits.length).toBeGreaterThan(0);
    console.log(`Found ${choreCommits.length} CHORE commits on main branch`);

    // 2. Verify CHORE commits have the expected pattern
    const expectedPatterns = [
      'CHORE: Update T&S policy snapshots and health data',
      'CHORE: Update policy summaries and run log'
    ];

    const hasExpectedPattern = choreCommits.some(commit =>
      expectedPatterns.some(pattern => commit.includes(pattern))
    );
    expect(hasExpectedPattern).toBe(true);
  });

  test('validates policy-changes branch excludes automation commits', async () => {
    // Switch to policy-changes branch and verify it has clean history

    try {
      execSync('git checkout policy-changes', { encoding: 'utf8' });
      const policyCommits = execSync('git log --oneline -20', { encoding: 'utf8' });
      const choreCommits = policyCommits.split('\n').filter(line => line.includes('CHORE:'));

      // Policy-changes branch should have NO CHORE commits
      expect(choreCommits.length).toBe(0);
      console.log('✓ Policy-changes branch contains no automation noise');

      // Should contain meaningful commits
      const meaningfulCommits = policyCommits.split('\n').filter(line =>
        line.includes('FIX:') || line.includes('FEAT:') || line.includes('REFACTOR:') ||
        line.includes('MOBILE FIX:') || line.includes('ANALYTICS FIX:')
      );
      expect(meaningfulCommits.length).toBeGreaterThan(0);
      console.log(`✓ Policy-changes branch contains ${meaningfulCommits.length} meaningful commits`);

    } finally {
      // Always switch back to main
      execSync('git checkout main', { encoding: 'utf8' });
    }
  });

  test('validates summaries.json structure and content', async () => {
    const summariesPath = path.join(process.cwd(), 'summaries.json');
    const summariesContent = await fs.readFile(summariesPath, 'utf8');
    const summaries = JSON.parse(summariesContent);

    // Verify structure
    expect(typeof summaries).toBe('object');

    // Check for required fields in at least one policy
    const policyKeys = Object.keys(summaries);
    expect(policyKeys.length).toBeGreaterThan(0);

    const firstPolicy = summaries[policyKeys[0]];
    expect(firstPolicy).toHaveProperty('policy_name');
    expect(firstPolicy).toHaveProperty('initial_summary');
    expect(firstPolicy).toHaveProperty('last_update_summary');
    expect(firstPolicy).toHaveProperty('last_updated');

    // If the policy has history (from PR #3), validate structure
    if (firstPolicy.history) {
      expect(Array.isArray(firstPolicy.history)).toBe(true);
      if (firstPolicy.history.length > 0) {
        const historyEntry = firstPolicy.history[0];
        expect(historyEntry).toHaveProperty('summary');
        expect(historyEntry).toHaveProperty('change_type');
        expect(historyEntry).toHaveProperty('timestamp');
        expect(historyEntry).toHaveProperty('snapshot_path');
      }
    }

    console.log(`✓ Summaries.json contains ${policyKeys.length} policies with valid structure`);
  });

  test('validates run_log.json tracking', async () => {
    const runLogPath = path.join(process.cwd(), 'run_log.json');
    const runLogContent = await fs.readFile(runLogPath, 'utf8');
    const runLog = JSON.parse(runLogContent);

    expect(Array.isArray(runLog)).toBe(true);
    expect(runLog.length).toBeGreaterThan(0);

    const latestRun = runLog[0];
    expect(latestRun).toHaveProperty('timestamp_utc');
    expect(latestRun).toHaveProperty('status');
    expect(latestRun).toHaveProperty('pages_checked');
    expect(latestRun).toHaveProperty('changes_found');
    expect(latestRun).toHaveProperty('errors');

    // Validate timestamp format
    expect(latestRun.timestamp_utc).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z$/);
    expect(['success', 'error', 'partial']).toContain(latestRun.status);

    console.log(`✓ Run log contains ${runLog.length} entries with valid structure`);
  });

  test('validates weekly_summaries.json structure', async () => {
    const weeklyPath = path.join(process.cwd(), 'weekly_summaries.json');

    try {
      const weeklyContent = await fs.readFile(weeklyPath, 'utf8');
      const weeklySummaries = JSON.parse(weeklyContent);

      expect(typeof weeklySummaries).toBe('object');

      // Check structure of weekly summaries
      const weekKeys = Object.keys(weeklySummaries);
      if (weekKeys.length > 0) {
        const firstWeek = weeklySummaries[weekKeys[0]];
        expect(firstWeek).toHaveProperty('run_metadata');
        expect(firstWeek).toHaveProperty('summary');
        expect(firstWeek).toHaveProperty('changes_count');
        expect(firstWeek).toHaveProperty('changed_policies');

        console.log(`✓ Weekly summaries contains ${weekKeys.length} week periods`);
      }
    } catch (error) {
      // Weekly summaries might not exist in all environments
      console.log('ℹ Weekly summaries file not found - this is acceptable for test environments');
    }
  });

  test('validates snapshot files exist and have content', async () => {
    const snapshotsDir = path.join(process.cwd(), 'snapshots/production');

    try {
      const platforms = await fs.readdir(snapshotsDir);
      expect(platforms.length).toBeGreaterThan(0);

      // Check a few random snapshot files
      const samplePlatforms = platforms.slice(0, 3);
      for (const platform of samplePlatforms) {
        const snapshotPath = path.join(snapshotsDir, platform, 'snapshot.html');
        const snapshotContent = await fs.readFile(snapshotPath, 'utf8');

        expect(snapshotContent.length).toBeGreaterThan(100); // Should have substantial content
        expect(snapshotContent).toContain('<html'); // Should be valid HTML
      }

      console.log(`✓ Validated ${samplePlatforms.length} snapshot files`);
    } catch (error) {
      console.error('Error validating snapshots:', error.message);
      throw error;
    }
  });
});

test.describe('Dashboard Integration Tests', () => {

  test('validates dashboard can load with current data structure', async ({ page }) => {
    // Navigate to local dashboard
    const dashboardPath = path.join(process.cwd(), 'dashboard/index.html');
    await page.goto(`file://${dashboardPath}`);

    // Wait for dashboard to load
    await page.waitForSelector('.dashboard-container', { timeout: 10000 });

    // Check for key dashboard elements
    await expect(page.locator('.dashboard-container')).toBeVisible();

    // Verify policy cards are rendered
    const policyCards = page.locator('.policy-card');
    const cardCount = await policyCards.count();
    expect(cardCount).toBeGreaterThan(0);

    console.log(`✓ Dashboard loaded with ${cardCount} policy cards`);
  });

  test('validates policy modal opens and shows history timeline', async ({ page }) => {
    const dashboardPath = path.join(process.cwd(), 'dashboard/index.html');
    await page.goto(`file://${dashboardPath}`);

    await page.waitForSelector('.dashboard-container');

    // Click on first policy card
    const firstCard = page.locator('.policy-card').first();
    await firstCard.click();

    // Verify modal opens
    await expect(page.locator('#policy-summary-modal')).toBeVisible();

    // Check for history timeline (if it exists)
    const historyTimeline = page.locator('.history-timeline');
    if (await historyTimeline.count() > 0) {
      await expect(historyTimeline).toBeVisible();
      console.log('✓ History timeline is visible in modal');
    } else {
      console.log('ℹ History timeline not present (may be suppressed for initial-only entries)');
    }

    // Check that history link points to policy-changes branch
    const historyLink = page.locator('#policy-modal-history');
    const href = await historyLink.getAttribute('href');
    expect(href).toContain('/commits/policy-changes/');

    console.log('✓ History link points to policy-changes branch');
  });

  test('validates dashboard responsiveness', async ({ page, browserName }) => {
    const dashboardPath = path.join(process.cwd(), 'dashboard/index.html');

    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto(`file://${dashboardPath}`);

      await page.waitForSelector('.dashboard-container');

      // Verify dashboard is functional at this viewport
      await expect(page.locator('.dashboard-container')).toBeVisible();

      // Check that policy cards are still clickable
      const firstCard = page.locator('.policy-card').first();
      if (await firstCard.count() > 0) {
        await expect(firstCard).toBeVisible();
      }

      console.log(`✓ Dashboard functional at ${viewport.name} (${viewport.width}x${viewport.height})`);
    }
  });
});

test.describe('Branch Management Validation', () => {

  test('validates workflow maintains two branches correctly', async () => {
    // Verify both branches exist
    const branches = execSync('git branch -a', { encoding: 'utf8' });
    expect(branches).toContain('main');
    expect(branches).toContain('policy-changes');

    // Get commit counts
    const mainCommitCount = execSync('git rev-list --count main', { encoding: 'utf8' }).trim();

    try {
      execSync('git checkout policy-changes', { encoding: 'utf8' });
      const policyCommitCount = execSync('git rev-list --count policy-changes', { encoding: 'utf8' }).trim();

      // Policy-changes should have fewer commits (filtered)
      expect(parseInt(policyCommitCount)).toBeLessThanOrEqual(parseInt(mainCommitCount));

      console.log(`✓ Main branch: ${mainCommitCount} commits, Policy-changes: ${policyCommitCount} commits`);

    } finally {
      execSync('git checkout main', { encoding: 'utf8' });
    }
  });

  test('validates GitHub Actions workflow file exists', async () => {
    const workflowPath = path.join(process.cwd(), '.github/workflows/maintain-policy-changes-branch.yml');

    try {
      const workflowContent = await fs.readFile(workflowPath, 'utf8');
      expect(workflowContent).toContain('Maintain Policy Changes Branch');
      expect(workflowContent).toContain('cherry-pick');
      expect(workflowContent).toContain('CHORE:');

      console.log('✓ Policy changes workflow file exists and is configured correctly');
    } catch (error) {
      throw new Error(`Workflow file missing or invalid: ${error.message}`);
    }
  });
});