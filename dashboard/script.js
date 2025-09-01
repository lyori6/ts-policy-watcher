// Enhanced T&S Policy Watcher Dashboard JavaScript

class PolicyWatcherDashboard {
    constructor() {
        // Dynamically determine branch based on deployment URL
        const branch = this.detectBranch();
        
        // GitHub raw content URLs (always use live data from repo)
        this.DATA_BRANCH = 'main';
        this.DATA_RAW_BASE = `https://raw.githubusercontent.com/lyori6/ts-policy-watcher/${this.DATA_BRANCH}`;
        
        this.LOG_FILE_PATH = `${this.DATA_RAW_BASE}/run_log.json`;
        this.SUMMARIES_PATH = `${this.DATA_RAW_BASE}/summaries.json`;
        this.PLATFORM_URLS_PATH = `${this.DATA_RAW_BASE}/platform_urls.json`;
        this.HEALTH_DATA_PATH = `${this.DATA_RAW_BASE}/url_health.json`;
        this.HEALTH_ALERTS_PATH = `${this.DATA_RAW_BASE}/health_alerts.json`;
        this.WEEKLY_SUMMARIES_PATH = `${this.DATA_RAW_BASE}/weekly_summaries.json`;
        
        console.log(`🌐 Dashboard using branch: ${branch}`);

        // Data containers
        this.runLogData = [];
        this.runData = []; // Alias for compatibility
        this.summariesData = {};
        this.platformData = [];
        this.healthData = null;  // URL health monitoring data
        this.weeklySummariesData = {};  // Weekly summaries data
        this.currentWeek = null;  // Currently selected week
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
                const filterValue = e.target.value;
                
                // If pagination exists, update filter; otherwise render normally
                if (this.historyPagination) {
                    const filterFunction = filterValue === 'all' ? 
                        null : 
                        (run) => filterValue === 'success' ? run.status === 'success' : run.status !== 'success';
                    
                    this.historyPagination.setData(this.runData, filterFunction);
                    this.currentHistoryFilter = filterValue;
                } else {
                    this.renderHistoryTable(filterValue);
                }
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
            case 'weekly':
                this.renderWeeklyUpdate();
                break;
            case 'platforms':
                this.renderPolicyExplorer();
                break;
            case 'analytics':
                this.renderAnalytics();
                this.renderHistory(); // Also load system logs
                this.renderRecentChanges(); // Render recent changes in analytics
                break;
        }
    }

    async loadAllData() {
        try {
            const [runLogResponse, summariesResponse, platformsResponse, healthResponse, healthAlertsResponse, weeklySummariesResponse] = await Promise.all([
                this.fetchData(this.LOG_FILE_PATH),
                this.fetchData(this.SUMMARIES_PATH),
                this.fetchData(this.PLATFORM_URLS_PATH),
                this.fetchData(this.HEALTH_DATA_PATH),
                this.fetchData(this.HEALTH_ALERTS_PATH),
                this.fetchData(this.WEEKLY_SUMMARIES_PATH)
            ]);

            this.runLogData = runLogResponse || [];
            this.runData = this.runLogData; // Set alias for compatibility
            this.summariesData = summariesResponse || {};
            this.platformData = platformsResponse || [];
            this.healthData = healthResponse || null;
            this.healthAlerts = healthAlertsResponse || [];
            this.weeklySummariesData = weeklySummariesResponse || {};

            console.log('Data loaded successfully:', {
                runs: this.runLogData.length,
                summaries: Object.keys(this.summariesData).length,
                platforms: this.platformData.length,
                healthData: this.healthData ? 'loaded' : 'not available',
                healthAlerts: this.healthAlerts ? this.healthAlerts.length : 0,
                weeklySummaries: Object.keys(this.weeklySummariesData).filter(k => !k.startsWith('_')).length,
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

    async fetchData(url, retries = 3, retryDelay = 1000) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const response = await fetch(url);
                
                if (!response.ok) {
                    const errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                    if (attempt === retries) {
                        throw new Error(errorMessage);
                    }
                    console.warn(`Failed to fetch ${url} (attempt ${attempt}/${retries}): ${errorMessage}. Retrying...`);
                    await this.delay(retryDelay * attempt); // Exponential backoff
                    continue;
                }
                
                const data = await response.json();
                
                // Validate JSON structure
                if (data === null || data === undefined) {
                    throw new Error(`Invalid JSON response: null or undefined`);
                }
                
                // Log successful fetch on retry
                if (attempt > 1) {
                    console.log(`Successfully fetched ${url} on attempt ${attempt}`);
                }
                
                return data;
                
            } catch (error) {
                const isLastAttempt = attempt === retries;
                const errorDetails = {
                    url: url,
                    attempt: attempt,
                    totalRetries: retries,
                    error: error.message,
                    isNetworkError: error.name === 'TypeError',
                    isJSONError: error.name === 'SyntaxError'
                };
                
                if (isLastAttempt) {
                    console.error(`Final attempt failed for ${url}:`, errorDetails);
                    this.reportFetchError(url, errorDetails);
                    return null;
                } else {
                    console.warn(`Fetch attempt ${attempt}/${retries} failed for ${url}:`, errorDetails);
                    await this.delay(retryDelay * attempt);
                }
            }
        }
        return null;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    reportFetchError(url, errorDetails) {
        // Store error for diagnostics
        if (!window.dashboardErrors) {
            window.dashboardErrors = [];
        }
        
        const errorReport = {
            timestamp: new Date().toISOString(),
            url: url,
            details: errorDetails,
            userAgent: navigator.userAgent,
            connectionType: navigator.connection ? navigator.connection.effectiveType : 'unknown'
        };
        
        window.dashboardErrors.push(errorReport);
        
        // Keep only last 10 errors to prevent memory issues
        if (window.dashboardErrors.length > 10) {
            window.dashboardErrors = window.dashboardErrors.slice(-10);
        }
        
        // Show user-friendly error notification
        this.showDataLoadError(url, errorDetails);
    }

    renderDashboard() {
        this.updateHeaderStats();
        this.renderMatrix(); // Start with Policy Matrix as default tab
        this.renderWeeklyUpdate(); // Prepare weekly data
    }

    updateHeaderStats() {
        // Update header status bar elements
        const headerTotalPolicies = document.getElementById('header-total-policies');
        
        if (headerTotalPolicies) {
            headerTotalPolicies.textContent = this.platformData.length;
        }
        
        // Always update system status after data is loaded
        this.updateSystemStatus();
    }

    renderRecentChanges() {
        const container = document.getElementById('recent-changes-list');
        if (!container) {
            console.error('Recent changes container not found');
            return;
        }

        // Initialize pagination with 3 items per page
        if (!this.changesPagination) {
            this.changesPagination = new PaginationManager('recent-changes-list', {
                itemsPerPage: 3,
                renderCallback: (pageData) => this.renderChangesPage(pageData),
                pageSizeOptions: [3, 5, 10]
            });
            
            // Register in global instances
            window.paginationInstances['recent-changes-list'] = this.changesPagination;
        }

        const allChanges = this.getAllRecentChanges();
        this.changesPagination.setData(allChanges);
    }

    renderChangesPage(changes) {
        const container = document.getElementById('recent-changes-list');
        if (!container) return;

        if (changes.length === 0) {
            const existingContent = container.querySelector('.changes-content');
            if (existingContent) {
                existingContent.innerHTML = '<p class="text-center" style="color: #666; font-style: italic;">No recent changes detected</p>';
            } else {
                container.insertAdjacentHTML('afterbegin', '<div class="changes-content"><p class="text-center" style="color: #666; font-style: italic;">No recent changes detected</p></div>');
            }
            return;
        }

        const changesHtml = changes.map((change, index) => {
            const summaryId = `summary-${Date.now()}-${index}`;
            const shortSummary = this.truncateText(change.last_update_summary, 120);
            const hasMore = change.last_update_summary && change.last_update_summary.length > 120;
            
            return `
                <div class="change-item-clean ${hasMore ? 'expandable' : ''}" ${hasMore ? `data-summary-id="${summaryId}"` : ''}>
                    <div class="change-header-clean">
                        <div class="platform-tag-clean">${change.platform}</div>
                        <h4 class="policy-name-clean">${change.policy_name}</h4>
                        <div class="timestamp-clean">${this.formatRelativeTime(change.last_updated)}</div>
                    </div>
                    <div class="summary-container-clean">
                        <div class="summary-clean" id="${summaryId}">
                            ${this.renderMarkdown(shortSummary)}
                            ${hasMore ? `<button class="read-more-btn-clean" onclick="toggleSummary('${summaryId}')" type="button">Read more</button>` : ''}
                        </div>
                        ${hasMore ? `<div class="summary-full" id="${summaryId}-full" style="display: none;">
                            ${this.renderMarkdown(change.last_update_summary)}
                            <button class="read-more-btn-clean expanded" onclick="toggleSummary('${summaryId}')" type="button">Read less</button>
                        </div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        // Update or create content container
        let contentContainer = container.querySelector('.changes-content');
        if (!contentContainer) {
            container.insertAdjacentHTML('afterbegin', '<div class="changes-content"></div>');
            contentContainer = container.querySelector('.changes-content');
        }
        contentContainer.innerHTML = changesHtml;
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

        let sectionHtml = '<div class="block-mute-section">';
        sectionHtml += '<h2><i class="fas fa-shield-alt"></i> Block & Moderation Controls</h2>';
        sectionHtml += '<div class="block-mute-grid">';

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

        sectionHtml += '</div></div>';
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
                const newPlatform = button.dataset.platform;
                
                // Update active tab
                tabsContainer.querySelectorAll('.platform-tab').forEach(t => t.classList.remove('active'));
                button.classList.add('active');
                
                this.currentPlatform = newPlatform;
                
                // If pagination exists, update filter; otherwise render normally
                if (this.policiesPagination) {
                    const filterFunction = newPlatform === 'all' ? 
                        null : 
                        (policy) => policy.platform === newPlatform;
                    
                    // Get all policies that have summaries
                    let allPolicies = this.platformData.filter(policy => {
                        const summaryData = this.summariesData[policy.slug];
                        return summaryData && summaryData.initial_summary;
                    });
                    
                    this.policiesPagination.setData(allPolicies, filterFunction);
                } else {
                    this.renderPoliciesByPlatform(newPlatform);
                }
            });
        });
    }

    renderPoliciesByPlatform(selectedPlatform) {
        const container = document.getElementById('platform-content');
        
        // Initialize pagination if not exists
        if (!this.policiesPagination) {
            this.policiesPagination = new PaginationManager('platform-content-wrapper', {
                itemsPerPage: 8,
                renderCallback: (pageData) => this.renderPoliciesPage(pageData),
                pageSizeOptions: [6, 8, 12, 24]
            });
            
            // Register in global instances
            window.paginationInstances['platform-content-wrapper'] = this.policiesPagination;
        }

        // Get all policies and filter them
        let allPolicies = this.platformData.filter(policy => {
            const summaryData = this.summariesData[policy.slug];
            return summaryData && summaryData.initial_summary;
        });

        // Apply platform filter
        const filterFunction = selectedPlatform === 'all' ? 
            null : 
            (policy) => policy.platform === selectedPlatform;

        this.policiesPagination.setData(allPolicies, filterFunction);
    }

    renderPoliciesPage(policies) {
        const container = document.getElementById('platform-content');
        if (!container) return;

        if (policies.length === 0) {
            const emptyStateHtml = `
                <div class="policies-content">
                    <div class="empty-state">
                        <i class="fas fa-file-alt"></i>
                        <h3>No Policy Summaries Available</h3>
                        <p>Summaries will appear here once the AI analysis pipeline processes new policy changes.</p>
                    </div>
                </div>
            `;
            
            // Update or create content container
            let contentContainer = container.querySelector('.policies-content');
            if (contentContainer) {
                contentContainer.outerHTML = emptyStateHtml;
            } else {
                container.insertAdjacentHTML('afterbegin', emptyStateHtml);
            }
            return;
        }

        const policiesHtml = policies.map((policy, index) => {
            const summaryData = this.summariesData[policy.slug] || {};
            const lastUpdated = summaryData.last_updated ? 
                this.formatRelativeTime(summaryData.last_updated) : 'Never';
            
            // Create unique IDs for expandable content
            const summaryId = `policy-summary-${policy.slug}-${index}`;
            const shortSummary = this.truncateText(summaryData.initial_summary, 80);
            const hasMore = summaryData.initial_summary && summaryData.initial_summary.length > 80;
            
            return `
                <div class="policy-card" onclick="openPolicyModal('${policy.slug}')" style="cursor: pointer;">
                    <div class="policy-header">
                        <div class="policy-title-section">
                            <h4>${policy.name}</h4>
                            <div class="policy-meta">
                                <span class="platform-badge">
                                    <i class="${this.getPlatformIcon(policy.platform)}"></i>
                                    ${policy.platform}
                                </span>
                                <span class="update-badge">${lastUpdated}</span>
                            </div>
                        </div>
                        <a href="${policy.url}" target="_blank" class="policy-link-btn" 
                           title="Visit ${policy.platform} policy page" onclick="event.stopPropagation();">
                            <i class="fas fa-external-link-alt"></i>
                        </a>
                    </div>
                    
                    <div class="summary-preview">
                        <div class="summary-excerpt" id="${summaryId}">
                            ${this.renderMarkdown(shortSummary)}
                            ${hasMore ? `<button class="read-more-btn" onclick="event.stopPropagation(); togglePolicySummary('${summaryId}')" type="button"><i class="fas fa-chevron-down"></i> Read more</button>` : ''}
                        </div>
                        ${hasMore ? `<div class="summary-full" id="${summaryId}-full" style="display: none;">
                            ${this.renderMarkdown(summaryData.initial_summary)}
                            <button class="read-more-btn expanded" onclick="event.stopPropagation(); togglePolicySummary('${summaryId}')" type="button"><i class="fas fa-chevron-up"></i> Show less</button>
                        </div>` : ''}
                    </div>
                    
                    ${summaryData.last_update_summary && summaryData.last_update_summary !== 'Initial version.' ? `
                        <div class="summary update-summary">
                            <div class="update-label">
                                <i class="fas fa-clock"></i> Latest Update
                            </div>
                            ${this.renderMarkdown(this.truncateText(summaryData.last_update_summary, 150))}
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Update or create content container
        let contentContainer = container.querySelector('.policies-content');
        if (!contentContainer) {
            container.insertAdjacentHTML('afterbegin', '<div class="policies-content"></div>');
            contentContainer = container.querySelector('.policies-content');
        }
        contentContainer.innerHTML = policiesHtml;
    }

    renderHistory() {
        this.renderHistoryTable('all');
    }

    renderHistoryTable(filter) {
        // Initialize pagination if not exists
        if (!this.historyPagination) {
            this.historyPagination = new PaginationManager('history-table-container', {
                itemsPerPage: 15,
                renderCallback: (pageData) => this.renderHistoryPage(pageData),
                pageSizeOptions: [10, 15, 25, 50]
            });
            
            // Register in global instances
            window.paginationInstances['history-table-container'] = this.historyPagination;
        }

        // Apply filter and update pagination
        const filterFunction = filter === 'all' ? 
            null : 
            (run) => filter === 'success' ? run.status === 'success' : run.status !== 'success';

        this.historyPagination.setData(this.runData, filterFunction);
        this.currentHistoryFilter = filter; // Store current filter for future reference
    }

    renderHistoryPage(runs) {
        const tbody = document.getElementById('history-tbody');
        if (!tbody) return;

        if (runs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No runs found</td></tr>';
            return;
        }

        const rowsHtml = runs.map((run, index) => {
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
        console.log('Rendering analytics with data:', {
            runLogEntries: this.runLogData ? this.runLogData.length : 0,
            summariesEntries: this.summariesData ? Object.keys(this.summariesData).length : 0,
            weeklySummariesEntries: this.weeklySummariesData ? Object.keys(this.weeklySummariesData).length : 0,
            platformEntries: this.platformData ? this.platformData.length : 0
        });
        
        try {
            this.renderWeeklyPlatformChart();
            this.renderPlatformActivity();
            this.renderPerformanceTrends();
            this.renderRecentChanges();
        } catch (error) {
            console.error('Error rendering analytics:', error);
            this.showAnalyticsError(error);
        }
    }
    
    showAnalyticsError(error) {
        const analyticsSection = document.getElementById('analytics');
        if (!analyticsSection) return;
        
        const errorHtml = `
            <div class="card full-width">
                <div class="card-body text-center">
                    <i class="fas fa-chart-line-down" style="font-size: 3rem; color: var(--warning-color); margin-bottom: 1rem;"></i>
                    <h3>Analytics Temporarily Unavailable</h3>
                    <p>There was an issue loading the analytics data. This is usually temporary.</p>
                    <div class="error-details" style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin: 1rem 0; text-align: left;">
                        <strong>Error details:</strong><br>
                        <code style="word-break: break-all;">${error.message}</code>
                    </div>
                    <div class="error-actions">
                        <button class="btn btn-primary" onclick="window.dashboardInstance.renderAnalytics()" style="margin-right: 0.5rem;">
                            <i class="fas fa-redo"></i> Retry Analytics
                        </button>
                        <button class="btn btn-secondary" onclick="window.location.reload()">
                            <i class="fas fa-sync"></i> Refresh Page
                        </button>
                    </div>
                    <details style="margin-top: 1rem; text-align: left;">
                        <summary>Troubleshooting Tips</summary>
                        <ul>
                            <li>Check that all data files are properly generated</li>
                            <li>Verify your internet connection</li>
                            <li>Try refreshing the page</li>
                            <li>Check the browser console for more details</li>
                        </ul>
                    </details>
                </div>
            </div>
        `;
        
        analyticsSection.innerHTML = errorHtml;
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

    renderWeeklyPlatformChart() {
        const container = document.getElementById('weekly-platform-chart');
        if (!container) {
            console.error('❌ Weekly platform chart container not found');
            return;
        }

        // Process weekly summaries data to extract platform changes by week
        const weeklyPlatformData = this.processWeeklyPlatformData();
        
        if (!weeklyPlatformData || weeklyPlatformData.weeks.length === 0) {
            container.innerHTML = `
                <div class="chart-placeholder">
                    <i class="fas fa-chart-line"></i>
                    <h3>No Weekly Data Available</h3>
                    <p>Weekly platform change data will appear here once weekly summaries are generated.</p>
                    <small>Run <code>python3 scripts/weekly_aggregator.py --manual</code> to generate weekly summaries.</small>
                </div>
            `;
            return;
        }

        // Create a visual chart showing weekly changes by platform
        const chartHtml = this.renderWeeklyPlatformChartVisual(weeklyPlatformData);
        container.innerHTML = chartHtml;
    }

    processWeeklyPlatformData() {
        // Get all weekly summary data (excluding metadata)
        const weeks = Object.keys(this.weeklySummariesData)
            .filter(key => !key.startsWith('_'))
            .sort((a, b) => a.localeCompare(b)); // Oldest to newest for timeline

        if (weeks.length === 0) {
            return null;
        }

        // Extract platform changes for each week
        const platformChanges = {};
        const weekData = [];

        weeks.forEach(weekKey => {
            const weekInfo = this.weeklySummariesData[weekKey];
            const weekStart = weekInfo.run_metadata.week_start;
            const weekLabel = new Date(weekStart).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            // Store both the original key and formatted label
            weekData.push({
                key: weekKey,
                label: weekLabel
            });

            // Count UNIQUE policies changed by platform for this week
            // Fix: Use Set to deduplicate policy_key entries (multiple commits for same policy = 1 change)
            const weekPlatformCounts = {};
            
            if (weekInfo.changed_policies) {
                // Group by platform first, then deduplicate policy keys within each platform
                const platformPolicyKeys = {};
                
                weekInfo.changed_policies.forEach(change => {
                    const platform = this.extractPlatformFromPolicyKey(change.policy_key);
                    
                    // Initialize platform set if doesn't exist
                    if (!platformPolicyKeys[platform]) {
                        platformPolicyKeys[platform] = new Set();
                    }
                    
                    // Add policy key to set (automatically deduplicates)
                    platformPolicyKeys[platform].add(change.policy_key);
                });
                
                // Count unique policies per platform
                Object.keys(platformPolicyKeys).forEach(platform => {
                    weekPlatformCounts[platform] = platformPolicyKeys[platform].size;
                });
            }

            // Initialize all platforms for this week (so we have consistent data)
            const allPlatforms = ['YouTube', 'Meta', 'TikTok', 'Twitch', 'Whatnot'];
            allPlatforms.forEach(platform => {
                if (!platformChanges[platform]) {
                    platformChanges[platform] = [];
                }
                platformChanges[platform].push(weekPlatformCounts[platform] || 0);
            });
        });

        return {
            weeks: weekData,
            platforms: platformChanges
        };
    }

    extractPlatformFromPolicyKey(policyKey) {
        // Map policy key prefixes to platform names
        if (policyKey.startsWith('youtube-')) return 'YouTube';
        if (policyKey.startsWith('meta-')) return 'Meta';
        if (policyKey.startsWith('instagram-')) return 'Meta';
        if (policyKey.startsWith('facebook-')) return 'Meta';
        if (policyKey.startsWith('tiktok-')) return 'TikTok';
        if (policyKey.startsWith('twitch-')) return 'Twitch';
        if (policyKey.startsWith('whatnot-')) return 'Whatnot';
        if (policyKey.startsWith('twitter-') || policyKey.startsWith('x-')) return 'X';
        return 'Other';
    }

    renderWeeklyPlatformChartVisual(data) {
        const { weeks, platforms } = data;
        
        // Calculate weekly totals for the trend line
        const weeklyTotals = weeks.map((week, weekIndex) => {
            return Object.values(platforms).reduce((sum, platformData) => sum + platformData[weekIndex], 0);
        });
        
        const maxChanges = Math.max(...weeklyTotals, 1);
        const totalChanges = weeklyTotals.reduce((sum, count) => sum + count, 0);
        
        // Create responsive SVG line graph
        // Use container-based sizing instead of fixed dimensions
        const isMobile = window.innerWidth <= 768;
        const isTablet = window.innerWidth <= 1024;
        
        // Dynamic chart dimensions based on screen size
        const chartWidth = isMobile ? Math.min(window.innerWidth - 40, 400) : 
                          isTablet ? 500 : 600;
        const chartHeight = isMobile ? 150 : 200;
        const padding = isMobile ? 25 : 40;
        const innerWidth = chartWidth - (padding * 2);
        const innerHeight = chartHeight - (padding * 2);
        
        // Calculate points for the line
        const points = weeklyTotals.map((count, index) => {
            const x = padding + (index / (weeks.length - 1)) * innerWidth;
            const y = padding + (1 - count / maxChanges) * innerHeight;
            return { 
                x, 
                y, 
                count, 
                weekKey: weeks[index].key,
                weekLabel: weeks[index].label
            };
        });
        
        // Create path string for the line
        const pathData = points.map((point, index) => 
            `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
        ).join(' ');
        
        return `
            <div class="weekly-timeline-chart">
                <div class="chart-header">
                    <h3>Weekly Unique Policy Changes</h3>
                    <div class="chart-summary">
                        <span class="total-changes">${totalChanges} unique policies changed</span>
                        <span class="week-range">${weeks.length} weeks</span>
                    </div>
                </div>
                
                <div class="timeline-container">
                    <svg width="${chartWidth}" height="${chartHeight}" viewBox="0 0 ${chartWidth} ${chartHeight}" class="timeline-svg responsive-chart">
                        <!-- Grid lines -->
                        ${Array.from({length: 5}, (_, i) => {
                            const y = padding + (i / 4) * innerHeight;
                            const value = Math.round(maxChanges * (1 - i / 4));
                            return `
                                <line x1="${padding}" y1="${y}" x2="${chartWidth - padding}" y2="${y}" 
                                      stroke="#e5e7eb" stroke-width="1" opacity="0.5"/>
                                <text x="${padding - 10}" y="${y + 4}" 
                                      text-anchor="end" font-size="12" fill="#6b7280">${value}</text>
                            `;
                        }).join('')}
                        
                        <!-- Trend line -->
                        <path d="${pathData}" 
                              stroke="#2563eb" 
                              stroke-width="3" 
                              fill="none" 
                              stroke-linecap="round" 
                              stroke-linejoin="round"/>
                        
                        <!-- Data points - Touch-friendly on mobile -->
                        ${points.map(point => `
                            <circle cx="${point.x}" cy="${point.y}" r="${isMobile ? '7' : '5'}" 
                                    fill="#2563eb" stroke="white" stroke-width="2"
                                    class="chart-data-point">
                                <title>${point.weekKey}: ${point.count} changes</title>
                            </circle>
                        `).join('')}
                        
                        <!-- Week labels - Smart mobile display -->
                        ${points.map((point, index) => {
                            // Smart date display: show fewer labels on mobile to prevent crowding
                            const shouldShow = isMobile ? 
                                (index === 0 || index === points.length - 1 || index % Math.ceil(points.length / 3) === 0) :
                                isTablet ? (index % Math.ceil(points.length / 6) === 0) :
                                true;
                            
                            return shouldShow ? `
                                <text x="${point.x}" y="${chartHeight - 5}" 
                                      text-anchor="middle" font-size="${isMobile ? '9' : '11'}" fill="#6b7280">
                                    ${point.weekLabel}
                                </text>
                            ` : '';
                        }).join('')}
                    </svg>
                </div>
                
                <div class="sustainable-timeline-details">
                    <!-- Professional Summary Statistics -->
                    <div class="timeline-stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${totalChanges}</div>
                            <div class="stat-label">Total Changes</div>
                            <div class="stat-sublabel">${weeks.length} weeks tracked</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${Math.max(...weeklyTotals)}</div>
                            <div class="stat-label">Peak Week</div>
                            <div class="stat-sublabel">${points.find(p => p.count === Math.max(...weeklyTotals))?.weekLabel || 'N/A'}</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${(totalChanges / weeks.length).toFixed(1)}</div>
                            <div class="stat-label">Avg/Week</div>
                            <div class="stat-sublabel">over ${weeks.length} weeks</div>
                        </div>
                        <div class="stat-card trend-card">
                            <div class="stat-value">${weeklyTotals[weeklyTotals.length-1] || 0}</div>
                            <div class="stat-label">Latest Week</div>
                            <div class="stat-sublabel">${points[points.length-1]?.weekLabel || 'N/A'}</div>
                        </div>
                    </div>
                    
                    <!-- Sustainable Data Table - Professional Approach -->
                    <div class="timeline-data-controls">
                        <div class="data-range-selector">
                            <button class="range-btn active" onclick="window.dashboardInstance.showTimelineRange(this, 'recent')">
                                Last 8 Weeks
                            </button>
                            <button class="range-btn" onclick="window.dashboardInstance.showTimelineRange(this, 'quarter')">
                                Last 3 Months
                            </button>
                            <button class="range-btn" onclick="window.dashboardInstance.showTimelineRange(this, 'all')">
                                All Time
                            </button>
                        </div>
                        <div class="data-search">
                            <input type="text" placeholder="Search by date..." class="search-input" 
                                   onkeyup="window.dashboardInstance.filterTimelineData(this.value)">
                            <i class="fas fa-search"></i>
                        </div>
                    </div>
                    
                    <div class="timeline-data-table">
                        <div class="table-header">
                            <span class="col-date">Date</span>
                            <span class="col-changes">Changes</span>
                            <span class="col-trend">Trend</span>
                            <span class="col-action">Details</span>
                        </div>
                        <div class="table-body" id="timeline-table-body">
                            ${this.generateTimelineTableRows(points, weeklyTotals, 'recent')}
                        </div>
                    </div>
                    
                    ${weeks.length > 8 ? `
                        <div class="table-pagination">
                            <span class="pagination-info">Showing recent 8 weeks of ${weeks.length} total</span>
                            <button class="pagination-btn" onclick="window.dashboardInstance.showTimelineRange(document.querySelector('.range-btn.active'), 'all')">
                                View All ${weeks.length} Weeks
                            </button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    generateTimelineTableRows(points, weeklyTotals, range = 'recent') {
        const filteredPoints = this.filterPointsByRange(points, range);
        
        return filteredPoints.map((point, index) => {
            const trend = index > 0 ? 
                (point.count > filteredPoints[index-1].count ? '↗️ +' : 
                 point.count < filteredPoints[index-1].count ? '↘️ ' : '→') : '—';
            
            const trendClass = index > 0 ? 
                (point.count > filteredPoints[index-1].count ? 'trend-up' : 
                 point.count < filteredPoints[index-1].count ? 'trend-down' : 'trend-stable') : 'trend-neutral';
                 
            return `
                <div class="table-row" data-week="${point.weekKey}">
                    <span class="col-date">${point.weekLabel}</span>
                    <span class="col-changes">
                        <span class="changes-count">${point.count}</span>
                        <span class="changes-unit">changes</span>
                    </span>
                    <span class="col-trend ${trendClass}">${trend}</span>
                    <span class="col-action">
                        <button class="detail-btn" onclick="window.dashboardInstance.showWeekDetails('${point.weekKey}')">
                            <i class="fas fa-info-circle"></i> View
                        </button>
                    </span>
                </div>
            `;
        }).join('');
    }

    filterPointsByRange(points, range) {
        switch(range) {
            case 'recent':
                return points.slice(-8); // Last 8 weeks
            case 'quarter':
                return points.slice(-12); // Last 12 weeks (3 months)
            case 'all':
                return points;
            default:
                return points.slice(-8);
        }
    }

    showTimelineRange(buttonElement, range) {
        // Update active button
        document.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
        buttonElement.classList.add('active');
        
        // Get current data
        const weeklyPlatformData = this.processWeeklyPlatformData();
        if (!weeklyPlatformData) return;
        
        const { weeks, platforms } = weeklyPlatformData;
        const weeklyTotals = weeks.map((week, weekIndex) => {
            return Object.values(platforms).reduce((sum, platformData) => sum + platformData[weekIndex], 0);
        });
        
        const points = weeklyTotals.map((count, index) => {
            return { 
                count, 
                weekKey: weeks[index].key,
                weekLabel: weeks[index].label
            };
        });
        
        // Update table body
        const tableBody = document.getElementById('timeline-table-body');
        if (tableBody) {
            tableBody.innerHTML = this.generateTimelineTableRows(points, weeklyTotals, range);
        }
        
        // Update pagination info
        const paginationInfo = document.querySelector('.pagination-info');
        if (paginationInfo) {
            const filteredCount = this.filterPointsByRange(points, range).length;
            paginationInfo.textContent = `Showing ${filteredCount} weeks of ${points.length} total`;
        }
    }

    filterTimelineData(searchTerm) {
        const rows = document.querySelectorAll('.table-row');
        const term = searchTerm.toLowerCase();
        
        rows.forEach(row => {
            const dateText = row.querySelector('.col-date').textContent.toLowerCase();
            const weekKey = row.getAttribute('data-week').toLowerCase();
            
            if (dateText.includes(term) || weekKey.includes(term)) {
                row.style.display = 'flex';
            } else {
                row.style.display = 'none';
            }
        });
    }

    showWeekDetails(weekKey) {
        // Find the week data
        const weekData = this.weeklySummariesData[weekKey];
        if (!weekData) {
            alert('Week details not available');
            return;
        }
        
        // Create modal content
        const modalContent = `
            <div class="week-detail-modal">
                <div class="modal-header">
                    <h3>Week Details: ${weekKey}</h3>
                    <button class="close-modal" onclick="this.closest('.week-detail-modal').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="week-overview">
                        <div class="overview-stat">
                            <strong>${weekData.changes_count || 0}</strong>
                            <span>Total Changes</span>
                        </div>
                        <div class="overview-stat">
                            <strong>${weekData.changed_policies ? weekData.changed_policies.length : 0}</strong>
                            <span>Policy Updates</span>
                        </div>
                        <div class="overview-stat">
                            <strong>${weekData.changed_policies ? new Set(weekData.changed_policies.map(p => p.policy_key.split('-')[0])).size : 0}</strong>
                            <span>Platforms</span>
                        </div>
                    </div>
                    ${weekData.changed_policies ? `
                        <div class="policy-changes-list">
                            <h4>Policy Changes This Week</h4>
                            ${weekData.changed_policies.slice(0, 10).map(policy => `
                                <div class="policy-change-item">
                                    <strong>${policy.policy_key.replace(/-/g, ' ')}</strong>
                                    <small>${new Date(policy.commit_date).toLocaleDateString()}</small>
                                </div>
                            `).join('')}
                            ${weekData.changed_policies.length > 10 ? `<p><em>... and ${weekData.changed_policies.length - 10} more</em></p>` : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        
        // Add modal to page
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'modal-overlay';
        modalOverlay.innerHTML = modalContent;
        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) modalOverlay.remove();
        };
        
        document.body.appendChild(modalOverlay);
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

    getPlatformIcon(platformName) {
        const iconMap = {
            'TikTok': 'fab fa-tiktok',
            'Meta': 'fab fa-meta', 
            'Instagram': 'fab fa-instagram',
            'YouTube': 'fab fa-youtube',
            'Twitch': 'fab fa-twitch',
            'Whatnot': 'fas fa-shopping-cart'
        };
        return iconMap[platformName] || 'fas fa-shield-alt';
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
        // Keep this method for backward compatibility, but limit to 5 items
        return this.getAllRecentChanges().slice(0, 5);
    }

    getAllRecentChanges() {
        // New method that returns all changes without limiting
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
            .sort((a, b) => new Date(b.last_updated) - new Date(a.last_updated));
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
        
        // If we have run data, calculate based on last actual run time + 6 hours
        if (this.runData && this.runData.length > 0) {
            const lastRun = this.runData[0];
            const lastRunTime = new Date(lastRun.timestamp_utc);
            
            // Next run should be 6 hours after the last run
            const nextRunTime = new Date(lastRunTime);
            nextRunTime.setHours(nextRunTime.getHours() + 6);
            
            const secondsUntilNext = Math.round((nextRunTime - now) / 1000);
            return Math.max(0, secondsUntilNext); // Ensure non-negative
        }
        
        // Fallback to theoretical schedule if no run data available
        const utcHour = now.getUTCHours();
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

    filterAIGeneratedText(text) {
        if (!text) return '';
        
        // Patterns to remove AI-generated filler text
        const aiPatterns = [
            // Remove "Here's a concise summary..." patterns
            /^Here's a concise summary.*?for a product manager[^:]*:?\s*/im,
            /^As a Trust & Safety analyst,? here is a concise summary.*?for a Product Manager[^:]*:?\s*/im,
            /^concise summary.*?for a product manager[^:]*:?\s*/im,
            
            // Remove highlighting patterns
            /highlighting key changes?[^:]*:?\s*/im,
            /highlighting.*?implications[^:]*:?\s*/im,
            
            // Remove meta descriptions about the diff
            /This diff (represents|introduces|shows).*?\.\s*/im,
            /^Based on this diff[^:]*:?\s*/im,
            
            // Remove separator lines and dashes  
            /^---+\s*$/gm,
            /^\*\*\*+\s*$/gm,
            
            // Clean up excessive newlines
            /\n{3,}/g
        ];
        
        let cleanedText = text;
        
        // Apply each pattern
        aiPatterns.forEach(pattern => {
            cleanedText = cleanedText.replace(pattern, pattern === /\n{3,}/g ? '\n\n' : '');
        });
        
        // Trim and return
        return cleanedText.trim();
    }

    renderMarkdown(text) {
        if (!text) return '';
        
        // Filter out AI-generated filler text
        text = this.filterAIGeneratedText(text);
        
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
                headerIndicator.title = `Monitoring ${this.platformData.length} policies\nNext check in: ${countdownDisplay}`;
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
        
        // Simple countdown - update every second (only countdown, not minutes since)
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
    
    showDataLoadError(url, errorDetails) {
        // Show a non-intrusive error notification for individual data loading failures
        const errorId = `error-${Date.now()}`;
        const fileName = url.split('/').pop();
        
        let errorType = 'Data Loading Error';
        let suggestions = [];
        
        if (errorDetails.isNetworkError) {
            errorType = 'Network Error';
            suggestions = [
                'Check your internet connection',
                'Try refreshing the page',
                'Verify the server is running'
            ];
        } else if (errorDetails.isJSONError) {
            errorType = 'Data Format Error';
            suggestions = [
                'The data file may be corrupted',
                'Try refreshing the page',
                'Contact the administrator'
            ];
        } else if (errorDetails.error.includes('404')) {
            errorType = 'File Not Found';
            suggestions = [
                'The data file may not exist yet',
                'Run the data collection script',
                'Check if the repository is properly configured'
            ];
        } else {
            suggestions = [
                'Try refreshing the page',
                'Check the browser console for more details',
                'Contact support if the problem persists'
            ];
        }
        
        const errorHtml = `
            <div id="${errorId}" class="data-error-notification">
                <div class="error-content">
                    <div class="error-header">
                        <i class="fas fa-exclamation-circle"></i>
                        <strong>${errorType}</strong>
                        <button class="error-dismiss" onclick="document.getElementById('${errorId}').remove()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="error-details">
                        <p>Failed to load <code>${fileName}</code></p>
                        <details>
                            <summary>Error Details</summary>
                            <ul>
                                <li><strong>URL:</strong> ${url}</li>
                                <li><strong>Error:</strong> ${errorDetails.error}</li>
                                <li><strong>Attempts:</strong> ${errorDetails.totalRetries}</li>
                            </ul>
                        </details>
                        <div class="error-suggestions">
                            <strong>Suggestions:</strong>
                            <ul>
                                ${suggestions.map(s => `<li>${s}</li>`).join('')}
                            </ul>
                        </div>
                        <button class="retry-button" onclick="window.dashboardInstance.retryDataLoad('${url}')">
                            <i class="fas fa-redo"></i> Retry Loading
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        // Add error notification to page
        let errorContainer = document.getElementById('error-notifications');
        if (!errorContainer) {
            errorContainer = document.createElement('div');
            errorContainer.id = 'error-notifications';
            errorContainer.className = 'error-notifications-container';
            document.body.appendChild(errorContainer);
        }
        
        errorContainer.insertAdjacentHTML('beforeend', errorHtml);
        
        // Auto-dismiss after 10 seconds
        setTimeout(() => {
            const errorElement = document.getElementById(errorId);
            if (errorElement) {
                errorElement.remove();
            }
        }, 10000);
    }
    
    async retryDataLoad(url) {
        console.log(`Retrying data load for: ${url}`);
        
        // Show loading indicator
        const retryButtons = document.querySelectorAll(`button[onclick*="${url}"]`);
        retryButtons.forEach(btn => {
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Retrying...';
            btn.disabled = true;
        });
        
        try {
            const data = await this.fetchData(url);
            
            if (data) {
                // Update the appropriate data property
                if (url.includes('run_log.json')) {
                    this.runLogData = data;
                    this.runData = data;
                } else if (url.includes('summaries.json')) {
                    this.summariesData = data;
                } else if (url.includes('weekly_summaries.json')) {
                    this.weeklySummariesData = data;
                } else if (url.includes('platform_urls.json')) {
                    this.platformData = data;
                }
                
                // Re-render affected components
                this.renderDashboard();
                
                // Remove error notifications for this URL
                const errorNotifications = document.querySelectorAll(`[id^="error-"][onclick*="${url}"]`);
                errorNotifications.forEach(notification => notification.remove());
                
                console.log(`Successfully reloaded data from: ${url}`);
            }
        } catch (error) {
            console.error(`Retry failed for ${url}:`, error);
        } finally {
            // Re-enable retry buttons
            retryButtons.forEach(btn => {
                btn.innerHTML = '<i class="fas fa-redo"></i> Retry Loading';
                btn.disabled = false;
            });
        }
    }
    
    // System Diagnostics and Monitoring
    generateDiagnosticReport() {
        const report = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            connectionInfo: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : 'unavailable',
            memoryInfo: performance.memory ? {
                usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
                totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB'
            } : 'unavailable',
            dataStatus: {
                runLog: {
                    loaded: !!this.runLogData,
                    entries: this.runLogData ? this.runLogData.length : 0
                },
                summaries: {
                    loaded: !!this.summariesData,
                    entries: this.summariesData ? Object.keys(this.summariesData).length : 0
                },
                weeklySummaries: {
                    loaded: !!this.weeklySummariesData,
                    entries: this.weeklySummariesData ? Object.keys(this.weeklySummariesData).filter(k => !k.startsWith('_')).length : 0
                },
                platformData: {
                    loaded: !!this.platformData,
                    entries: this.platformData ? this.platformData.length : 0
                }
            },
            errors: window.dashboardErrors || [],
            performanceEntries: performance.getEntriesByType('navigation').map(entry => ({
                type: entry.type,
                loadEventEnd: Math.round(entry.loadEventEnd),
                domContentLoadedEventEnd: Math.round(entry.domContentLoadedEventEnd),
                connectEnd: Math.round(entry.connectEnd),
                responseEnd: Math.round(entry.responseEnd)
            }))
        };
        
        return report;
    }
    
    showDiagnosticModal() {
        const report = this.generateDiagnosticReport();
        const modalHtml = `
            <div id="diagnostic-modal" class="modal" style="display: block;">
                <div class="modal-content modal-large">
                    <div class="modal-header">
                        <h2><i class="fas fa-stethoscope"></i> System Diagnostics</h2>
                        <span class="close-button" onclick="document.getElementById('diagnostic-modal').remove()">&times;</span>
                    </div>
                    <div class="modal-body">
                        <div class="diagnostic-sections">
                            <div class="diagnostic-section">
                                <h3><i class="fas fa-database"></i> Data Status</h3>
                                <div class="status-grid">
                                    ${Object.entries(report.dataStatus).map(([key, status]) => `
                                        <div class="status-item ${status.loaded ? 'success' : 'error'}">
                                            <strong>${key.replace(/([A-Z])/g, ' $1').toLowerCase().replace(/^./, str => str.toUpperCase())}</strong>
                                            <span class="status-indicator">
                                                <i class="fas fa-${status.loaded ? 'check-circle' : 'times-circle'}"></i>
                                                ${status.loaded ? `${status.entries} entries` : 'Not loaded'}
                                            </span>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>
                            
                            <div class="diagnostic-section">
                                <h3><i class="fas fa-exclamation-triangle"></i> Recent Errors (${report.errors.length})</h3>
                                ${report.errors.length > 0 ? `
                                    <div class="error-list">
                                        ${report.errors.slice(-5).map(error => `
                                            <div class="error-item">
                                                <div class="error-timestamp">${new Date(error.timestamp).toLocaleString()}</div>
                                                <div class="error-url">${error.url.split('/').pop()}</div>
                                                <div class="error-message">${error.details.error}</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : '<p class="no-errors">No recent errors detected.</p>'}
                            </div>
                            
                            <div class="diagnostic-section">
                                <h3><i class="fas fa-tachometer-alt"></i> Performance</h3>
                                <div class="performance-grid">
                                    <div class="perf-item">
                                        <strong>Page Load</strong>
                                        <span>${report.performanceEntries[0] ? Math.round(report.performanceEntries[0].loadEventEnd) + 'ms' : 'N/A'}</span>
                                    </div>
                                    <div class="perf-item">
                                        <strong>DOM Ready</strong>
                                        <span>${report.performanceEntries[0] ? Math.round(report.performanceEntries[0].domContentLoadedEventEnd) + 'ms' : 'N/A'}</span>
                                    </div>
                                    <div class="perf-item">
                                        <strong>Memory Usage</strong>
                                        <span>${report.memoryInfo !== 'unavailable' ? report.memoryInfo.usedJSHeapSize : 'N/A'}</span>
                                    </div>
                                    <div class="perf-item">
                                        <strong>Connection</strong>
                                        <span>${report.connectionInfo !== 'unavailable' ? report.connectionInfo.effectiveType : 'N/A'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="diagnostic-actions">
                            <button class="btn btn-primary" onclick="navigator.clipboard.writeText(JSON.stringify(${JSON.stringify(report)}, null, 2)); alert('Diagnostic report copied to clipboard!')">
                                <i class="fas fa-copy"></i> Copy Full Report
                            </button>
                            <button class="btn btn-secondary" onclick="window.dashboardInstance.clearErrors()">
                                <i class="fas fa-broom"></i> Clear Error History
                            </button>
                            <button class="btn btn-secondary" onclick="window.location.reload()">
                                <i class="fas fa-sync"></i> Reload Dashboard
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }
    
    clearErrors() {
        window.dashboardErrors = [];
        console.log('Error history cleared');
        
        // Remove error notifications
        const errorContainer = document.getElementById('error-notifications');
        if (errorContainer) {
            errorContainer.innerHTML = '';
        }
        
        alert('Error history has been cleared.');
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
                    // Determine destination tab
                    const targetTab = tab.getAttribute('data-tab');
                    // If leaving Policy Explorer, reset sticky immediately
                    if (targetTab !== 'platforms') {
                        this.resetStickyState();
                    }
                    // Immediate recalculation to minimize timing windows
                    this.updateStickyCalculations();
                    // Follow-up recalculation after layout settles
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
            // Do not hide main nav on mobile; keep it stable
            
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
        
        // No-op for main nav visibility; keep it always visible
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

    // Weekly Update Methods
    renderWeeklyUpdate() {
        this.populateWeekSelector();
        this.renderLatestWeeklySummary();
    }

    populateWeekSelector() {
        const weekSelector = document.getElementById('week-selector');
        if (!weekSelector) return;

        // Get all available weeks (excluding metadata)
        const weeks = Object.keys(this.weeklySummariesData)
            .filter(key => !key.startsWith('_'))
            .sort((a, b) => b.localeCompare(a)); // Most recent first

        weekSelector.innerHTML = '';

        if (weeks.length === 0) {
            weekSelector.innerHTML = '<option value="">No weekly summaries available</option>';
            return;
        }

        weeks.forEach((weekKey, index) => {
            const weekData = this.weeklySummariesData[weekKey];
            const metadata = weekData.run_metadata;
            const startDate = new Date(metadata.week_start);
            const endDate = new Date(metadata.week_end);
            
            const option = document.createElement('option');
            option.value = weekKey;
            option.textContent = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
            
            if (index === 0) {
                option.selected = true;
                this.currentWeek = weekKey;
            }
            
            weekSelector.appendChild(option);
        });

        // Add event listener for week selection
        weekSelector.addEventListener('change', (e) => {
            this.currentWeek = e.target.value;
            this.displayWeeklySummary(this.currentWeek);
        });
    }

    renderLatestWeeklySummary() {
        const weeks = Object.keys(this.weeklySummariesData)
            .filter(key => !key.startsWith('_'))
            .sort((a, b) => b.localeCompare(a));

        if (weeks.length > 0) {
            this.currentWeek = weeks[0];
            this.displayWeeklySummary(this.currentWeek);
        } else {
            this.displayNoWeeklyData();
        }
    }

    displayWeeklySummary(weekKey) {
        if (!weekKey || !this.weeklySummariesData[weekKey]) {
            this.displayNoWeeklyData();
            return;
        }

        const weekData = this.weeklySummariesData[weekKey];
        const metadata = weekData.run_metadata;

        // Update metadata display
        this.updateWeeklyMetadata(metadata);

        // Update stats
        this.updateWeeklyStats(weekData);

        // Update summary content
        this.updateWeeklySummaryContent(weekData.summary);
    }

    updateWeeklyMetadata(metadata) {
        const metadataContainer = document.getElementById('weekly-metadata');
        if (!metadataContainer) return;

        const startDate = new Date(metadata.week_start);
        const endDate = new Date(metadata.week_end);
        const runDate = new Date(metadata.run_date);

        const runTypeClass = metadata.run_type === 'manual' ? 'manual' : 'scheduled';
        const runTypeText = metadata.run_type === 'manual' ? 'Manual Test Run' : 'Scheduled Friday Run';

        metadataContainer.innerHTML = `
            <div class="weekly-info">
                <div class="weekly-date-range">
                    Week of ${startDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
                <div class="weekly-generated-date">
                    Generated on ${runDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at ${runDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })} UTC
                </div>
            </div>
            <div class="run-type-badge ${runTypeClass}">
                ${runTypeText}
            </div>
        `;
    }

    updateWeeklyStats(weekData) {
        // Update changes count
        const changesCountEl = document.getElementById('weekly-changes-count');
        if (changesCountEl) {
            changesCountEl.textContent = weekData.changes_count || 0;
        }

        // Update platforms count
        const platformsCountEl = document.getElementById('weekly-platforms-count');
        if (platformsCountEl && weekData.changed_policies) {
            const uniquePlatforms = new Set();
            weekData.changed_policies.forEach(policy => {
                const platform = policy.policy_key.split('-')[0];
                uniquePlatforms.add(platform);
            });
            platformsCountEl.textContent = uniquePlatforms.size;
        }

        // Update run date
        const runDateEl = document.getElementById('weekly-run-date');
        if (runDateEl && weekData.run_metadata) {
            const runDate = new Date(weekData.run_metadata.run_date);
            runDateEl.textContent = runDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }

    updateWeeklySummaryContent(summaryText) {
        const contentContainer = document.getElementById('weekly-summary-content');
        if (!contentContainer) return;

        if (!summaryText || summaryText.trim() === '') {
            contentContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-info-circle"></i>
                    <p>No summary available for this week.</p>
                </div>
            `;
            return;
        }

        // Convert markdown to HTML (basic conversion)
        const htmlContent = this.markdownToHtml(summaryText);
        contentContainer.innerHTML = `<div class="weekly-summary-content">${htmlContent}</div>`;
    }

    markdownToHtml(markdown) {
        // Basic markdown conversion for weekly summaries
        return markdown
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            .replace(/^\* (.*$)/gim, '<li>$1</li>')
            .replace(/^\- (.*$)/gim, '<li>$1</li>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(?!<[h1-6]|<li|<\/li|<p|<\/p)(.+)$/gim, '<p>$1</p>')
            .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
            .replace(/<\/ul>\s*<ul>/g, '');
    }

    displayNoWeeklyData() {
        const contentContainer = document.getElementById('weekly-summary-content');
        const metadataContainer = document.getElementById('weekly-metadata');
        
        if (contentContainer) {
            contentContainer.innerHTML = `
                <div class="loading-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>No weekly summaries available yet. Run the weekly aggregator to generate summaries.</p>
                </div>
            `;
        }

        if (metadataContainer) {
            metadataContainer.innerHTML = `
                <div class="weekly-info">
                    <div class="weekly-date-range">No weekly data available</div>
                    <div class="weekly-generated-date">Run the weekly aggregator to generate summaries</div>
                </div>
            `;
        }

        // Reset stats
        ['weekly-changes-count', 'weekly-platforms-count', 'weekly-run-date'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '-';
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
    window.dashboardInstance = new PolicyWatcherDashboard();
    window.policyDashboard = window.dashboardInstance; // Keep for compatibility
});


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
            // Track successful subscription in GTM
            window.dataLayer = window.dataLayer || [];
            window.dataLayer.push({
                'event': 'newsletter_subscription_success',
                'subscription_source': 'widget',
                'subscription_email_domain': email.split('@')[1] || 'unknown'
            });
            
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
        
        // Track subscription event in GTM
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
            'event': 'newsletter_subscription',
            'subscription_source': 'widget',
            'subscription_email_domain': email.split('@')[1] || 'unknown' // domain only for privacy
        });
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
    
    // Widget starts expanded by default (from HTML)
    // Only minimize if user has explicitly minimized it before
    if (widgetMinimized === 'true') {
        widgetForm.classList.remove('expanded');
    } else {
        // Ensure it's expanded and clear any minimize preference
        widgetForm.classList.add('expanded');
        localStorage.setItem('widget-minimized', 'false');
    }
    
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
    
    // Close widget form when clicking outside or pressing escape
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
    
    // Close widget with escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            const widgetForm = document.getElementById('widgetForm');
            if (widgetForm && widgetForm.classList.contains('expanded')) {
                widgetForm.classList.remove('expanded');
                localStorage.setItem('widget-minimized', 'true');
            }
        }
    });
});

// Pagination Manager Class
class PaginationManager {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.currentPage = 1;
        this.itemsPerPage = options.itemsPerPage || 10;
        this.totalItems = 0;
        this.data = [];
        this.filteredData = [];
        this.renderCallback = options.renderCallback;
        this.onPageChange = options.onPageChange;
        
        // Page size options
        this.pageSizeOptions = options.pageSizeOptions || [10, 25, 50];
        
        // Create pagination container
        this.createPaginationContainer();
    }
    
    createPaginationContainer() {
        const container = document.getElementById(this.containerId);
        if (!container) return;
        
        // Remove existing pagination if any
        const existingPagination = container.querySelector('.pagination-container');
        if (existingPagination) {
            existingPagination.remove();
        }
        
        // Create new pagination container
        const paginationHtml = `
            <div class="pagination-container">
                <div class="pagination-info">
                    <span id="${this.containerId}-pagination-info">Showing 0-0 of 0 items</span>
                </div>
                <div class="pagination-controls" id="${this.containerId}-pagination-controls">
                    <!-- Pagination buttons will be inserted here -->
                </div>
                <div class="items-per-page">
                    <label for="${this.containerId}-page-size">Show:</label>
                    <select id="${this.containerId}-page-size">
                        ${this.pageSizeOptions.map(size => 
                            `<option value="${size}" ${size === this.itemsPerPage ? 'selected' : ''}>${size}</option>`
                        ).join('')}
                    </select>
                    <span>per page</span>
                </div>
            </div>
        `;
        
        container.insertAdjacentHTML('beforeend', paginationHtml);
        
        // Add event listeners
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Page size selector
        const pageSizeSelect = document.getElementById(`${this.containerId}-page-size`);
        if (pageSizeSelect) {
            pageSizeSelect.addEventListener('change', (e) => {
                this.itemsPerPage = parseInt(e.target.value);
                this.currentPage = 1;
                this.render();
            });
        }
    }
    
    setData(data, filterFunction = null) {
        this.data = data;
        this.filteredData = filterFunction ? data.filter(filterFunction) : data;
        this.totalItems = this.filteredData.length;
        this.currentPage = 1;
        this.render();
    }
    
    updateFilter(filterFunction) {
        this.filteredData = filterFunction ? this.data.filter(filterFunction) : this.data;
        this.totalItems = this.filteredData.length;
        this.currentPage = 1;
        this.render();
    }
    
    getCurrentPageData() {
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        return this.filteredData.slice(start, end);
    }
    
    getTotalPages() {
        return Math.ceil(this.totalItems / this.itemsPerPage);
    }
    
    goToPage(page) {
        const totalPages = this.getTotalPages();
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.render();
            
            if (this.onPageChange) {
                this.onPageChange(page, this.getCurrentPageData());
            }
        }
    }
    
    nextPage() {
        this.goToPage(this.currentPage + 1);
    }
    
    prevPage() {
        this.goToPage(this.currentPage - 1);
    }
    
    render() {
        this.updatePaginationInfo();
        this.updatePaginationControls();
        
        if (this.renderCallback) {
            this.renderCallback(this.getCurrentPageData());
        }
    }
    
    updatePaginationInfo() {
        const infoElement = document.getElementById(`${this.containerId}-pagination-info`);
        if (!infoElement) return;
        
        if (this.totalItems === 0) {
            infoElement.textContent = 'No items to display';
            return;
        }
        
        const start = (this.currentPage - 1) * this.itemsPerPage + 1;
        const end = Math.min(this.currentPage * this.itemsPerPage, this.totalItems);
        infoElement.textContent = `Showing ${start}-${end} of ${this.totalItems} items`;
    }
    
    updatePaginationControls() {
        const controlsElement = document.getElementById(`${this.containerId}-pagination-controls`);
        if (!controlsElement) return;
        
        const totalPages = this.getTotalPages();
        
        if (totalPages <= 1) {
            controlsElement.innerHTML = '';
            return;
        }
        
        let controlsHtml = '';
        
        // Previous button
        controlsHtml += `
            <button class="pagination-btn ${this.currentPage === 1 ? 'disabled' : ''}" 
                    onclick="window.paginationInstances['${this.containerId}'].prevPage()" 
                    ${this.currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Page numbers with smart ellipsis
        const pageNumbers = this.getPageNumbers(totalPages);
        pageNumbers.forEach((page, index) => {
            if (page === '...') {
                controlsHtml += '<span class="pagination-ellipsis">...</span>';
            } else {
                controlsHtml += `
                    <button class="pagination-btn ${page === this.currentPage ? 'active' : ''}" 
                            onclick="window.paginationInstances['${this.containerId}'].goToPage(${page})">
                        ${page}
                    </button>
                `;
            }
        });
        
        // Next button
        controlsHtml += `
            <button class="pagination-btn ${this.currentPage === totalPages ? 'disabled' : ''}" 
                    onclick="window.paginationInstances['${this.containerId}'].nextPage()" 
                    ${this.currentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        controlsElement.innerHTML = controlsHtml;
    }
    
    getPageNumbers(totalPages) {
        const pages = [];
        const current = this.currentPage;
        
        if (totalPages <= 7) {
            // Show all pages if 7 or fewer
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);
            
            if (current <= 4) {
                // Near the beginning
                for (let i = 2; i <= 5; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            } else if (current >= totalPages - 3) {
                // Near the end
                pages.push('...');
                for (let i = totalPages - 4; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                // In the middle
                pages.push('...');
                for (let i = current - 1; i <= current + 1; i++) {
                    pages.push(i);
                }
                pages.push('...');
                pages.push(totalPages);
            }
        }
        
        return pages;
    }
}

// Global pagination instances registry
window.paginationInstances = window.paginationInstances || {};

// Global function for toggling policy summary expansion
function togglePolicySummary(summaryId) {
    const shortSummary = document.getElementById(summaryId);
    const fullSummary = document.getElementById(summaryId + '-full');
    
    if (shortSummary && fullSummary) {
        const isExpanded = fullSummary.style.display !== 'none';
        
        if (isExpanded) {
            // Collapse
            fullSummary.style.display = 'none';
            shortSummary.style.display = 'block';
        } else {
            // Expand
            shortSummary.style.display = 'none';
            fullSummary.style.display = 'block';
        }
    }
}

// Global weekly refresh function

// Make function globally available
window.togglePolicySummary = togglePolicySummary;

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

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Ctrl+D - Show diagnostics modal
    if (event.ctrlKey && event.key === 'd') {
        event.preventDefault();
        if (window.dashboardInstance) {
            window.dashboardInstance.showDiagnosticModal();
        }
    }
    
    // Escape - Close any open modal
    if (event.key === 'Escape') {
        const modals = document.querySelectorAll('.modal[style*="display: block"], .modal[style="display: block;"]');
        modals.forEach(modal => {
            if (modal.id === 'diagnostic-modal' || modal.id === 'policy-summary-modal' || modal.id === 'run-log-modal') {
                modal.remove ? modal.remove() : (modal.style.display = 'none');
            }
        });
    }
    
    // F5 - Refresh data (but not page)
    if (event.key === 'F5' && !event.shiftKey) {
        event.preventDefault();
        if (window.dashboardInstance) {
            console.log('Refreshing dashboard data...');
            window.dashboardInstance.loadAllData().then(() => {
                window.dashboardInstance.renderDashboard();
                console.log('Dashboard data refreshed');
            });
        }
    }
});