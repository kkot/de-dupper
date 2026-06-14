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
            const windowQuery = { currentWindow: true };

            // Group magnet tabs, dedup, then sort — see runCleanup for ordering.
            const { groupedCount, closedCount, sortedCount } = await runCleanup(mode, windowQuery);

            const label = mode === 'recent' ? 'recent usage' : 'URL';
            const closedMsg = closedCount > 0
                ? `Closed ${closedCount} duplicate${closedCount === 1 ? '' : 's'}, `
                : 'No duplicates, ';
            const groupedMsg = groupedCount > 0
                ? `grouped ${groupedCount} tab${groupedCount === 1 ? '' : 's'}, `
                : '';
            showStatus(`${closedMsg}${groupedMsg}sorted ${sortedCount} tab${sortedCount === 1 ? '' : 's'} by ${label}`, 'success');
        } catch (error) {
            console.error('Error cleaning up tabs:', error);
            showStatus('Error occurred while cleaning up tabs', 'error');
        } finally {
            button.disabled = false;
            button.textContent = 'Sort & Close Duplicates';
        }
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
