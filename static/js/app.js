// BotManager V2.5 - Enhanced AI Project Generator with Multi-Bot Support
// Main Application JavaScript File

// Global state management
const AppState = {
    currentBot: null,
    bots: [],
    projects: [],
    activeTab: 'dashboard',
    isLoading: false,
    notifications: []
};

// DOM Elements
let DOM = {};

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeDOM();
    setupEventListeners();
    loadInitialData();
    setupRealTimeUpdates();
});

// Cache DOM elements for better performance
function initializeDOM() {
    DOM = {
        // Navigation
        navDashboard: document.getElementById('nav-dashboard'),
        navBotManager: document.getElementById('nav-bot-manager'),
        navProjectGenerator: document.getElementById('nav-project-generator'),
        navSettings: document.getElementById('nav-settings'),
        
        // Main content sections
        dashboardSection: document.getElementById('dashboard-section'),
        botManagerSection: document.getElementById('bot-manager-section'),
        projectGeneratorSection: document.getElementById('project-generator-section'),
        settingsSection: document.getElementById('settings-section'),
        
        // Dashboard elements
        statsBots: document.getElementById('stats-bots'),
        statsProjects: document.getElementById('stats-projects'),
        statsActive: document.getElementById('stats-active'),
        recentActivity: document.getElementById('recent-activity'),
        
        // Bot Manager elements
        botList: document.getElementById('bot-list'),
        createBotBtn: document.getElementById('create-bot-btn'),
        botModal: document.getElementById('bot-modal'),
        botForm: document.getElementById('bot-form'),
        botModalTitle: document.getElementById('bot-modal-title'),
        closeModal: document.querySelectorAll('.close-modal'),
        
        // Project Generator elements
        projectTypeSelect: document.getElementById('project-type'),
        projectNameInput: document.getElementById('project-name'),
        projectDescription: document.getElementById('project-description'),
        generateProjectBtn: document.getElementById('generate-project-btn'),
        projectOutput: document.getElementById('project-output'),
        projectStatus: document.getElementById('project-status'),
        
        // Settings elements
        apiKeyInput: document.getElementById('api-key'),
        saveSettingsBtn: document.getElementById('save-settings-btn'),
        settingsStatus: document.getElementById('settings-status'),
        
        // Notification container
        notificationContainer: document.getElementById('notification-container')
    };
}

// Set up all event listeners
function setupEventListeners() {
    // Navigation
    DOM.navDashboard.addEventListener('click', () => switchTab('dashboard'));
    DOM.navBotManager.addEventListener('click', () => switchTab('bot-manager'));
    DOM.navProjectGenerator.addEventListener('click', () => switchTab('project-generator'));
    DOM.navSettings.addEventListener('click', () => switchTab('settings'));
    
    // Bot Manager
    DOM.createBotBtn.addEventListener('click', openCreateBotModal);
    DOM.botForm.addEventListener('submit', handleBotFormSubmit);
    
    // Close modal buttons
    DOM.closeModal.forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    
    // Project Generator
    DOM.generateProjectBtn.addEventListener('click', generateProject);
    
    // Settings
    DOM.saveSettingsBtn.addEventListener('click', saveSettings);
    
    // Close notifications when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('notification')) {
            removeNotification(e.target.dataset.id);
        }
    });
}

// Load initial data from server
async function loadInitialData() {
    try {
        showLoading(true);
        
        // Load bots
        const botsResponse = await fetch('/api/bots');
        if (botsResponse.ok) {
            AppState.bots = await botsResponse.json();
            renderBotList();
        }
        
        // Load projects
        const projectsResponse = await fetch('/api/projects');
        if (projectsResponse.ok) {
            AppState.projects = await projectsResponse.json();
        }
        
        // Load settings
        const settingsResponse = await fetch('/api/settings');
        if (settingsResponse.ok) {
            const settings = await settingsResponse.json();
            if (settings.apiKey) {
                DOM.apiKeyInput.value = settings.apiKey;
            }
        }
        
        updateDashboardStats();
        showNotification('Application loaded successfully', 'success');
        
    } catch (error) {
        console.error('Error loading initial data:', error);
        showNotification('Failed to load application data', 'error');
    } finally {
        showLoading(false);
    }
}

