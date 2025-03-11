# Salesforce Setup Sidepanel

A Chrome extension that provides seamless access to Salesforce Setup pages through Chrome's side panel feature. Work efficiently in Salesforce without disrupting your workflow by navigating away from your current tab.

## Features

- 🔍 Access Salesforce Setup directly in the side panel
- 🔄 Setup links automatically redirect to the side panel
- 🌐 Works with all Salesforce domains (.salesforce.com, .force.com, etc.)
- 🧠 Intelligent detection of Salesforce Setup pages
- 🚀 Optimized performance with minimal overhead
- 🔒 CSP-compliant with secure iframe implementation

## How It Works

The extension operates through three main components:

1. **Content Script** (content.js): Runs on Salesforce domains, detects setup links, and intercepts clicks
2. **Background Service Worker** (background.js): Manages state between tabs and handles message passing
3. **Side Panel** (sidepanel.js/html): Renders Salesforce Setup content in Chrome's side panel

When you click a Setup link on any Salesforce page, the extension intercepts the click, opens the side panel, and loads the setup content within it - all without navigating away from your current page.

## Installation

### Developer Installation

1. Clone this repository:
   ```
   git clone https://github.com/joshmedeski/sf-setup-sidepanel.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top-right corner

4. Click "Load unpacked" and select the extension directory

5. The extension is now installed and ready to use on Salesforce domains

### Chrome Web Store Installation

*Coming soon*

## Usage

1. Navigate to any Salesforce domain
2. The extension automatically activates on Salesforce websites
3. Click any Setup link - it will open in the side panel instead of navigating away
4. Use the refresh button in the side panel to reload Setup content
5. The side panel persists as you navigate between Salesforce pages

## Technical Implementation

### Architecture Overview

```
├── manifest.json       # Extension configuration (Manifest V3)
├── background.js       # Service worker for extension lifecycle management
├── content.js          # Injected into Salesforce pages to detect/intercept setup links
├── sidepanel.html      # HTML structure for the side panel
├── sidepanel.js        # Side panel functionality and iframe management
└── styles.css          # Styling for the side panel interface
```

### Key Components

- **Domain Detection**: The extension maintains a consistent domain validation system across all components to correctly identify Salesforce domains
- **Setup Pattern Matching**: Identifies Setup URLs through pattern matching to determine when to activate
- **Message Passing**: Components communicate through Chrome's message passing API
- **State Management**: Maintains state across tabs to ensure proper context
- **Error Handling**: Comprehensive error handling with graceful degradation

### Security Considerations

The extension implements several security measures:

- Content Security Policy (CSP) compliance
- Sandboxed iframe for rendering Salesforce content
- Domain validation before loading content
- Secure referrer policy implementation

## Compatibility

- **Chrome Version**: Requires Chrome 116+ (supports side panel API)
- **Salesforce Domains**: Works with all Salesforce domains including:
  - .salesforce.com
  - .force.com
  - .lightning.force.com
  - .visualforce.com
  - .salesforce-setup.com

## Debugging

If you encounter issues:

1. Open Chrome DevTools (F12) while on a Salesforce page
2. Check the Console for any error messages
3. Inspect the side panel by right-clicking on it and selecting "Inspect"
4. For background script issues, go to `chrome://extensions/`, find the extension, and click on "background page" under "Inspect views"

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Author

Josh Medeski - [@joshmedeski](https://github.com/joshmedeski)

---

For bug reports and feature requests, please open an issue in the GitHub repository.