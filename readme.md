# Duplicate Tab Closer

A Chrome extension (Manifest V3) that closes duplicate tabs and sorts the
remaining tabs. Run it from the popup button or with the keyboard shortcut
(`Ctrl+Shift+S`, `Cmd+Shift+S` on macOS).

## Behavior

- Operates on the **current window only**.
- **Dedup:** tabs with identical URLs are duplicates. The oldest tab (lowest tab
  id) per URL is kept; the rest are closed. URLs are compared exactly, including
  the trailing slash and query parameters.
- **Sort:** the remaining tabs are sorted by the selected mode:
  - `URL` — alphabetically by URL.
  - `Recent usage` — by last-access time, least recently used first (most
    recently used last).
- Pinned tabs are left untouched — they keep their position and order; only the
  unpinned tabs are sorted.
- The selected sort mode is persisted and reused, including for the shortcut.
- A second shortcut (`Ctrl+Shift+D`, `Cmd+Shift+D` on macOS) switches the sort
  mode (URL ⇄ Recent usage) and then runs dedup + sort with the new mode.

## Install

1. Open `chrome://extensions/` and enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
