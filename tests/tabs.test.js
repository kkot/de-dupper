// Unit tests for the pure sorting logic in tabs.js.
// Run with: node --test
const test = require('node:test');
const assert = require('node:assert/strict');

const { getCompare, segmentKeyFor, planTabMoves, planDuplicatesToClose } = require('../tabs.js');

// Build a tab with sensible defaults; override only what a test cares about.
function tab(overrides) {
    return {
        id: 1,
        windowId: 1,
        index: 0,
        url: 'https://example.com/',
        pinned: false,
        groupId: -1,
        lastAccessed: 0,
        ...overrides,
    };
}

// Replay batch moves the way chrome does (remove, then reinsert at index) so
// tests can assert the final visible order rather than raw move ops.
function applyMoves(tabs, moves) {
    const order = [...tabs].sort((a, b) => a.index - b.index);
    for (const { index, ids } of moves) {
        const moved = ids.map(id => order.find(t => t.id === id));
        for (const m of moved) {
            order.splice(order.indexOf(m), 1);
        }
        order.splice(index, 0, ...moved);
    }
    return order.map(t => t.id);
}

// Total tabs sorted across all batch moves (what sortTabs returns).
function sortedCount(moves) {
    return moves.reduce((n, m) => n + m.ids.length, 0);
}

test('getCompare: url mode orders alphabetically by url', () => {
    const cmp = getCompare('url');
    assert.ok(cmp({ url: 'https://a.com' }, { url: 'https://b.com' }) < 0);
    assert.ok(cmp({ url: 'https://b.com' }, { url: 'https://a.com' }) > 0);
    assert.equal(cmp({ url: 'https://a.com' }, { url: 'https://a.com' }), 0);
});

test('getCompare: missing url sorts as empty string', () => {
    const cmp = getCompare('url');
    assert.ok(cmp({}, { url: 'https://a.com' }) < 0);
});

test('getCompare: recent mode orders by lastAccessed ascending', () => {
    const cmp = getCompare('recent');
    assert.ok(cmp({ lastAccessed: 100 }, { lastAccessed: 200 }) < 0);
    assert.ok(cmp({ lastAccessed: 200 }, { lastAccessed: 100 }) > 0);
});

test('getCompare: missing lastAccessed treated as 0', () => {
    const cmp = getCompare('recent');
    assert.ok(cmp({}, { lastAccessed: 5 }) < 0);
});

test('getCompare: unknown mode falls back to url ordering', () => {
    const cmp = getCompare('something-else');
    assert.ok(cmp({ url: 'https://a.com' }, { url: 'https://b.com' }) < 0);
});

test('segmentKeyFor: pinned tabs key as pinned regardless of group', () => {
    assert.equal(segmentKeyFor(tab({ pinned: true, groupId: 7 })), 'pinned');
});

test('segmentKeyFor: grouped tab keys by its group id', () => {
    assert.equal(segmentKeyFor(tab({ groupId: 7 })), 'group:7');
});

test('segmentKeyFor: ungrouped tab (-1 or undefined) keys as ungrouped', () => {
    assert.equal(segmentKeyFor(tab({ groupId: -1 })), 'ungrouped');
    assert.equal(segmentKeyFor(tab({ groupId: undefined })), 'ungrouped');
});

test('planTabMoves: sorts a simple ungrouped window by url', () => {
    const tabs = [
        tab({ id: 1, index: 0, url: 'https://c.com' }),
        tab({ id: 2, index: 1, url: 'https://a.com' }),
        tab({ id: 3, index: 2, url: 'https://b.com' }),
    ];
    const moves = planTabMoves(tabs, 'url');
    assert.deepEqual(applyMoves(tabs, moves), [2, 3, 1]);
    assert.equal(sortedCount(moves), 3);
});

test('planTabMoves: sorts by recent usage (oldest accessed first)', () => {
    const tabs = [
        tab({ id: 1, index: 0, lastAccessed: 300 }),
        tab({ id: 2, index: 1, lastAccessed: 100 }),
        tab({ id: 3, index: 2, lastAccessed: 200 }),
    ];
    const moves = planTabMoves(tabs, 'recent');
    assert.deepEqual(applyMoves(tabs, moves), [2, 3, 1]);
});

test('planTabMoves: pinned tabs are left untouched and not counted', () => {
    const tabs = [
        tab({ id: 1, index: 0, pinned: true, url: 'https://z.com' }),
        tab({ id: 2, index: 1, pinned: true, url: 'https://y.com' }),
        tab({ id: 3, index: 2, url: 'https://c.com' }),
        tab({ id: 4, index: 3, url: 'https://a.com' }),
    ];
    const moves = planTabMoves(tabs, 'url');
    // Only the two unpinned tabs are sorted; pinned block keeps z,y order.
    assert.equal(sortedCount(moves), 2);
    assert.deepEqual(applyMoves(tabs, moves), [1, 2, 4, 3]);
});

test('planTabMoves: each tab group is sorted within itself only', () => {
    const tabs = [
        tab({ id: 1, index: 0, groupId: 10, url: 'https://b.com' }),
        tab({ id: 2, index: 1, groupId: 10, url: 'https://a.com' }),
        tab({ id: 3, index: 2, groupId: 20, url: 'https://d.com' }),
        tab({ id: 4, index: 3, groupId: 20, url: 'https://c.com' }),
    ];
    const moves = planTabMoves(tabs, 'url');
    // Group 10 -> [2,1], group 20 -> [4,3]; groups never interleave.
    assert.deepEqual(applyMoves(tabs, moves), [2, 1, 4, 3]);
});

