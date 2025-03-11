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
    'salesforce.com': {
        purpose: 'Core Salesforce functionality and authentication',
        enhanced: true
    },
    'force.com': {
        purpose: 'Visualforce pages and Lightning pages',
        enhanced: true
    },
    'salesforce-setup.com': {
        purpose: 'New dedicated setup pages domain',
        enhanced: true
    },
    'visualforce.com': {
        purpose: 'Legacy Visualforce pages (pre-enhanced domains)',
        enhanced: false
    },
    'lightning.com': {
        purpose: 'Legacy Lightning container (pre-enhanced domains)',
        enhanced: false
    }
};

// Secure content loading states
const LoadingState = {
    INITIAL: 'initial',
    LOADING: 'loading',
    LOADED: 'loaded',
    ERROR: 'error'
};

/**
 * Manages the Salesforce Setup side panel functionality
 */
class SetupSidePanel {
    constructor() {
        this.state = LoadingState.INITIAL;
        this.setupFrame = null;
        this.contentContainer = null;
        this.loadingIndicator = null;
        this.errorDisplay = null;
        this.errorMessageEl = null;
        this.boundListeners = new Map(); // Store bound listeners for cleanup
        
        // Bind methods to this instance
        this.handleMessage = this.handleMessage.bind(this);
        this.handleLoadSuccess = this.handleLoadSuccess.bind(this);
        this.handleLoadError = this.handleLoadError.bind(this);
        this.handleRefreshClick = this.handleRefreshClick.bind(this);
        this.handleVisibilityChange = this.handleVisibilityChange.bind(this);
        this.handleSearchInput = this.handleSearchInput.bind(this);
        
        // Store bound handlers for cleanup
        this.boundListeners.set('message', this.handleMessage);
        this.boundListeners.set('visibilitychange', this.handleVisibilityChange);
        
        // Initialize when DOM is fully loaded
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
        try {
            // Remove document-level event listeners
            document.removeEventListener('visibilitychange', this.boundListeners.get('visibilitychange'));
            
            // Remove chrome listeners
            chrome.runtime.onMessage.removeListener(this.boundListeners.get('message'));
            
            // Remove UI event listeners
            const refreshButton = document.getElementById('refreshButton');
            if (refreshButton) {
                refreshButton.removeEventListener('click', this.handleRefreshClick);
            }
            
            const searchInput = document.getElementById('setupSearch');
            if (searchInput) {
                searchInput.removeEventListener('input', this.handleSearchInput);
            }
            
            // Clear iframe if any
            if (this.setupFrame && this.setupFrame.parentNode) {
                this.setupFrame.removeEventListener('load', this.handleLoadSuccess);
                this.setupFrame.removeEventListener('error', this.handleLoadError);
                this.setupFrame.parentNode.removeChild(this.setupFrame);
            }
            
            console.log('Side panel cleaned up');
        } catch (error) {
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
            
            // Check for null elements
            if (!this.contentContainer) {
                throw new Error('Content container not found');
            }
            
            if (!this.loadingIndicator) {
                console.warn('Loading indicator not found, creating one');
                this.setupLoadingIndicator();
            }
            
            if (!this.errorDisplay) {
                console.warn('Error display not found, creating one');
                this.setupErrorDisplay();
            } else {
                // Get error message element if error display exists
                this.errorMessageEl = this.errorDisplay.querySelector('.error-message');
                if (!this.errorMessageEl) {
                    console.warn('Error message element not found, creating one');
                    this.errorMessageEl = document.createElement('div');
                    this.errorMessageEl.className = 'error-message';
                    this.errorDisplay.appendChild(this.errorMessageEl);
                }
            }
            
            // Set up refresh button
            const refreshButton = document.getElementById('refreshButton');
            if (refreshButton) {
                refreshButton.addEventListener('click', this.handleRefreshClick);
            }
            
            // Set up the search input if present
            const searchInput = document.getElementById('setupSearch');
            if (searchInput) {
                searchInput.addEventListener('input', this.handleSearchInput);
            }
            
            // Listen for messages from the background script
            chrome.runtime.onMessage.addListener(this.handleMessage);
            
            // Listen for visibility changes
            document.addEventListener('visibilitychange', this.handleVisibilityChange);
            
            // Get current active tab info
            this.getCurrentTabInfo();
            
            console.log('Side panel initialized');
        } catch (error) {
            console.error('Failed to initialize side panel:', error);
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
        this.loadingIndicator.setAttribute('aria-live', 'polite');
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
        this.errorDisplay.setAttribute('aria-live', 'assertive');
        
        // Create error icon
        const errorIcon = document.createElement('span');
        errorIcon.className = 'error-icon';
        errorIcon.textContent = '⚠️';
        errorIcon.setAttribute('aria-hidden', 'true');
        
        // Create error message container
        this.errorMessageEl = document.createElement('div');
        this.errorMessageEl.className = 'error-message';
        
        // Append elements
        this.errorDisplay.appendChild(errorIcon);
        this.errorDisplay.appendChild(this.errorMessageEl);
        document.body.appendChild(this.errorDisplay);
    }
    
    /**
     * Handles visibility changes of the document
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // Panel became visible, refresh content if needed
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
                        // If we have a setup URL for this tab, load it
                        this.createSecureFrame(response.state.setupUrl);
                    }
                })
                .catch(error => {
                    console.error('Error getting tab state:', error);
                    this.displayError('Failed to get tab state: ' + error.message);
                });
        } catch (error) {
            console.error('Error in getCurrentTabInfo:', error);
        }
    }
    
    /**
     * Handles search input
     * @param {Event} event - Input event
     */
    handleSearchInput(event) {
        try {
            const searchTerm = event.target.value.toLowerCase();
            
            // You would implement search functionality here
            // This is a placeholder for future implementation
            console.log('Search term:', searchTerm);
        } catch (error) {
            console.error('Error in search input:', error);
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
            console.error('Invalid URL:', e);
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
                // Remove event listeners
                this.setupFrame.removeEventListener('load', this.handleLoadSuccess);
                this.setupFrame.removeEventListener('error', this.handleLoadError);
                
                // Remove from DOM
                if (this.setupFrame.parentNode) {
                    this.setupFrame.parentNode.removeChild(this.setupFrame);
                }
                this.setupFrame = null;
            }
            
            // Ensure content container exists
            if (!this.contentContainer) {
                this.contentContainer = document.getElementById('content-container');
                if (!this.contentContainer) {
                    const main = document.querySelector('main') || document.body;
                    this.contentContainer = document.createElement('div');
                    this.contentContainer.id = 'content-container';
                    main.appendChild(this.contentContainer);
                }
            }

            // Create new iframe
            this.setupFrame = document.createElement('iframe');
            this.setupFrame.id = 'setupFrame';
            
            // Set security attributes
            this.setupFrame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-downloads allow-storage-access-by-user-activation');
            this.setupFrame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
            this.setupFrame.setAttribute('allow', 'clipboard-read; clipboard-write');
            
            // Set event handlers
            this.setupFrame.addEventListener('load', this.handleLoadSuccess);
            this.setupFrame.addEventListener('error', this.handleLoadError);
            
            // Set source and append to container
            this.setupFrame.src = setupUrl;
            this.contentContainer.appendChild(this.setupFrame);
            
            console.log('Created setup frame for URL:', setupUrl);
        } catch (error) {
            console.error('Error creating setup frame:', error);
            this.displayError('Failed to create content frame: ' + error.message);
            this.setState(LoadingState.ERROR, error.message);
        }
    }

