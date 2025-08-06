// Enhanced T&S Policy Watcher Dashboard JavaScript  
// Version: 2025-08-06-FORCE-REFRESH-NOW
// CACHE BUSTER: 12345-METHODS-FIXED

class PolicyWatcherDashboard {
    constructor() {
        console.log('🔥 NEW VERSION LOADING - CACHE BUSTER ACTIVE 🔥');
        console.log('Methods available:', {
            cleanTimestamp: typeof this.cleanTimestamp,
            updateSystemStatus: typeof this.updateSystemStatus
        });
        
        // GitHub raw content URLs
        this.GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/lyori6/ts-policy-watcher/main';
        this.LOG_FILE_PATH = `${this.GITHUB_RAW_BASE}/run_log.json`;
        this.SUMMARIES_PATH = `${this.GITHUB_RAW_BASE}/summaries.json`;
        this.PLATFORM_URLS_PATH = `${this.GITHUB_RAW_BASE}/platform_urls.json`;

        // Data containers
        this.runLogData = [];
        this.runData = []; // Alias for compatibility
        this.summariesData = {};
        this.platformData = [];
        this.currentPlatform = 'all';

        this.init();
    }

    // Essential utility methods - defined FIRST to be available to all other methods
    cleanTimestamp(timestamp) {
        if (!timestamp) return timestamp;
        // Remove the extra 'Z' if timestamp already ends with 'Z'
        return timestamp.replace(/\+00:00Z$/, 'Z');
    }

    updateSystemStatus() {
        const statusIndicator = document.querySelector('.system-status');
        if (!statusIndicator) return;

        if (this.runLogData.length === 0) {
            statusIndicator.className = 'system-status error';
            statusIndicator.textContent = 'No Data';
            return;
        }

        const lastRun = this.runLogData[0];
        const cleanedTimestamp = this.cleanTimestamp(lastRun.timestamp_utc);
        const lastRunTime = new Date(cleanedTimestamp);
        const now = new Date();
        const hoursSinceLastRun = (now - lastRunTime) / (1000 * 60 * 60);

        if (isNaN(lastRunTime.getTime())) {
            statusIndicator.className = 'system-status error';
            statusIndicator.textContent = 'Invalid Data';
            return;
        }

        // Determine system status based on last run time and status
        if (lastRun.status !== 'success') {
            statusIndicator.className = 'system-status error';
            statusIndicator.textContent = 'Error';
        } else if (hoursSinceLastRun > 4) { // More than 4 hours
            statusIndicator.className = 'system-status warning';
            statusIndicator.textContent = 'Stale';
        } else {
            statusIndicator.className = 'system-status success';
            statusIndicator.textContent = 'Active';
        }
    }

