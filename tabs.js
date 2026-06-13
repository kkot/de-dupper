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

// Compare function for a given sort mode. 'recent' orders by last-accessed
// time; anything else (default 'url') orders alphabetically by URL.
function getCompare(mode) {
    return mode === 'recent'
        ? (a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0)
        : (a, b) => (a.url || '').localeCompare(b.url || '');
}

// The contiguous-segment key for a tab. Tabs are split into segments that must
// never be reordered across one another: the pinned block, each tab group, and
// each run of ungrouped tabs. groupId is -1 (or undefined on browsers without
// tab groups) when a tab is ungrouped.
function segmentKeyFor(tab) {
    return tab.pinned
        ? 'pinned'
        : (tab.groupId !== undefined && tab.groupId !== -1)
            ? `group:${tab.groupId}`
            : 'ungrouped';
}

// Pure planning step: given the tabs to sort and a mode, return the list of
// { id, index } moves needed to sort them. No chrome API access, so this is
// what the unit tests exercise.
//
// Tab indices are window-scoped, so each window is sorted independently. Within
// a window, only *within* a segment is sorted — moving a grouped tab outside
// its group's index range is exactly what pulls it out of the group. Pinned
// tabs are left untouched.
//
// Each tab in a non-pinned segment produces a move (even if it doesn't change
// position), so moves.length equals the number of tabs that were sorted.
function planTabMoves(tabs, mode) {
    const compare = getCompare(mode);
    const moves = [];

    const windowGroups = {};
    tabs.forEach(tab => {
        if (!windowGroups[tab.windowId]) {
            windowGroups[tab.windowId] = [];
        }
        windowGroups[tab.windowId].push(tab);
    });

    for (const windowTabs of Object.values(windowGroups)) {
        windowTabs.sort((a, b) => a.index - b.index);

        let segment = [];
        let segmentKey = null;
        const flushSegment = () => {
            if (segment.length && segmentKey !== 'pinned') {
                const start = segment[0].index;
                const sorted = [...segment].sort(compare);
                for (let i = 0; i < sorted.length; i++) {
                    moves.push({ id: sorted[i].id, index: start + i });
                }
            }
            segment = [];
        };

        for (const tab of windowTabs) {
            const key = segmentKeyFor(tab);
            if (key !== segmentKey) {
                flushSegment();
                segmentKey = key;
            }
            segment.push(tab);
        }
        flushSegment();
    }

    return moves;
}

async function sortTabs(mode, windowQuery) {
    const tabs = await chrome.tabs.query(windowQuery);
    const moves = planTabMoves(tabs, mode);
    for (const move of moves) {
        await chrome.tabs.move(move.id, { index: move.index });
    }
    return moves.length;
}

// Exported for unit tests (Node). In the browser there is no module system, so
// this block is skipped and the functions stay as plain script-scope globals.
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getCompare, segmentKeyFor, planTabMoves };
}
