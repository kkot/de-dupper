// Background script for the Duplicate Tab Closer extension
// This runs in the background and handles extension lifecycle events

importScripts('tabs.js');

chrome.runtime.onInstalled.addListener(() => {
    console.log('Duplicate Tab Closer extension installed');
    refreshModeBadge();
});

// Re-apply the badge when the worker spins back up (browser start, wake-up).
chrome.runtime.onStartup.addListener(refreshModeBadge);

// Keep the badge in sync with whatever changes the sort mode: the popup
// dropdown, the toggle shortcut, anything that writes to storage.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.sortMode) {
        updateModeBadge(changes.sortMode.newValue);
    }
});

async function refreshModeBadge() {
    const { sortMode } = await chrome.storage.local.get('sortMode');
    updateModeBadge(sortMode || 'url');
}

// Keyboard shortcut support: run the same sort + dedup action as the popup
chrome.commands.onCommand.addListener((command) => {
    if (command === 'close-duplicates') {
        cleanUpTabs();
    } else if (command === 'toggle-sort-and-clean') {
        cleanUpTabs({ toggleMode: true });
    }
});

async function cleanUpTabs({ toggleMode = false } = {}) {
    try {
        const { sortMode } = await chrome.storage.local.get('sortMode');
        let mode = sortMode || 'url';

        // Switch the sort mode and persist it so the popup reflects the change.
        if (toggleMode) {
            mode = mode === 'url' ? 'recent' : 'url';
            await chrome.storage.local.set({ sortMode: mode });
        }

        // Background runs without a focused tab, so target the last-focused window.
        const windowQuery = { lastFocusedWindow: true };
        const closedCount = await closeDuplicateTabs(windowQuery);
        const sortedCount = await sortTabs(mode, windowQuery);

        console.log(`Closed ${closedCount} duplicate tabs, sorted ${sortedCount} tabs by ${mode}`);
    } catch (error) {
        console.error('Error cleaning up tabs:', error);
    }
}
