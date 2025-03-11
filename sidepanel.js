'use strict';

/**
 * Salesforce domain configurations
 * @type {Object.<string, boolean>}
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

// Define loading states
const LoadingState = {
    LOADING: 'loading',
    LOADED: 'loaded',
    ERROR: 'error'
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
 * Manages the Salesforce Setup side panel functionality
 */
class SetupSidePanel {
    /**
     * Constructor
     */
    constructor() {
        // Initialize state
        this.state = LoadingState.LOADING;
        this.setupFrame = null;
        
        // Bind methods to maintain 'this' context
        this.handleLoadSuccess = this.handleLoadSuccess.bind(this);
        this.handleLoadError = this.handleLoadError.bind(this);
        this.handleMessage = this.handleMessage.bind(this);
        this.handleRefreshClick = this.handleRefreshClick.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        
        // Store bound listeners for cleanup
        this.boundListeners = new Map([
            ['message', this.handleMessage],
            ['visibilitychange', this.handleVisibilityChange]
        ]);
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
        
        // Add unload listener for cleanup
        window.addEventListener('unload', () => this.cleanup());
    }

    /**
     * Handles visibility changes of the document
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            this.getCurrentTabInfo();
        }
    }

    /**
     * Cleanup event listeners and resources
     */
    cleanup() {
        try {
            // Remove document-level event listeners - check if bound listeners exist
            if (document && this.boundListeners && this.boundListeners.has('visibilitychange')) {
                document.removeEventListener('visibilitychange', this.boundListeners.get('visibilitychange'));
            }
            
            // Remove chrome listeners
            if (chrome && chrome.runtime && this.boundListeners && this.boundListeners.has('message')) {
                chrome.runtime.onMessage.removeListener(this.boundListeners.get('message'));
            }
            
            // Remove UI event listeners
            const refreshButton = document.getElementById('refreshButton');
            if (refreshButton && this.handleRefreshClick) {
                refreshButton.removeEventListener('click', this.handleRefreshClick);
            }
            
            // Clear iframe if any - with comprehensive null checks
            if (this.setupFrame) {
                if (this.handleLoadSuccess) {
                    this.setupFrame.removeEventListener('load', this.handleLoadSuccess);
                }
                if (this.handleLoadError) {
                    this.setupFrame.removeEventListener('error', this.handleLoadError);
                }
                if (this.setupFrame.parentNode) {
                    this.setupFrame.parentNode.removeChild(this.setupFrame);
                }
            }
        } catch (error) {
            // Silently handle any cleanup errors
            console.error('Error during cleanup:', error);
        }
    }

    /**
     * Initializes the side panel
     */
    initialize() {
        try {
            // Set up DOM references
            this.contentContainer = document.getElementById('content-container');
            this.loadingIndicator = document.getElementById('loading-indicator');
            this.errorDisplay = document.getElementById('error-display');
            
            // Create content container if it doesn't exist
            if (!this.contentContainer) {
                const main = document.querySelector('main') || document.body;
                this.contentContainer = document.createElement('div');
                this.contentContainer.id = 'content-container';
                main.appendChild(this.contentContainer);
            }
            
            // Set up loading indicator if not found
            if (!this.loadingIndicator) {
                this.setupLoadingIndicator();
            }
            
            // Set up error display if not found
            if (!this.errorDisplay) {
                this.setupErrorDisplay();
            } else {
                this.errorMessageEl = this.errorDisplay.querySelector('.error-message');
            }
            
            // Set up refresh button
            const refreshButton = document.getElementById('refreshButton');
            if (refreshButton) {
                refreshButton.addEventListener('click', this.handleRefreshClick);
            }
            
            // Listen for messages from the background script
            chrome.runtime.onMessage.addListener(this.handleMessage);
            
            // Listen for visibility changes
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
            
            // Get current active tab info
            this.getCurrentTabInfo();
        } catch (error) {
            this.displayError('Failed to initialize: ' + error.message);
        }
    }
    
    /**
     * Sets up the loading indicator element if not present
     */
    setupLoadingIndicator() {
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.id = 'loading-indicator';
        this.loadingIndicator.textContent = 'Loading Salesforce Setup...';
        this.loadingIndicator.setAttribute('role', 'status');
        document.body.appendChild(this.loadingIndicator);
    }
    
    /**
     * Sets up the error display element if not present
     */
    setupErrorDisplay() {
        this.errorDisplay = document.createElement('div');
        this.errorDisplay.id = 'error-display';
        this.errorDisplay.className = 'error-container';
        this.errorDisplay.setAttribute('role', 'alert');
        
        // Create error message container
        this.errorMessageEl = document.createElement('div');
        this.errorMessageEl.className = 'error-message';
        
        this.errorDisplay.appendChild(this.errorMessageEl);
        document.body.appendChild(this.errorDisplay);
    }
    
    /**
     * Gets the current tab information
     */
    getCurrentTabInfo() {
        try {
            chrome.runtime.sendMessage({ type: 'GET_TAB_STATE' })
                .then(response => {
                    if (response && response.state && response.state.setupUrl) {
                        this.createSecureFrame(response.state.setupUrl);
                    }
                })
                .catch(error => {
                    // Handle error silently with fallback error display
                    this.displayError('Unable to load tab information. Try refreshing the page.');
                });
        } catch (error) {
            // Handle error silently with fallback error display
            this.displayError("Unable to load tab information. Try refreshing the page.");
        }
    }

