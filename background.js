// Global state for tabs
const state = {
    tabState: new Map()
};

// Salesforce domain patterns
const SALESFORCE_DOMAINS = {
    '.salesforce.com': true,
    '.force.com': true,
    '.lightning.force.com': true,
    '.visualforce.com': true,
    '.salesforce-setup.com': true
};

// Setup URL patterns
const SETUP_PATTERNS = [
    '/lightning/setup/',
    '/setup/',
    '/_ui/common/setup/'
];

// Check if URL matches Salesforce domains
function isSalesforceDomain(url) {
    try {
        const hostname = new URL(url).hostname;
        return Object.keys(SALESFORCE_DOMAINS).some(domain => hostname.endsWith(domain));
    } catch (e) {
        return false;
    }
}

// Check if URL matches setup patterns
function isSetupUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        return SETUP_PATTERNS.some(pattern => pathname.includes(pattern));
    } catch (e) {
        return false;
    }
}

// Set up event listeners
chrome.runtime.onInstalled.addListener(async () => {
    // Set side panel configuration
    try {
        await chrome.sidePanel.setOptions({
            enabled: true,
            path: 'sidepanel.html'
        });
    } catch (error) {
        // Handle error silently - will auto-retry on next startup
    }
});

// Clean up when tabs are removed
chrome.tabs.onRemoved.addListener((tabId) => {
    state.tabState.delete(tabId);
});

// Handle messages from content scripts and the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        // Handle direct setup link clicks from content script
        if (message.type === 'SETUP_LINK_CLICKED' && message.url) {
            const tabId = sender.tab?.id;
            if (!tabId) {
                sendResponse({ error: 'No tab ID provided' });
                return true;
            }
            
            // Validate URL
            if (!isSalesforceDomain(message.url)) {
                sendResponse({ error: 'Invalid Salesforce domain' });
                return true;
            }
            
            // Update tab state
            const currentState = state.tabState.get(tabId) || {};
            state.tabState.set(tabId, {
                ...currentState,
                setupActive: true,
                setupUrl: message.url
            });
            
            // Improved error handling with retry logic
            const openSidePanel = async () => {
                try {
                    // Wait for the side panel to open
                    await chrome.sidePanel.open({ tabId: tabId });
                    
                    // Add a small delay to ensure the side panel is fully loaded
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    // Then try to send the message
                    await chrome.runtime.sendMessage({
                        type: 'LOAD_SETUP',
                        url: message.url
                    });
                    
                    sendResponse({ success: true });
                } catch (error) {
                    // If it's a connection error, we might want to retry once
                    if (error.message && error.message.includes('Could not establish connection')) {
                        // Wait a bit longer and try one more time
                        setTimeout(async () => {
                            try {
                                await chrome.runtime.sendMessage({
                                    type: 'LOAD_SETUP',
                                    url: message.url
                                });
                                sendResponse({ success: true, retried: true });
                            } catch (retryError) {
                                sendResponse({ error: retryError.message });
                            }
                        }, 300);
                    } else {
                        sendResponse({ error: error.message });
                    }
                }
            };
            
            // Execute the async function
            openSidePanel();
            
            // Return true to indicate we'll send a response asynchronously
            return true;
        }
        
        if (message.type === 'SETUP_DETECTED' && message.url) {
            const tabId = sender.tab?.id;
            if (!tabId) {
                sendResponse({ error: 'No tab ID provided' });
                return true;
            }
            
            // Validate URL
            if (!isSalesforceDomain(message.url)) {
                sendResponse({ error: 'Invalid Salesforce domain' });
                return true;
            }
            
            // Update tab state
            const currentState = state.tabState.get(tabId) || {};
            state.tabState.set(tabId, {
                ...currentState,
                setupActive: true,
                setupUrl: message.url
            });
            
            // Simply acknowledge the setup detection
            sendResponse({ success: true });
            return true;
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
        
        sendResponse({ error: 'Unknown message type' });
    } catch (e) {
        // Log error but don't expose to console
        sendResponse({ error: e.message });
    }
    
    return true;
});