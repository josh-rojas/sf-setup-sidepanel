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
        /** @type {string} */
        this.state = LoadingState.INITIAL;
        /** @type {HTMLIFrameElement|null} */
        this.setupFrame = null;
        /** @type {HTMLElement|null} */
        this.loadingIndicator = null;
        /** @type {HTMLElement|null} */
        this.errorDisplay = null;
        /** @type {HTMLElement|null} */
        this.contentContainer = null;
        
        this.initialize();
    }

    /**
     * Initializes the side panel by setting up message listeners and DOM elements
     * @private
     */
    initialize() {
        try {
            // Set up DOM elements
            this.setupLoadingIndicator();
            this.setupErrorDisplay();
            this.contentContainer = document.getElementById('content-container');
            
            // Listen for messages from the background script
            chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
        } catch (error) {
            console.error('Failed to initialize side panel:', error);
            throw error; // Re-throw to be caught by the main initialization
        }
    }

    /**
     * Validates if a given URL belongs to a supported Salesforce domain
     * @param {string} url - The URL to validate
     * @returns {boolean} - Whether the URL is from a supported Salesforce domain
     */
    validateSalesforceDomain(url) {
        try {
            const urlObj = new URL(url);
            return Object.keys(SALESFORCE_DOMAINS).some(domain => {
                return urlObj.hostname.endsWith(domain);
            });
        } catch (e) {
            console.error('Invalid URL:', e);
            return false;
        }
    }

    /**
     * Sets up secure iframe for loading Salesforce content
     * @param {string} setupUrl - The Salesforce setup URL to load
     */
    createSecureFrame(setupUrl) {
        if (this.setupFrame) {
            document.body.removeChild(this.setupFrame);
        }

        this.setupFrame = document.createElement('iframe');
        // Security measures
        this.setupFrame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-forms');
        this.setupFrame.setAttribute('referrerpolicy', 'strict-origin');
        this.setupFrame.setAttribute('csp', "default-src 'self' *.salesforce.com *.force.com *.salesforce-setup.com");
        
        // Error handling
        this.setupFrame.onerror = this.handleLoadError.bind(this);
        this.setupFrame.onload = this.handleLoadSuccess.bind(this);
        
        this.setupFrame.src = setupUrl;
        document.body.appendChild(this.setupFrame);
    }

    /**
     * Handles messages from the background script
     * @param {Object} message - Message received from background script
     * @param {MessageSender} sender - Message sender information
     * @param {function} sendResponse - Callback to send response
     */
    handleMessage(message, sender, sendResponse) {
        if (message.type === 'LOAD_SETUP' && message.url) {
            if (this.validateSalesforceDomain(message.url)) {
                this.setState(LoadingState.LOADING);
                this.createSecureFrame(message.url);
                sendResponse({ success: true });
            } else {
                this.setState(LoadingState.ERROR, 'Invalid Salesforce domain');
                sendResponse({ success: false, error: 'Invalid domain' });
            }
        }
    }

    /**
     * Updates the panel's state and UI
     * @param {string} state - New state from LoadingState enum
     * @param {string} [error] - Optional error message
     */
    setState(state, error = null) {
        this.state = state;
        this.updateUI(state, error);
    }

    /**
     * Updates the UI based on current state
     * @param {string} state - Current loading state
     * @param {string} [error] - Optional error message
     */
    updateUI(state, error = null) {
        const loadingIndicator = document.getElementById('loading-indicator');
        const errorDisplay = document.getElementById('error-display');
        const contentContainer = document.getElementById('content-container');

        switch (state) {
            case LoadingState.LOADING:
                loadingIndicator.style.display = 'block';
                errorDisplay.style.display = 'none';
                contentContainer.style.opacity = '0.5';
                break;
            case LoadingState.LOADED:
                loadingIndicator.style.display = 'none';
                errorDisplay.style.display = 'none';
                contentContainer.style.opacity = '1';
                break;
            case LoadingState.ERROR:
                loadingIndicator.style.display = 'none';
                errorDisplay.style.display = 'block';
                errorDisplay.textContent = error || 'An error occurred';
                contentContainer.style.opacity = '1';
                break;
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
     * @param {Error} error - The error that occurred
     */
    handleLoadError(error) {
        this.setState(LoadingState.ERROR, 'Failed to load Salesforce Setup content');
        console.error('Setup frame load error:', error);
    }

    /**
     * Sets up the loading indicator element
     */
    /**
     * Sets up the loading indicator element
     * @private
     */
    setupLoadingIndicator() {
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.id = 'loading-indicator';
        this.loadingIndicator.textContent = 'Loading Salesforce Setup...';
        this.loadingIndicator.style.display = 'none';
        this.loadingIndicator.setAttribute('role', 'status');
        this.loadingIndicator.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.loadingIndicator);
    }

    /**
     * Sets up the error display element
     */
    /**
     * Sets up the error display element
     * @private
     */
    setupErrorDisplay() {
        this.errorDisplay = document.createElement('div');
        this.errorDisplay.id = 'error-display';
        this.errorDisplay.style.display = 'none';
        this.errorDisplay.setAttribute('role', 'alert');
        this.errorDisplay.setAttribute('aria-live', 'assertive');
        document.body.appendChild(this.errorDisplay);
    }
}

// Initialize the side panel when the document is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        new SetupSidePanel();
    } catch (error) {
        console.error('Failed to initialize SetupSidePanel:', error);
        // Display error in the UI if possible
        const errorDisplay = document.getElementById('error-display');
        if (errorDisplay) {
            errorDisplay.textContent = 'Failed to initialize Salesforce Setup panel';
            errorDisplay.style.display = 'block';
        }
    }
});
