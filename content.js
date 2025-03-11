'use strict';

/**
 * Configuration object for Salesforce domains and their setup-related properties.
 * @const {Object}
 */
const SALESFORCE_DOMAINS = {
    // Core domains
    'salesforce.com': {
        purpose: 'Main Salesforce domain for login, authentication, and content sites',
        setupPatterns: ['/lightning/setup', '/_ui/common/setup/Setup']
    },
    'force.com': {
        purpose: 'Visualforce pages, Lightning pages, and content storage',
        setupPatterns: ['/setup']
    },
    'salesforce-setup.com': {
        purpose: 'Dedicated domain for Setup pages in Salesforce',
        setupPatterns: ['*'] // All paths on this domain are setup-related
    },
    // Legacy domains (pre-Winter '24, orgs without enhanced domains)
    'visualforce.com': {
        purpose: 'Legacy domain for Visualforce pages',
        setupPatterns: ['/apex/setup']
    },
    'lightning.com': {
        purpose: 'Legacy domain for Lightning container components',
        setupPatterns: ['/setup']
    },
    'sfdcstatic.com': {
        purpose: 'Static resource content delivery',
        setupPatterns: [] // No direct setup URLs
    }
};
/**
 * Constants for DOM selectors used to detect Setup UI elements
 * @const {Object}
 */
const SETUP_SELECTORS = {
    classic: '#setupLink',
    lightning: '[data-id="Setup"]'
};

/**
 * Validates if a given URL belongs to a Salesforce domain
 * @param {string} url - The URL to validate
 * @returns {boolean} True if the URL belongs to a Salesforce domain
 */
function isSalesforceDomain(url) {
    try {
        const hostname = new URL(url).hostname;
        return Object.keys(SALESFORCE_DOMAINS).some(domain => 
            hostname.endsWith('.' + domain) || hostname === domain
        );
    } catch (error) {
        console.error('Error parsing URL:', error);
        return false;
    }
}

/**
 * Checks if the given URL is a Salesforce Setup page
 * @param {string} url - The URL to check
 * @returns {boolean} True if the URL is a Setup page
 */
function isSetupPage(url) {
    try {
        const urlObj = new URL(url);
        const hostname = urlObj.hostname;
        const pathname = urlObj.pathname;

        // Special case for salesforce-setup.com domain
        if (hostname.endsWith('salesforce-setup.com')) {
            return true;
        }

        // Check against domain-specific setup patterns
        for (const [domain, config] of Object.entries(SALESFORCE_DOMAINS)) {
            if (hostname.endsWith('.' + domain) || hostname === domain) {
                return config.setupPatterns.some(pattern => {
                    if (pattern === '*') return true;
                    return pathname.toLowerCase().includes(pattern.toLowerCase());
                });
            }
        }

        return false;
    } catch (error) {
        console.error('Error checking setup page:', error);
        return false;
    }
}

/**
 * Checks for the presence of Setup menu elements in the DOM
 * @returns {boolean} True if Setup menu elements are found
 */
function checkForSetupMenu() {
    try {
        const isClassicSetup = !!document.querySelector(SETUP_SELECTORS.classic);
        const isLightningSetup = !!document.querySelector(SETUP_SELECTORS.lightning);
        return isClassicSetup || isLightningSetup;
    } catch (error) {
        console.error('Error checking for setup menu:', error);
        return false;
    }
}

/**
 * Checks if the current page is a Salesforce setup page and reports to background script
 * @returns {Promise<void>}
 */
async function checkAndReportSetupPage() {
    try {
        const currentUrl = window.location.href;
        if (isSalesforceDomain(currentUrl) && 
           (isSetupPage(currentUrl) || checkForSetupMenu())) {
            try {
                // Use the chrome.runtime.sendMessage API instead of direct function calls
                await chrome.runtime.sendMessage({
                    type: 'SETUP_DETECTED',
                    url: currentUrl
                });
                console.log('Salesforce Setup detected at:', currentUrl);
            } catch (error) {
                // Handle specific errors
                if (error.message.includes('Extension context invalidated')) {
                    cleanupExtension();
                } else if (error.message.includes('Could not establish connection')) {
                    console.warn('Connection to extension failed, will retry later');
                    // Schedule a retry after a delay
                    setTimeout(checkAndReportSetupPage, 2000);
                } else {
                    console.error('Error sending setup detection message:', error);
                }
            }
        }
    } catch (error) {
        console.error('Error checking setup page:', error);
    }
}

// Track extension status
let extensionActive = true;

/**
 * Cleans up extension resources when the extension is reloaded or disabled
 */
function cleanupExtension() {
    if (!extensionActive) return; // Avoid redundant cleanup
    
    console.log('Cleaning up extension resources');
    extensionActive = false;
    
    // Disconnect observers
    if (observer) {
        observer.disconnect();
    }
    
    // Remove event listeners
    window.removeEventListener('load', checkAndReportSetupPage);
    window.removeEventListener('unload', handleUnload);
}

/**
 * Handles page unload events
 */
function handleUnload() {
    cleanupExtension();
}

// Unified observer for both URL changes and DOM changes
let currentUrl = window.location.href;
let observer = null;

// Initialize the observer if we're in a Salesforce domain
if (isSalesforceDomain(window.location.href)) {
    // Create the observer
    observer = new MutationObserver(() => {
        try {
            // Check for URL changes
            if (window.location.href !== currentUrl) {
                currentUrl = window.location.href;
                checkAndReportSetupPage();
            }
            
            // Check for DOM changes that might indicate setup elements
            if (checkForSetupMenu()) {
                checkAndReportSetupPage();
            }
        } catch (error) {
            console.error('Error in observer callback:', error);
        }
    });
    
    // Start observing DOM for changes with error handling
    try {
        observer.observe(document, { subtree: true, childList: true });
        
        // Initial check
        checkAndReportSetupPage();
        
        // Also check when the page is fully loaded
        window.addEventListener('load', checkAndReportSetupPage);
        
        // Clean up on page unload
        window.addEventListener('unload', handleUnload);
    } catch (error) {
        console.error('Error starting observer:', error);
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (message.type === 'GET_SETUP_STATUS') {
            sendResponse({
                isSalesforceDomain: isSalesforceDomain(window.location.href),
                isSetupPage: isSetupPage(window.location.href) || checkForSetupMenu()
            });
            return true;
        }
        
        // Handle other message types here
        
        return false;
    } catch (error) {
        console.error('Error handling message:', error);
        sendResponse({ error: error.message });
        return true;
    }
});
