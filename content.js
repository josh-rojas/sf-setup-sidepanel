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

// Listen for URL changes to detect navigation to setup pages
let currentUrl = window.location.href;
const observer = new MutationObserver(() => {
    if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        if (isSalesforceDomain(currentUrl) && isSetupPage(currentUrl)) {
            chrome.runtime.sendMessage({
                type: 'SETUP_PAGE_DETECTED',
                url: currentUrl
            });
        }
    }
});

// Start observing URL changes when in a Salesforce domain
if (isSalesforceDomain(window.location.href)) {
    observer.observe(document, { subtree: true, childList: true });
    
    // Initial check for setup page
    if (isSetupPage(window.location.href)) {
        chrome.runtime.sendMessage({
            type: 'SETUP_PAGE_DETECTED',
            url: window.location.href
        });
    }
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GET_SETUP_STATUS') {
        sendResponse({
            isSalesforceDomain: isSalesforceDomain(window.location.href),
            isSetupPage: isSetupPage(window.location.href)
        });
    }
});

// State tracking for setup detection
let isInSetup = false;

// Store original History API methods
const originalPushState = history.pushState;
const originalReplaceState = history.replaceState;
/**
 * Handles setup detection state changes and sends appropriate messages
 * @param {boolean} detected - Whether setup is currently detected
 * @returns {Promise<void>}
 */
async function handleSetupDetection(detected) {
    if (detected === isInSetup) {
        return; // No state change
    }

    isInSetup = detected;
    const message = {
        type: detected ? 'SETUP_DETECTED' : 'SETUP_CLOSED',
        timestamp: Date.now()
    };

    if (detected) {
        message.url = window.location.href;
    }

    try {
        await chrome.runtime.sendMessage(message);
        console.log(detected ? 'Salesforce Setup detected' : 'Left Salesforce Setup');
    } catch (error) {
        console.error(`Error sending ${message.type} message:`, error);
        // Re-throw specific errors that need special handling
        if (error.message.includes('Extension context invalidated')) {
            throw error;
        }
    }
}
/**
 * Handles URL changes and triggers setup detection
 */
function handleUrlChange() {
    const setupDetected = isSetupPage(window.location.href) || checkForSetupMenu();
    handleSetupDetection(setupDetected).catch(handleExtensionError);
}

// Override History API methods to detect URL changes
history.pushState = function(...args) {
    originalPushState.apply(this, args);
    handleUrlChange();
};

history.replaceState = function(...args) {
    originalReplaceState.apply(this, args);
    handleUrlChange();
};

// Listen for popstate events
window.addEventListener('popstate', handleUrlChange);
/**
 * Observes DOM changes to detect Setup UI elements
 * @type {MutationObserver}
 */
const observer = new MutationObserver(() => {
    const setupDetected = checkForSet
