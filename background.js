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
    console.log('SF Setup Panel: Extension installed/updated');
    // Set side panel configuration
    try {
        await chrome.sidePanel.setOptions({
            enabled: true,
            path: 'sidepanel.html'
        });
        console.log('SF Setup Panel: Side panel options set successfully');
    } catch (error) {
        console.error('SF Setup Panel: Error setting side panel options:', error);
        // Handle error silently - will auto-retry on next startup
    }
});

// Clean up when tabs are removed
chrome.tabs.onRemoved.addListener((tabId) => {
    console.log('SF Setup Panel: Tab removed, cleaning up state for tab', tabId);
    state.tabState.delete(tabId);
});

// Handle messages from content scripts and the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        console.log('SF Setup Panel: Background received message:', message.type);
        
        // Handle direct setup link clicks from content script
        if (message.type === 'SETUP_LINK_CLICKED' && message.url) {
            const tabId = sender.tab?.id;
            if (!tabId) {
                console.error('SF Setup Panel: No tab ID provided with SETUP_LINK_CLICKED');
                sendResponse({ error: 'No tab ID provided' });
                return true;
            }
            
            console.log('SF Setup Panel: Setup link clicked in tab', tabId, 'with URL', message.url);
            
            // Validate URL
            if (!isSalesforceDomain(message.url)) {
                console.error('SF Setup Panel: Invalid domain for URL', message.url);
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
            console.log('SF Setup Panel: Tab state updated for tab', tabId);
            
            // Improved error handling with retry logic
            const openSidePanel = async () => {
                try {
                    console.log('SF Setup Panel: Opening side panel for tab', tabId);
                    
                    // Wait for the side panel to open
                    await chrome.sidePanel.open({ tabId });
                    console.log('SF Setup Panel: Side panel opened successfully');
                    
                    // Add a longer delay to ensure the side panel is fully loaded
                    await new Promise(resolve => setTimeout(resolve, 500));
                    
                    // Then try to send the message
                    console.log('SF Setup Panel: Sending LOAD_SETUP message to side panel');
                    await chrome.runtime.sendMessage({
                        type: 'LOAD_SETUP',
                        url: message.url
                    });
                    
                    console.log('SF Setup Panel: Message sent successfully');
                    sendResponse({ success: true });
                } catch (error) {
                    console.error('SF Setup Panel: Error opening side panel or sending message:', error);
                    
                    // If it's a connection error, we might want to retry once
                    if (error.message && error.message.includes('Could not establish connection')) {
                        console.log('SF Setup Panel: Connection error detected, retrying after delay');
                        // Wait a bit longer and try one more time
                        setTimeout(async () => {
                            try {
                                await chrome.runtime.sendMessage({
                                    type: 'LOAD_SETUP',
                                    url: message.url
                                });
                                console.log('SF Setup Panel: Retry successful');
                                sendResponse({ success: true, retried: true });
                            } catch (retryError) {
                                console.error('SF Setup Panel: Retry failed:', retryError);
                                sendResponse({ error: retryError.message });
                            }
                        }, 800);
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
                console.error('SF Setup Panel: No tab ID provided with SETUP_DETECTED');
                sendResponse({ error: 'No tab ID provided' });
                return true;
            }
            
            console.log('SF Setup Panel: Setup page detected in tab', tabId, 'with URL', message.url);
            
            // Validate URL
            if (!isSalesforceDomain(message.url)) {
                console.error('SF Setup Panel: Invalid domain for URL', message.url);
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
            console.log('SF Setup Panel: Tab state updated for tab', tabId);
            
            // Simply acknowledge the setup detection
            sendResponse({ success: true });
            return true;
        }
        
        if (message.type === 'GET_TAB_STATE') {
            const tabId = sender.tab?.id;
            if (!tabId) {
                console.error('SF Setup Panel: No tab ID provided with GET_TAB_STATE');
                sendResponse({ error: 'No tab ID provided' });
                return true;
            }
            
            const tabState = state.tabState.get(tabId);
            console.log('SF Setup Panel: Returning tab state for tab', tabId, 'state:', tabState);
            sendResponse({ state: tabState });
            return true;
        }
        
        console.warn('SF Setup Panel: Unknown message type:', message.type);
        sendResponse({ error: 'Unknown message type' });
    } catch (e) {
        console.error('SF Setup Panel: Error handling message:', e);
        // Log error but don't expose to console
        sendResponse({ error: e.message });
    }
    
    return true;
});