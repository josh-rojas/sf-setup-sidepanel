// Global state management
const state = {
    tabState: new Map(),
    initialized: false
};

// Initialize extension
async function initializeExtension() {
    if (state.initialized) return;
    
    try {
        // Register the side panel
        await chrome.sidePanel.setOptions({
            enabled: true,
            path: 'sidepanel.html'
        });
        
        state.initialized = true;
        console.log('Extension initialized successfully');
    } catch (error) {
        console.error('Failed to initialize extension:', error);
    }
}

// Event Listeners
self.addEventListener('activate', (event) => {
    event.waitUntil(initializeExtension());
});

// Handle installation and updates
chrome.runtime.onInstalled.addListener(async (details) => {
    await initializeExtension();
    
    if (details.reason === 'install') {
        console.log('Extension installed');
    } else if (details.reason === 'update') {
        console.log('Extension updated');
    }
});

// Handle tab updates
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (!state.initialized) await initializeExtension();
    
    try {
        if (changeInfo.url) {
            const isSalesforceUrl = tab.url.match(/\.(salesforce\.com|force\.com|salesforce-setup\.com)/);
            
            // Update tab state
            state.tabState.set(tabId, {
                isSalesforceTab: Boolean(isSalesforceUrl),
                setupActive: false,
                url: tab.url
            });

            // Enable/disable side panel based on URL
            await chrome.sidePanel.setOptions({
                enabled: Boolean(isSalesforceUrl),
                tabId
            });
        }
    } catch (error) {
        console.error(`Error handling tab update for tab ${tabId}:`, error);
    }
});

// Clean up tab state
chrome.tabs.onRemoved.addListener((tabId) => {
    state.tabState.delete(tabId);
});

// Handle messages from content scripts and side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!state.initialized) {
        initializeExtension().then(() => handleMessage(message, sender, sendResponse));
        return true;
    }
    
    handleMessage(message, sender, sendResponse);
    return true;
});

// Message handler
async function handleMessage(message, sender, sendResponse) {
    try {
        const tabId = sender.tab?.id;
        
        switch (message.type) {
            case 'SETUP_DETECTED': {
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
                
                // Show side panel
                await chrome.sidePanel.open({ tabId });
                
                // Send setup URL to side panel
                chrome.runtime.sendMessage({
                    type: 'LOAD_SETUP',
                    url: message.url
                }).catch(console.error);
                
                sendResponse({ success: true });
                break;
            }

            case 'GET_TAB_STATE': {
                if (!tabId) {
                    sendResponse({ error: 'No tab ID provided' });
                    return;
                }
                sendResponse({ state: state.tabState.get(tabId) });
                break;
            }

            case 'SETUP_ERROR': {
                console.error('Setup error:', message.error);
                sendResponse({ received: true });
                break;
            }

            default: {
                console.warn('Unknown message type:', message.type);
                sendResponse({ error: 'Unknown message type' });
            }
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
    }
}

// Error handling
chrome.runtime.onError.addListener((error) => {
    console.error('Runtime error:', error);
});