// Switch between application tabs
function switchTab(tabName) {
    AppState.activeTab = tabName;
    
    // Hide all sections
    const sections = [
        DOM.dashboardSection,
        DOM.botManagerSection,
        DOM.projectGeneratorSection,
        DOM.settingsSection
    ];
    
    sections.forEach(section => {
        section.classList.add('hidden');
    });
    
    // Remove active class from all nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Show selected section and activate nav item
    switch(tabName) {
        case 'dashboard':
            DOM.dashboardSection.classList.remove('hidden');
            DOM.navDashboard.classList.add('active');
            updateDashboardStats();
            break;
        case 'bot-manager':
            DOM.botManagerSection.classList.remove('hidden');
            DOM.navBotManager.classList.add('active');
            break;
        case 'project-generator':
            DOM.projectGeneratorSection.classList.remove('hidden');
            DOM.navProjectGenerator.classList.add('active');
            break;
        case 'settings':
            DOM.settingsSection.classList.remove('hidden');
            DOM.navSettings.classList.add('active');
            break;
    }
}

// Bot Manager Functions
function openCreateBotModal(bot = null) {
    DOM.botModal.classList.remove('hidden');
    DOM.botForm.reset();
    
    if (bot) {
        // Edit existing bot
        DOM.botModalTitle.textContent = 'Edit Bot';
        document.getElementById('bot-id').value = bot.id;
        document.getElementById('bot-name').value = bot.name;
        document.getElementById('bot-type').value = bot.type;
        document.getElementById('bot-description').value = bot.description;
        document.getElementById('bot-status').value = bot.status;
    } else {
        // Create new bot
        DOM.botModalTitle.textContent = 'Create New Bot';
        document.getElementById('bot-id').value = '';
    }
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.add('hidden');
    });
}

async function handleBotFormSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(DOM.botForm);
    const botData = Object.fromEntries(formData);
    
    try {
        showLoading(true);
        
        const url = botData.id ? `/api/bots/${botData.id}` : '/api/bots';
        const method = botData.id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(botData)
        });
        
        if (response.ok) {
            const bot = await response.json();
            
            if (botData.id) {
                // Update existing bot in state
                const index = AppState.bots.findIndex(b => b.id === bot.id);
                if (index !== -1) {
                    AppState.bots[index] = bot;
                }
                showNotification('Bot updated successfully', 'success');
            } else {
                // Add new bot to state
                AppState.bots.push(bot);
                showNotification('Bot created successfully', 'success');
            }
            
            renderBotList();
            closeAllModals();
            updateDashboardStats();
        } else {
            throw new Error('Failed to save bot');
        }
    } catch (error) {
        console.error('Error saving bot:', error);
        showNotification('Failed to save bot', 'error');
    } finally {
        showLoading(false);
    }
}

function renderBotList() {
    if (!DOM.botList) return;
    
    DOM.botList.innerHTML = '';
    
    if (AppState.bots.length === 0) {
        DOM.botList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-robot"></i>
                <p>No bots created yet</p>
                <button class="btn btn-primary" onclick="openCreateBotModal()">
                    Create Your First Bot
                </button>
            </div>
        `;
        return;
    }
    
    AppState.bots.forEach(bot => {
        const botElement = document.createElement('div');
        botElement.className = 'bot-card';
        botElement.innerHTML = `
            <div class="bot-card-header">
                <div class="bot-icon">
                    <i class="fas fa-${getBotIcon(bot.type)}"></i>
                </div>
                <div class="bot-info">
                    <h3>${bot.name}</h3>
                    <p class="bot-type">${bot.type}</p>
                </div>
                <div class="bot-status ${bot.status}">
                    <span class="status-dot"></span>
                    ${bot.status}
                </div>
            </div>
            <div class="bot-card-body">
                <p>${bot.description || 'No description provided'}</p>
            </div>
            <div class="bot-card-footer">
                <button class="btn btn-sm btn-outline" onclick="toggleBotStatus('${bot.id}')">
                    <i class="fas fa-power-off"></i> ${bot.status === 'active' ? 'Deactivate' : 'Activate'}
                </button>
                <button class="btn btn-sm btn-outline" onclick="openCreateBotModal(${JSON.stringify(bot).replace(/"/g, '&quot;')})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteBot('${bot.id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        DOM.botList.appendChild(botElement);
    });
}

