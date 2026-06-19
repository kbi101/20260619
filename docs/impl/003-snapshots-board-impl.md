# 003 Snapshots Board — Implementation Details

## Status
- [x] Electron Main Process (`electron/main.ts`) — IPC handles & filesystem watch setup
- [x] Preload APIs (`electron/preload.ts`) — secure bindings exposed
- [x] Titlebar launch button & hash routing (`src/App.tsx`)
- [x] SnapshotsBoard React UI (`src/components/snapshots/SnapshotsBoard.tsx`) — tabs + timeline + zoom canvas
- [x] TypeScript validation (`pnpm run typecheck`) — resolved literal warning checks
- [x] Bundle compiles successfully (`pnpm run build`) — bundle verified

---

## Implementation Details

### 1. Main Process File APIs & Folder Watcher
**File:** `workspace-ui/electron/main.ts`
- Uses Node.js `fs` APIs to scan `/Users/kepingbi/Data/QuantEdge/[YYYYMMDD]`.
- Implemented file matching:
  - Primary regex: `/^(.*)_(\d{6})\.(png|jpg|jpeg|gif)$/i` matches custom categorized screenshots.
  - Fallback logic checks for standard extensions (`.png`, `.jpg`, `.jpeg`), mapping the filename to category and reading system `mtime` for timestamp information.
- Implemented folder watcher:
  - If today's directory does not exist, watches the parent directory for directory creation, with a 10s fallback timer loop.
  - Once today's directory is active, watches it for additions/deletions. When triggers fire, broadcasts `snapshots:updated` to all active windows.
- Handled IPC operations:
  - `snapshots:list`: Fetches sorted metadata.
  - `snapshots:read`: Validates path basename (preventing directory traversal attacks) and loads binary contents as `data:image/png;base64...` data URL.
- Added Snapshots window creation (`createSnapshotsWindow`), binding to shortcut `CmdOrCtrl+3` and Application Menu.

### 2. Preload API secure bridge
**File:** `workspace-ui/electron/preload.ts`
- Exposed the `electronAPI` methods to the frontend context bridge:
  - `openSnapshotsWindow`
  - `getSnapshots`
  - `readSnapshot`
  - `onSnapshotsUpdated`

### 3. Frontend App Integrations
**File:** `workspace-ui/src/App.tsx`
- Maps hash route `#/snapshots` to render `<SnapshotsBoard />`.
- Added Title Bar quick launch button.
- Cast custom CSS property literals (e.g. `WebkitAppRegion`) to `any` to allow TypeScript to compile successfully.

### 4. Snapshots Board Component
**File:** `workspace-ui/src/components/snapshots/SnapshotsBoard.tsx`
- Renders the dashboard in a three-column grid:
  - Left panel: Category tabs sorted with badge counts.
  - Center viewport: View canvas backing container displaying active base64 image data. Provides scaling controls and aspect-ratio toggles.
  - Right panel: Vertical chronological timeline connecting snapshots by visual path node lines.
- **Auto-Follow Mode**: Auto-focuses the latest capture in the selected category on directory watch broadcasts. Auto-follow is disabled if a trader selects a historical snapshot manually on the timeline.
- **Bug Resolution (Decoupling)**: Decatur-isolated component mount fetching and event subscription from category change states. Decoupling category changes from mount fetching prevents user tab selections from being overridden back to default categories on state updates.

---

## File Manifest

| File | Type | Description |
|---|---|---|
| `workspace-ui/electron/main.ts` | Modified | Core IPC handles, watcher, window menu triggers |
| `workspace-ui/electron/preload.ts` | Modified | Secure context isolation bindings |
| `workspace-ui/src/App.tsx` | Modified | Hash routing mapping, Title bar button, type casting |
| `workspace-ui/src/components/snapshots/SnapshotsBoard.tsx` | New | React component code |
| `workspace-ui/src/components/intel/IntelDashboard.tsx` | Modified | Casting style literals to any |
| `docs/spec/003-snapshots-board.md` | New | Technical Specification |
| `docs/impl/003-snapshots-board-impl.md` | New | Implementation details documentation |

---

## Verification Results

### Build & Type Verification
```bash
# Verify TypeScript compiles with no emits
pnpm run typecheck

# Verify bundler output builds successfully
pnpm run build
```
- Both compilation verification suites pass with zero warnings or errors.
- Checked asset bundle outputs, verifying that the CSS and React bundles build successfully.
