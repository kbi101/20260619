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
})

// Type declaration for the renderer
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
    }
  }
}