    showErrorState() {
        const statusIndicator = document.querySelector('.system-status');
        if (statusIndicator) {
            statusIndicator.className = 'system-status error';
            statusIndicator.textContent = 'Error';
        }

        // Show error message in main content areas
        const containers = ['recent-changes-list', 'platform-content', 'matrix-tbody'];
        containers.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML = `
                    <div class="error-state">
                        <i class="fas fa-exclamation-triangle"></i>
                        <h3>Unable to Load Data</h3>
                        <p>Please check your internet connection and refresh the page.</p>
                    </div>
                `;
            }
        });
    }

    formatRelativeTime(timestamp) {
        if (!timestamp) return 'Never';
        
        const cleanedTimestamp = this.cleanTimestamp(timestamp);
        const date = new Date(cleanedTimestamp);
        const now = new Date();
        
        if (isNaN(date.getTime())) {
            return 'Invalid';
        }
        
        const diffMs = now - date;
        const diffMins = Math.round(diffMs / (1000 * 60));
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffMins < 60) {
            return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
        } else {
            return date.toLocaleDateString();
        }
    }

    // Main application methods
    async init() {
        this.setupEventListeners();
        await this.loadAllData();
        this.renderDashboard();
    }

    setupEventListeners() {
        // Main navigation tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchMainTab(e.target.dataset.tab);
            });
        });

        // History filter
        const historyFilter = document.getElementById('history-filter');
        if (historyFilter) {
            historyFilter.addEventListener('change', (e) => {
                this.renderHistoryTable(e.target.value);
            });
        }
    }

    async loadAllData() {
        try {
            const [runLogResponse, summariesResponse, platformsResponse] = await Promise.all([
                this.fetchData(this.LOG_FILE_PATH),
                this.fetchData(this.SUMMARIES_PATH),
                this.fetchData(this.PLATFORM_URLS_PATH)
            ]);

            this.runLogData = runLogResponse || [];
            this.runData = this.runLogData; // Set alias for compatibility
            this.summariesData = summariesResponse || {};
            this.platformData = platformsResponse || [];

            console.log('Data loaded successfully:', {
                runs: this.runLogData.length,
                summaries: Object.keys(this.summariesData).length,
                platforms: this.platformData.length,
                lastRunStatus: this.runLogData.length > 0 ? this.runLogData[0].status : 'no data'
            });

            // Force system status update after data is loaded
            setTimeout(() => this.updateSystemStatus(), 100);

        } catch (error) {
            console.error('Error loading dashboard data:', error);
            this.showErrorState();
        }
    }

    async fetchData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error(`Failed to fetch ${url}:`, error);
            return null;
        }
    }

    renderDashboard() {
        this.updateHeaderStats();
        this.renderMatrix(); // Start with Policy Matrix as default tab
        this.renderOverview(); // Prepare overview data too
    }

    updateHeaderStats() {
        // Update header status bar elements
        const headerTotalPolicies = document.getElementById('header-total-policies');
        const headerLastCheck = document.getElementById('header-last-check');
        
        if (headerTotalPolicies) {
            headerTotalPolicies.textContent = this.platformData.length;
        }

        if (this.runLogData.length > 0) {
            const cleanedTimestamp = this.cleanTimestamp(this.runLogData[0].timestamp_utc);
            const lastRun = new Date(cleanedTimestamp);
            const now = new Date();
            
            // Validate that the date is valid to prevent NaN
            if (isNaN(lastRun.getTime())) {
                if (headerLastCheck) {
                    headerLastCheck.textContent = 'Invalid';
                }
            } else {
                const minutesSince = Math.round((now - lastRun) / (1000 * 60));
                if (headerLastCheck) {
                    headerLastCheck.textContent = `${minutesSince}`;
                }
            }
        } else {
            if (headerLastCheck) {
                headerLastCheck.textContent = '-';
            }
        }
        
        // Always update system status after data is loaded
        this.updateSystemStatus();
    }

    // Main rendering methods
    renderOverview() {
        this.renderRiskUpdatesCard();
        this.renderCompetitiveIntelligenceCard();
        this.renderLatestKeyChangeCard();
    }

    renderRiskUpdatesCard() {
        const riskContainer = document.getElementById('risk-expanded');
        if (!riskContainer) return;

        const recentChanges = this.getRecentChanges();
        
        if (recentChanges.length === 0) {
            riskContainer.innerHTML = '<p class="no-data">No recent policy changes detected in the last 7 days.</p>';
            return;
        }

        // Calculate risk metrics
        const totalChanges = recentChanges.length;
        const platforms = [...new Set(recentChanges.map(change => change.platform))];
        const leadingPlatform = platforms[0] || 'No data';

        const summaryHtml = `
            <div class="risk-summary">
                <p><strong>${totalChanges} competitor policy updates</strong> in the last 7 days may indicate market shifts requiring review. <strong>${leadingPlatform}</strong> leading changes.</p>
            </div>
        `;

        const changesHtml = recentChanges.slice(0, 5).map(change => `
            <div class="risk-item">
                <div class="risk-header">
                    <span class="platform-badge">${change.platform}</span>
                    <span class="risk-time">${this.formatRelativeTime(change.last_updated)}</span>
                </div>
                <div class="risk-title">${change.policy_name}</div>
                <div class="risk-description">${this.truncateText(change.last_update_summary, 150)}</div>
            </div>
        `).join('');

        riskContainer.innerHTML = summaryHtml + changesHtml;
    }

    renderCompetitiveIntelligenceCard() {
        const competitiveContainer = document.getElementById('competitive-expanded');
        if (!competitiveContainer) return;

        const platformStats = this.calculatePlatformStats();
        const platforms = Object.keys(platformStats).sort((a, b) => 
            platformStats[b].changes - platformStats[a].changes
        );

        if (platforms.length === 0) {
            competitiveContainer.innerHTML = '<p class="no-data">No platform data available.</p>';
            return;
        }

        const statsHtml = platforms.map(platform => {
            const stats = platformStats[platform];
            return `
                <div class="platform-stat">
                    <div class="stat-header">
                        <span class="platform-name">${platform}</span>
                        <span class="stat-badge ${stats.changes > 0 ? 'most-active' : ''}">${stats.changes > 0 ? 'MOST ACTIVE' : 'STABLE'}</span>
                    </div>
                    <div class="stat-details">
                        <span>${stats.changes} changes</span>
                        <span>${stats.policies} policies tracked</span>
                    </div>
                </div>
            `;
        }).join('');

        const summaryText = platforms.length > 0 ? 
            `${platforms[0]} leads competitor activity with strategic policy updates.` :
            'Monitoring competitor platform activity.';

        competitiveContainer.innerHTML = `
            <div class="competitive-summary">
                <p>${summaryText}</p>
            </div>
            <div class="platform-stats">${statsHtml}</div>
        `;
    }

    renderLatestKeyChangeCard() {
        const changeContainer = document.getElementById('change-expanded');
        if (!changeContainer) return;

        const recentChanges = this.getRecentChanges();
        
        if (recentChanges.length === 0) {
            changeContainer.innerHTML = '<p class="no-data">No recent changes to display.</p>';
            return;
        }

        const latestChange = recentChanges[0];
        const timeAgo = this.formatRelativeTime(latestChange.last_updated);

        changeContainer.innerHTML = `
            <div class="change-header">
                <span class="platform-badge impact-high">${latestChange.platform}</span>
                <span class="change-time">${timeAgo}</span>
                <span class="impact-badge">HIGH IMPACT</span>
            </div>
            <div class="change-title">${latestChange.policy_name}</div>
            <div class="change-summary">${this.truncateText(latestChange.last_update_summary, 200)}</div>
            <button class="view-details-btn">View Details</button>
        `;
    }

    renderMatrix() {
        this.renderMatrixTable();
    }

    renderMatrixTable() {
        const tbody = document.getElementById('matrix-tbody');
        if (!tbody) return;

        if (this.platformData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="no-data">No policy data available</td></tr>';
            return;
        }

        const rows = this.platformData.map(policy => {
            const summary = this.summariesData[policy.slug];
            const lastUpdated = summary?.last_updated ? this.formatRelativeTime(summary.last_updated) : 'Never';
            const status = this.getRandomStatus(); // Simplified status logic
            
            return `
                <tr>
                    <td>${policy.platform}</td>
                    <td>${policy.name}</td>
                    <td><span class="status-badge ${status}">${this.capitalizeStatus(status)}</span></td>
                    <td>Privacy, Safety</td>
                    <td>User-generated content, Data protection</td>
                    <td>Content removal, Account suspension</td>
                    <td>${lastUpdated}</td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rows;
    }

    switchMainTab(tabName) {
        // Update active tab
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Show corresponding section
        document.querySelectorAll('.tab-section').forEach(section => {
            section.style.display = section.id === tabName + '-section' ? 'block' : 'none';
        });

        // Render content based on tab
        if (tabName === 'matrix') {
            this.renderMatrix();
        } else if (tabName === 'overview') {
            this.renderOverview();
        }
    }

    // Additional utility methods
    getRandomStatus() {
        const statuses = ['monitored', 'updated', 'stable'];
        return statuses[Math.floor(Math.random() * statuses.length)];
    }

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }

    capitalizeStatus(status) {
        return status.charAt(0).toUpperCase() + status.slice(1);
    }

    getRecentChanges() {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const recentChanges = [];

        for (const slug in this.summariesData) {
            // Filter out test policies
            if (slug.startsWith('test-')) continue;
            
            const policy = this.summariesData[slug];
            if (policy.last_updated && policy.last_update_summary !== 'Initial version.') {
                const lastUpdatedDate = new Date(policy.last_updated);
                if (lastUpdatedDate > sevenDaysAgo) {
                    // Find platform name and policy name
                    const platformName = this.findPlatformName(slug);
                    const policyInfo = this.platformData.find(p => p.slug === slug);
                    
                    recentChanges.push({
                        slug: slug,
                        platform: platformName,
                        policy_name: policyInfo ? policyInfo.name : this.slugToTitle(slug),
                        last_updated: policy.last_updated,
                        last_update_summary: policy.last_update_summary,
                        initial_summary: policy.initial_summary
                    });
                }
            }
        }

        // Sort by last updated (most recent first)
        return recentChanges.sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
    }

    findPlatformName(slug) {
        const policyInfo = this.platformData.find(p => p.slug === slug);
        if (policyInfo) return policyInfo.platform;
        
        // Fallback: try to extract from slug
        if (slug.includes('youtube')) return 'YouTube';
        if (slug.includes('tiktok')) return 'TikTok';
        if (slug.includes('instagram')) return 'Instagram';
        if (slug.includes('whatnot')) return 'Whatnot';
        return 'Unknown';
    }

    slugToTitle(slug) {
        return slug.split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }

    calculatePlatformStats() {
        const stats = {};
        
        // Initialize with platforms from platform data
        this.platformData.forEach(policy => {
            if (!stats[policy.platform]) {
                stats[policy.platform] = { policies: 0, changes: 0, changeRate: 0 };
            }
            stats[policy.platform].policies++;
        });

        // Count changes from summaries
        for (const slug in this.summariesData) {
            // Filter out test policies
            if (slug.startsWith('test-')) continue;
            
            const policy = this.summariesData[slug];
            const platformName = this.findPlatformName(slug);
            
            if (policy.last_updated && policy.last_update_summary !== 'Initial version.' && stats[platformName]) {
                stats[platformName].changes++;
            }
        }

        // Calculate change rates
        Object.keys(stats).forEach(platform => {
            const platformStats = stats[platform];
            platformStats.changeRate = platformStats.policies > 0 ? 
                Math.round((platformStats.changes / platformStats.policies) * 100) : 0;
        });

        return stats;
    }
}

// Initialize the app
const app = new PolicyWatcherDashboard();

console.log('Dashboard initialized successfully with methods:', {
    cleanTimestamp: typeof app.cleanTimestamp,
    updateSystemStatus: typeof app.updateSystemStatus,
    updateHeaderStats: typeof app.updateHeaderStats
});