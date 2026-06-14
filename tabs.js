// Shared tab logic for the popup ({ currentWindow }) and the background service
// worker ({ lastFocusedWindow }, since a worker has no "current" window).

// Show the active sort mode as a toolbar badge.
function updateModeBadge(mode) {
    const isRecent = mode === 'recent';
    chrome.action.setBadgeText({ text: isRecent ? 'REC' : 'URL' });
    chrome.action.setBadgeBackgroundColor({ color: isRecent ? '#34a853' : '#4285f4' });
}

// Group by exact URL; keep the oldest tab (lowest id) per URL, return the rest.
function planDuplicatesToClose(tabs) {
    const urlGroups = {};
    tabs.forEach(tab => {
        if (!urlGroups[tab.url]) {
            urlGroups[tab.url] = [];
        }
        urlGroups[tab.url].push(tab);
    });

    const idsToClose = [];
    Object.values(urlGroups).forEach(group => {
        if (group.length > 1) {
            group.sort((a, b) => a.id - b.id);
            for (let i = 1; i < group.length; i++) {
                idsToClose.push(group[i].id);
            }
        }
    });
    return idsToClose;
}

async function closeDuplicateTabs(windowQuery) {
    const tabs = await chrome.tabs.query(windowQuery);
    const idsToClose = planDuplicatesToClose(tabs);
    if (idsToClose.length > 0) {
        await chrome.tabs.remove(idsToClose);
    }
    return idsToClose.length;
}

// 'recent' sorts by last-accessed time (oldest first); else alphabetically by URL.
function getCompare(mode) {
    return mode === 'recent'
        ? (a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0)
        : (a, b) => (a.url || '').localeCompare(b.url || '');
}

// Segment key: tabs are sorted within, never across, these — the pinned block,
// each tab group, and each run of ungrouped tabs (groupId -1 or undefined).
function segmentKeyFor(tab) {
    return tab.pinned
        ? 'pinned'
        : (tab.groupId !== undefined && tab.groupId !== -1)
            ? `group:${tab.groupId}`
            : 'ungrouped';
}

// Plan the moves to sort each window's tabs. Returns one { index, ids } per
// non-pinned segment: its tabs in sorted order, placed starting at index.
// Windows are independent; pinned tabs are left untouched.
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
                const ids = [...segment].sort(compare).map(tab => tab.id);
                moves.push({ index: start, ids });
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
    let sortedCount = 0;
    // One move call per segment; in-place moves don't shift other segments.
    for (const move of moves) {
        await chrome.tabs.move(move.ids, { index: move.index });
        sortedCount += move.ids.length;
    }
    return sortedCount;
}

// Exported for Node unit tests; skipped in the browser (no module system).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getCompare, segmentKeyFor, planTabMoves, planDuplicatesToClose, closeDuplicateTabs, sortTabs };
}
