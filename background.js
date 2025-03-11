// Tab state management
const tabState = new Map();

// Initialize extension and set up side panel
chrome.runtime.onInstalled.addListener(async () => {
    try {
        // Register the side panel
        await chrome.sidePanel.setOptions({
            enabled: true,
            path: 'sidepanel.html'
        });
        console.log('Side panel configuration completed');
    } catch (error) {
        console.error('Failed to initialize side panel:', error);
    }
});

// Handle tab updates to manage side panel visibility
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    try {
        if (changeInfo.url) {
            const isSalesforceUrl = tab.url.match(/\.(salesforce\.com|force\.com)/);
            
            // Update tab state
            tabState.set(tabId, {
                isSalesforceTab: isSalesforceUrl,
                setupActive: false
            });

            // Enable/disable side panel based on URL
            await chrome.sidePanel.setOptions({
                enabled: isSalesforceUrl,
                tabId
            });
        }
    } catch (error) {
        console.error(`Error handling tab update for tab ${tabId}:`, error);
    }
});

// Clean up tab state when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
    tabState.delete(tabId);
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
    try {
        const tabId = sender.tab.id;
        
        switch (message.type) {
            case 'SETUP_DETECTED':
                // Update tab state
                tabState.set(tabId, {
                    ...tabState.get(tabId),
                    setupActive: true
                });
                
                // Show side panel
                await chrome.sidePanel.open({ tabId });
                
                // Send setup URL to side panel
                await chrome.runtime.sendMessage({
                    type: 'LOAD_SETUP',
                    url: message.setupUrl
                });
                
                sendResponse({ success: true });
                break;

            case 'GET_TAB_STATE':
                sendResponse({ state: tabState.get(tabId) });
                break;

            case 'SETUP_ERROR':
                console.error('Setup error:', message.error);
                // Notify user of error if needed
                sendResponse({ received: true });
                break;

            default:
                console.warn('Unknown message type:', message.type);
                sendResponse({ error: 'Unknown message type' });
        }
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
    }
    
    // Return true to indicate we'll send a response asynchronously
    return true;
});

// Error handling for runtime errors
chrome.runtime.onError.addListener((error) => {
    console.error('Runtime error:', error);
});

