document.addEventListener('DOMContentLoaded', function() {
    const button = document.getElementById('cleanUp');
    const sortMode = document.getElementById('sortMode');
    const status = document.getElementById('status');

    button.addEventListener('click', cleanUpTabs);

    // Restore the persisted sort mode (default: 'url')
    chrome.storage.local.get('sortMode', (data) => {
        if (data.sortMode) {
            sortMode.value = data.sortMode;
        }
    });

    // Persist the sort mode whenever it changes
    sortMode.addEventListener('change', () => {
        chrome.storage.local.set({ sortMode: sortMode.value });
    });

    async function cleanUpTabs() {
        try {
            button.disabled = true;
            button.textContent = 'Processing...';

            const mode = sortMode.value;

            // 1. Close duplicate tabs (keep the oldest tab per URL)
            const closedCount = await closeDuplicateTabs();

            // 2. Sort the remaining tabs by the selected mode
            const sortedCount = await sortTabs(mode);

            const label = mode === 'recent' ? 'recent usage' : 'URL';
            const closedMsg = closedCount > 0
                ? `Closed ${closedCount} duplicate${closedCount === 1 ? '' : 's'}, `
                : 'No duplicates, ';
            showStatus(`${closedMsg}sorted ${sortedCount} tab${sortedCount === 1 ? '' : 's'} by ${label}`, 'success');
        } catch (error) {
            console.error('Error cleaning up tabs:', error);
            showStatus('Error occurred while cleaning up tabs', 'error');
        } finally {
            button.disabled = false;
            button.textContent = 'Sort & Close Duplicates';
        }
    }

    async function closeDuplicateTabs() {
        const tabs = await chrome.tabs.query({ currentWindow: true });

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

    async function sortTabs(mode) {
        const compare = mode === 'recent'
            ? (a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)
            : (a, b) => (a.url || '').localeCompare(b.url || '');

        // Get tabs in the current window only (tab indices are window-scoped)
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const windowGroups = {};
        tabs.forEach(tab => {
            if (!windowGroups[tab.windowId]) {
                windowGroups[tab.windowId] = [];
            }
            windowGroups[tab.windowId].push(tab);
        });

        // Sort each window. Pinned tabs must stay before unpinned ones, so each
        // group is sorted independently and the pinned block is kept at the front.
        let sortedCount = 0;
        for (const group of Object.values(windowGroups)) {
            const pinned = group.filter(t => t.pinned).sort(compare);
            const unpinned = group.filter(t => !t.pinned).sort(compare);
            const ordered = [...pinned, ...unpinned];

            for (let index = 0; index < ordered.length; index++) {
                await chrome.tabs.move(ordered[index].id, { index });
            }
            sortedCount += ordered.length;
        }
        return sortedCount;
    }

    function showStatus(message, type) {
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';

        // Hide status after 3 seconds
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }
});
