// Top-level cleanup orchestration: pull tabs into magnet groups, dedup, sort.
// Shared by the popup and the background service worker.

// groupMatchingTabs (groups.js) and the tabs.js helpers are globals in the
// browser (loaded first) and module exports in Node tests. Resolve them once
// without assuming a module system. Untaken ternary branches aren't evaluated,
// so the bare identifiers are safe in Node.
const isNode = (typeof module !== 'undefined' && module.exports);
const tabsApi = isNode ? require('./tabs.js') : null;
const groupsApi = isNode ? require('./groups.js') : null;
const closeDuplicates = isNode ? tabsApi.closeDuplicateTabs : closeDuplicateTabs;
const sortMatchingTabs = isNode ? tabsApi.sortTabs : sortTabs;
const groupTabs = isNode ? groupsApi.groupMatchingTabs : groupMatchingTabs;

// Run the full cleanup in the order that protects magnet groups: pull matching
// tabs into /regex/-titled groups FIRST, so a group whose only tab is a
// placeholder "New Tab" isn't emptied — and thus auto-deleted by Chrome — by the
// dedup step before its matching tabs are moved in. Then dedup, then sort.
async function runCleanup(mode, windowQuery) {
    const groupedCount = await groupTabs(windowQuery);
    const closedCount = await closeDuplicates(windowQuery);
    const sortedCount = await sortMatchingTabs(mode, windowQuery);
    return { groupedCount, closedCount, sortedCount };
}

// Exported for Node unit tests; skipped in the browser (no module system).
if (isNode) {
    module.exports = { runCleanup };
}
