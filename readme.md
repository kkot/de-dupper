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
  - `Recent usage` — most recently accessed first.
- Pinned tabs stay at the front of the window and are sorted among themselves.
- The selected sort mode is persisted and reused, including for the shortcut.

## Install

1. Open `chrome://extensions/` and enable **Developer mode**.
2. Click **Load unpacked** and select this folder.
