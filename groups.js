// Magnet groups: a tab group whose title is wrapped in slashes (e.g. /github\.com/)
// reads the inner text as a regex; any ungrouped, non-pinned tab in the same
// window whose URL or title matches is pulled into that group. Shared by the
// popup and the background service worker.

// segmentKeyFor lives in tabs.js — a global in the browser, a module export in
// Node tests. Resolve it without assuming a module system.
const segmentKey = (typeof module !== 'undefined' && module.exports)
    ? require('./tabs.js').segmentKeyFor
    : segmentKeyFor;

// Plan which ungrouped tabs get pulled into magnet groups. Returns one
// { groupId, tabIds } per group that gained tabs. First matching group wins.
function planTabsToGroup(tabs, groups) {
    const magnets = [];
    for (const group of groups) {
        const parsed = /^\/(.*)\/([a-z]*)$/.exec(group.title || '');
        if (!parsed || parsed[1] === '') {
            continue;
        }
        // Always case-insensitive; merge with any flags from the title (no dupes).
        const flags = [...new Set('i' + parsed[2])].join('');
        try {
            magnets.push({ groupId: group.id, windowId: group.windowId, regex: new RegExp(parsed[1], flags) });
        } catch (e) {
            // Invalid regex in the title: skip this group.
        }
    }

    const assignments = new Map(); // groupId -> tabIds
    for (const tab of tabs) {
        if (segmentKey(tab) !== 'ungrouped') {
            continue;
        }
        const magnet = magnets.find(m =>
            m.windowId === tab.windowId &&
            (m.regex.test(tab.url || '') || m.regex.test(tab.title || ''))
        );
        if (magnet) {
            if (!assignments.has(magnet.groupId)) {
                assignments.set(magnet.groupId, []);
            }
            assignments.get(magnet.groupId).push(tab.id);
        }
    }

    return [...assignments].map(([groupId, tabIds]) => ({ groupId, tabIds }));
}

async function groupMatchingTabs(windowQuery) {
    const tabs = await chrome.tabs.query(windowQuery);
    const windowIds = [...new Set(tabs.map(t => t.windowId))];
    const groups = (await Promise.all(
        windowIds.map(windowId => chrome.tabGroups.query({ windowId }))
    )).flat();
    const plan = planTabsToGroup(tabs, groups);
    let groupedCount = 0;
    for (const { groupId, tabIds } of plan) {
        await chrome.tabs.group({ groupId, tabIds });
        groupedCount += tabIds.length;
    }
    return groupedCount;
}

// Exported for Node unit tests; skipped in the browser (no module system).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { planTabsToGroup };
}
