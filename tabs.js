// Shared tab logic used by both the popup and the background service worker.
//
// Both contexts target the window the user is looking at, but express it
// differently because they run in different places:
//   - popup      -> { currentWindow: true }      (window the popup is attached to)
//   - background -> { lastFocusedWindow: true }   (a service worker has no
//                                                  "current" window, so it uses
//                                                  the most recently focused one)

// Reflect the active sort mode on the toolbar icon as a short badge so the
// current mode is visible without opening the popup.
function updateModeBadge(mode) {
    const isRecent = mode === 'recent';
    chrome.action.setBadgeText({ text: isRecent ? 'REC' : 'URL' });
    chrome.action.setBadgeBackgroundColor({ color: isRecent ? '#34a853' : '#4285f4' });
}

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

    // Sort each window in place. Tabs are split into contiguous segments that
    // must never be reordered across one another: the pinned block, each tab
    // group, and each run of ungrouped tabs. We only sort *within* a segment,
    // because moving a grouped tab outside its group's index range is exactly
    // what pulls it out of the group. Pinned tabs are left untouched.
    let sortedCount = 0;
    for (const windowTabs of Object.values(windowGroups)) {
        windowTabs.sort((a, b) => a.index - b.index);

        let segment = [];
        let segmentKey = null;
        const flushSegment = async () => {
            if (segment.length && segmentKey !== 'pinned') {
                const start = segment[0].index;
                const sorted = [...segment].sort(compare);
                for (let i = 0; i < sorted.length; i++) {
                    await chrome.tabs.move(sorted[i].id, { index: start + i });
                }
                sortedCount += sorted.length;
            }
            segment = [];
        };

        for (const tab of windowTabs) {
            // groupId is -1 (or undefined on browsers without tab groups) when
            // a tab is ungrouped.
            const key = tab.pinned
                ? 'pinned'
                : (tab.groupId !== undefined && tab.groupId !== -1)
                    ? `group:${tab.groupId}`
                    : 'ungrouped';
            if (key !== segmentKey) {
                await flushSegment();
                segmentKey = key;
            }
            segment.push(tab);
        }
        await flushSegment();
    }
    return sortedCount;
}