async function toggleBotStatus(botId) {
    try {
        const bot = AppState.bots.find(b => b.id === botId);
        if (!bot) return;
        
        const newStatus = bot.status === 'active' ? 'inactive' : 'active';
        
        const response = await fetch(`/api/bots/${botId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        if (response.ok) {
            bot.status = newStatus;
            renderBotList();
            updateDashboardStats();
            showNotification(`Bot ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
        }
    } catch (error) {
        console.error('Error toggling bot status:', error);
        showNotification('Failed to update bot status', 'error');
    }
}

async function deleteBot(botId) {
    if (!confirm('Are you sure you want to delete this bot?')) return;
    
    try {
        const response = await fetch(`/api/bots/${botId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            AppState.bots = AppState.bots.filter(b => b.id !== botId);
            renderBotList();
            updateDashboardStats();
            showNotification('Bot deleted successfully', 'success');
        }
    } catch (error) {
        console.error('Error deleting bot:', error);
        showNotification('Failed to delete bot', 'error');
    }
}

// Project Generator Functions
async function generateProject() {
    const projectType = DOM.projectTypeSelect.value;
    const projectName = DOM.projectNameInput.value.trim();
    const description = DOM.projectDescription.value.trim();
    
    if (!projectName) {
        showNotification('Please enter a project name', 'warning');
        return;
    }
    
    if (!description) {
        showNotification('Please enter a project description', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        DOM.projectStatus.textContent = 'Generating project...';
        DOM.projectStatus.className = 'project-status generating';
        DOM.projectOutput.innerHTML = '';
        
        const response = await fetch('/api/generate-project', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: projectType,
                name: projectName,
                description: description
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to generate project');
        }
        
        const data = await response.json();
        
        DOM.projectStatus.textContent = 'Project generated successfully!';
        DOM.projectStatus.className = 'project-status success';
        
        // Display the generated project
        DOM.projectOutput.innerHTML = `
            <div class="project-result">
                <h3>Generated Project: ${data.project.name}</h3>
                <div class="project-files">
                    <h4>Files Created:</h4>
                    <ul>
                        ${data.files.map(file => `<li><code>${file.name}</code> - ${file.description}</li>`).join('')}
                    </ul>
                </div>
                <div class="project-instructions">
                    <h4>Setup Instructions:</h4>
                    <pre><code>${data.instructions}</code></pre>
                </div>
                <div class="project-actions">
                    <button class="btn btn-primary" onclick="downloadProject('${data.project.id}')">
                        <i class="fas fa-download"></i> Download Project
                    </button>
                    <button class="btn btn-outline" onclick="saveProjectTemplate('${data.project.id}')">
                        <i class="fas fa-save"></i> Save as Template
                    </button>
                </div>
            </div>
        `;
        
        // Add to projects list
        AppState.projects.unshift(data.project);
        updateDashboardStats();
        showNotification('Project generated successfully', 'success');
        
    } catch (error) {
        console.error('Error generating project:', error);
        DOM.projectStatus.textContent = 'Failed to generate project';
        DOM.projectStatus.className = 'project-status error';
        showNotification('Failed to generate project', 'error');
    } finally {
        showLoading(false);
    }
}

async function downloadProject(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/download`);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `project-${projectId}.zip`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            showNotification('Project download started', 'success');
        }
    } catch (error) {
        console.error('Error downloading project:', error);
        showNotification('Failed to download project', 'error');
    }
}

async function saveProjectTemplate(projectId) {
    try {
        const response = await fetch(`/api/projects/${projectId}/save-template`, {
            method: 'POST'
        });
        
        if (response.ok) {
            showNotification('Project saved as template', 'success');
        }
    } catch (error) {
        console.error('Error saving template:', error);
        showNotification('Failed to save template', 'error');
    }
}

