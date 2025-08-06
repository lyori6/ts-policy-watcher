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
            case 'analytics':
                this.renderAnalytics();
                this.renderHistory(); // Also load system logs
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

    renderOverview() {
        this.renderRecentChanges();
        this.renderIntelligencePanel();
    }

    renderRecentChanges() {
        const container = document.getElementById('recent-changes-list');
        if (!container) {
            console.error('Recent changes container not found');
            return;
        }

        const recentChanges = this.getRecentChanges();

        if (recentChanges.length === 0) {
            container.innerHTML = '<p class="text-center" style="color: #666; font-style: italic;">No recent changes detected</p>';
            return;
        }

        const changesHtml = recentChanges.map((change, index) => {
            const summaryId = `summary-${Date.now()}-${index}`; // More unique IDs
            const shortSummary = this.truncateText(change.last_update_summary, 200);
            const hasMore = change.last_update_summary && change.last_update_summary.length > 200;
            
            return `
                <div class="change-item ${hasMore ? 'expandable' : ''}" ${hasMore ? `data-summary-id="${summaryId}"` : ''}>
                    <div class="change-header">
                        <div class="platform-tag">${change.platform}</div>
                        <h4>${change.policy_name}</h4>
                    </div>
                    <div class="summary-container">
                        <div class="summary" id="${summaryId}">
                            ${this.renderMarkdown(shortSummary)}
                            ${hasMore ? '<button class="read-more-btn" onclick="toggleSummary(\'' + summaryId + '\')" type="button"><i class="fas fa-chevron-down"></i> Read more</button>' : ''}
                        </div>
                        ${hasMore ? `<div class="summary-full" id="${summaryId}-full" style="display: none;">
                            ${this.renderMarkdown(change.last_update_summary)}
                            <button class="read-more-btn expanded" onclick="toggleSummary('${summaryId}')" type="button"><i class="fas fa-chevron-up"></i> Read less</button>
                        </div>` : ''}
                    </div>
                    <div class="timestamp">Updated ${this.formatRelativeTime(change.last_updated)}</div>
                </div>
            `;
        }).join('');

        container.innerHTML = changesHtml;
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
                <div class="policy-card" onclick="openPolicyModal('${policy.slug}')" style="cursor: pointer;">
                    <div class="policy-header">
                        <h4>${policy.name}</h4>
                        <span class="update-badge">${lastUpdated}</span>
                    </div>
                    
                    <div class="summary-preview">
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
                        <a href="${policy.url}" target="_blank" class="action-btn primary-btn" 
                           title="Visit current policy page" onclick="event.stopPropagation();">
                            <i class="fas fa-external-link-alt"></i> Visit ${policy.platform} Policy Page
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
                
                // Show view button only if we have data
                const viewButton = summaryData.initial_summary ? 
                    `<a href="${policy.url}" target="_blank" class="link-btn">View</a>` : 
                    `<span class="link-btn disabled">N/A</span>`;

                matrixHtml += `
                    <tr>
                        <td>${platform}</td>
                        <td>${policy.name}</td>
                        <td><span class="status-badge ${hasData}">${statusText}</span></td>
                        <td>${coverage}</td>
                        <td>${keyFeatures}</td>
                        <td>${enforcement}</td>
                        <td>${lastUpdated}</td>
                        <td>${viewButton}</td>
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
        
        const chartHtml = Object.entries(platformStats)
            .filter(([platform, stats]) => stats.policies > 0) // Only show platforms we're tracking
            .sort(([,a], [,b]) => b.changes - a.changes) // Sort by change frequency
            .map(([platform, stats]) => {
                const icon = this.getPlatformIcon(platform);
                return `
                    <div class="platform-activity-row">
                        <div class="platform-info">
                            <i class="${icon}" style="color: var(--secondary-color); margin-right: 0.5rem;"></i>
                            <strong>${platform}</strong>
                            <small>(${stats.policies} policies)</small>
                        </div>
                        <div class="activity-metrics">
                            <span class="change-count">${stats.changes} changes</span>
                            <span class="change-rate">${stats.changeRate}% rate</span>
                        </div>
                    </div>
                `;
            }).join('');

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
                <span>Changes Today</span>
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
            // Filter out test policies from risk assessment
            if (slug.startsWith('test-')) continue;
            
            const policy = this.summariesData[slug];
            if (policy.last_updated && policy.last_update_summary !== 'Initial version.') {
                const lastUpdatedDate = new Date(policy.last_updated);
                if (lastUpdatedDate > sevenDaysAgo) {
                    recentChangesCount++;
                    const platformName = this.findPlatformName(slug);
                    if (platformName && platformName !== 'Unknown') {
                        if (platformActivity[platformName]) {
                            platformActivity[platformName]++;
                        } else {
                            platformActivity[platformName] = 1;
                        }
                    }
                }
            }
        }

        // Compact risk updates display
        let riskLevel = 'stable';
        let riskIcon = '✅';
        let riskText = 'STABLE';
        
        if (recentChangesCount > 0) {
            // Calculate most active platform
            let mostActivePlatform = '';
            const platforms = Object.keys(platformActivity);
            if (platforms.length > 0) {
                mostActivePlatform = platforms.reduce((a, b) => platformActivity[a] > platformActivity[b] ? a : b);
            }
            
            riskLevel = recentChangesCount > 3 ? 'elevated' : 'moderate';
            riskIcon = riskLevel === 'elevated' ? '🚨' : '⚠️';
            riskText = riskLevel.toUpperCase() + ' ACTIVITY';
            
            // Store expanded content for click functionality
            window.riskExpandedContent = {
                recentChangesCount,
                mostActivePlatform,
                riskLevel,
                platformActivity
            };
        }
        
        // Compact display
        const compactRisk = `
            <div class="risk-compact" onclick="toggleRiskExpansion()">
                <div class="risk-summary">
                    <span class="risk-indicator ${riskLevel}">${riskIcon} ${riskText}</span>
                    ${recentChangesCount > 0 ? `<span class="risk-count">${recentChangesCount} changes</span>` : ''}
                </div>
                <div class="expand-hint">
                    <i class="fas fa-chevron-down"></i> <span>Click for details</span>
                </div>
            </div>
            <div class="risk-expanded" id="risk-expanded" style="display: none;"></div>
        `;
        
        trendContainer.innerHTML = compactRisk;

        // --- Competitive Intelligence (Change Frequency) ---
        this.renderCompetitiveIntelligence();

        // --- Latest Key Change ---
        this.renderLatestKeyChange();
    }

    renderCompetitiveIntelligence() {
        const activityContainer = document.getElementById('insight-platform-activity');
        if (!activityContainer) return;

        // Get actual platform change activity data
        const platformStats = this.calculatePlatformStats();
        
        // Sort platforms by change frequency for strategic insight
        const sortedPlatforms = Object.entries(platformStats)
            .filter(([platform, stats]) => stats.policies > 0) // Only show platforms we track
            .sort(([,a], [,b]) => b.changes - a.changes) // Sort by most active first
            .slice(0, 4); // Top 4 most active

        if (sortedPlatforms.length === 0) {
            activityContainer.innerHTML = '<p class="no-data">No competitor activity data available.</p>';
            return;
        }

        // Store expanded content for click functionality
        window.competitiveExpandedContent = sortedPlatforms;

        // Get top competitor for compact display
        const [topPlatform, topStats] = sortedPlatforms[0];
        const topIcon = this.getPlatformIcon(topPlatform);
        
        // Compact display - show only top competitor
        const compactCompetitive = `
            <div class="competitive-compact" onclick="toggleCompetitiveExpansion()">
                <div class="competitive-summary">
                    <div class="top-competitor">
                        <i class="${topIcon}"></i>
                        <strong>${topPlatform}</strong>
                        ${topStats.changes > 0 ? '<span class="leader-badge">LEADING</span>' : ''}
                    </div>
                    <div class="activity-stats">
                        <span class="change-count">${topStats.changes} changes</span>
                    </div>
                </div>
                <div class="expand-hint">
                    <i class="fas fa-chevron-down"></i> <span>View all competitors</span>
                </div>
            </div>
            <div class="competitive-expanded" id="competitive-expanded" style="display: none;"></div>
        `;
        
        activityContainer.innerHTML = compactCompetitive;
    }

    renderLatestKeyChange() {
        const changeContainer = document.getElementById('insight-latest-change');
        if (!changeContainer) return;

        // Get the most recent policy change
        const recentChanges = this.getRecentChanges();
        
        if (recentChanges.length === 0) {
            changeContainer.innerHTML = `
                <div class="latest-change-empty">
                    <div class="empty-state">
                        <span class="empty-icon">📋</span>
                        <span class="empty-text">No recent changes</span>
                    </div>
                </div>
            `;
            return;
        }

        const latestChange = recentChanges[0];
        const timeAgo = this.formatRelativeTime(latestChange.last_updated);
        const icon = this.getPlatformIcon(latestChange.platform);
        
        // Extract key details from the summary
        const summary = latestChange.last_update_summary || latestChange.initial_summary || '';
        const impactLevel = this.assessChangeImpact(summary);
        const impactColor = impactLevel === 'high' ? '#ff6b35' : impactLevel === 'medium' ? '#ffa500' : '#4ECDC4';
        
        // Store expanded content for click functionality
        window.latestChangeExpandedContent = {
            latestChange,
            summary,
            impactLevel,
            impactColor
        };
        
        // Compact display - just key info
        const compactChange = `
            <div class="latest-change-compact" onclick="toggleLatestChangeExpansion()">
                <div class="change-preview">
                    <div class="change-basic">
                        <i class="${icon}"></i>
                        <strong>${latestChange.platform}</strong>
                        <span class="policy-brief">${this.truncateText(latestChange.policy_name.replace('Policy', '').replace('Guidelines', ''), 20)}</span>
                        <span class="impact-badge" style="background: ${impactColor};">${impactLevel.toUpperCase()}</span>
                    </div>
                    <div class="change-timing">${timeAgo}</div>
                </div>
                <div class="expand-hint">
                    <i class="fas fa-chevron-down"></i> <span>View details</span>
                </div>
            </div>
            <div class="latest-change-expanded" id="latest-change-expanded" style="display: none;"></div>
        `;
        
        changeContainer.innerHTML = compactChange;
    }

    assessChangeImpact(summary) {
        if (!summary) return 'low';
        
        const highImpactKeywords = ['monetization', 'algorithm', 'policy change', 'new rule', 'banned', 'prohibited', 'enforcement'];
        const mediumImpactKeywords = ['guideline', 'update', 'clarification', 'revision', 'modification'];
        
        const summaryLower = summary.toLowerCase();
        
        if (highImpactKeywords.some(keyword => summaryLower.includes(keyword))) {
            return 'high';
        }
        if (mediumImpactKeywords.some(keyword => summaryLower.includes(keyword))) {
            return 'medium';
        }
        
        return 'low';
    }

    getPlatformIcon(platform) {
        switch (platform.toLowerCase()) {
            case 'tiktok': return 'fab fa-tiktok';
            case 'youtube': return 'fab fa-youtube';
            case 'instagram': return 'fab fa-instagram';
            case 'whatnot': return 'fas fa-store';
            default: return 'fas fa-building';
        }
    }

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }

    renderMarkdown(text) {
        if (!text) return '';
        // Simple markdown-like rendering for basic formatting
        return text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\*(.*?)\*/g, '<em>$1</em>');
    }
}

// Initialize the app
const app = new PolicyWatcherDashboard();

// Global toggle functions for card expansions  
function toggleRiskExpansion() {
    const expanded = document.getElementById('risk-expanded');
    const compact = document.querySelector('.risk-compact');
    const chevron = compact.querySelector('.fa-chevron-down');
    
    if (expanded.style.display === 'none') {
        // Show expanded content
        if (window.riskExpandedContent) {
            const data = window.riskExpandedContent;
            let expandedHtml = `
                <div class="risk-details">
                    <div class="risk-breakdown">
                        <h4>Market Risk Analysis</h4>
                        <p><strong>${data.recentChangesCount}</strong> competitor policy updates in the last 7 days indicate <strong>${data.riskLevel}</strong> market activity.</p>
                        ${data.mostActivePlatform ? `<p>🔥 <strong>${data.mostActivePlatform}</strong> is leading changes with strategic policy updates.</p>` : ''}
                    </div>
                    <div class="platform-breakdown">
                        <h5>Platform Activity:</h5>
                        <ul class="activity-list">
            `;
            
            Object.entries(data.platformActivity).forEach(([platform, count]) => {
                if (count > 0) {
                    expandedHtml += `<li><strong>${platform}:</strong> ${count} changes</li>`;
                }
            });
            
            expandedHtml += `
                        </ul>
                    </div>
                </div>
            `;
            
            expanded.innerHTML = expandedHtml;
        }
        expanded.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
    } else {
        // Hide expanded content
        expanded.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
}

function toggleCompetitiveExpansion() {
    const expanded = document.getElementById('competitive-expanded');
    const compact = document.querySelector('.competitive-compact');
    const chevron = compact.querySelector('.fa-chevron-down');
    
    if (expanded.style.display === 'none') {
        // Show expanded content
        if (window.competitiveExpandedContent) {
            const sortedPlatforms = window.competitiveExpandedContent;
            const mostActiveChanges = Math.max(...sortedPlatforms.map(([,stats]) => stats.changes));
            
            let expandedHtml = `
                <div class="competitive-details">
                    <h4>All Competitors</h4>
                    <div class="competitors-list">
            `;
            
            sortedPlatforms.forEach(([platform, stats]) => {
                const icon = app.getPlatformIcon(platform);
                const isLeader = stats.changes === mostActiveChanges && mostActiveChanges > 0;
                const intensity = mostActiveChanges > 0 ? Math.round((stats.changes / mostActiveChanges) * 100) : 0;
                
                expandedHtml += `
                    <div class="competitor-detail ${isLeader ? 'leader' : ''}">
                        <div class="competitor-info">
                            <i class="${icon}"></i>
                            <strong>${platform}</strong>
                            ${isLeader ? '<span class="leader-tag">LEADING</span>' : ''}
                        </div>
                        <div class="competitor-stats">
                            <span class="changes">${stats.changes} changes</span>
                            <span class="policies">${stats.policies} tracked</span>
                        </div>
                        <div class="activity-bar-mini">
                            <div class="activity-fill-mini" style="width: ${intensity}%"></div>
                        </div>
                    </div>
                `;
            });
            
            expandedHtml += `
                    </div>
                    <div class="competitive-summary">
                        💡 Strategic insight: Monitor ${sortedPlatforms[0][0]} closely for policy trend leadership.
                    </div>
                </div>
            `;
            
            expanded.innerHTML = expandedHtml;
        }
        expanded.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
    } else {
        // Hide expanded content
        expanded.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
}

function toggleLatestChangeExpansion() {
    const expanded = document.getElementById('latest-change-expanded');
    const compact = document.querySelector('.latest-change-compact');
    const chevron = compact.querySelector('.fa-chevron-down');
    
    if (expanded.style.display === 'none') {
        // Show expanded content
        if (window.latestChangeExpandedContent) {
            const data = window.latestChangeExpandedContent;
            const shortSummary = app.truncateText(data.summary, 200);
            
            const expandedHtml = `
                <div class="change-details">
                    <div class="change-header-detailed">
                        <h4>${data.latestChange.policy_name}</h4>
                        <span class="impact-badge-large" style="background: ${data.impactColor};">
                            ${data.impactLevel.toUpperCase()} IMPACT
                        </span>
                    </div>
                    <div class="change-content">
                        <p>${app.renderMarkdown(shortSummary)}</p>
                    </div>
                    <div class="change-actions-detailed">
                        <button class="detail-action-btn" onclick="openPolicyModal('${data.latestChange.slug}')">
                            <i class="fas fa-eye"></i> View Full Policy
                        </button>
                        <span class="strategic-insight">💡 Strategic intelligence update</span>
                    </div>
                </div>
            `;
            
            expanded.innerHTML = expandedHtml;
        }
        expanded.style.display = 'block';
        chevron.style.transform = 'rotate(180deg)';
    } else {
        // Hide expanded content
        expanded.style.display = 'none';
        chevron.style.transform = 'rotate(0deg)';
    }
}


// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Make app globally available for the toggle functions
    window.app = app;
});

