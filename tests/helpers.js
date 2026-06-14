// Shared test fixtures. Build a tab/group with sensible defaults; override only
// what a test cares about.
function tab(overrides) {
    return {
        id: 1,
        windowId: 1,
        index: 0,
        url: 'https://example.com/',
        title: '',
        pinned: false,
        groupId: -1,
        lastAccessed: 0,
        ...overrides,
    };
}

// Build a tab group (shape returned by chrome.tabGroups.query).
function group(overrides) {
    return { id: 100, windowId: 1, title: '', ...overrides };
}

module.exports = { tab, group };
