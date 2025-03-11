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

// Initialize the extension when installed
chrome.runtime.onInstalled.addListener(function(details) {
    console.log('Extension installed or updated:', details.reason);
    
    // Set default side panel behavior
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
    .catch(function(error) {
        console.error('Failed to set panel behavior:', error);
    });
});

// Handle tab updates
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
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
    
    // Enable/disable side panel based on URL
    chrome.sidePanel.setOptions({
        tabId: tabId,
        path: 'sidepanel.html',
        enabled: isSalesforceUrl
    }).catch(function(error) {
        console.error('Failed to update side panel for tab:', error);
    });
});

// Clean up tab state
chrome.tabs.onRemoved.addListener(function(tabId) {
    state.tabState.delete(tabId);
});

// Handle messages
chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) {
    console.log('Received message:', message.type);
    
    try {
        if (message.type === 'SETUP_DETECTED') {
            const tabId = sender.tab?.id;
            if (!tabId) {
                sendResponse({ error: 'No tab ID provided' });
                return true;
            }
    
            // Update tab state
            const currentState = state.tabState.get(tabId) || {};
            state.tabState.set(tabId, {
                ...currentState,
                setupActive: true,
                setupUrl: message.url
            });
            
            // Open the side panel for this specific tab
            chrome.sidePanel.open({ tabId: tabId })
                .then(function() {
                    // Send setup URL to side panel
                    return chrome.runtime.sendMessage({
                        type: 'LOAD_SETUP',
                        url: message.url
                    });
                })
                .then(function() {
                    sendResponse({ success: true });
                })
                .catch(function(error) {
                    console.error('Error opening side panel:', error);
                    sendResponse({ error: error.message });
                });
            
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

// Error handling
chrome.runtime.onError.addListener((error) => {
    console.error('Runtime error:', error);
});

