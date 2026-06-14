// Unit tests for the magnet-group logic in groups.js.
// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');

const { planTabsToGroup } = require('../groups.js');
const { tab, group } = require('./helpers');

test('planTabsToGroup: ungrouped tab matching by url is pulled into the group', () => {
    const tabs = [
        tab({ id: 1, url: 'https://github.com/foo' }),
        tab({ id: 2, url: 'https://example.com/' }),
    ];
    const groups = [group({ id: 100, title: '/github\\.com/' })];
    assert.deepEqual(planTabsToGroup(tabs, groups), [{ groupId: 100, tabIds: [1] }]);
});

test('planTabsToGroup: matches by title when url does not match', () => {
    const tabs = [
        tab({ id: 1, url: 'https://example.com/', title: 'My GitHub dashboard' }),
    ];
    const groups = [group({ id: 100, title: '/GitHub/' })];
    assert.deepEqual(planTabsToGroup(tabs, groups), [{ groupId: 100, tabIds: [1] }]);
});

test('planTabsToGroup: matching is case-insensitive by default', () => {
    const tabs = [tab({ id: 1, url: 'https://GITHUB.com/' })];
    const groups = [group({ id: 100, title: '/github/' })];
    assert.deepEqual(planTabsToGroup(tabs, groups), [{ groupId: 100, tabIds: [1] }]);
});

test('planTabsToGroup: regex flags in the title are honored', () => {
    const tabs = [tab({ id: 1, url: 'https://example.com/', title: 'github' })];
    const groups = [group({ id: 100, title: '/GITHUB/i' })];
    assert.deepEqual(planTabsToGroup(tabs, groups), [{ groupId: 100, tabIds: [1] }]);
});

test('planTabsToGroup: non-matching ungrouped tabs are left alone', () => {
    const tabs = [tab({ id: 1, url: 'https://example.com/' })];
    const groups = [group({ id: 100, title: '/github/' })];
    assert.deepEqual(planTabsToGroup(tabs, groups), []);
});

test('planTabsToGroup: already-grouped and pinned tabs are never moved', () => {
    const tabs = [
        tab({ id: 1, url: 'https://github.com/a', groupId: 50 }),
        tab({ id: 2, url: 'https://github.com/b', pinned: true }),
    ];
    const groups = [group({ id: 100, title: '/github/' })];
    assert.deepEqual(planTabsToGroup(tabs, groups), []);
});

test('planTabsToGroup: titles not wrapped in slashes are ignored', () => {
    const tabs = [tab({ id: 1, url: 'https://github.com/' })];
    const groups = [group({ id: 100, title: 'github' })];
    assert.deepEqual(planTabsToGroup(tabs, groups), []);
});

test('planTabsToGroup: empty pattern // is ignored', () => {
    const tabs = [tab({ id: 1, url: 'https://github.com/' })];
    const groups = [group({ id: 100, title: '//' })];
    assert.deepEqual(planTabsToGroup(tabs, groups), []);
});

test('planTabsToGroup: invalid regex in title is skipped without throwing', () => {
    const tabs = [tab({ id: 1, url: 'https://github.com/' })];
    const groups = [group({ id: 100, title: '/[/' })];
    assert.deepEqual(planTabsToGroup(tabs, groups), []);
});

test('planTabsToGroup: a tab joins only the first matching group', () => {
    const tabs = [tab({ id: 1, url: 'https://github.com/' })];
    const groups = [
        group({ id: 100, title: '/github/' }),
        group({ id: 200, title: '/com/' }),
    ];
    assert.deepEqual(planTabsToGroup(tabs, groups), [{ groupId: 100, tabIds: [1] }]);
});

test('planTabsToGroup: groups and tabs in different windows do not cross-match', () => {
    const tabs = [
        tab({ id: 1, windowId: 1, url: 'https://github.com/' }),
        tab({ id: 2, windowId: 2, url: 'https://github.com/' }),
    ];
    const groups = [group({ id: 100, windowId: 1, title: '/github/' })];
    assert.deepEqual(planTabsToGroup(tabs, groups), [{ groupId: 100, tabIds: [1] }]);
});
