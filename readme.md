# Duplicate Tab Closer Chrome Extension

A simple Chrome extension that automatically closes duplicate tabs with one click. Keep your browser organized and improve performance by eliminating redundant tabs.

## Features

- 🚀 **One-click operation** - Close all duplicate tabs instantly
- 🧠 **Smart detection** - Identifies tabs with identical URLs
- 💡 **Preserves oldest tabs** - Keeps the first opened tab for each URL
- 📊 **User feedback** - Shows how many duplicates were closed
- 🎨 **Clean interface** - Modern, intuitive popup design

## Installation

### Method 1: Load as Unpacked Extension (Developer Mode)

1. **Download the extension files**
   - Download all the files from this repository
   - Create a new folder on your computer (e.g., `duplicate-tab-closer`)
   - Save all files in this folder:
     - `manifest.json`
     - `popup.html`
     - `popup.js`
     - `background.js`

2. **Create extension icons (optional)**
   - Add icon files: `icon16.png`, `icon48.png`, `icon128.png`
   - Or remove the `"icons"` section from `manifest.json` if you skip this step

3. **Load the extension in Chrome**
   - Open Google Chrome
   - Navigate to `chrome://extensions/`
   - Enable **"Developer mode"** using the toggle in the top-right corner
   - Click **"Load unpacked"**
   - Select the folder containing your extension files
   - The extension should now appear in your extensions list

4. **Pin the extension (recommended)**
   - Click the puzzle piece icon (🧩) in the Chrome toolbar
   - Find "Duplicate Tab Closer" in the list
   - Click the pin icon to add it to your toolbar for easy access

## How to Use

1. **Open multiple tabs** - Navigate normally and open tabs (some duplicates will naturally occur)

2. **Click the extension** - Click the "Duplicate Tab Closer" icon in your toolbar

3. **View results** - The popup will show:
   - A button to close duplicates
   - Status message indicating how many tabs were closed
   - "No duplicate tabs found" if there are no duplicates

## How It Works

The extension uses Chrome's tabs API to:

1. **Scan all open tabs** across all Chrome windows
2. **Group tabs by URL** to identify duplicates
3. **Preserve the oldest tab** for each unique URL (based on tab ID)
4. **Close duplicate tabs** automatically
5. **Provide feedback** on the number of tabs closed

## Permissions Required

The extension requires the following Chrome permissions:

- **`tabs`** - To access and manage browser tabs
- **`activeTab`** - To interact with the currently active tab

These permissions are necessary for the extension to detect and close duplicate tabs.

## Troubleshooting

### Extension doesn't appear after loading
- Make sure all required files are in the same folder
- Check that Developer mode is enabled in `chrome://extensions/`
- Verify the `manifest.json` file is properly formatted

### "Extensions" page won't load
- Type `chrome://extensions/` directly in the address bar
- Make sure you're using Google Chrome (not another browser)

### Extension icon is missing
- Either add icon files (`icon16.png`, `icon48.png`, `icon128.png`) to your folder
- Or remove the entire `"icons"` section from `manifest.json`

### No duplicates found when you expect them
- The extension compares exact URLs, including parameters
- `https://example.com` and `https://example.com/` are considered different
- Query parameters make URLs unique (e.g., `?utm_source=google`)

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve this extension.

## License

This project is open source and available under the [MIT License](LICENSE).

## Version History

- **v1.0** - Initial release
  - Basic duplicate tab detection and closing
  - Simple popup interface
  - Status feedback

---

**Note**: This extension is designed for personal use and development purposes. Always review code before installing browser extensions, especially in developer mode.
