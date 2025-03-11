# SF Setup Side Panel Extension

A Chrome extension that enhances the Salesforce Setup experience by providing quick access to commonly used setup pages and tools through Chrome's side panel feature. This extension makes navigating Salesforce Setup more efficient and user-friendly.

## Features

- 🔍 Quick access to Salesforce Setup pages through Chrome's side panel
- 📌 Easily navigate to commonly used Setup sections
- 🚀 Streamlined interface for faster Salesforce administration
- 💻 Works seamlessly within the Chrome browser
- 🎨 Clean, intuitive user interface

## Project Structure

```
sf-setup-sidepanel/
├── README.md           # This documentation file
├── manifest.json       # Extension configuration
├── background.js      # Background script for extension
├── content.js         # Content script for page interaction
├── sidepanel.js      # Side panel functionality
├── sidepanel.html    # Side panel HTML interface
├── .gitignore        # Git ignore configuration
└── icons/            # Extension icons
    ├── icon16.png    # 16x16 icon
    ├── icon48.png    # 48x48 icon
    ├── icon128.png   # 128x128 icon
    ├── icon.png      # Default icon
    └── icon.svg      # Vector icon
```

## Installation/Setup Instructions

### Developer Mode Installation

1. Clone this repository to your local machine
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the extension directory
5. The extension icon should appear in your Chrome toolbar
6. Click the extension icon to open the side panel

### Usage Requirements

- Google Chrome browser (latest version recommended)
- Access to Salesforce instance with appropriate permissions

## Usage

1. Click the extension icon in the Chrome toolbar to open the side panel
2. Navigate to your Salesforce instance (Setup pages)
3. Use the side panel to quickly access different Setup sections:
   - Object Manager
   - Users
   - Profiles
   - Permission Sets
   - And more...
4. Click on any item in the side panel to navigate directly to that Setup page

---

For bug reports and feature requests, please open an issue in the GitHub repository.

