// Integration tests for runCleanup's ordering (cleanup.js), driven against a
// minimal chrome mock that models Chrome auto-deleting a group once it's empty.
// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');

const { runCleanup } = require('../cleanup.js');
const { tab } = require('./helpers');

// Install a fake chrome backed by `store`, mutated the way Chrome would.
function installChrome(store) {
    globalThis.chrome = {
        tabs: {
            query: async () => store.tabs.map(t => ({ ...t })),
            group: async ({ groupId, tabIds }) => {
                for (const id of tabIds) {
                    const t = store.tabs.find(x => x.id === id);
                    if (t) t.groupId = groupId;
                }
            },
            remove: async (ids) => {
                const arr = Array.isArray(ids) ? ids : [ids];
                store.tabs = store.tabs.filter(t => !arr.includes(t.id));
                // Chrome removes a tab group automatically once it has no tabs.
                store.groups = store.groups.filter(g => store.tabs.some(t => t.groupId === g.id));
            },
            move: async () => {}, // sort order is irrelevant to these assertions
        },
        tabGroups: {
            query: async ({ windowId }) =>
                store.groups.filter(g => g.windowId === windowId).map(g => ({ ...g })),
        },
    };
}

test('runCleanup: magnet group survives dedup that would remove its only (placeholder) tab', async () => {
    // Group /github/ holds just a placeholder New Tab (id 5). An ungrouped New
    // Tab (id 3) shares its URL, so dedup keeps id 3 and closes id 5 — which
    // would empty and delete the group. Grouping runs first, moving the matching
    // github tab (id 2) in, so the group still has a tab and survives.
    const store = {
        groups: [{ id: 100, windowId: 1, title: '/github/' }],
        tabs: [
            tab({ id: 5, index: 0, url: 'chrome://newtab/', title: 'New Tab', groupId: 100 }),
            tab({ id: 2, index: 1, url: 'https://github.com/x' }),
            tab({ id: 3, index: 2, url: 'chrome://newtab/', title: 'New Tab' }),
        ],
    };
    installChrome(store);

    const counts = await runCleanup('url', { currentWindow: true });

    assert.equal(counts.groupedCount, 1);
    assert.equal(counts.closedCount, 1);
    // The group still exists and now holds the matching github tab.
    assert.ok(store.groups.some(g => g.id === 100), 'magnet group should survive');
    assert.deepEqual(store.tabs.filter(t => t.groupId === 100).map(t => t.id), [2]);
    // The placeholder New Tab (higher id) was the duplicate that got closed.
    assert.deepEqual(store.tabs.map(t => t.id).sort((a, b) => a - b), [2, 3]);
});
