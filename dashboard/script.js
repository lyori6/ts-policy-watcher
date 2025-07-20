document.addEventListener('DOMContentLoaded', () => {
    // Use a relative path to fetch from the repo root
    const LOG_FILE_PATH = '../run_log.json';
    const SUMMARIES_PATH = '../summaries.json';
    const PLATFORM_URLS_PATH = '../platform_urls.json';

    loadSystemHealth();
    loadPolicyExplorer();

    async function loadSystemHealth() {
        const statusEl = document.getElementById('last-run-status');
        const timestampEl = document.getElementById('last-run-timestamp');
        const errorsContainer = document.getElementById('last-run-errors');

        try {
            const response = await fetch(LOG_FILE_PATH);
            if (!response.ok) throw new Error('Log file not found.');
            
            const logData = await response.json();
            const lastRun = logData[0]; // Get the most recent log entry

            if (lastRun) {
                statusEl.textContent = lastRun.status.replace('_', ' ');
                statusEl.className = `status-${lastRun.status.includes('failure') ? 'failure' : 'success'}`;
                timestampEl.textContent = new Date(lastRun.timestamp_utc).toLocaleString();

                if (lastRun.errors && lastRun.errors.length > 0) {
                    let errorHtml = '<h4>Errors from last run:</h4><ul>';
                    lastRun.errors.forEach(err => {
                        errorHtml += `<li><strong>${err.url}</strong>: ${err.reason}</li>`;
                    });
                    errorHtml += '</ul>';
                    errorsContainer.innerHTML = errorHtml;
                } else {
                    errorsContainer.style.display = 'none';
                }
            } else {
                 throw new Error('Log file is empty.');
            }
        } catch (error) {
            statusEl.textContent = 'Error';
            statusEl.className = 'status-failure';
            timestampEl.textContent = `Could not load log data: ${error.message}`;
        }
    }

    async function loadPolicyExplorer() {
        const container = document.getElementById('policy-grid-container');
        container.innerHTML = '<p>Loading policies...</p>';

        try {
            const [platformsRes, summariesRes] = await Promise.all([
                fetch(PLATFORM_URLS_PATH),
                fetch(SUMMARIES_PATH)
            ]);

            if (!platformsRes.ok) throw new Error('Could not load platform URLs config.');

            const platforms = await platformsRes.json();
            const summaries = summariesRes.ok ? await summariesRes.json() : {};

            // Group policies by platform
            const policiesByPlatform = platforms.reduce((acc, policy) => {
                acc[policy.platform] = acc[policy.platform] || [];
                acc[policy.platform].push(policy);
                return acc;
            }, {});

            container.innerHTML = ''; // Clear loading message

            for (const platform in policiesByPlatform) {
                const platformHeader = document.createElement('h3');
                platformHeader.textContent = platform;
                platformHeader.className = 'platform-group-header';
                container.appendChild(platformHeader);

                const platformGrid = document.createElement('div');
                platformGrid.className = 'platform-grid';
                container.appendChild(platformGrid);

                policiesByPlatform[platform].forEach(policy => {
                    const summaryData = summaries[policy.slug] || {};
                    const card = document.createElement('div');
                    card.className = 'policy-card';
                    card.innerHTML = `
                        <h4>${policy.name}</h4>
                        <p class="summary initial-summary"><strong>Initial Summary:</strong> ${summaryData.initial_summary || 'Not yet generated.'}</p>
                        <p class="summary update-summary"><strong>Last Update:</strong> ${summaryData.last_update_summary || 'No updates detected.'}</p>
                        <p class="timestamp"><strong>Updated On:</strong> ${summaryData.last_update_timestamp_utc ? new Date(summaryData.last_update_timestamp_utc).toLocaleDateString() : 'N/A'}</p>
                        <a href="../snapshots/${policy.slug}/" target="_blank">View History</a> | 
                        <a href="${policy.url}" target="_blank">View Live Page</a>
                    `;
                    platformGrid.appendChild(card);
                });
            }

        } catch (error) {
            container.innerHTML = `<p style="color: #e74c3c;">Error loading policy data: ${error.message}</p>`;
        }
    }
});
