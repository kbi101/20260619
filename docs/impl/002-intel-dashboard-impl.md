# IMPL-002: QuantStation — Daily Intel & Watchlist Window Implementation

| Field          | Value                                    |
|:---------------|:-----------------------------------------|
| **Spec**       | [SPEC-002](../spec/002-intel-dashboard.md)|
| **Status**     | Planned                                  |
| **Created**    | 2026-06-19                               |
| **Updated**    | 2026-06-19                               |

---

## 1. Repository Layout Updates

To implement the secondary window, the following files will be added or modified:

```text
quantstation/
├── core-engine/
│   └── src/main/java/com/quantstation/
│       ├── repository/
│       │   └── RedisStateRepository.java        # [MODIFY] Added daily notes CRUD
│       └── web/
│           └── UiRestController.java            # [MODIFY] Added GET/POST /api/notes/daily
│
└── workspace-ui/
    ├── electron/
    │   ├── main.ts                              # [MODIFY] Instantiates intelWindow + IPC routing
    │   └── preload.ts                           # [MODIFY] Added window communications IPC
    └── src/
        ├── App.tsx                              # [MODIFY] Hash routing between components
        ├── store/
        │   └── useStore.ts                      # [MODIFY] Added checklist/notes state slice
        └── components/
            └── intel/                           # [NEW] Intel Panels
                ├── IntelDashboard.tsx           # Dashboard Panel container
                ├── WatchlistPanel.tsx           # Universal Watchlist grid
                ├── NewsFeed.tsx                 # Event news stream
                ├── EconomicCalendar.tsx         # Macro releases list
                └── DailyChecklist.tsx           # Checklist & Notes editor
```

---

## 2. Electron Main Process Modifications

### 2.1 Multi-Window Instantiation in [main.ts](file:///Users/kepingbi/20260619/quantstation/workspace-ui/electron/main.ts)
We need to declare `intelWindow` and instantiate it alongside `mainWindow`:

```typescript
let mainWindow: BrowserWindow | null = null
let intelWindow: BrowserWindow | null = null

function createIntelWindow(): void {
  intelWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'QuantStation - Intel Dashboard',
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const devServerUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL
  if (devServerUrl) {
    // Hash routing for secondary React components page
    intelWindow.loadURL(`${devServerUrl}#/intel`)
  } else {
    intelWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/intel' })
  }

  intelWindow.on('closed', () => {
    intelWindow = null
  })
}
```

### 2.2 IPC Event Coordinating in [main.ts](file:///Users/kepingbi/20260619/quantstation/workspace-ui/electron/main.ts)
The main process acts as the event post office, relaying messages between renderers:

```typescript
// Relay ticker selection from Intel board to Workspace main window
ipcMain.on('symbol:select', (event, symbol: string) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('symbol:update', symbol)
  }
})
```

---

## 3. Preload contextBridge Config in [preload.ts](file:///Users/kepingbi/20260619/quantstation/workspace-ui/electron/preload.ts)

We will expand the context bridge so that the windows can invoke IPC messaging:

```typescript
contextBridge.exposeInMainWorld('api', {
  // Outgoing calls to main process
  selectSymbol: (symbol: string) => ipcRenderer.send('symbol:select', symbol),
  
  // Subscriptions to main process events
  onSymbolUpdate: (callback: (symbol: string) => void) => {
    const listener = (_event: any, symbol: string) => callback(symbol)
    ipcRenderer.on('symbol:update', listener)
    return () => ipcRenderer.removeListener('symbol:update', listener)
  }
})
```

---

## 4. Frontend Router & Store Configuration

### 4.1 React Hash Router in [App.tsx](file:///Users/kepingbi/20260619/quantstation/workspace-ui/src/App.tsx)
We will conditionalize render paths on Hash change (Hash router pattern):

```typescript
import React, { useEffect, useState } from 'react'
import { Workspace } from './components/Workspace' // Existing grid layout
import { IntelDashboard } from './components/intel/IntelDashboard'

export default function App() {
  const [route, setRoute] = useState(window.location.hash)

  useEffect(() => {
    const handleHashChange = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  if (route.startsWith('#/intel')) {
    return <IntelDashboard />
  }

  return <Workspace />
}
```

### 4.2 Zustand IPC listener in Workspace mount
Inside the main Workspace dashboard, we register the symbol listener:

```typescript
useEffect(() => {
  if (window.api?.onSymbolUpdate) {
    const unsubscribe = window.api.onSymbolUpdate((newSymbol) => {
      // Updates the Zustand activeSymbol store parameter
      useStore.getState().setActiveSymbol(newSymbol)
    })
    return unsubscribe
  }
}, [])
```

---

## 5. Backend REST & Redis Configuration

### 5.1 Redis Namespace
The daily notes will be cached as a JSON string under the key:
- `qs:notes:daily`

### 5.2 CRUD Endpoints in [UiRestController.java](file:///Users/kepingbi/20260619/quantstation/core-engine/src/main/java/com/quantstation/web/UiRestController.java)

```java
@GetMapping("/notes/daily")
public ResponseEntity<String> getDailyNotes() {
    String notes = redisState.getDailyNotes(); // Fetch raw JSON string
    return ResponseEntity.ok(notes != null ? notes : "{}");
}

@PostMapping("/notes/daily")
public ResponseEntity<Void> saveDailyNotes(@RequestBody String notesJson) {
    redisState.saveDailyNotes(notesJson);
    return ResponseEntity.ok().build();
}
```

---

## 6. Verification Plan

### 6.1 Multi-Monitor Drag Testing
- Launch the workstation via scripts (`scripts/start-pod.sh`).
- Confirm two separate native window borders launch.
- Drag `QuantStation - Intel Dashboard` to a secondary physical screen.
- Verify scaling, title bars, and traffic lights render cleanly on both screens.

### 6.2 IPC Communication Verification
- Add `AAPL`, `TSLA`, and `NVDA` to the Watchlist grid on Window 2.
- Double-click `TSLA`.
- Verify Window 1 instantly reloads the PriceChart and OrderBook panels to fetch and display `TSLA`.

### 6.3 Daily Notes Persistence Verification
- Toggle checklist checkboxes and write scratchpad rules in the notes panel on Window 2.
- Execute restart command (`scripts/stop-pod.sh` then `scripts/start-pod.sh`).
- Re-open dashboard and verify checkbox targets and text notes are fully recovered from Redis.
