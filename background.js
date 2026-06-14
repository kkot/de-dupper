// Service worker: badge upkeep and keyboard-shortcut handling.

importScripts('tabs.js', 'groups.js', 'cleanup.js');

// Show the active sort mode as a toolbar badge.
function updateModeBadge(mode) {
    const isRecent = mode === 'recent';
    chrome.action.setBadgeText({ text: isRecent ? 'REC' : 'URL' });
    chrome.action.setBadgeBackgroundColor({ color: isRecent ? '#34a853' : '#4285f4' });
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('Duplicate Tab Closer extension installed');
    refreshModeBadge();
});

// Re-apply the badge when the worker spins back up.
chrome.runtime.onStartup.addListener(refreshModeBadge);

// Keep the badge in sync with any sort-mode change.
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.sortMode) {
        updateModeBadge(changes.sortMode.newValue);
    }
});

async function refreshModeBadge() {
    const { sortMode } = await chrome.storage.local.get('sortMode');
    updateModeBadge(sortMode || 'url');
}

chrome.commands.onCommand.addListener((command) => {
    if (command === 'close-duplicates') {
        cleanUpTabs();
    } else if (command === 'toggle-sort-and-clean') {
        cleanUpTabs({ toggleMode: true });
    }
});

let cleanupInProgress = false;

async function cleanUpTabs({ toggleMode = false } = {}) {
    // Skip overlapping runs so rapid shortcut presses don't race each other.
    if (cleanupInProgress) {
        return;
    }
    cleanupInProgress = true;
    try {
        const { sortMode } = await chrome.storage.local.get('sortMode');
        let mode = sortMode || 'url';

        if (toggleMode) {
            mode = mode === 'url' ? 'recent' : 'url';
            await chrome.storage.local.set({ sortMode: mode });
        }

        const windowQuery = { lastFocusedWindow: true };
        const { groupedCount, closedCount, sortedCount } = await runCleanup(mode, windowQuery);

        console.log(`Closed ${closedCount} duplicate tabs, grouped ${groupedCount} tabs, sorted ${sortedCount} tabs by ${mode}`);
    } catch (error) {
        console.error('Error cleaning up tabs:', error);
    } finally {
        cleanupInProgress = false;
    }
}