    /**
     * Handles messages from the background script
     */
    handleMessage(message, sender, sendResponse) {
        try {
            console.log('Side panel received message:', message.type);
            
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
            console.error('Error handling message:', error);
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
                // If no frame exists, try to get current tab info
                this.getCurrentTabInfo();
            }
        } catch (error) {
            console.error('Error refreshing content:', error);
            this.displayError('Failed to refresh: ' + error.message);
        }
    }

    /**
     * Updates the panel's state
     */
    setState(state, errorMessage = null) {
        try {
            this.state = state;
            this.updateUI(state, errorMessage);
        } catch (error) {
            console.error('Error setting state:', error);
        }
    }

    /**
     * Updates the UI based on current state
     */
    updateUI(state, errorMessage = null) {
        try {
            if (!this.loadingIndicator || !this.errorDisplay) {
                console.error('UI elements not found for update');
                return;
            }
            
            switch (state) {
                case LoadingState.LOADING:
                    this.loadingIndicator.style.display = 'flex';
                    this.errorDisplay.style.display = 'none';
                    if (this.contentContainer) {
                        this.contentContainer.style.opacity = '0.5';
                    }
                    break;
                    
                case LoadingState.LOADED:
                    this.loadingIndicator.style.display = 'none';
                    this.errorDisplay.style.display = 'none';
                    if (this.contentContainer) {
                        this.contentContainer.style.opacity = '1';
                    }
                    break;
                    
                case LoadingState.ERROR:
                    this.loadingIndicator.style.display = 'none';
                    this.errorDisplay.style.display = 'flex';
                    this.displayError(errorMessage || 'An error occurred');
                    if (this.contentContainer) {
                        this.contentContainer.style.opacity = '1';
                    }
                    
                    // Create retry button for errors
                    this.createRetryButton();
                    break;
            }
        } catch (error) {
            console.error('Error updating UI:', error);
        }
    }

    /**
     * Displays an error message
     */
    displayError(message) {
        try {
            if (this.errorMessageEl) {
                this.errorMessageEl.textContent = message;
            } else {
                console.error('Error message element not available');
                // Fallback to alert if in development
                if (process.env.NODE_ENV === 'development') {
                    console.error('Error:', message);
                }
            }
        } catch (error) {
            console.error('Error displaying error message:', error);
        }
    }

    /**
     * Handles successful loading of the setup frame
     */
    handleLoadSuccess() {
        try {
            this.setState(LoadingState.LOADED);
            console.log('Setup frame loaded successfully');
        } catch (error) {
            console.error('Error in load success handler:', error);
        }
    }

    /**
     * Handles loading errors
     */
    handleLoadError(error) {
        try {
            const errorDetails = {
                message: error.message || 'Failed to load Salesforce Setup content',
                timestamp: new Date().toISOString()
            };
            
            this.setState(LoadingState.ERROR, errorDetails.message);
            console.error('Setup frame error:', errorDetails);
        } catch (e) {
            console.error('Error in error handler:', e);
        }
    }

    /**
     * Creates a retry button in the error display
     */
    createRetryButton() {
        try {
            if (!this.errorDisplay) return;
            
            // Check if button already exists
            if (this.errorDisplay.querySelector('.retry-button')) return;
            
            const retryButton = document.createElement('button');
            retryButton.textContent = 'Retry';
            retryButton.className = 'retry-button';
            retryButton.setAttribute('aria-label', 'Retry loading Salesforce Setup');
            
            retryButton.addEventListener('click', () => {
                if (this.setupFrame && this.setupFrame.src) {
                    this.setState(LoadingState.LOADING);
                    this.setupFrame.src = this.setupFrame.src;
                } else {
                    // If no frame exists, try to get current tab info
                    this.getCurrentTabInfo();
                }
            });
            
            this.errorDisplay.appendChild(retryButton);
        } catch (error) {
            console.error('Error creating retry button:', error);
        }
    }
}

// Initialize the side panel
try {
    window.setupSidePanel = new SetupSidePanel();
} catch (error) {
    console.error('Failed to initialize SetupSidePanel:', error);
    // Display error in the UI if possible
    const errorDisplay = document.getElementById('error-display');
    if (errorDisplay) {
        const errorMessage = errorDisplay.querySelector('.error-message');
        if (errorMessage) {
            errorMessage.textContent = 'Failed to initialize Salesforce Setup panel: ' + error.message;
        }
        errorDisplay.style.display = 'flex';
    }
}
