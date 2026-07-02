import { contextBridge, ipcRenderer } from 'electron'

/**
 * Preload script — secure IPC bridge between Electron main and React renderer.
 *
 * Exposes only the minimum API surface needed by the UI.
 * All Node.js APIs are blocked in the renderer by contextIsolation.
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Platform info
  platform: process.platform,

  // Window controls (for custom title bar)
  minimize: () => ipcRenderer.send('window:minimize'),
  maximize: () => ipcRenderer.send('window:maximize'),
  close: () => ipcRenderer.send('window:close'),

  // App version
  getVersion: () => ipcRenderer.invoke('app:version'),

  // Cross-window sync (select symbol in Intel, receive in Workspace)
  selectSymbol: (symbol: string) => ipcRenderer.send('symbol:select', symbol),
  onSymbolUpdate: (callback: (symbol: string) => void) => {
    const listener = (_event: any, symbol: string) => callback(symbol)
    ipcRenderer.on('symbol:update', listener)
    return () => {
      ipcRenderer.removeListener('symbol:update', listener)
    }
  },

  // Window openers (to reopen closed windows dynamically)
  openIntelWindow: () => ipcRenderer.send('window:open-intel'),
  openWorkspaceWindow: () => ipcRenderer.send('window:open-workspace'),
  openSnapshotsWindow: () => ipcRenderer.send('window:open-snapshots'),

  // Snapshots APIs
  getSnapshots: (date?: string) => ipcRenderer.invoke('snapshots:list', date),
  readSnapshot: (filename: string, date?: string) => ipcRenderer.invoke('snapshots:read', filename, date),
  saveSnapshot: (payload: { category: string; filename: string; base64Data: string }) => 
    ipcRenderer.invoke('snapshots:save', payload),
  deleteSnapshot: (filename: string, date?: string) => ipcRenderer.invoke('snapshots:delete', filename, date),
  readClipboardImage: () => ipcRenderer.invoke('clipboard:read-image'),
  getAvailableDates: () => ipcRenderer.invoke('snapshots:get-dates'),
  onSnapshotsUpdated: (callback: (snapshots: any[]) => void) => {
    const listener = (_event: any, snapshots: any[]) => callback(snapshots)
    ipcRenderer.on('snapshots:updated', listener)
    return () => {
      ipcRenderer.removeListener('snapshots:updated', listener)
    }
  },
})

// Type declaration for the renderer
export interface SnapshotMeta {
  filename: string
  category: string
  timestamp: string // HHMMSS
  mtime: number
  date?: string
}

declare global {
  interface Window {
    electronAPI: {
      platform: string
      minimize: () => void
      maximize: () => void
      close: () => void
      getVersion: () => Promise<string>
      selectSymbol: (symbol: string) => void
      onSymbolUpdate: (callback: (symbol: string) => void) => () => void
      openIntelWindow: () => void
      openWorkspaceWindow: () => void
      openSnapshotsWindow: () => void
      getSnapshots: (date?: string) => Promise<SnapshotMeta[]>
      readSnapshot: (filename: string, date?: string) => Promise<string>
      saveSnapshot: (payload: { category: string; filename: string; base64Data: string }) => Promise<void>
      deleteSnapshot: (filename: string, date?: string) => Promise<boolean>
      readClipboardImage: () => Promise<string | null>
      getAvailableDates: () => Promise<string[]>
      onSnapshotsUpdated: (callback: (snapshots: SnapshotMeta[]) => void) => () => void
    }
  }
}