// Settings Functions
async function saveSettings() {
    const apiKey = DOM.apiKeyInput.value.trim();
    
    if (!apiKey) {
        showNotification('API key is required', 'warning');
        return;
    }
    
    try {
        showLoading(true);
        
        const response = await fetch('/api/settings', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ apiKey })
        });
        
        if (response.ok) {
            DOM.settingsStatus.textContent = 'Settings saved successfully';
            DOM.settingsStatus.className = 'settings-status success';
            showNotification('Settings saved successfully', 'success');
            
            // Clear status after 3 seconds
            setTimeout(() => {
                DOM.settingsStatus.textContent = '';
                DOM.settingsStatus.className = 'settings-status';
            }, 3000);
        } else {
            throw new Error('Failed to save settings');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
        DOM.settingsStatus.textContent = 'Failed to save settings';
        DOM.settingsStatus.className = 'settings-status error';
        showNotification('Failed to save settings', 'error');
    } finally {
        showLoading(false);
    }
}

// Dashboard Functions
function updateDashboardStats() {
    if (!DOM.statsBots || !DOM.statsProjects || !DOM.statsActive) return;
    
    const activeBots = AppState.bots.filter(bot => bot.status === 'active').length;
    
    DOM.statsBots.textContent = AppState.bots.length;
    DOM.statsProjects.textContent = AppState.projects.length;
    DOM.statsActive.textContent = activeBots;
    
    // Update recent activity
    updateRecentActivity();
}

function updateRecentActivity() {
    if (!DOM.recentActivity) return;
    
    const activities = [];
    
    // Add bot activities
    AppState.bots.slice(0, 3).forEach(bot => {
        activities.push({
            type: 'bot',
            message: `Bot "${bot.name}" is ${bot.status}`,
            time: 'Recently',
            icon: 'fa-robot'
        });
    });
    
    // Add project activities
    AppState.projects.slice(0, 3).forEach(project => {
        activities.push({
            type: 'project',
            message: `Project "${project.name}" created`,
            time: 'Recently',
            icon: 'fa-project-diagram'
        });
    });
    
    if (activities.length === 0) {
        DOM.recentActivity.innerHTML = '<p class="text-muted">No recent activity</p>';
        return;
    }
    
    DOM.recentActivity.innerHTML = activities.map(activity => `
        <div class="activity-item">
            <div class="activity-icon">
                <i class="fas ${activity.icon}"></i>
            </div>
            <div class="activity-content">
                <p class="activity-message">${activity.message}</p>
                <small class="activity-time">${activity.time}</small>
            </div>
        </div>
    `).join('');
}

// Utility Functions
function getBotIcon(botType) {
    const iconMap = {
        'chat': 'fa-comments',
        'assistant': 'fa-headset',
        'automation': 'fa-cogs',
        'analytics': 'fa-chart-line',
        'custom': 'fa-code'
    };
    return iconMap[botType] || 'fa-robot';
}

function showLoading(show) {
    AppState.isLoading = show;
    
    if (show) {
        document.body.classList.add('loading');
    } else {
        document.body.classList.remove('loading');
    }
}

function showNotification(message, type = 'info') {
    const id = Date.now().toString();
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.dataset.id = id;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="removeNotification('${id}')">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    DOM.notificationContainer.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        removeNotification(id);
    }, 5000);
    
    AppState.notifications.push({ id, element: notification });
}

function removeNotification(id) {
    const notification = document.querySelector(`.notification[data-id="${id}"]`);
    if (notification) {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }
    
    AppState.notifications = AppState.notifications.filter(n => n.id !== id);
}

function getNotificationIcon(type) {
    const iconMap = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'warning': 'fa-exclamation-triangle',
        'info': 'fa-info-circle'
    };
    return iconMap[type] || 'fa-info-circle';
}

// Real-time updates setup
function setupRealTimeUpdates() {
    // Poll for updates every 30 seconds
    setInterval(async () => {
        try {
            const response = await fetch('/api/updates');
            if (response.ok) {
                const updates = await response.json();
                if (updates.botsUpdated || updates.projectsUpdated) {
                    loadInitialData();
                }
            }
        } catch (error) {
            console.error('Error checking for updates:', error);
        }
    }, 30000);
}

// Make functions available globally for inline event handlers
window.openCreateBotModal = openCreateBotModal;
window.toggleBotStatus = toggleBotStatus;
window.deleteBot = deleteBot;
window.downloadProject = downloadProject;
window.saveProjectTemplate = saveProjectTemplate;
window.removeNotification = removeNotification;