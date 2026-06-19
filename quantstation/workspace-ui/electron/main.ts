import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import path from 'path'

// Set application name override for development
app.name = 'QuantStation'

// Disable hardware acceleration to resolve blank black screens and window freezing on macOS
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null
let intelWindow: BrowserWindow | null = null

function registerDevShortcuts(win: BrowserWindow): void {
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      const isDevTools = input.key === 'F12' || 
        (input.meta && input.alt && input.key.toLowerCase() === 'i') ||
        (input.control && input.shift && input.key.toLowerCase() === 'i');
      
      const isReload = input.key === 'F5' || 
        (input.meta && input.key.toLowerCase() === 'r') ||
        (input.control && input.key.toLowerCase() === 'r');

      if (isDevTools) {
        win.webContents.toggleDevTools()
        event.preventDefault()
      } else if (isReload) {
        win.webContents.reload()
        event.preventDefault()
      }
    }
  })
}

function forwardConsole(win: BrowserWindow, prefix: string): void {
  win.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[${prefix} Console] [Level ${level}] ${message} (Source: ${sourceId}:${line})`)
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    title: 'Workspace',
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

  // Lock title to prevent index.html overriding it
  mainWindow.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  // Load the renderer
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL
  if (devServerUrl) {
    mainWindow.loadURL(devServerUrl)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  forwardConsole(mainWindow, 'Workspace')
  registerDevShortcuts(mainWindow)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function createIntelWindow(): void {
  intelWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'Intel Dashboard',
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

  // Lock title to prevent index.html overriding it
  intelWindow.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  // Load the renderer pointing to hash route
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL
  if (devServerUrl) {
    intelWindow.loadURL(`${devServerUrl}#/intel`)
  } else {
    intelWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/intel' })
  }

  forwardConsole(intelWindow, 'Intel')
  registerDevShortcuts(intelWindow)

  intelWindow.on('closed', () => {
    intelWindow = null
  })
}

// Window opener helpers
function showWorkspaceWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
  } else {
    createWindow()
  }
}

// Fixed spelling 'Dashboard' to match specification
function showIntelWindow(): void {
  if (intelWindow && !intelWindow.isDestroyed()) {
    intelWindow.show()
    intelWindow.focus()
  } else {
    createIntelWindow()
  }
}

// Window controls IPC handlers (generic for active sender window)
ipcMain.on('window:minimize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.minimize()
})

ipcMain.on('window:maximize', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})

ipcMain.on('window:close', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  win?.close()
})

// Cross-window symbol synchronizer
ipcMain.on('symbol:select', (event, symbol: string) => {
  console.log(`[IPC Router] Received symbol:select for ${symbol}. Routing to Workspace...`)
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('symbol:update', symbol)
  }
})

// Reopen window requests via IPC
ipcMain.on('window:open-intel', () => {
  console.log('[IPC Router] Opening/Focusing Intel Dashboard...')
  showIntelWindow()
})

ipcMain.on('window:open-workspace', () => {
  console.log('[IPC Router] Opening/Focusing Workspace...')
  showWorkspaceWindow()
})

ipcMain.handle('app:version', () => {
  return app.getVersion()
})

// Create macOS Application Menu
function createApplicationMenu(): void {
  const template: any[] = [
    {
      label: 'QuantStation',
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Show Workspace',
          accelerator: 'CmdOrCtrl+1',
          click: () => showWorkspaceWindow()
        },
        {
          label: 'Show Intel Dashboard',
          accelerator: 'CmdOrCtrl+2',
          click: () => showIntelWindow()
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        { type: 'separator' },
        { role: 'front' }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

app.whenReady().then(() => {
  createApplicationMenu()
  createWindow()
  createIntelWindow()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
  if (intelWindow === null) createIntelWindow()
})