test('planTabMoves: a group is not reordered across surrounding ungrouped runs', () => {
    const tabs = [
        tab({ id: 1, index: 0, url: 'https://m.com' }),
        tab({ id: 2, index: 1, groupId: 5, url: 'https://b.com' }),
        tab({ id: 3, index: 2, groupId: 5, url: 'https://a.com' }),
        tab({ id: 4, index: 3, url: 'https://n.com' }),
    ];
    const moves = planTabMoves(tabs, 'url');
    // Ungrouped runs (single tabs) stay put; only the group's pair swaps.
    assert.deepEqual(applyMoves(tabs, moves), [1, 3, 2, 4]);
});

test('planTabMoves: two ungrouped runs split by a group sort independently', () => {
    const tabs = [
        tab({ id: 1, index: 0, url: 'https://q.com' }),
        tab({ id: 2, index: 1, url: 'https://p.com' }),
        tab({ id: 3, index: 2, groupId: 9, url: 'https://x.com' }),
        tab({ id: 4, index: 3, url: 'https://s.com' }),
        tab({ id: 5, index: 4, url: 'https://r.com' }),
    ];
    const moves = planTabMoves(tabs, 'url');
    // First run [1,2]->[2,1], group untouched (single), second run [4,5]->[5,4].
    assert.deepEqual(applyMoves(tabs, moves), [2, 1, 3, 5, 4]);
});

test('planTabMoves: windows are sorted independently', () => {
    const tabs = [
        tab({ id: 1, windowId: 1, index: 0, url: 'https://c.com' }),
        tab({ id: 2, windowId: 1, index: 1, url: 'https://a.com' }),
        tab({ id: 3, windowId: 2, index: 0, url: 'https://z.com' }),
        tab({ id: 4, windowId: 2, index: 1, url: 'https://m.com' }),
    ];
    const moves = planTabMoves(tabs, 'url');
    const w1 = tabs.filter(t => t.windowId === 1);
    const w2 = tabs.filter(t => t.windowId === 2);
    const w1Moves = moves.filter(m => m.ids.some(id => [1, 2].includes(id)));
    const w2Moves = moves.filter(m => m.ids.some(id => [3, 4].includes(id)));
    assert.deepEqual(applyMoves(w1, w1Moves), [2, 1]);
    assert.deepEqual(applyMoves(w2, w2Moves), [4, 3]);
});

test('planTabMoves: target indices are window-scoped (start from segment index)', () => {
    const tabs = [
        tab({ id: 3, windowId: 2, index: 0, url: 'https://z.com' }),
        tab({ id: 4, windowId: 2, index: 1, url: 'https://m.com' }),
    ];
    const moves = planTabMoves(tabs, 'url');
    // Window 2's segment still targets index 0, not a global offset.
    assert.deepEqual(moves, [{ index: 0, ids: [4, 3] }]);
});

test('planTabMoves: already-sorted tabs still produce an in-place move', () => {
    const tabs = [
        tab({ id: 1, index: 0, url: 'https://a.com' }),
        tab({ id: 2, index: 1, url: 'https://b.com' }),
    ];
    const moves = planTabMoves(tabs, 'url');
    assert.deepEqual(moves, [{ index: 0, ids: [1, 2] }]);
});

test('planTabMoves: empty input yields no moves', () => {
    assert.deepEqual(planTabMoves([], 'url'), []);
});

test('planDuplicatesToClose: no duplicates yields nothing to close', () => {
    const tabs = [
        tab({ id: 1, url: 'https://a.com' }),
        tab({ id: 2, url: 'https://b.com' }),
    ];
    assert.deepEqual(planDuplicatesToClose(tabs), []);
});

test('planDuplicatesToClose: keeps the lowest id and closes the rest', () => {
    const tabs = [
        tab({ id: 5, url: 'https://a.com' }),
        tab({ id: 2, url: 'https://a.com' }),
        tab({ id: 9, url: 'https://a.com' }),
    ];
    // Oldest tab (id 2) is kept; the two newer duplicates are closed.
    assert.deepEqual(planDuplicatesToClose(tabs), [5, 9]);
});

test('planDuplicatesToClose: lowest id wins regardless of array order', () => {
    const tabs = [
        tab({ id: 2, url: 'https://a.com' }),
        tab({ id: 1, url: 'https://a.com' }),
    ];
    assert.deepEqual(planDuplicatesToClose(tabs), [2]);
});

test('planDuplicatesToClose: dedups each url group independently', () => {
    const tabs = [
        tab({ id: 1, url: 'https://a.com' }),
        tab({ id: 2, url: 'https://a.com' }),
        tab({ id: 3, url: 'https://b.com' }),
        tab({ id: 4, url: 'https://b.com' }),
    ];
    assert.deepEqual(planDuplicatesToClose(tabs), [2, 4]);
});

test('planDuplicatesToClose: distinct query strings are not duplicates', () => {
    const tabs = [
        tab({ id: 1, url: 'https://a.com/?x=1' }),
        tab({ id: 2, url: 'https://a.com/?x=2' }),
    ];
    assert.deepEqual(planDuplicatesToClose(tabs), []);
});

test('planDuplicatesToClose: pinned status is ignored, lowest id still wins', () => {
    const tabs = [
        tab({ id: 5, pinned: true, url: 'https://a.com' }),
        tab({ id: 2, pinned: false, url: 'https://a.com' }),
    ];
    // Current behavior: dedup keys purely on URL, so the pinned tab (id 5) is
    // the one closed because it has the higher id.
    assert.deepEqual(planDuplicatesToClose(tabs), [5]);
});

test('planDuplicatesToClose: empty input yields nothing to close', () => {
    assert.deepEqual(planDuplicatesToClose([]), []);
});
