// Shared tab logic used by both the popup and the background service worker.
//
// Both contexts target the window the user is looking at, but express it
// differently because they run in different places:
//   - popup      -> { currentWindow: true }      (window the popup is attached to)
//   - background -> { lastFocusedWindow: true }   (a service worker has no
//                                                  "current" window, so it uses
//                                                  the most recently focused one)

async function closeDuplicateTabs(windowQuery) {
    const tabs = await chrome.tabs.query(windowQuery);

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

async function sortTabs(mode, windowQuery) {
    const compare = mode === 'recent'
        ? (a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0)
        : (a, b) => (a.url || '').localeCompare(b.url || '');

    // Tab indices are window-scoped, so sort within each window separately.
    const tabs = await chrome.tabs.query(windowQuery);
    const windowGroups = {};
    tabs.forEach(tab => {
        if (!windowGroups[tab.windowId]) {
            windowGroups[tab.windowId] = [];
        }
        windowGroups[tab.windowId].push(tab);
    });

    // Sort each window. Pinned tabs are left exactly where they are; only the
    // unpinned tabs are sorted and moved into place after the pinned block.
    let sortedCount = 0;
    for (const group of Object.values(windowGroups)) {
        const pinnedCount = group.filter(t => t.pinned).length;
        const unpinned = group.filter(t => !t.pinned).sort(compare);

        for (let i = 0; i < unpinned.length; i++) {
            await chrome.tabs.move(unpinned[i].id, { index: pinnedCount + i });
        }
        sortedCount += unpinned.length;
    }
    return sortedCount;
}
