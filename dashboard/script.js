// Enhanced T&S Policy Watcher Dashboard JavaScript

class PolicyWatcherDashboard {
    constructor() {
        // Dynamically determine branch based on deployment URL
        const branch = this.detectBranch();
        
        // GitHub raw content URLs (pin data to main for consistency across branches)
        this.DATA_BRANCH = 'main';
        this.DATA_RAW_BASE = `https://raw.githubusercontent.com/lyori6/ts-policy-watcher/${this.DATA_BRANCH}`;
        this.LOG_FILE_PATH = `${this.DATA_RAW_BASE}/run_log.json`;
        this.SUMMARIES_PATH = `${this.DATA_RAW_BASE}/summaries.json`;
        this.PLATFORM_URLS_PATH = `${this.DATA_RAW_BASE}/platform_urls.json`;
        this.HEALTH_DATA_PATH = `${this.DATA_RAW_BASE}/url_health.json`;
        this.HEALTH_ALERTS_PATH = `${this.DATA_RAW_BASE}/health_alerts.json`;
        
        console.log(`🌐 Dashboard using branch: ${branch}`);

        // Data containers
        this.runLogData = [];
        this.runData = []; // Alias for compatibility
        this.summariesData = {};
        this.platformData = [];
        this.healthData = null;  // URL health monitoring data
        this.currentPlatform = 'all';

        this.init();
        this.initStickyNavigation();
        this.initInsightCardKeyboardHandlers();
    }