    /**
     * Creates an iframe to load Salesforce setup content
     */
    createSecureFrame(setupUrl) {
        try {
            // Set state to loading
            this.setState(LoadingState.LOADING);
            
            // Validate URL
            if (!setupUrl || typeof setupUrl !== 'string') {
                throw new Error('Invalid setup URL provided');
            }
            
            if (!isSalesforceDomain(setupUrl)) {
                throw new Error('URL is not from a valid Salesforce domain');
            }
            
            // Remove existing frame if any
            if (this.setupFrame) {
                this.setupFrame.removeEventListener('load', this.handleLoadSuccess);
                this.setupFrame.removeEventListener('error', this.handleLoadError);
                
                if (this.setupFrame.parentNode) {
                    this.setupFrame.parentNode.removeChild(this.setupFrame);
                }
                this.setupFrame = null;
            }
            
            // Double-check content container exists
            if (!this.contentContainer) {
                const main = document.querySelector('main') || document.body;
                this.contentContainer = document.createElement('div');
                this.contentContainer.id = 'content-container';
                main.appendChild(this.contentContainer);
            }

            // Create new iframe with full permissions
            this.setupFrame = document.createElement('iframe');
            this.setupFrame.id = 'setupFrame';
            
            // Set relaxed security attributes for maximum functionality
            this.setupFrame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-top-navigation allow-presentation');
            this.setupFrame.setAttribute('referrerpolicy', 'no-referrer-when-downgrade');
            
            // Set event handlers
            this.setupFrame.addEventListener('load', this.handleLoadSuccess);
            this.setupFrame.addEventListener('error', this.handleLoadError);
            
            // Set source and append to container
            this.setupFrame.src = setupUrl;
            this.contentContainer.appendChild(this.setupFrame);
        } catch (error) {
            this.displayError('Failed to load content: ' + error.message);
            this.setState(LoadingState.ERROR, error.message);
        }
    }

    /**
     * Handles messages from the background script
     */
    handleMessage(message, sender, sendResponse) {
        try {
            if (message.type === 'LOAD_SETUP' && message.url) {
                if (isSalesforceDomain(message.url)) {
                    this.createSecureFrame(message.url);
                    sendResponse({ success: true });
                } else {
                    this.setState(LoadingState.ERROR, 'Invalid Salesforce domain');
                    sendResponse({ success: false, error: 'Invalid domain' });
                }
                return true; // Indicate that we'll respond asynchronously
            }
            
            return false;
        } catch (error) {
            sendResponse({ error: error.message });
            return true;
        }
    }

    /**
     * Handles refresh button clicks
     */
    handleRefreshClick() {
        try {
            if (this.setupFrame && this.setupFrame.src) {
                this.setState(LoadingState.LOADING);
                this.setupFrame.src = this.setupFrame.src;
            } else {
                this.getCurrentTabInfo();
            }
        } catch (error) {
            this.displayError('Failed to refresh: ' + error.message);
        }
    }

    /**
     * Updates the panel's state
     */
    setState(state, errorMessage = null) {
        this.state = state;
        this.updateUI(state, errorMessage);
    }

    /**
     * Updates the UI based on current state
     */
    updateUI(state, errorMessage = null) {
        if (!this.loadingIndicator || !this.errorDisplay) return;
        
        switch (state) {
            case LoadingState.LOADING:
                // Show loading indicator
                this.loadingIndicator.classList.add('visible');
                
                // Hide error display
                this.errorDisplay.classList.remove('visible');
                
                // Dim content container
                if (this.contentContainer) {
                    this.contentContainer.classList.add('content-loading');
                    this.contentContainer.classList.remove('content-loaded');
                }
                break;
                
            case LoadingState.LOADED:
                // Hide loading indicator
                this.loadingIndicator.classList.remove('visible');
                
                // Hide error display
                this.errorDisplay.classList.remove('visible');
                
                // Show content container at full opacity
                if (this.contentContainer) {
                    this.contentContainer.classList.remove('content-loading');
                    this.contentContainer.classList.add('content-loaded');
                }
                break;
                
            case LoadingState.ERROR:
                // Hide loading indicator
                this.loadingIndicator.classList.remove('visible');
                
                // Show error with message
                if (errorMessage && this.errorMessageEl) {
                    this.errorMessageEl.textContent = errorMessage;
                    this.errorDisplay.classList.add('visible');
                }
                break;
        }
    }

    /**
     * Displays an error message
     */
    displayError(message) {
        try {
            if (this.errorMessageEl) {
                this.errorMessageEl.textContent = message;
                if (this.errorDisplay) {
                    this.errorDisplay.classList.add('visible');
                }
            }
            
            if (this.loadingIndicator) {
                this.loadingIndicator.classList.remove('visible');
            }
        } catch (error) {
            // Error in error handler, recover gracefully by falling back to console
            console.error('Error displaying error message:', error);
        }
    }

    /**
     * Handles successful loading of the setup frame
     */
    handleLoadSuccess() {
        this.setState(LoadingState.LOADED);
    }

    /**
     * Handles loading errors
     */
    handleLoadError(error) {
        const errorMessage = error.message || 'Failed to load Salesforce Setup content';
        this.setState(LoadingState.ERROR, errorMessage);
    }
}

// Initialize the side panel
try {
    window.setupSidePanel = new SetupSidePanel();
} catch (error) {
    // Display error in the UI if possible
    const errorDisplay = document.getElementById('error-display');
    if (errorDisplay) {
        const errorMessage = errorDisplay.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.textContent = 'Failed to initialize Salesforce Setup panel: ' + error.message;
        }
        errorDisplay.classList.add('visible');
    }
}