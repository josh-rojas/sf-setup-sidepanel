'use strict';

// Track extension status and observers
let extensionActive = true;
let currentUrl = window.location.href;
let observer = null;

/**
 * Salesforce domain configurations
 * @const {Object}
 */
const SALESFORCE_DOMAINS = {
    '.salesforce.com': true,
    '.force.com': true,
    '.lightning.force.com': true,
    '.visualforce.com': true,
    '.salesforce-setup.com': true
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

        // Check if domain is valid Salesforce domain
        if (!isSalesforceDomain(url)) {
            return false;
        }

        // Check if URL matches any setup patterns
        return SETUP_PATTERNS.some(pattern => pathname.includes(pattern));
    } catch (error) {
        return false;
    }
}

/**
 * Checks if a URL matches setup URL patterns
 * @param {string} url - The URL to check
 * @returns {boolean} True if the URL matches setup patterns
 */
function isSetupUrl(url) {
    try {
        const pathname = new URL(url).pathname;
        return SETUP_PATTERNS.some(pattern => pathname.includes(pattern));
    } catch (e) {
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
 * Set up link interception for setup navigation
 */
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
                    console.log('SF Setup Panel: Link clicked with href:', href);
                    break;
                }
                
                // Check for setup-specific elements
                if (target.matches) {
                    if (target.matches(SETUP_SELECTORS.lightning) || 
                        target.matches(SETUP_SELECTORS.classic) ||
                        (target.getAttribute && target.getAttribute('data-id') === 'Setup')) {
                        
                        console.log('SF Setup Panel: Setup menu element clicked');
                        
                        // Set up an observer to detect navigation to setup page
                        const setupObserver = new MutationObserver(() => {
                            const currentLocation = window.location.href;
                            console.log('SF Setup Panel: Checking if setup URL:', currentLocation);
                            
                            if (isSetupUrl(currentLocation)) {
                                console.log('SF Setup Panel: Setup URL detected, opening side panel');
                                setupObserver.disconnect();
                                
                                chrome.runtime.sendMessage({
                                    type: 'SETUP_LINK_CLICKED',
                                    url: currentLocation
                                }).then((response) => {
                                    console.log('SF Setup Panel: Message sent, response:', response);
                                    // Going back is optional - commented out so the setup page itself can be used
                                    // history.back();
                                }).catch((error) => {
                                    console.error('SF Setup Panel: Error sending message:', error);
                                });
                            }
                        });
                        
                        setupObserver.observe(document, { subtree: true, childList: true });
                        
                        // Create a timeout to clean up observer if navigation doesn't occur
                        const timeoutId = setTimeout(() => {
                            try {
                                console.log('SF Setup Panel: Cleaning up observer after timeout');
                                setupObserver.disconnect();
                            } catch (error) {
                                // Error handled silently
                            }
                        }, 3000);
                        return; // Let the click proceed to trigger navigation
                    }
                }
                
                target = target.parentElement;
            }
            
            // If we found a setup link, intercept it
            if (href && isSetupUrl(href)) {
                console.log('SF Setup Panel: Setup link clicked, intercepting:', href);
                event.preventDefault();
                event.stopPropagation();
                
                chrome.runtime.sendMessage({
                    type: 'SETUP_LINK_CLICKED',
                    url: href
                }).then((response) => {
                    console.log('SF Setup Panel: Message sent, response:', response);
                }).catch((error) => {
                    console.error('SF Setup Panel: Error sending message:', error);
                    // Fall back to default navigation if messaging fails
                    window.location.href = href;
                });
                
                return false;
            } else if (href) {
                console.log('SF Setup Panel: Non-setup link clicked:', href);
            }
        } catch (error) {
            console.error('SF Setup Panel: Error in click handler:', error);
            // In case of error, let the default behavior happen
        }
    }, true);
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
                console.log('SF Setup Panel: Setup page detected:', currentUrl);
                // Use the chrome.runtime.sendMessage API instead of direct function calls
                await chrome.runtime.sendMessage({
                    type: 'SETUP_DETECTED',
                    url: currentUrl
                });
            } catch (error) {
                console.error('SF Setup Panel: Error reporting setup page:', error);
                // Handle specific errors
                if (error.message.includes('Extension context invalidated')) {
                    cleanupExtension();
                } else if (error.message.includes('Could not establish connection')) {
                    // Schedule a retry after a delay
                    setTimeout(checkAndReportSetupPage, 2000);
                }
            }
        } else {
            console.log('SF Setup Panel: Not a setup page, enabling link interception');
            // If not on a setup page, ensure link interception is enabled
            setupLinkInterception();
        }
    } catch (error) {
        console.error('SF Setup Panel: Error checking setup page:', error);
        // Error handled silently
    }
}

/**
 * Cleans up extension resources when the extension is reloaded or disabled
 */
function cleanupExtension() {
    if (!extensionActive) return; // Avoid redundant cleanup
    
    extensionActive = false;
    
    // Disconnect observers
    if (observer) {
        observer.disconnect();
    }
    
    // Remove event listeners
    window.removeEventListener('load', checkAndReportSetupPage);
    window.removeEventListener('pagehide', handleUnload);
}

/**
 * Handles page unload events
 */
function handleUnload() {
    cleanupExtension();
}

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'CHECK_FOR_SETUP') {
        console.log('SF Setup Panel: Received CHECK_FOR_SETUP message');
        sendResponse({ checked: true });
        return true;
    }
    
    sendResponse({ error: 'Unknown message type' });
    return true;
});

// Initialize the observer if we're in a Salesforce domain
if (isSalesforceDomain(window.location.href)) {
    console.log('SF Setup Panel: Content script initialized on Salesforce domain');
    
    // Create the observer
    observer = new MutationObserver(() => {
        try {
            // Check for URL changes
            if (window.location.href !== currentUrl) {
                console.log('SF Setup Panel: URL changed from', currentUrl, 'to', window.location.href);
                currentUrl = window.location.href;
                checkAndReportSetupPage();
            }
            
            // Check for DOM changes that might indicate setup elements
            if (checkForSetupMenu()) {
                console.log('SF Setup Panel: Setup menu detected');
                checkAndReportSetupPage();
            }
        } catch (error) {
            console.error('SF Setup Panel: Error in observer:', error);
            // Error handled silently
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
        window.addEventListener('pagehide', handleUnload);
    } catch (error) {
        console.error('SF Setup Panel: Error setting up observer:', error);
        // Error handled silently
    }
} else {
    console.log('SF Setup Panel: Not on a Salesforce domain, content script inactive');
}