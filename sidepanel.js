'use strict';

/**
 * @typedef {Object} DomainConfig
 * @property {string} purpose - Description of the domain's purpose
 * @property {boolean} enhanced - Whether this is an enhanced domain
 */

/**
 * Salesforce domain configurations based on official documentation
 * @type {Object.<string, DomainConfig>}
 */
const SALESFORCE_DOMAINS = {
    '.salesforce.com': true,
    '.force.com': true,
    '.lightning.force.com': true,
    '.visualforce.com': true
};

// Define loading states
const LoadingState = {
    LOADING: 'loading',
    LOADED: 'loaded',
    ERROR: 'error'
};

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
        
        // Store bound listeners for cleanup
        this.boundListeners = new Map([
            ['message', this.handleMessage],
            ['visibilitychange', this.handleVisibilityChange.bind(this)]
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
     * Cleanup event listeners and resources
     */
    cleanup() {
        // Remove document-level event listeners
        document.removeEventListener('visibilitychange', this.boundListeners.get('visibilitychange'));
        
        // Remove chrome listeners
        chrome.runtime.onMessage.removeListener(this.boundListeners.get('message'));
        
        // Remove UI event listeners
        const refreshButton = document.getElementById('refreshButton');
        if (refreshButton) {
            refreshButton.removeEventListener('click', this.handleRefreshClick);
        }
        
        // Clear iframe if any
        if (this.setupFrame && this.setupFrame.parentNode) {
            this.setupFrame.removeEventListener('load', this.handleLoadSuccess);
            this.setupFrame.removeEventListener('error', this.handleLoadError);
            this.setupFrame.parentNode.removeChild(this.setupFrame);
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
     * Handles visibility changes of the document
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            this.getCurrentTabInfo();
        }
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
                    this.displayError('Failed to get tab state: ' + error.message);
                });
        } catch (error) {
            // Silent fail
        }
    }

    /**
     * Validates if a given URL belongs to a supported Salesforce domain
     */
    validateSalesforceDomain(url) {
        try {
            const urlObj = new URL(url);
            return Object.keys(SALESFORCE_DOMAINS).some(domain => 
                urlObj.hostname.endsWith(domain)
            );
        } catch (e) {
            return false;
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

            // Create new iframe
            this.setupFrame = document.createElement('iframe');
            this.setupFrame.id = 'setupFrame';
            
            // Set security attributes
            this.setupFrame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads');
            this.setupFrame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            
            // Set event handlers
            this.setupFrame.addEventListener('load', this.handleLoadSuccess);
            this.setupFrame.addEventListener('error', this.handleLoadError);
            
            // Set source and append to container
            this.setupFrame.src = setupUrl;
            this.contentContainer.appendChild(this.setupFrame);
        } catch (error) {
            this.displayError('Failed to create content frame: ' + error.message);
            this.setState(LoadingState.ERROR, error.message);
        }
    }

    /**
     * Handles messages from the background script
     */
    handleMessage(message, sender, sendResponse) {
        try {
            if (message.type === 'LOAD_SETUP' && message.url) {
                if (this.validateSalesforceDomain(message.url)) {
                    this.createSecureFrame(message.url);
                    sendResponse({ success: true });
                } else {
                    this.setState(LoadingState.ERROR, 'Invalid Salesforce domain');
                    sendResponse({ success: false, error: 'Invalid domain' });
                }
                return true;
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
            // Silent fail
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
