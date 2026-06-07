// Background script for the Duplicate Tab Closer extension
// This runs in the background and handles extension lifecycle events

importScripts('tabs.js');

chrome.runtime.onInstalled.addListener(() => {
    console.log('Duplicate Tab Closer extension installed');
});

// Keyboard shortcut support: run the same sort + dedup action as the popup
chrome.commands.onCommand.addListener((command) => {
    if (command === 'close-duplicates') {
        cleanUpTabs();
    }
});

async function cleanUpTabs() {
    try {
        const { sortMode } = await chrome.storage.local.get('sortMode');
        const mode = sortMode || 'url';

        // Background runs without a focused tab, so target the last-focused window.
        const windowQuery = { lastFocusedWindow: true };
        const closedCount = await closeDuplicateTabs(windowQuery);
        const sortedCount = await sortTabs(mode, windowQuery);

        console.log(`Closed ${closedCount} duplicate tabs, sorted ${sortedCount} tabs by ${mode}`);
    } catch (error) {
        console.error('Error cleaning up tabs:', error);
    }
}
