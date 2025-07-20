// Enhanced T&S Policy Watcher Dashboard JavaScript

class PolicyWatcherDashboard {
    constructor() {
        // GitHub raw content URLs
        this.GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/lyori6/ts-policy-watcher/main';
        this.LOG_FILE_PATH = `${this.GITHUB_RAW_BASE}/run_log.json`;
        this.SUMMARIES_PATH = `${this.GITHUB_RAW_BASE}/summaries.json`;
        this.PLATFORM_URLS_PATH = `${this.GITHUB_RAW_BASE}/platform_urls.json`;

        // Data containers
        this.runData = [];
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
            const [runDataResponse, summariesResponse, platformsResponse] = await Promise.all([
                this.fetchData(this.LOG_FILE_PATH),
                this.fetchData(this.SUMMARIES_PATH),
                this.fetchData(this.PLATFORM_URLS_PATH)
            ]);

            this.runData = runDataResponse || [];
            this.summariesData = summariesResponse || {};
            this.platformData = platformsResponse || [];

            console.log('Data loaded successfully:', {
                runs: this.runData.length,
                summaries: Object.keys(this.summariesData).length,
                platforms: this.platformData.length
            });

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
        this.renderOverview();
    }

    updateHeaderStats() {
        const totalPolicies = this.platformData.length;
        const lastRun = this.runData[0];
        const hoursAgo = lastRun ? this.getHoursAgo(new Date(lastRun.timestamp_utc)) : '-';
        const uptime = this.calculateUptime();

        this.updateElement('total-policies', totalPolicies);
        this.updateElement('last-check', hoursAgo);
        this.updateElement('uptime-metric', uptime);
    }

    renderOverview() {
        const lastRun = this.runData[0];
        
        // System Health
        if (lastRun) {
            const statusClass = this.getStatusClass(lastRun.status);
            this.updateElement('overall-health-badge', this.capitalizeStatus(lastRun.status), statusClass);
            this.updateElement('last-run-status', this.capitalizeStatus(lastRun.status), `status-badge ${statusClass}`);
            this.updateElement('last-run-timestamp', this.formatDateTime(lastRun.timestamp_utc));
            this.updateElement('pages-checked', lastRun.pages_checked);
            this.updateElement('changes-found', lastRun.changes_found);

            // Handle errors
            this.renderErrors(lastRun.errors || []);
        }

        // Recent Changes
        this.renderRecentChanges();

        // Quick Stats
        this.renderQuickStats();
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
        this.renderPoliciesByPlatform(this.currentPlatform);
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
        const filteredPolicies = selectedPlatform === 'all' ? 
            this.platformData : 
            this.platformData.filter(p => p.platform === selectedPlatform);

        if (filteredPolicies.length === 0) {
            container.innerHTML = '<p class="text-center">No policies found for this platform.</p>';
            return;
        }

        const policiesHtml = filteredPolicies.map(policy => {
            const summaryData = this.summariesData[policy.slug] || {};
            const lastUpdated = summaryData.last_updated ? 
                this.formatDateTime(summaryData.last_updated) : 'Never';
            
            return `
                <div class="policy-card">
                    <h4>${policy.name}</h4>
                    
                    ${summaryData.initial_summary ? `
                        <div class="summary initial-summary">
                            <strong>Overview:</strong><br>
                            <div class="summary-content" data-full="${policy.slug}-full">
                                ${this.renderMarkdown(this.truncateText(summaryData.initial_summary, 400))}
                                ${summaryData.initial_summary.length > 400 ? `
                                    <button class="read-more-btn" onclick="toggleSummary('${policy.slug}-full', this)">
                                        <i class="fas fa-chevron-down"></i> Read More
                                    </button>
                                    <div class="full-content" style="display: none;">
                                        ${this.renderMarkdown(summaryData.initial_summary)}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    ` : '<p><em>No summary generated yet</em></p>'}
                    
                    ${summaryData.last_update_summary && summaryData.last_update_summary !== 'Initial version.' ? `
                        <div class="summary update-summary">
                            <strong>Latest Change:</strong><br>
                            ${this.renderMarkdown(summaryData.last_update_summary)}
                        </div>
                    ` : ''}
                    
                    <div class="timestamp">
                        <strong>Last Updated:</strong> ${lastUpdated}
                    </div>
                    
                    <div class="policy-actions">
                        <a href="https://github.com/lyori6/ts-policy-watcher/tree/main/snapshots/${policy.slug}" 
                           target="_blank">
                            <i class="fas fa-history"></i> View History
                        </a>
                        <a href="${policy.url}" target="_blank">
                            <i class="fas fa-external-link-alt"></i> Live Page
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
            const duration = index < filteredRuns.length - 1 ? 
                this.calculateDuration(run.timestamp_utc, filteredRuns[index + 1].timestamp_utc) : 
                '-';
            
            return `
                <tr>
                    <td>${this.formatDateTime(run.timestamp_utc)}</td>
                    <td>
                        <div class="status-cell">
                            <div class="status-icon ${statusClass}"></div>
                            ${this.capitalizeStatus(run.status)}
                        </div>
                    </td>
                    <td>${run.pages_checked}</td>
                    <td>${run.changes_found}</td>
                    <td>${run.errors ? run.errors.length : 0}</td>
                    <td>${duration}</td>
                </tr>
            `;
        }).join('');

        tbody.innerHTML = rowsHtml;
    }

    renderAnalytics() {
        this.renderPlatformActivity();
        this.renderPerformanceTrends();
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
        };
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
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);

        if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return 'Recently';
    }

    getHoursAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        return diffHours;
    }

    calculateDuration(start, end) {
        const diffMs = new Date(start) - new Date(end);
        const diffMin = Math.floor(diffMs / (1000 * 60));
        return `${diffMin} min`;
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

// Global function for summary toggling
function toggleSummary(id, button) {
    const summaryContent = document.querySelector(`[data-full="${id}"]`);
    const fullContent = summaryContent.querySelector('.full-content');
    const isExpanded = fullContent.style.display === 'block';
    
    if (isExpanded) {
        fullContent.style.display = 'none';
        button.innerHTML = '<i class="fas fa-chevron-down"></i> Read More';
        button.classList.remove('expanded');
    } else {
        fullContent.style.display = 'block';
        button.innerHTML = '<i class="fas fa-chevron-up"></i> Read Less';
        button.classList.add('expanded');
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PolicyWatcherDashboard();
});