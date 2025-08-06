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

    // Placeholder for other methods - simplified for testing
    switchMainTab(tabName) { console.log('switchMainTab:', tabName); }
    renderMatrix() { console.log('renderMatrix called'); }
    renderOverview() { console.log('renderOverview called'); }
}

// Initialize the app
const app = new PolicyWatcherDashboard();

console.log('Dashboard initialized successfully with methods:', {
    cleanTimestamp: typeof app.cleanTimestamp,
    updateSystemStatus: typeof app.updateSystemStatus,
    updateHeaderStats: typeof app.updateHeaderStats
});