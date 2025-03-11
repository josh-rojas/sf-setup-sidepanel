// Domain patterns for Salesforce
const SALESFORCE_PATTERNS = [
    "*://*.salesforce.com/*",
    "*://*.force.com/*",
    "*://*.salesforce-setup.com/*"
];

// Global state
const state = {
    tabState: new Map()
};

// Global error handler for uncaught errors
self.addEventListener('error', (event) => {
    console.error('Global error:', event.error);
});

// Unhandled promise rejection handler
self.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);
});

// Service worker activation
self.addEventListener('activate', (event) => {
    console.log('Service worker activated');
});

// Initialize the extension when installed
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Extension installed or updated:', details.reason);
    
    try {
        // Set default side panel behavior
        await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
        console.log('Side panel behavior set successfully');
    } catch (error) {
        console.error('Failed to set panel behavior:', error);
    }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!tab.url) return;
    
    // Check if this is a Salesforce domain
    let isSalesforceUrl = false;
    try {
        isSalesforceUrl = SALESFORCE_PATTERNS.some(pattern => {
            // Convert wildcard pattern to RegExp
            const regexPattern = pattern.replace(/\*/g, '.*').replace(/\//g, '\\/');
            const regex = new RegExp(regexPattern);
            return regex.test(tab.url);
        });
    } catch (e) {
        console.error('Error in pattern matching:', e);
    }
    
    // Update tab state
    state.tabState.set(tabId, {
        isSalesforceTab: isSalesforceUrl,
        setupActive: false,
        url: tab.url
    });
    
    try {
        // Enable/disable side panel based on URL
        await chrome.sidePanel.setOptions({
            tabId: tabId,
            path: 'sidepanel.html',
            enabled: isSalesforceUrl
        });
    } catch (error) {
        console.error('Failed to update side panel for tab:', error);
    }
});

// Clean up tab state
chrome.tabs.onRemoved.addListener((tabId) => {
    state.tabState.delete(tabId);
});

// Handle messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Received message:', message.type);
    
    const handleSetupDetected = async (message, sender, sendResponse) => {
        const tabId = sender.tab?.id;
        if (!tabId) {
            sendResponse({ error: 'No tab ID provided' });
            return;
        }

        // Update tab state
        const currentState = state.tabState.get(tabId) || {};
        state.tabState.set(tabId, {
            ...currentState,
            setupActive: true,
            setupUrl: message.url
        });
        
        try {
            // Open the side panel for this specific tab
            await chrome.sidePanel.open({ tabId: tabId });
            
            // Send setup URL to side panel
            await chrome.runtime.sendMessage({
                type: 'LOAD_SETUP',
                url: message.url
            });
            
            sendResponse({ success: true });
        } catch (error) {
            console.error('Error opening side panel:', error);
            sendResponse({ error: error.message });
        }
    };
    
    try {
        if (message.type === 'SETUP_DETECTED') {
            handleSetupDetected(message, sender, sendResponse);
            return true; // Keep the message channel open for async response
        }
        
        if (message.type === 'GET_TAB_STATE') {
            const tabId = sender.tab?.id;
            if (!tabId) {
                sendResponse({ error: 'No tab ID provided' });
                return true;
            }
            
            sendResponse({ state: state.tabState.get(tabId) });
            return true;
        }
        
        if (message.type === 'SETUP_ERROR') {
            console.error('Setup error:', message.error);
            sendResponse({ received: true });
            return true;
        }
        
        // Unknown message type
        console.warn('Unknown message type:', message.type);
        sendResponse({ error: 'Unknown message type' });
    } catch (e) {
        console.error('Error handling message:', e);
        sendResponse({ error: e.message });
    }
    
    return true;
});

