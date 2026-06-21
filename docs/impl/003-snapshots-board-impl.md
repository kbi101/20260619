# 003 Snapshots Board — Implementation Details

## Status
- [x] Electron Main Process (`electron/main.ts`) — Custom date routing, getAvailableDates scanning, native clipboard buffer & Finder file parsing
- [x] Preload APIs (`electron/preload.ts`) — Exposed `saveSnapshot`, `readClipboardImage`, `getAvailableDates` bindings
- [x] SnapshotsBoard React UI (`src/components/snapshots/SnapshotsBoard.tsx`) — Sidebar date selector, consolidated week checkbox, "Copy to Today" canvas actions, drag/drop overlay triggers
- [x] Window dimensions (`electron/main.ts`) — Default sizes scaled up to macOS 2560x1440 optimized layouts
- [x] TypeScript validation (`pnpm run typecheck`) — All checks pass cleanly
- [x] Bundle compiles successfully (`pnpm run build`) — Production assets verified

---

## Implementation Details

### 1. Main Process File APIs & Folder Watcher
**File:** `workspace-ui/electron/main.ts`
- **Dynamic Date Directory Routing:** Added `getDirForDate(date)` helper. `snapshots:list` and `snapshots:read` were modified to route requests dynamically to past date folders when a parameter is provided.
- **Historical Date Scanning (`snapshots:get-dates`):** Scans the parent directory `/Users/kepingbi/Data/QuantEdge` for subfolders matching `\d{8}`, automatically injecting the current local date (today) and sorting descending (latest first).
- **Snapshot Writing (`snapshots:save`):** Checks and creates today's target folder recursively. Decodes incoming base64 data URLs to binary buffers, sanitizing file categories to lowercase alphanumeric patterns.
- **Native Clipboard Reading (`clipboard:read-image`):** Uses Electron's native clipboard modules. If the clipboard holds an image buffer (from screenshots or web copying), reads it as base64. If it contains Finder file references (from screenshot files on Desktop copied to clipboard), reads the path natively and loads the file buffer directly.

### 2. Preload API Secure Bridge
**File:** `workspace-ui/electron/preload.ts`
- Exposed new endpoints to the window's `electronAPI` bridge:
  - `saveSnapshot`
  - `readClipboardImage`
  - `getAvailableDates`
- Enriched `getSnapshots` and `readSnapshot` to support the optional date string parameter.

### 3. Frontend App Integrations
**File:** `workspace-ui/src/App.tsx`
- Preserved Title Bar launchers and hash routing integrations.

### 4. Snapshots Board Component
**File:** `workspace-ui/src/components/snapshots/SnapshotsBoard.tsx`
- **State Hooks:** Implemented `selectedDate`, `availableDates`, and `showWeek` states.
- **Sidebar Date Selector Dropdown:** Integrated a select dropdown directly in the Categories panel with human-readable tags (e.g. "Today", "Yesterday"). Disabled during range views.
- **Consolidated Week View:** Integrated a checkbox toggle below the dropdown. When checked, maps and triggers parallel `Promise.all` fetches across the 7 latest dates, flat-merging and sorting them chronologically.
- **Timeline Date Tags:** Timeline nodes render discrete `MM/DD` badges when the weekly view is active.
- **Copy to Today Action:** Added a toolbar button visible on past snapshots. It retrieves the base64 content of the historical snap, opens the categorization modal, and redirects the selector view to **Today** once saved.
- **Keyboard Paste & Drag Zone:** Intercepts `paste` events natively. Added full dropzone event listening with a fullscreen dashed target overlay.
- **Sizing Adjustments:** Scaled the default Electron window widths and heights to match 2560x1440 resolutions.
  - Workspace: 2560x1440
  - Intel: 1600x1000
  - Snapshots: 1920x1080

---

## File Manifest

| File | Type | Description |
|---|---|---|
| `workspace-ui/electron/main.ts` | Modified | Window sizes, IPC endpoints, date folder scanning, native clipboard buffer reading |
| `workspace-ui/electron/preload.ts` | Modified | Secure preload bridges and type definitions |
| `workspace-ui/src/components/snapshots/SnapshotsBoard.tsx` | Modified | Date select dropdown, checkbox, timeline badges, drag overlay, paste events, upload hooks |
| `docs/spec/003-snapshots-board.md` | Modified | Technical Specification |
| `docs/impl/003-snapshots-board-impl.md` | Modified | Implementation details documentation |

---

## Verification Results

### Build & Type Verification
```bash
# Verify TypeScript compiles with no emits
pnpm run typecheck

# Verify bundler output builds successfully
pnpm run build
```
- Both validation checks pass successfully with zero warnings or errors.
