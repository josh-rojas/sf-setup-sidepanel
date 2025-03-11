// Global state for tabs
const state = {
    tabState: new Map()
};

// Salesforce domain patterns
const SALESFORCE_DOMAIN_PATTERNS = [
    '.salesforce.com',
    '.force.com',
    '.lightning.force.com',
    '.visualforce.com'
];

// Check if URL matches Salesforce domains
function isSalesforceDomain(url) {
    try {
        const hostname = new URL(url).hostname;
        return SALESFORCE_DOMAIN_PATTERNS.some(pattern => hostname.endsWith(pattern));
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
        console.error('Error setting side panel options:', error);
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
            
            // Update tab state
            const currentState = state.tabState.get(tabId) || {};
            state.tabState.set(tabId, {
                ...currentState,
                setupActive: true,
                setupUrl: message.url
            });
            
            // Since this is in response to a user clicking a link (user gesture),
            // we can open the side panel immediately
            chrome.sidePanel.open({ tabId: tabId })
                .then(() => {
                    return chrome.runtime.sendMessage({
                        type: 'LOAD_SETUP',
                        url: message.url
                    });
                })
                .then(() => {
                    sendResponse({ success: true });
                })
                .catch((error) => {
                    console.error('Error opening side panel:', error);
                    sendResponse({ error: error.message });
                });
            
            // Return true to indicate we'll send a response asynchronously
            return true;
        }
        
        if (message.type === 'SETUP_DETECTED' && message.url) {
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
        console.error('Error handling message:', e);
        sendResponse({ error: e.message });
    }
    
    return true;
});

