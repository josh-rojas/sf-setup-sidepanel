'use strict';

/**
 * Configuration object for Salesforce domains and their setup-related properties.
 * @const {Object}
 */
const SALESFORCE_DOMAINS = {
    '.salesforce.com': true,
    '.force.com': true,
    '.lightning.force.com': true,
    '.visualforce.com': true
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
 * Constants for setup URL patterns
 * @const {Array}
 */
const SETUP_PATTERNS = [
    '/lightning/setup/',
    '/setup/',
    '/_ui/common/setup/'
];

/**
 * Validates if a given URL belongs to a Salesforce domain
 * @param {string} url - The URL to validate
 * @returns {boolean} True if the URL belongs to a Salesforce domain
 */
function isSalesforceDomain(url) {
    try {
        const hostname = new URL(url).hostname;
        return Object.keys(SALESFORCE_DOMAINS).some(domain => hostname.endsWith(domain));
    } catch (e) {
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
        return document.querySelector(SETUP_SELECTORS.classic) || 
               document.querySelector(SETUP_SELECTORS.lightning);
    } catch (error) {
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
        const isSetupPageNow = isSalesforceDomain(currentUrl) && 
                             (isSetupPage(currentUrl) || checkForSetupMenu());
        
        if (isSetupPageNow) {
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
        } else {
            // If not on a setup page, ensure link interception is enabled
            setupLinkInterception();
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
    if (message.type === 'CHECK_FOR_SETUP') {
        sendResponse({ checked: true });
        return true;
    }
    
    sendResponse({ error: 'Unknown message type' });
    return true;
});

// Check if the URL is a setup URL pattern
function isSetupUrl(url) {
    return SETUP_PATTERNS.some(pattern => url.includes(pattern));
}

// Set up link interception for setup navigation
function setupLinkInterception() {
    document.addEventListener('click', function(event) {
        try {
            // Find if the click was on a link or a child of a link
            let target = event.target;
            let href = null;
            
            // Find the closest anchor element or setup-specific element
            while (target && target !== document) {
                // Check for anchor tags
                if (target.tagName === 'A') {
                    href = target.href;
                    break;
                }
                
                // Check for setup-specific elements
                if (target.matches) {
                    if (target.matches(SETUP_SELECTORS.lightning) || 
                        target.matches(SETUP_SELECTORS.classic) ||
                        (target.getAttribute && target.getAttribute('data-id') === 'Setup')) {
                        
                        const setupObserver = new MutationObserver(() => {
                            if (isSetupUrl(window.location.href)) {
                                setupObserver.disconnect();
                                
                                chrome.runtime.sendMessage({
                                    type: 'SETUP_LINK_CLICKED',
                                    url: window.location.href
                                }).then(() => {
                                    history.back();
                                }).catch(() => {});
                            }
                        });
                        
                        setupObserver.observe(document, { subtree: true, childList: true });
                        setTimeout(() => setupObserver.disconnect(), 3000);
                        break;
                    }
                }
                
                target = target.parentElement;
            }
            
            // If we found a setup link, intercept it
            if (href && isSetupUrl(href)) {
                event.preventDefault();
                event.stopPropagation();
                
                chrome.runtime.sendMessage({
                    type: 'SETUP_LINK_CLICKED',
                    url: href
                }).catch(() => {
                    // Fall back to default navigation if messaging fails
                    window.location.href = href;
                });
                
                return false;
            }
        } catch (error) {
            // In case of error, let the default behavior happen
        }
    }, true);
}

// Start the initialization
try {
    initialize();
} catch (error) {
    console.error('Error initializing content script:', error);
}
