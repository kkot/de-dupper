// Background script for the Duplicate Tab Closer extension
// This runs in the background and handles extension lifecycle events

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

        const closedCount = await closeDuplicateTabs();
        const sortedCount = await sortTabs(mode);

        console.log(`Closed ${closedCount} duplicate tabs, sorted ${sortedCount} tabs by ${mode}`);
    } catch (error) {
        console.error('Error cleaning up tabs:', error);
    }
}

async function closeDuplicateTabs() {
    const tabs = await chrome.tabs.query({});

    // Group tabs by URL
    const urlGroups = {};
    tabs.forEach(tab => {
        if (!urlGroups[tab.url]) {
            urlGroups[tab.url] = [];
        }
        urlGroups[tab.url].push(tab);
    });

    // Keep the oldest tab (lowest id) per URL, close the rest
    const tabsToClose = [];
    Object.values(urlGroups).forEach(group => {
        if (group.length > 1) {
            group.sort((a, b) => a.id - b.id);
            for (let i = 1; i < group.length; i++) {
                tabsToClose.push(group[i].id);
            }
        }
    });

    if (tabsToClose.length > 0) {
        await chrome.tabs.remove(tabsToClose);
    }
    return tabsToClose.length;
}

async function sortTabs(mode) {
    const compare = mode === 'recent'
        ? (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)
        : (a, b) => (a.url || '').localeCompare(b.url || '');

    // Get all tabs and group them by window (tab indices are window-scoped)
    const tabs = await chrome.tabs.query({});
    const windowGroups = {};
    tabs.forEach(tab => {
        if (!windowGroups[tab.windowId]) {
            windowGroups[tab.windowId] = [];
        }
        windowGroups[tab.windowId].push(tab);
    });

    // Sort each window. Pinned tabs must stay before unpinned ones, so each
    // group is sorted independently and the pinned block is kept at the front.
    let sortedCount = 0;
    for (const group of Object.values(windowGroups)) {
        const pinned = group.filter(t => t.pinned).sort(compare);
        const unpinned = group.filter(t => !t.pinned).sort(compare);
        const ordered = [...pinned, ...unpinned];

        for (let index = 0; index < ordered.length; index++) {
            await chrome.tabs.move(ordered[index].id, { index });
        }
        sortedCount += ordered.length;
    }
    return sortedCount;
}