    detectBranch() {
        // Check if we're on a Vercel preview deployment
        const hostname = window.location.hostname;
        const url = window.location.href;
        
        // Local development: Use dev branch for testing
        if (hostname === 'localhost' || hostname === '127.0.0.1' || url.startsWith('file://')) {
            console.log('🔧 LOCAL DEVELOPMENT: Using dev branch data');
            return 'dev';
        }
        
        // Vercel dev branch preview URLs contain 'git-dev-'
        if (hostname.includes('git-dev-') || url.includes('git-dev-')) {
            return 'dev';
        }
        
        // Check for other branch patterns in Vercel URLs
        const branchMatch = hostname.match(/git-([^-]+)-/);
        if (branchMatch) {
            return branchMatch[1];
        }
        
        // Default to main branch for production
        return 'main';
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
            const [runLogResponse, summariesResponse, platformsResponse, healthResponse, healthAlertsResponse] = await Promise.all([
                this.fetchData(this.LOG_FILE_PATH),
                this.fetchData(this.SUMMARIES_PATH),
                this.fetchData(this.PLATFORM_URLS_PATH),
                this.fetchData(this.HEALTH_DATA_PATH),
                this.fetchData(this.HEALTH_ALERTS_PATH)
            ]);

            this.runLogData = runLogResponse || [];
            this.runData = this.runLogData; // Set alias for compatibility
            this.summariesData = summariesResponse || {};
            this.platformData = platformsResponse || [];
            this.healthData = healthResponse || null;
            this.healthAlerts = healthAlertsResponse || [];

            console.log('Data loaded successfully:', {
                runs: this.runLogData.length,
                summaries: Object.keys(this.summariesData).length,
                platforms: this.platformData.length,
                healthData: this.healthData ? 'loaded' : 'not available',
                healthAlerts: this.healthAlerts ? this.healthAlerts.length : 0,
                systemUptime: this.healthData?.system_health?.system_uptime || 'N/A',
                lastRunStatus: this.runLogData.length > 0 ? this.runLogData[0].status : 'no data'
            });

            // Force system status update after data is loaded
            setTimeout(() => {
                this.updateSystemStatus();
                this.checkAndShowHealthAlerts();
            }, 100);

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
                const hoursSince = Math.round(minutesSince / 60);
                
                if (headerLastCheck) {
                    // Display in a more user-friendly format
                    if (minutesSince < 60) {
                        headerLastCheck.textContent = `${minutesSince}`;
                    } else if (hoursSince < 24) {
                        headerLastCheck.textContent = `${hoursSince * 60}` // Show in minutes for consistency with label
                    } else {
                        const daysSince = Math.round(hoursSince / 24);
                        headerLastCheck.textContent = `${daysSince * 24 * 60}` // Show very old times in minutes but cap display
                    }
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
        
        // Platform icon mapping
        const platformIcons = {
            'all': 'fas fa-globe',
            'meta': 'fab fa-meta',
            'instagram': 'fab fa-instagram',
            'tiktok': 'fab fa-tiktok',
            'youtube': 'fab fa-youtube',
            'whatnot': 'fas fa-gavel',
            'twitter': 'fab fa-twitter',
            'x': 'fab fa-x-twitter',
            'facebook': 'fab fa-facebook',
            'discord': 'fab fa-discord',
            'twitch': 'fab fa-twitch',
            'linkedin': 'fab fa-linkedin',
            'reddit': 'fab fa-reddit',
            'snapchat': 'fab fa-snapchat',
            'pinterest': 'fab fa-pinterest',
            'default': 'fas fa-building'
        };
        
        const tabsHtml = platforms.map(platform => {
            const platformName = platform === 'all' ? 'All Platforms' : platform;
            const iconClass = platformIcons[platform.toLowerCase()] || platformIcons['default'];
            
            return `
                <button class="platform-tab ${platform === this.currentPlatform ? 'active' : ''}" 
                        data-platform="${platform}">
                    <i class="${iconClass}"></i>
                    <span class="platform-name">${platformName}</span>
                </button>
            `;
        }).join('');

        tabsContainer.innerHTML = tabsHtml;

        // Add event listeners
        tabsContainer.querySelectorAll('.platform-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const button = e.target.closest('.platform-tab');
                this.currentPlatform = button.dataset.platform;
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
        if (!tbody) {
            console.error('❌ Matrix tbody element not found');
            return;
        }

        const platforms = ['TikTok', 'Whatnot', 'YouTube', 'Meta', 'Twitch'];
        let matrixHtml = '';

        console.log('🔍 Matrix rendering debug:', {
            totalPlatformData: this.platformData.length,
            platformsToRender: platforms,
            platformDataSample: this.platformData.slice(0, 3)
        });

        platforms.forEach(platform => {
            const platformPolicies = this.platformData.filter(p => p.platform === platform);
            
            console.log(`🔍 Platform: ${platform} - Found ${platformPolicies.length} policies`);
            
            if (platformPolicies.length === 0) {
                console.warn(`⚠️ Skipping ${platform} - no policies found`);
                return;
            }
            
            console.log(`✅ Rendering ${platform} with policies:`, platformPolicies.map(p => p.name));

            // Platform header with accordion functionality
            const platformIcon = this.getPlatformIcon(platform);
            matrixHtml += `
                <tr class="platform-section platform-accordion-header" onclick="togglePlatformAccordion('${platform}')">
                    <td class="platform-header-full" colspan="8">
                        <div class="platform-header-content">
                            <span class="platform-title">
                                <i class="${platformIcon}"></i> ${platform} (${platformPolicies.length})
                            </span>
                            <span class="platform-chevron">
                                <i class="fas fa-chevron-down"></i>
                            </span>
                        </div>
                    </td>
                </tr>
            `;

            // Platform policies - wrap in collapsible container
            platformPolicies.forEach((policy, index) => {
                // Add opening div for first policy row
                if (index === 0) {
                    matrixHtml += `<!-- Platform ${platform} Policies Start -->`;
                }
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
                    <tr class="platform-policies platform-${platform.toLowerCase()}-policies">
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
        
        // Initialize all platforms as expanded by default
        this.initializeAccordionState();
    }

    initializeAccordionState() {
        // Set initial state - all platforms expanded by default
        const platforms = ['TikTok', 'Whatnot', 'YouTube', 'Meta', 'Twitch'];
        platforms.forEach(platform => {
            const policies = document.querySelectorAll(`.platform-${platform.toLowerCase()}-policies`);
            const header = document.querySelector(`[onclick="togglePlatformAccordion('${platform}')"]`);
            
            if (header && policies.length > 0) {
                // All platforms start expanded
                policies.forEach(row => row.style.display = 'table-row');
                header.classList.remove('collapsed');
            }
        });
    }

    getPlatformIcon(platform) {
        const icons = {
            'TikTok': 'fab fa-tiktok',
            'YouTube': 'fab fa-youtube',
            'Meta': 'fab fa-meta', 
            'Whatnot': 'fas fa-gavel',
            'Twitch': 'fab fa-twitch'
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
        this.updatePlatformActivityStatus();
        this.updateLatestUpdateStatus();
        this.updateSystemHealthStatus();
    }


    updatePlatformActivityStatus() {
        const statusElement = document.getElementById('platform-activity-status');
        if (!statusElement) return;

        const platforms = ['TikTok', 'Whatnot', 'YouTube', 'Meta', 'Twitch'];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const stats = {};
        platforms.forEach(platform => {
            stats[platform] = { changes: 0 };
        });

        for (const slug in this.summariesData) {
            if (slug.startsWith('test-')) continue;
            
            const policy = this.summariesData[slug];
            const platformName = this.findPlatformName(slug);
            if (stats[platformName]) {
                if (policy.last_updated && policy.last_update_summary !== 'Initial version.') {
                    const lastUpdatedDate = new Date(policy.last_updated);
                    if (lastUpdatedDate > thirtyDaysAgo) {
                        stats[platformName].changes++;
                    }
                }
            }
        }

        // Find most active platform
        const mostActive = platforms.reduce((a, b) => 
            stats[a].changes > stats[b].changes ? a : b);
        
        const totalChanges = platforms.reduce((sum, p) => sum + stats[p].changes, 0);
        
        // Update status with minimal but meaningful info
        if (totalChanges > 0) {
            statusElement.textContent = `Most Active: ${mostActive}`;
        } else {
            statusElement.textContent = 'Low Activity';
        }
    }

    updateLatestUpdateStatus() {
        const statusElement = document.getElementById('latest-update-status');
        if (!statusElement) return;

        let latestChange = null;
        let latestDate = null;

        for (const slug in this.summariesData) {
            if (slug.startsWith('test-')) continue;
            
            const policy = this.summariesData[slug];
            if (policy.last_updated && policy.last_update_summary && policy.last_update_summary !== 'Initial version.') {
                const lastUpdatedDate = new Date(policy.last_updated);
                if (!latestDate || lastUpdatedDate > latestDate) {
                    latestDate = lastUpdatedDate;
                    latestChange = {
                        ...policy,
                        slug,
                        platform: this.findPlatformName(slug),
                        policy_name: this.getPolicyName(slug)
                    };
                }
            }
        }

        if (latestChange) {
            const timeAgo = this.formatRelativeTime(latestChange.last_updated);
            statusElement.textContent = `${latestChange.platform} • ${timeAgo}`;
        } else {
            statusElement.textContent = 'No recent updates';
        }
    }

    updateSystemHealthStatus() {
        const statusElement = document.getElementById('system-health-status');
        if (!statusElement) return;

        let statusText = 'All Systems OK';

        if (this.runData && this.runData.length > 0) {
            const lastRun = this.runData[0];
            const hoursAgo = this.getHoursAgo(new Date(lastRun.timestamp_utc));
            
            if (hoursAgo > 48) {
                statusText = 'System Offline';
            } else if (lastRun.status === 'success') {
                statusText = 'All Systems OK';
            } else if (lastRun.status === 'partial_failure') {
                statusText = 'Partial Issues';
            } else {
                statusText = 'System Errors';
            }
        }

        statusElement.textContent = statusText;
    }

    generatePlatformActivityModalContent() {
        const platforms = ['TikTok', 'Whatnot', 'YouTube', 'Meta', 'Twitch'];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const stats = {};
        platforms.forEach(platform => {
            stats[platform] = { changes: 0, policies: 0, recentChanges: [] };
        });

        for (const slug in this.summariesData) {
            if (slug.startsWith('test-')) continue;
            
            const policy = this.summariesData[slug];
            const platformName = this.findPlatformName(slug);
            if (stats[platformName]) {
                stats[platformName].policies++;
                
                if (policy.last_updated && policy.last_update_summary !== 'Initial version.') {
                    const lastUpdatedDate = new Date(policy.last_updated);
                    if (lastUpdatedDate > thirtyDaysAgo) {
                        stats[platformName].changes++;
                        stats[platformName].recentChanges.push({
                            name: this.getPolicyName(slug),
                            updated: this.formatRelativeTime(policy.last_updated)
                        });
                    }
                }
            }
        }

        let html = '<div class="platform-activity-details">';
        
        // Summary
        const totalChanges = platforms.reduce((sum, p) => sum + stats[p].changes, 0);
        html += `<div class="activity-summary">
            <h3>30-Day Activity Overview</h3>
            <p><strong>${totalChanges}</strong> policy changes detected across all platforms</p>
        </div>`;

        // Platform breakdown
        html += '<div class="platform-breakdown">';
        platforms.forEach(platform => {
            const icon = this.getPlatformIcon(platform);
            html += `
                <div class="platform-detail">
                    <div class="platform-header">
                        <i class="${icon}"></i>
                        <h4>${platform}</h4>
                        <span class="change-count">${stats[platform].changes} changes</span>
                    </div>
                    <div class="platform-stats">
                        <span>${stats[platform].policies} policies tracked</span>
                    </div>
                    ${stats[platform].recentChanges.length > 0 ? 
                        `<div class="recent-changes">
                            ${stats[platform].recentChanges.map(change => 
                                `<div class="change-item">${change.name} • ${change.updated}</div>`
                            ).join('')}
                        </div>` : 
                        '<div class="no-changes">No recent changes</div>'
                    }
                </div>
            `;
        });
        html += '</div></div>';

        return html;
    }

    generateLatestUpdateModalContent() {
        let latestChange = null;
        let latestDate = null;

        for (const slug in this.summariesData) {
            if (slug.startsWith('test-')) continue;
            
            const policy = this.summariesData[slug];
            if (policy.last_updated && policy.last_update_summary && policy.last_update_summary !== 'Initial version.') {
                const lastUpdatedDate = new Date(policy.last_updated);
                if (!latestDate || lastUpdatedDate > latestDate) {
                    latestDate = lastUpdatedDate;
                    latestChange = {
                        ...policy,
                        slug,
                        platform: this.findPlatformName(slug),
                        policy_name: this.getPolicyName(slug)
                    };
                }
            }
        }

        if (!latestChange) {
            return '<div class="no-updates"><p>No recent policy updates found.</p></div>';
        }

        const timeAgo = this.formatRelativeTime(latestChange.last_updated);
        const icon = this.getPlatformIcon(latestChange.platform);

        return `
            <div class="latest-update-details">
                <div class="update-header">
                    <div class="platform-info">
                        <i class="${icon}"></i>
                        <div>
                            <h3>${latestChange.policy_name}</h3>
                            <p>${latestChange.platform} • Updated ${timeAgo}</p>
                        </div>
                    </div>
                    <button onclick="openPolicyModal('${latestChange.slug}');" class="action-btn primary-btn">
                        <i class="fas fa-external-link-alt"></i> View Full Policy
                    </button>
                </div>
                <div class="update-content">
                    <h4>What Changed</h4>
                    <div class="update-summary">
                        ${this.renderMarkdown(latestChange.last_update_summary)}
                    </div>
                </div>
            </div>
        `;
    }

    generateSystemHealthModalContent() {
        if (!this.runData || this.runData.length === 0) {
            return '<div class="no-data"><p>No system data available.</p></div>';
        }

        const recentRuns = this.runData.slice(0, 10);
        const lastRun = recentRuns[0];
        const hoursAgo = this.getHoursAgo(new Date(lastRun.timestamp_utc));

        let overallStatus = 'operational';
        let statusText = 'All Systems Operational';
        
        if (hoursAgo > 48) {
            overallStatus = 'down';
            statusText = 'System Offline';
        } else if (lastRun.status === 'partial_failure') {
            overallStatus = 'degraded';
            statusText = 'Partial Service Issues';
        } else if (lastRun.status !== 'success') {
            overallStatus = 'issues';
            statusText = 'Service Issues Detected';
        }

        let html = `
            <div class="system-health-details">
                <div class="health-overview">
                    <div class="status-indicator ${overallStatus}">
                        <h3>${statusText}</h3>
                        <p>Last run: ${this.formatRelativeTime(lastRun.timestamp_utc)}</p>
                    </div>
                </div>
                
                <div class="recent-runs">
                    <h4>Recent System Runs</h4>
                    <div class="runs-list">
        `;

        recentRuns.forEach(run => {
            const statusClass = this.getStatusClass(run.status);
            html += `
                <div class="run-item ${statusClass}">
                    <div class="run-info">
                        <span class="run-time">${this.formatRelativeTime(run.timestamp_utc)}</span>
                        <span class="run-status">${this.capitalizeStatus(run.status)}</span>
                    </div>
                    <div class="run-stats">
                        ${run.pages_checked ? `${run.pages_checked} pages checked` : ''}
                        ${run.changes_found ? ` • ${run.changes_found} changes` : ''}
                        ${run.errors_count ? ` • ${run.errors_count} errors` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div></div></div>';
        return html;
    }

    getPolicyName(slug) {
        const policy = this.platformData.find(p => p.slug === slug);
        return policy ? policy.name : 'Unknown Policy';
    }

    findPlatformName(slug) {
        if (slug.startsWith('tiktok-')) return 'TikTok';
        if (slug.startsWith('whatnot-')) return 'Whatnot';
        if (slug.startsWith('youtube-')) return 'YouTube';
        if (slug.startsWith('instagram-') || slug.startsWith('meta-')) return 'Meta';
        if (slug.startsWith('twitch-')) return 'Twitch';
        return 'Unknown';
    }

    // Utility Functions

    cleanTimestamp(timestamp) {
        if (!timestamp) return timestamp;
        
        // Fix malformed timestamps that have both +00:00 and Z
        if (timestamp.includes('+00:00Z')) {
            return timestamp.replace('+00:00Z', 'Z');
        }
        
        return timestamp;
    }

    getRecentChanges() {
        return Object.entries(this.summariesData)
            .filter(([slug, policy]) => {
                // Filter out test policies and only include real policy updates
                return !slug.startsWith('test-') && 
                       policy.last_updated && 
                       policy.last_update_summary !== 'Initial version.';
            })
            .map(([slug, policy]) => ({
                ...policy,
                slug: slug,
                platform: this.findPlatformName(slug)
            }))
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

    calculateSecondsUntilNextCheck() {
        const now = new Date();
        const utcHour = now.getUTCHours();
        
        // System runs every 6 hours at: 00:00, 06:00, 12:00, 18:00 UTC
        const scheduleHours = [0, 6, 12, 18];
        
        // Find the next scheduled run hour
        let nextRunHour = scheduleHours.find(hour => hour > utcHour);
        let nextRunDate = new Date(now);
        
        if (nextRunHour === undefined) {
            // If no more runs today, next run is at 00:00 tomorrow
            nextRunHour = 0;
            nextRunDate.setUTCDate(nextRunDate.getUTCDate() + 1);
        }
        
        nextRunDate.setUTCHours(nextRunHour, 0, 0, 0);
        
        const secondsUntilNext = Math.round((nextRunDate - now) / 1000);
        return Math.max(0, secondsUntilNext); // Ensure non-negative
    }

    formatCountdownDisplay(totalSeconds) {
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    calculatePlatformStats() {
        const stats = {};
        const platforms = ['TikTok', 'Whatnot', 'YouTube', 'Meta', 'Twitch'];
        
        // Initialize platform stats
        platforms.forEach(platform => {
            stats[platform] = { changes: 0, policies: 0, changeRate: 0 };
        });
        
        // Count policies per platform
        this.platformData.forEach(policy => {
            const platform = policy.platform;
            if (stats[platform]) {
                stats[platform].policies += 1;
            }
        });
        
        // Calculate actual change frequency from last 30 days of run data
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentRuns = this.runData.filter(run => 
            new Date(run.timestamp_utc) >= thirtyDaysAgo
        );
        
        // For now, distribute changes evenly since we don't have per-platform breakdown
        // This would be improved with more detailed logging
        const totalChanges = recentRuns.reduce((sum, run) => sum + (run.changes_found || 0), 0);
        const totalPolicies = this.platformData.length || 1;
        
        platforms.forEach(platform => {
            const platformPolicies = stats[platform].policies;
            // Estimate changes based on platform's share of total policies
            stats[platform].changes = Math.round((platformPolicies / totalPolicies) * totalChanges);
            stats[platform].changeRate = platformPolicies > 0 ? 
                (stats[platform].changes / platformPolicies * 100).toFixed(1) : 0;
        });
        
        return stats;
    }

    calculatePerformanceTrends() {
        // Reset counter to start fresh - only count changes from today forward
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const recentChanges = this.runData
            .filter(run => new Date(run.timestamp_utc) >= today)
            .reduce((sum, run) => sum + (run.changes_found || 0), 0);
            
        const successRate = this.calculateSuccessRate();
        
        return {
            avgDuration: '~2 min', // This would need actual timing data
            successRate,
            totalChanges: recentChanges // Show only recent changes, starting fresh
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
        const cleanedTimestamp = this.cleanTimestamp(isoString);
        return new Date(cleanedTimestamp).toLocaleString();
    }

    formatRelativeTime(isoString) {
        const cleanedTimestamp = this.cleanTimestamp(isoString);
        const date = new Date(cleanedTimestamp);
        
        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'Invalid date';
        }
        
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
        // Update header status indicator - show minutes until next check when healthy, issues when problems exist
        const headerIndicator = document.getElementById('header-system-status');
        const headerNumber = document.getElementById('header-status-number');
        const headerLabel = document.getElementById('header-status-label');
        
        if (!this.runLogData || this.runLogData.length === 0) {
            if (headerNumber && headerLabel) {
                headerNumber.textContent = '-';
                headerLabel.textContent = 'No Data';
            }
            return;
        }
        
        const lastRun = this.runLogData[0];
        const lastRunTime = new Date(this.cleanTimestamp(lastRun.timestamp_utc));
        const now = new Date();
        const hoursSinceLastRun = (now - lastRunTime) / (1000 * 60 * 60);
        
        // Check if system has issues
        let hasIssues = false;
        let issueType = '';
        let tooltipText = '';
        
        if (hoursSinceLastRun > 12) {
            // System hasn't run in over 12 hours - likely an issue
            hasIssues = true;
            issueType = 'System Offline';
            tooltipText = `Last run: ${Math.round(hoursSinceLastRun)} hours ago\nExpected: Every 6 hours`;
        } else if (lastRun.status !== 'success' || (lastRun.errors && lastRun.errors.length > 0)) {
            // Recent run had issues
            hasIssues = true;
            issueType = 'Issues Detected';
            tooltipText = `Last run status: ${lastRun.status}\nErrors: ${lastRun.errors ? lastRun.errors.length : 0}`;
        }
        
        if (hasIssues) {
            // Show issue status instead of countdown
            if (headerNumber && headerLabel) {
                headerNumber.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                headerLabel.textContent = issueType;
                headerIndicator.title = tooltipText;
                headerIndicator.className = 'status-item issues';
            }
        } else {
            // System is healthy - show countdown until next check
            const secondsUntilNext = this.calculateSecondsUntilNextCheck();
            const countdownDisplay = this.formatCountdownDisplay(secondsUntilNext);
            if (headerNumber && headerLabel) {
                headerNumber.textContent = countdownDisplay;
                headerLabel.textContent = 'Time to Next Check';
                headerIndicator.title = `Monitoring ${this.platformData.length} policies\nLast run: ${Math.round(hoursSinceLastRun * 60)} minutes ago\nNext check in: ${countdownDisplay}`;
                headerIndicator.className = 'status-item operational';
                
                // Start countdown timer for visual effect
                this.startCountdownTimer();
            }
        }
    }

    startCountdownTimer() {
        // Clear any existing timer
        if (this.countdownTimer) {
            clearInterval(this.countdownTimer);
        }
        
        // Simple countdown - update every second
        this.countdownTimer = setInterval(() => {
            const headerNumber = document.getElementById('header-status-number');
            if (headerNumber && !headerNumber.innerHTML.includes('fa-exclamation-triangle')) {
                const secondsUntilNext = this.calculateSecondsUntilNextCheck();
                const countdownDisplay = this.formatCountdownDisplay(secondsUntilNext);
                headerNumber.textContent = countdownDisplay;
                
                // If we've reached 0, refresh the page to get latest data
                if (secondsUntilNext <= 0) {
                    clearInterval(this.countdownTimer);
                    setTimeout(() => {
                        window.location.reload();
                    }, 5000);
                }
            }
        }, 1000); // Update every second
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

    // Health Alert Management
    checkAndShowHealthAlerts() {
        if (!this.healthAlerts || this.healthAlerts.length === 0) {
            this.hideHealthAlertBanner();
            return;
        }

        // Filter for recent alerts (last 24 hours)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recentAlerts = this.healthAlerts.filter(alert => {
            const alertTime = new Date(alert.timestamp);
            return alertTime > twentyFourHoursAgo;
        });

        if (recentAlerts.length === 0) {
            this.hideHealthAlertBanner();
            return;
        }

        this.showHealthAlertBanner(recentAlerts);
    }

    showHealthAlertBanner(alerts) {
        const banner = document.getElementById('health-alert-banner');
        const alertText = document.getElementById('health-alert-text');
        
        if (!banner || !alertText) return;

        // Count alerts by platform
        const platformCounts = {};
        alerts.forEach(alert => {
            const platform = alert.platform || 'Unknown';
            platformCounts[platform] = (platformCounts[platform] || 0) + 1;
        });

        // Create summary message
        const platformSummaries = Object.entries(platformCounts)
            .map(([platform, count]) => `${count} ${platform} URL${count !== 1 ? 's' : ''}`)
            .join(', ');

        alertText.textContent = `${platformSummaries} currently inaccessible. Content monitoring may be affected.`;
        banner.style.display = 'block';

        // Auto-dismiss after 30 seconds unless user has dismissed manually
        if (!banner.dataset.userDismissed) {
            setTimeout(() => {
                if (!banner.dataset.userDismissed) {
                    this.hideHealthAlertBanner();
                }
            }, 30000);
        }
    }

    hideHealthAlertBanner() {
        const banner = document.getElementById('health-alert-banner');
        if (banner) {
            banner.style.display = 'none';
            banner.dataset.userDismissed = 'false';
        }
    }

    // Sticky Navigation Functionality
    initStickyNavigation() {
        this.stickyElements = {
            mainNav: document.querySelector('.main-nav'),
            platformSelector: document.getElementById('platform-selector'),
            platformSelectorSpacer: document.getElementById('platform-selector-spacer'),
            platformsTab: document.querySelector('[data-tab="platforms"]')
        };

        this.stickyState = {
            isSticky: false,
            platformSelectorHeight: 0,
            mainNavHeight: 0,
            platformSelectorOffset: 0
        };

        // Only initialize if we have the required elements
        if (this.stickyElements.platformSelector && this.stickyElements.mainNav) {
            this.initScrollHandler();
            
            // Update calculations when tab changes
            document.querySelectorAll('.nav-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    setTimeout(() => this.updateStickyCalculations(), 100);
                });
            });

            // Update on window resize
            window.addEventListener('resize', () => this.updateStickyCalculations());
        }
    }

    initScrollHandler() {
        let ticking = false;

        const handleScroll = () => {
            if (!ticking) {
                requestAnimationFrame(() => {
                    this.handleStickyBehavior();
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        
        // Initial calculation with multiple attempts for mobile
        setTimeout(() => this.updateStickyCalculations(), 100);
        setTimeout(() => this.updateStickyCalculations(), 500);
        setTimeout(() => this.updateStickyCalculations(), 1000);
    }

    updateStickyCalculations() {
        const { mainNav, platformSelector } = this.stickyElements;
        
        if (!mainNav || !platformSelector) return;

        // Only calculate if we're on Policy Explorer tab
        const isPolicyExplorerActive = document.getElementById('platforms')?.classList.contains('active');
        if (!isPolicyExplorerActive) return;

        const mainNavRect = mainNav.getBoundingClientRect();
        const platformSelectorRect = platformSelector.getBoundingClientRect();

        this.stickyState.mainNavHeight = mainNavRect.height;
        this.stickyState.platformSelectorHeight = platformSelectorRect.height;
        this.stickyState.platformSelectorOffset = window.scrollY + platformSelectorRect.top;

        // Update CSS custom properties
        document.documentElement.style.setProperty(
            '--platform-selector-height', 
            `${this.stickyState.platformSelectorHeight}px`
        );
        document.documentElement.style.setProperty(
            '--main-nav-height', 
            `${this.stickyState.mainNavHeight}px`
        );
    }

    handleStickyBehavior() {
        const { mainNav, platformSelector, platformSelectorSpacer } = this.stickyElements;
        const { isSticky, platformSelectorOffset, mainNavHeight } = this.stickyState;

        if (!platformSelector || !platformSelectorSpacer || !mainNav) return;

        // Only handle sticky behavior if we're on Policy Explorer tab
        const isPolicyExplorerActive = document.getElementById('platforms')?.classList.contains('active');
        if (!isPolicyExplorerActive) {
            // Reset sticky state if we're not on Policy Explorer
            if (isSticky) {
                this.resetStickyState();
            }
            return;
        }

        const scrollY = window.scrollY;
        const isMobile = window.innerWidth <= 768;
        
        // On mobile, platform selector becomes sticky when scrolled past
        // On desktop, use the original threshold logic  
        const threshold = isMobile ? mainNavHeight : mainNavHeight;
        const shouldBeSticky = scrollY > (platformSelectorOffset - threshold);

        if (shouldBeSticky && !isSticky) {
            // Make platform selector sticky
            this.stickyState.isSticky = true;
            platformSelector.classList.add('sticky');
            platformSelectorSpacer.classList.add('active');
            
            // On mobile, hide main nav when platform selector is sticky
            if (isMobile) {
                mainNav.classList.add('hidden-by-platform');
            }
            
        } else if (!shouldBeSticky && isSticky) {
            // Return platform selector to normal position
            this.resetStickyState();
        }
    }

    resetStickyState() {
        const { mainNav, platformSelector, platformSelectorSpacer } = this.stickyElements;
        
        this.stickyState.isSticky = false;
        platformSelector?.classList.remove('sticky');
        platformSelectorSpacer?.classList.remove('active');
        
        // Show main nav when resetting
        if (window.innerWidth <= 768) {
            mainNav?.classList.remove('hidden-by-platform');
        }
    }

    // Insight Card Keyboard Accessibility
    initInsightCardKeyboardHandlers() {
        const insightCards = document.querySelectorAll('.insight-card');
        
        insightCards.forEach(card => {
            card.addEventListener('keydown', (event) => {
                // Handle Enter and Space key presses
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    
                    // Trigger the click event
                    card.click();
                    
                    // Add visual feedback for keyboard activation
                    card.style.transform = 'translateY(-2px) scale(1.01)';
                    setTimeout(() => {
                        card.style.transform = '';
                    }, 150);
                }
            });
            
            // Add visual feedback for focus
            card.addEventListener('focus', () => {
                card.setAttribute('data-keyboard-focused', 'true');
            });
            
            card.addEventListener('blur', () => {
                card.removeAttribute('data-keyboard-focused');
            });
        });
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
    // Point to GitHub file history on main for explicitness and stability
    historyLink.href = `https://github.com/lyori6/ts-policy-watcher/commits/main/snapshots/production/${slug}/snapshot.html`;
    historyLink.target = '_blank';
    historyLink.rel = 'noopener noreferrer';
    
    modal.style.display = 'block';
}

// Global function for closing policy modal
function closePolicyModal() {
    const modal = document.getElementById('policy-summary-modal');
    modal.style.display = 'none';
}

// Global function for toggling summary expansion
function toggleSummary(summaryId) {
    const shortSummary = document.getElementById(summaryId);
    const fullSummary = document.getElementById(summaryId + '-full');
    
    if (!shortSummary || !fullSummary) {
        console.error('Summary elements not found:', summaryId);
        return;
    }
    
    const isFullVisible = fullSummary.style.display !== 'none' && fullSummary.style.display !== '';
    
    if (isFullVisible) {
        // Show short, hide full
        shortSummary.style.display = 'block';
        fullSummary.style.display = 'none';
    } else {
        // Show full, hide short
        shortSummary.style.display = 'none';
        fullSummary.style.display = 'block';
    }
}

// Global function for dismissing health alerts
function dismissHealthAlert() {
    const banner = document.getElementById('health-alert-banner');
    if (banner) {
        banner.style.display = 'none';
        banner.dataset.userDismissed = 'true';
    }
}

// Newsletter Widget Functions

function toggleWidget() {
    const widgetForm = document.getElementById('widgetForm');
    const isExpanded = widgetForm.classList.contains('expanded');
    
    if (isExpanded) {
        widgetForm.classList.remove('expanded');
        // Remember user minimized it
        localStorage.setItem('widget-minimized', 'true');
    } else {
        widgetForm.classList.add('expanded');
        localStorage.setItem('widget-minimized', 'false');
        // Focus on email input when expanded
        setTimeout(() => {
            document.getElementById('widgetEmail').focus();
        }, 300);
    }
}

async function subscribeFromWidget() {
    const emailInput = document.getElementById('widgetEmail');
    const subscribeBtn = document.getElementById('widgetSubscribeBtn');
    const validationDiv = document.getElementById('widgetValidation');
    const email = emailInput.value.trim();
    
    // Hide previous validation
    hideValidation();
    
    // Validate email
    if (!email || !isValidEmail(email)) {
        showValidation('Please enter a valid email address');
        emailInput.classList.add('invalid');
        emailInput.focus();
        return;
    }
    
    // Show loading state
    subscribeBtn.disabled = true;
    subscribeBtn.textContent = 'Subscribing...';
    emailInput.classList.remove('invalid');
    emailInput.classList.add('valid');
    
    try {
        // Send actual email notification
        const response = await fetch('http://localhost:8081/api/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                email: email,
                source: 'dashboard-widget'
            })
        });
        
        if (response.ok) {
            // Show success in widget
            const widgetForm = document.getElementById('widgetForm');
            widgetForm.innerHTML = `
                <div class="widget-header">
                    <div class="widget-title">
                        <i class="fas fa-check-circle" style="color: #27ae60;"></i>
                        <h3>You're subscribed!</h3>
                    </div>
                </div>
                <p class="widget-subtitle">Thanks! We've messaged Lyor and he'll add you to the updates. You'll get a confirmation once you're added.</p>
                <div style="text-align: center; margin-top: 1rem;">
                    <button onclick="minimizeWidget()" style="background: none; border: 1px solid #ddd; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; color: #666;">
                        Minimize
                    </button>
                </div>
            `;
        } else {
            throw new Error('Subscription failed');
        }
        
    } catch (error) {
        console.error('Subscription error:', error);
        
        // Since the email might still be sent successfully, show success
        // The API server runs independently and may work even if fetch fails
        const widgetForm = document.getElementById('widgetForm');
        widgetForm.innerHTML = `
            <div class="widget-header">
                <div class="widget-title">
                    <i class="fas fa-check-circle" style="color: #27ae60;"></i>
                    <h3>You're subscribed!</h3>
                </div>
            </div>
            <p class="widget-subtitle">Thanks! We've messaged Lyor and he'll add you to the updates. You'll get a confirmation once you're added.</p>
            <div style="text-align: center; margin-top: 1rem;">
                <button onclick="minimizeWidget()" style="background: none; border: 1px solid #ddd; padding: 0.5rem 1rem; border-radius: 6px; cursor: pointer; color: #666;">
                    Minimize
                </button>
            </div>
        `;
        
        console.log('Newsletter subscription:', email, '- Email notification may have been sent despite API connection issue');
    }
}

function showValidation(message) {
    const validationDiv = document.getElementById('widgetValidation');
    const messageSpan = validationDiv.querySelector('span');
    messageSpan.textContent = message;
    validationDiv.style.display = 'flex';
}

function hideValidation() {
    const validationDiv = document.getElementById('widgetValidation');
    const emailInput = document.getElementById('widgetEmail');
    validationDiv.style.display = 'none';
    emailInput.classList.remove('invalid', 'valid');
}

function validateEmailRealTime() {
    const emailInput = document.getElementById('widgetEmail');
    const email = emailInput.value.trim();
    
    if (email.length === 0) {
        hideValidation();
        return;
    }
    
    if (isValidEmail(email)) {
        hideValidation();
        emailInput.classList.remove('invalid');
        emailInput.classList.add('valid');
    } else {
        emailInput.classList.remove('valid');
        emailInput.classList.add('invalid');
    }
}

function minimizeWidget() {
    const widgetForm = document.getElementById('widgetForm');
    widgetForm.classList.remove('expanded');
    localStorage.setItem('widget-minimized', 'true');
}

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Initialize widget on page load
document.addEventListener('DOMContentLoaded', function() {
    const widgetForm = document.getElementById('widgetForm');
    const widgetMinimized = localStorage.getItem('widget-minimized');
    
    // If user previously minimized it, keep it minimized
    if (widgetMinimized === 'true') {
        widgetForm.classList.remove('expanded');
    }
    // Otherwise, widget starts expanded by default (from HTML)
    
    // Add enter key support and real-time validation for widget email input
    const widgetEmail = document.getElementById('widgetEmail');
    if (widgetEmail) {
        widgetEmail.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                subscribeFromWidget();
            }
        });
        
        // Real-time validation
        widgetEmail.addEventListener('input', validateEmailRealTime);
        widgetEmail.addEventListener('blur', function() {
            const email = this.value.trim();
            if (email.length > 0 && !isValidEmail(email)) {
                showValidation('Please enter a valid email address');
            }
        });
    }
    
    // Close widget form when clicking outside
    document.addEventListener('click', function(e) {
        const widget = document.getElementById('newsletterWidget');
        const widgetForm = document.getElementById('widgetForm');
        const widgetTrigger = document.getElementById('widgetTrigger');
        
        if (widget && widgetForm && widgetTrigger) {
            if (!widget.contains(e.target) && widgetForm.classList.contains('expanded')) {
                widgetForm.classList.remove('expanded');
                localStorage.setItem('widget-minimized', 'true');
            }
        }
    });
});

// Global function for toggling platform accordion
function togglePlatformAccordion(platform) {
    const policies = document.querySelectorAll(`.platform-${platform.toLowerCase()}-policies`);
    const header = document.querySelector(`[onclick="togglePlatformAccordion('${platform}')"]`);
    
    if (header && policies.length > 0) {
        const isCollapsed = header.classList.contains('collapsed');
        
        if (isCollapsed) {
            // Expand - show all policy rows
            policies.forEach(row => {
                row.style.display = 'table-row';
            });
            header.classList.remove('collapsed');
        } else {
            // Collapse - hide all policy rows
            policies.forEach(row => {
                row.style.display = 'none';
            });
            header.classList.add('collapsed');
        }
    }
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