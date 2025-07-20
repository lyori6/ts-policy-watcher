// Enhanced T&S Policy Watcher Dashboard JavaScript

class PolicyWatcherDashboard {
    constructor() {
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

    async init() {
        this.setupEventListeners();
        await this.loadAllData();
        this.renderDashboard();
        this.setupModal(); // Setup modal after initial render
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

    switchMainTab(tabName) {
        // Update nav tabs
        document.querySelectorAll('.nav-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabName);
        });

        // Load specific tab content
        switch(tabName) {
            case 'matrix':
                this.renderMatrix();
                break;
            case 'overview':
                this.renderOverview();
                break;
            case 'platforms':
                this.renderPolicyExplorer();
                break;
            case 'history':
                this.renderHistory();
                break;
            case 'analytics':
                this.renderAnalytics();
                break;
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
        document.getElementById('total-policies').textContent = this.platformData.length;

        if (this.runLogData.length > 0) {
            const lastRun = new Date(this.runLogData[0].timestamp_utc);
            const now = new Date();
            const hoursSince = Math.round((now - lastRun) / (1000 * 60 * 60));
            document.getElementById('last-check').textContent = `${hoursSince}`;
        } else {
            document.getElementById('last-check').textContent = '-';
        }
        
        // Always update system status after data is loaded
        this.updateSystemStatus();
    }

    renderOverview() {
        this.renderRecentChanges();
        this.renderIntelligencePanel();
    }

    renderRecentChanges() {
        const container = document.getElementById('recent-changes-list');
        const recentChanges = this.getRecentChanges();

        if (recentChanges.length === 0) {
            container.innerHTML = '<p class="text-center" style="color: #666; font-style: italic;">No recent changes detected</p>';
            return;
        }

        const changesHtml = recentChanges.map(change => `
            <div class="change-item">
                <div class="platform-tag">${change.platform}</div>
                <h4>${change.policy_name}</h4>
                <p class="summary">${this.truncateText(change.last_update_summary, 150)}</p>
                <div class="timestamp">Updated ${this.formatRelativeTime(change.last_updated)}</div>
            </div>
        `).join('');

        container.innerHTML = changesHtml;
    }

    renderQuickStats() {
        const platforms = new Set(this.platformData.map(p => p.platform)).size;
        const avgChanges = this.calculateAverageChanges();
        const successRate = this.calculateSuccessRate();

        this.updateElement('platform-count', platforms);
        this.updateElement('avg-changes', avgChanges.toFixed(1));
        this.updateElement('success-rate', `${(successRate * 100).toFixed(1)}%`);
    }

    renderPolicyExplorer() {
        this.renderPlatformTabs();
        // this.renderBlockMuteSection(); // Hidden for now - needs better design
        this.renderPoliciesByPlatform(this.currentPlatform);
    }

    renderBlockMuteSection() {
        const sectionContainer = document.getElementById('block-mute-section');
        if (!sectionContainer) return;

        const blockingPolicies = [];
        const mutingPolicies = [];

        // Find blocking and muting policies
        for (const slug in this.summariesData) {
            const policy = this.summariesData[slug];
            const platformName = this.findPlatformName(slug);
            const summary = policy.initial_summary?.toLowerCase() || '';

            if (slug.includes('block') || summary.includes('block')) {
                const policyInfo = this.platformData.find(p => p.slug === slug);
                if (policyInfo) {
                    blockingPolicies.push({
                        ...policyInfo,
                        platform: platformName,
                        summary: policy.initial_summary,
                        lastUpdated: policy.last_updated
                    });
                }
            }

            if (summary.includes('mute') || summary.includes('silence') || summary.includes('moderat')) {
                const policyInfo = this.platformData.find(p => p.slug === slug);
                if (policyInfo && !blockingPolicies.find(bp => bp.slug === slug)) {
                    mutingPolicies.push({
                        ...policyInfo,
                        platform: platformName,
                        summary: policy.initial_summary,
                        lastUpdated: policy.last_updated
                    });
                }
            }
        }

        let sectionHtml = '<div class="card block-mute-card">';
        sectionHtml += '<div class="card-header"><h2><i class="fas fa-shield-alt"></i> Block & Moderation Controls</h2></div>';
        sectionHtml += '<div class="card-body"><div class="block-mute-grid">';

        // Blocking section
        if (blockingPolicies.length > 0) {
            sectionHtml += '<div class="control-section">';
            sectionHtml += '<h3><i class="fas fa-ban"></i> User Blocking</h3>';
            sectionHtml += '<div class="policy-pills">';
            blockingPolicies.forEach(policy => {
                sectionHtml += `
                    <div class="policy-pill" onclick="openPolicyModal('${policy.slug}')">
                        <div class="pill-platform">${policy.platform}</div>
                        <div class="pill-name">${policy.name}</div>
                        <div class="pill-updated">${this.formatRelativeTime(policy.lastUpdated)}</div>
                    </div>
                `;
            });
            sectionHtml += '</div></div>';
        }

        // Muting/Moderation section  
        if (mutingPolicies.length > 0) {
            sectionHtml += '<div class="control-section">';
            sectionHtml += '<h3><i class="fas fa-volume-mute"></i> Moderation & Controls</h3>';
            sectionHtml += '<div class="policy-pills">';
            mutingPolicies.forEach(policy => {
                sectionHtml += `
                    <div class="policy-pill" onclick="openPolicyModal('${policy.slug}')">
                        <div class="pill-platform">${policy.platform}</div>
                        <div class="pill-name">${policy.name}</div>
                        <div class="pill-updated">${this.formatRelativeTime(policy.lastUpdated)}</div>
                    </div>
                `;
            });
            sectionHtml += '</div></div>';
        }

        sectionHtml += '</div></div></div>';
        sectionContainer.innerHTML = sectionHtml;
    }

    renderPlatformTabs() {
        const tabsContainer = document.getElementById('platform-tabs');
        const platforms = ['all', ...new Set(this.platformData.map(p => p.platform))];
        
        const tabsHtml = platforms.map(platform => `
            <button class="platform-tab ${platform === this.currentPlatform ? 'active' : ''}" 
                    data-platform="${platform}">
                ${platform === 'all' ? 'All Platforms' : platform}
            </button>
        `).join('');

        tabsContainer.innerHTML = tabsHtml;

        // Add event listeners
        tabsContainer.querySelectorAll('.platform-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.currentPlatform = e.target.dataset.platform;
                this.renderPolicyExplorer();
            });
        });
    }

    renderPoliciesByPlatform(selectedPlatform) {
        const container = document.getElementById('platform-content');
        let filteredPolicies = selectedPlatform === 'all' ? 
            this.platformData : 
            this.platformData.filter(p => p.platform === selectedPlatform);

        // Filter out policies without summaries to keep the view clean
        filteredPolicies = filteredPolicies.filter(policy => {
            const summaryData = this.summariesData[policy.slug];
            return summaryData && summaryData.initial_summary;
        });

        if (filteredPolicies.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-file-alt"></i>
                    <h3>No Policy Summaries Available</h3>
                    <p>Summaries will appear here once the AI analysis pipeline processes new policy changes.</p>
                </div>
            `;
            return;
        }

        const policiesHtml = filteredPolicies.map(policy => {
            const summaryData = this.summariesData[policy.slug] || {};
            const lastUpdated = summaryData.last_updated ? 
                this.formatRelativeTime(summaryData.last_updated) : 'Never';
            
            return `
                <div class="policy-card">
                    <div class="policy-header">
                        <h4>${policy.name}</h4>
                        <span class="update-badge">${lastUpdated}</span>
                    </div>
                    
                    <div class="summary-preview" onclick="openPolicyModal('${policy.slug}')" style="cursor: pointer;">
                        <div class="summary-excerpt">
                            ${this.renderMarkdown(this.truncateText(summaryData.initial_summary, 150))}
                        </div>
                    </div>
                    
                    ${summaryData.last_update_summary && summaryData.last_update_summary !== 'Initial version.' ? `
                        <div class="summary update-summary">
                            <div class="update-label">
                                <i class="fas fa-exclamation-circle"></i> Latest Change
                            </div>
                            ${this.renderMarkdown(this.truncateText(summaryData.last_update_summary, 200))}
                        </div>
                    ` : ''}
                    
                    <div class="policy-actions">
                        <a href="https://github.com/lyori6/ts-policy-watcher/tree/main/snapshots/${policy.slug}" 
                           target="_blank" class="action-btn secondary-btn" title="View snapshot history">
                            <i class="fas fa-clock"></i> History Log
                        </a>
                        <a href="${policy.url}" target="_blank" class="action-btn primary-btn" title="Visit current policy page">
                            <i class="fas fa-external-link-alt"></i> Visit Page
                        </a>
                    </div>
                </div>
            `;
        }).join('');

        container.innerHTML = policiesHtml;
    }

    renderHistory() {
        this.renderHistoryTable('all');
    }

    renderHistoryTable(filter) {
        const tbody = document.getElementById('history-tbody');
        let filteredRuns = this.runData;

        if (filter !== 'all') {
            filteredRuns = this.runData.filter(run => 
                filter === 'success' ? run.status === 'success' : run.status !== 'success'
            );
        }

        if (filteredRuns.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No runs found</td></tr>';
            return;
        }

        const rowsHtml = filteredRuns.map((run, index) => {
            const statusClass = this.getStatusClass(run.status);
            const timeAgo = this.formatRelativeTime(run.timestamp_utc);
            
            return `
                <tr>
                    <td>${this.formatDateTime(run.timestamp_utc)}</td>
                    <td>
                        <div class="status-cell">
                            <div class="status-icon ${statusClass}" title="${this.getStatusTooltip(run.status)}"></div>
                            ${this.capitalizeStatus(run.status)}
                        </div>
                    </td>
                    <td>${run.pages_checked || 0}</td>
                    <td>${run.changes_found || 0}</td>
                    <td>${run.errors ? run.errors.length : 0}</td>
                    <td>${timeAgo}</td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rowsHtml;
    }

    renderAnalytics() {
        this.renderPlatformActivity();
        this.renderPerformanceTrends();
    }

    renderMatrix() {
        this.renderMatrixTable();
    }

    renderMatrixTable() {
        const tbody = document.getElementById('matrix-tbody');
        if (!tbody) return;

        const platforms = ['TikTok', 'Whatnot', 'YouTube', 'Instagram'];
        let matrixHtml = '';

        platforms.forEach(platform => {
            const platformPolicies = this.platformData.filter(p => p.platform === platform);
            
            if (platformPolicies.length === 0) return;

            // Platform header
            const platformIcon = this.getPlatformIcon(platform);
            matrixHtml += `
                <tr class="platform-section">
                    <td colspan="8" class="platform-header">
                        <strong><i class="${platformIcon}"></i> ${platform}</strong>
                    </td>
                </tr>
            `;

            // Platform policies
            platformPolicies.forEach(policy => {
                const summaryData = this.summariesData[policy.slug] || {};
                const lastUpdated = summaryData.last_updated ? 
                    this.formatRelativeTime(summaryData.last_updated) : 'No data';
                const hasData = summaryData.initial_summary ? 'success' : 'warning';
                const statusText = summaryData.initial_summary ? 'Tracked' : 'Pending';
                
                // Extract key info from summary for display
                const coverage = this.extractCoverageAreas(summaryData.initial_summary);
                const keyFeatures = this.extractKeyFeatures(summaryData.initial_summary);
                const enforcement = this.extractEnforcementInfo(summaryData.initial_summary);

                matrixHtml += `
                    <tr>
                        <td>${platform}</td>
                        <td>${policy.name}</td>
                        <td><span class="status-badge ${hasData}">${statusText}</span></td>
                        <td>${coverage}</td>
                        <td>${keyFeatures}</td>
                        <td>${enforcement}</td>
                        <td>${lastUpdated}</td>
                        <td><a href="${policy.url}" target="_blank" class="link-btn">View</a></td>
                    </tr>
                `;
            });
        });

        tbody.innerHTML = matrixHtml;
    }

    getPlatformIcon(platform) {
        const icons = {
            'TikTok': 'fab fa-tiktok',
            'YouTube': 'fab fa-youtube',
            'Instagram': 'fab fa-instagram', 
            'Whatnot': 'fas fa-gavel'
        };
        return icons[platform] || 'fas fa-globe';
    }

    extractCoverageAreas(summary) {
        if (!summary) return 'No data';
        
        const keywords = ['harassment', 'blocking', 'moderation', 'community', 'content', 'safety', 'violence', 'hate'];
        const found = keywords.filter(keyword => 
            summary.toLowerCase().includes(keyword)
        ).slice(0, 3);
        
        return found.length > 0 ? 
            found.map(f => f.charAt(0).toUpperCase() + f.slice(1)).join(', ') : 
            'General policies';
    }

    extractKeyFeatures(summary) {
        if (!summary) return 'No data';
        
        // Look for specific feature mentions
        const features = [];
        if (summary.toLowerCase().includes('block')) features.push('User blocking');
        if (summary.toLowerCase().includes('report')) features.push('Reporting system');
        if (summary.toLowerCase().includes('moderat')) features.push('Content moderation');
        if (summary.toLowerCase().includes('appeal')) features.push('Appeals process');
        
        return features.length > 0 ? features.slice(0, 2).join(', ') : 'Standard policies';
    }

    extractEnforcementInfo(summary) {
        if (!summary) return 'No data';
        
        // Look for enforcement action mentions
        const actions = [];
        if (summary.toLowerCase().includes('removal') || summary.toLowerCase().includes('remove')) {
            actions.push('Content removal');
        }
        if (summary.toLowerCase().includes('suspension') || summary.toLowerCase().includes('ban')) {
            actions.push('Account suspension');
        }
        if (summary.toLowerCase().includes('warning')) {
            actions.push('Warnings');
        }
        
        return actions.length > 0 ? actions.slice(0, 2).join(', ') : 'Standard enforcement';
    }

    renderPlatformActivity() {
        const container = document.getElementById('platform-activity-chart');
        const platformStats = this.calculatePlatformStats();
        
        const chartHtml = Object.entries(platformStats).map(([platform, stats]) => `
            <div class="stat-row">
                <span><strong>${platform}</strong></span>
                <span>${stats.changes} changes</span>
            </div>
        `).join('');

        container.innerHTML = chartHtml || '<div class="chart-placeholder">Platform activity data will appear here</div>';
    }

    renderPerformanceTrends() {
        const container = document.getElementById('performance-timeline');
        const trends = this.calculatePerformanceTrends();
        
        const trendsHtml = `
            <div class="stat-row">
                <span>Average Run Duration</span>
                <span>${trends.avgDuration}</span>
            </div>
            <div class="stat-row">
                <span>Success Rate (30 days)</span>
                <span>${(trends.successRate * 100).toFixed(1)}%</span>
            </div>
            <div class="stat-row">
                <span>Total Changes Detected</span>
                <span>${trends.totalChanges}</span>
            </div>
        `;

        container.innerHTML = trendsHtml;
    }

    renderErrors(errors) {
        const container = document.getElementById('last-run-errors');
        
        if (!errors || errors.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        const errorsHtml = `
            <h4>Errors from last run:</h4>
            ${errors.map(err => `
                <div class="error-item">
                    <strong>${err.file}:</strong> ${err.error}
                </div>
            `).join('')}
        `;

        container.innerHTML = errorsHtml;
    }

    renderIntelligencePanel() {
        // --- Trend Alert --- 
        const trendContainer = document.getElementById('insight-trend-alert');
        if (!trendContainer) return; // Exit if the panel isn't in the HTML

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        let recentChangesCount = 0;
        const platformActivity = {};

        for (const slug in this.summariesData) {
            const policy = this.summariesData[slug];
            if (policy.last_updated && policy.last_update_summary !== 'Initial version.') {
                const lastUpdatedDate = new Date(policy.last_updated);
                if (lastUpdatedDate > sevenDaysAgo) {
                    recentChangesCount++;
                    if (platformActivity[policy.platform]) {
                        platformActivity[policy.platform]++;
                    } else {
                        platformActivity[policy.platform] = 1;
                    }
                }
            }
        }

        let trendMessage = '';
        if (recentChangesCount > 0) {
            const mostActivePlatform = Object.keys(platformActivity).reduce((a, b) => platformActivity[a] > platformActivity[b] ? a : b, '');
            trendMessage = `<strong>${recentChangesCount}</strong> policy update${recentChangesCount > 1 ? 's' : ''} detected in the last 7 days.`;
            if (mostActivePlatform) {
                trendMessage += ` <strong>${mostActivePlatform}</strong> was the most active platform.`;
            }
        } else {
            trendMessage = 'No policy changes detected in the last 7 days. The landscape is currently stable.';
        }
        
        trendContainer.innerHTML = `<p>${trendMessage}</p>`;

        // --- Platform Activity ---
        this.renderPlatformActivityInsight();

        // --- Focus Areas ---
        this.renderFocusAreasInsight();
    }

    renderPlatformActivityInsight() {
        const activityContainer = document.getElementById('insight-platform-activity');
        if (!activityContainer) return;

        const platformStats = {};
        const platforms = ['TikTok', 'Whatnot', 'YouTube', 'Instagram'];
        
        // Initialize platform counts
        platforms.forEach(platform => {
            platformStats[platform] = 0;
        });

        // Count policies per platform
        for (const slug in this.summariesData) {
            const policy = this.summariesData[slug];
            const platformName = this.findPlatformName(slug);
            if (platformStats.hasOwnProperty(platformName)) {
                platformStats[platformName]++;
            }
        }

        let activityHtml = '<div class="platform-comparison">';
        for (const [platform, count] of Object.entries(platformStats)) {
            const percentage = Math.round((count / Object.values(platformStats).reduce((a, b) => a + b, 0)) * 100) || 0;
            activityHtml += `
                <div class="platform-stat">
                    <span class="platform-name">${platform}</span>
                    <span class="policy-count">${count} policies</span>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                </div>
            `;
        }
        activityHtml += '</div>';
        
        activityContainer.innerHTML = activityHtml;
    }

    renderFocusAreasInsight() {
        const focusContainer = document.getElementById('insight-focus-areas');
        if (!focusContainer) return;

        const capabilities = {
            blocking: { platforms: [], features: [] },
            muting: { platforms: [], features: [] },
            reporting: { platforms: [], features: [] },
            moderation: { platforms: [], features: [] }
        };

        for (const slug in this.summariesData) {
            const policy = this.summariesData[slug];
            const platform = this.findPlatformName(slug);
            const summary = policy.initial_summary?.toLowerCase() || '';

            // Check for blocking capabilities
            if (slug.includes('block') || summary.includes('block')) {
                capabilities.blocking.platforms.push(platform);
                if (summary.includes('permanent')) capabilities.blocking.features.push('permanent blocking');
                if (summary.includes('dm') || summary.includes('message')) capabilities.blocking.features.push('message blocking');
                if (summary.includes('purchase') || summary.includes('buy')) capabilities.blocking.features.push('purchase blocking');
            }

            // Check for muting/throttling
            if (summary.includes('mute') || summary.includes('silence') || summary.includes('throttle')) {
                capabilities.muting.platforms.push(platform);
                if (summary.includes('temporary')) capabilities.muting.features.push('temporary muting');
                if (summary.includes('live') || summary.includes('stream')) capabilities.muting.features.push('live stream muting');
            }

            // Check for reporting systems  
            if (slug.includes('report') || summary.includes('report')) {
                capabilities.reporting.platforms.push(platform);
                if (summary.includes('anonymous')) capabilities.reporting.features.push('anonymous reporting');
                if (summary.includes('email')) capabilities.reporting.features.push('email reporting');
            }

            // Check for moderation tools
            if (slug.includes('moderat') || summary.includes('moderat')) {
                capabilities.moderation.platforms.push(platform);
                if (summary.includes('keyword')) capabilities.moderation.features.push('keyword filtering');
                if (summary.includes('age') || summary.includes('18+')) capabilities.moderation.features.push('age controls');
            }
        }

        let focusHtml = '<div class="capabilities-grid">';
        
        if ([...new Set(capabilities.blocking.platforms)].length > 0) {
            focusHtml += `
                <div class="capability-item">
                    <div class="capability-header">🚫 User Blocking</div>
                    <div class="platforms">${[...new Set(capabilities.blocking.platforms)].filter(p => p !== 'Unknown').join(', ')}</div>
                    <div class="features">${[...new Set(capabilities.blocking.features)].slice(0, 2).join(', ')}</div>
                </div>
            `;
        }

        if ([...new Set(capabilities.muting.platforms)].length > 0) {
            focusHtml += `
                <div class="capability-item">
                    <div class="capability-header">🔇 Muting/Throttling</div>
                    <div class="platforms">${[...new Set(capabilities.muting.platforms)].filter(p => p !== 'Unknown').join(', ')}</div>
                    <div class="features">${[...new Set(capabilities.muting.features)].slice(0, 2).join(', ')}</div>
                </div>
            `;
        }

        if ([...new Set(capabilities.reporting.platforms)].length > 0) {
            focusHtml += `
                <div class="capability-item">
                    <div class="capability-header">📢 Reporting Systems</div>
                    <div class="platforms">${[...new Set(capabilities.reporting.platforms)].filter(p => p !== 'Unknown').join(', ')}</div>
                    <div class="features">${[...new Set(capabilities.reporting.features)].slice(0, 2).join(', ')}</div>
                </div>
            `;
        }

        focusHtml += '</div>';
        
        focusContainer.innerHTML = focusHtml;
    }

    findPlatformName(slug) {
        if (slug.startsWith('tiktok-')) return 'TikTok';
        if (slug.startsWith('whatnot-')) return 'Whatnot';
        if (slug.startsWith('youtube-')) return 'YouTube';
        if (slug.startsWith('instagram-')) return 'Instagram';
        return 'Unknown';
    }

    // Utility Functions

    getRecentChanges() {
        return Object.values(this.summariesData)
            .filter(policy => policy.last_updated && policy.last_update_summary !== 'Initial version.')
            .sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated))
            .slice(0, 5);
    }

    calculateUptime() {
        if (this.runData.length < 2) return '100%';
        
        const successfulRuns = this.runData.filter(run => run.status === 'success').length;
        return `${((successfulRuns / this.runData.length) * 100).toFixed(1)}%`;
    }

    calculateSuccessRate() {
        if (this.runData.length === 0) return 1;
        const successfulRuns = this.runData.filter(run => run.status === 'success').length;
        return successfulRuns / this.runData.length;
    }

    calculateAverageChanges() {
        if (this.runData.length === 0) return 0;
        const totalChanges = this.runData.reduce((sum, run) => sum + (run.changes_found || 0), 0);
        return totalChanges / this.runData.length;
    }

    calculatePlatformStats() {
        const stats = {};
        Object.values(this.summariesData).forEach(policy => {
            const platform = this.findPlatformForPolicy(policy.policy_name);
            if (platform) {
                stats[platform] = stats[platform] || { changes: 0, policies: 0 };
                stats[platform].changes += 1;
                stats[platform].policies += 1;
            }
        });
        return stats;
    }

    calculatePerformanceTrends() {
        const totalChanges = this.runData.reduce((sum, run) => sum + (run.changes_found || 0), 0);
        const successRate = this.calculateSuccessRate();
        
        return {
            avgDuration: '~2 min', // This would need actual timing data
            successRate,
            totalChanges
        }
    }

    findPlatformForPolicy(policyName) {
        const policy = this.platformData.find(p => 
            p.name.toLowerCase().includes(policyName.toLowerCase()) ||
            policyName.toLowerCase().includes(p.platform.toLowerCase())
        );
        return policy?.platform;
    }

    getStatusClass(status) {
        if (status === 'success') return 'success';
        if (status === 'partial_failure') return 'warning';
        return 'error';
    }

    getStatusTooltip(status) {
        const tooltips = {
            'success': 'All policy pages were successfully checked and processed',
            'partial_failure': 'Some policy pages had issues but others were processed successfully',
            'failure': 'The monitoring run failed - check the error details',
            'pending': 'Run is currently in progress or queued',
            'error': 'An error occurred during the monitoring run'
        };
        return tooltips[status] || 'Status information not available';
    }

    capitalizeStatus(status) {
        return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatDateTime(isoString) {
        return new Date(isoString).toLocaleString();
    }

    formatRelativeTime(isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now - date;
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        const diffHours = Math.floor(diffMinutes / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffMinutes > 0) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
        return 'Just now';
    }

    getHoursAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        return diffHours;
    }


    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text || '';
        return text.substring(0, maxLength) + '...';
    }

    renderMarkdown(text) {
        if (!text) return '';
        
        // Enhanced markdown rendering for better formatting
        let html = text
            // Headers
            .replace(/### (.*?)$/gm, '<h4 class="md-h4">$1</h4>')
            .replace(/## (.*?)$/gm, '<h3 class="md-h3">$1</h3>')
            .replace(/# (.*?)$/gm, '<h2 class="md-h2">$1</h2>')
            
            // Bold and italic
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            
            // Bullet points - handle various formats
            .replace(/^\* (.*?)$/gm, '<li>$1</li>')
            .replace(/^- (.*?)$/gm, '<li>$1</li>')
            .replace(/^\+ (.*?)$/gm, '<li>$1</li>')
            
            // Convert consecutive list items into proper ul tags
            .replace(/(<li>.*?<\/li>)(\s*<li>.*?<\/li>)*/gs, '<ul>$&</ul>')
            
            // Paragraphs - split on double newlines
            .split('\n\n')
            .map(paragraph => {
                // Don't wrap headers or lists in p tags
                if (paragraph.includes('<h') || paragraph.includes('<ul>') || paragraph.includes('<li>')) {
                    return paragraph;
                }
                // Clean up single newlines within paragraphs
                return paragraph ? `<p>${paragraph.replace(/\n/g, '<br>')}</p>` : '';
            })
            .join('');

        return html;
    }

    updateElement(id, content, className = '', isHtml = false) {
        const element = document.getElementById(id);
        if (element) {
            if (isHtml) {
                element.innerHTML = content;
            } else {
                element.textContent = content;
            }
            if (className) {
                element.className = className;
            }
        }
    }

    updateSystemStatus() {
        const indicator = document.getElementById('system-status-indicator');
        const icon = document.getElementById('status-icon');
        const text = document.getElementById('status-text');

        if (!indicator || !icon || !text) return;

        if (!this.runLogData || this.runLogData.length === 0) {
            indicator.className = 'stat-card';
            icon.innerHTML = '<i class="fas fa-question-circle"></i>';
            text.textContent = 'Unknown';
            return;
        }

        const lastRun = this.runLogData[0];
        const isSuccess = lastRun.status === 'success' && (!lastRun.errors || lastRun.errors.length === 0);

        if (isSuccess) {
            indicator.className = 'stat-card status-success';
            icon.innerHTML = '<i class="fas fa-check-circle"></i>';
            text.textContent = 'Operational';
        } else {
            indicator.className = 'stat-card status-error';
            icon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
            text.textContent = 'Issues Detected';
        }
    }

    showErrorState() {
        // Show error state when data loading fails
        const errorMessage = `
            <div class="card">
                <div class="card-body text-center">
                    <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: var(--danger-color); margin-bottom: 1rem;"></i>
                    <h3>Unable to Load Dashboard Data</h3>
                    <p>Please ensure the repository is public and try refreshing the page.</p>
                </div>
            </div>
        `;
        
        document.querySelector('main').innerHTML = errorMessage;
    }
}

// Global function for opening policy modal
function openPolicyModal(slug) {
    const modal = document.getElementById('policy-summary-modal');
    const title = document.getElementById('policy-modal-title');
    const content = document.getElementById('policy-modal-content');
    const visitLink = document.getElementById('policy-modal-visit');
    const historyLink = document.getElementById('policy-modal-history');
    
    // Get dashboard instance to access data
    const dashboard = window.policyDashboard;
    if (!dashboard) return;
    
    const policy = dashboard.platformData.find(p => p.slug === slug);
    const summaryData = dashboard.summariesData[slug] || {};
    
    if (!policy) return;
    
    // Update modal content
    title.innerHTML = `<i class="fas fa-file-text"></i> ${policy.name} - ${dashboard.findPlatformName(slug)}`;
    
    let modalHtml = '';
    if (summaryData.initial_summary) {
        modalHtml += '<div class="modal-summary">';
        modalHtml += '<h3>Policy Summary</h3>';
        modalHtml += dashboard.renderMarkdown(summaryData.initial_summary);
        modalHtml += '</div>';
        
        if (summaryData.last_update_summary && summaryData.last_update_summary !== 'Initial version.') {
            modalHtml += '<div class="modal-update">';
            modalHtml += '<h3><i class="fas fa-exclamation-circle"></i> Recent Changes</h3>';
            modalHtml += dashboard.renderMarkdown(summaryData.last_update_summary);
            modalHtml += `<div class="update-timestamp">Updated: ${dashboard.formatRelativeTime(summaryData.last_updated)}</div>`;
            modalHtml += '</div>';
        }
    } else {
        modalHtml = '<p>No summary available for this policy yet.</p>';
    }
    
    content.innerHTML = modalHtml;
    
    // Update action links
    visitLink.href = policy.url;
    historyLink.href = `https://github.com/lyori6/ts-policy-watcher/tree/main/snapshots/${slug}`;
    
    modal.style.display = 'block';
}

// Global function for closing policy modal
function closePolicyModal() {
    const modal = document.getElementById('policy-summary-modal');
    modal.style.display = 'none';
}

// Global function for exporting matrix to CSV
function exportMatrix() {
    const table = document.getElementById('policy-matrix-table');
    const rows = table.querySelectorAll('tbody tr:not(.platform-section)');
    
    // CSV headers
    const headers = ['Platform', 'Policy Name', 'Status', 'Coverage Areas', 'Key Features', 'Enforcement Actions', 'Last Updated', 'URL'];
    let csvContent = headers.join(',') + '\n';
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells.length >= 7) {
            const rowData = [
                `"${cells[0].textContent.trim()}"`,
                `"${cells[1].textContent.trim()}"`,
                `"${cells[2].textContent.trim()}"`,
                `"${cells[3].textContent.trim()}"`,
                `"${cells[4].textContent.trim()}"`,
                `"${cells[5].textContent.trim()}"`,
                `"${cells[6].textContent.trim()}"`,
                `"${cells[7].querySelector('a') ? cells[7].querySelector('a').href : ''}"`
            ];
            csvContent += rowData.join(',') + '\n';
        }
    });
    
    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `policy-matrix-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.policyDashboard = new PolicyWatcherDashboard();
});

// Global modal close functionality
window.onclick = function(event) {
    const policyModal = document.getElementById('policy-summary-modal');
    const runLogModal = document.getElementById('run-log-modal');
    
    if (event.target === policyModal) {
        closePolicyModal();
    }
    if (event.target === runLogModal) {
        runLogModal.style.display = 'none';
    }
}