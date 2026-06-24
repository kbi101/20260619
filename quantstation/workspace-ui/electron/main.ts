import { app, BrowserWindow, ipcMain, Menu, clipboard } from 'electron'
import path from 'path'
import fs from 'fs'

// Set application name override for development
app.name = 'QuantStation'

// Disable hardware acceleration to resolve blank black screens and window freezing on macOS
app.disableHardwareAcceleration()

let mainWindow: BrowserWindow | null = null
let intelWindow: BrowserWindow | null = null
let snapshotsWindow: BrowserWindow | null = null

// Snapshot Directory & Watcher State
let fileWatcher: fs.FSWatcher | null = null

interface SnapshotMeta {
  filename: string
  category: string
  timestamp: string // HHMMSS
  mtime: number
  date?: string
}

function getTodayStr(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${yyyy}${mm}${dd}`
}

function getTodayDir(): string {
  return path.join('/Users/kepingbi/Data/QuantEdge', getTodayStr())
}

function getDirForDate(date?: string): string {
  const targetDate = (date && /^\d{8}$/.test(date)) ? date : getTodayStr()
  return path.join('/Users/kepingbi/Data/QuantEdge', targetDate)
}

async function getSnapshotsList(date?: string): Promise<SnapshotMeta[]> {
  const dir = getDirForDate(date)
  if (!fs.existsSync(dir)) {
    return []
  }
  const targetDate = (date && /^\d{8}$/.test(date)) ? date : getTodayStr()
  try {
    const files = await fs.promises.readdir(dir)
    const list: SnapshotMeta[] = []
    for (const file of files) {
      // Match format: category_HHMMSS.png or similar
      const match = file.match(/^(.*)_(\d{6})\.(png|jpg|jpeg|gif)$/i)
      if (match) {
        const filePath = path.join(dir, file)
        const stat = await fs.promises.stat(filePath)
        list.push({
          filename: file,
          category: match[1],
          timestamp: match[2],
          mtime: stat.mtimeMs,
          date: targetDate,
        })
      } else if (file.toLowerCase().endsWith('.png') || file.toLowerCase().endsWith('.jpg') || file.toLowerCase().endsWith('.jpeg')) {
        const filePath = path.join(dir, file)
        const stat = await fs.promises.stat(filePath)
        const mtimeDate = new Date(stat.mtimeMs)
        const hh = String(mtimeDate.getHours()).padStart(2, '0')
        const mm = String(mtimeDate.getMinutes()).padStart(2, '0')
        const ss = String(mtimeDate.getSeconds()).padStart(2, '0')
        const nameWithoutExt = file.substring(0, file.lastIndexOf('.'))
        list.push({
          filename: file,
          category: nameWithoutExt || 'other',
          timestamp: `${hh}${mm}${ss}`,
          mtime: stat.mtimeMs,
          date: targetDate,
        })
      }
    }
    return list.sort((a, b) => a.mtime - b.mtime)
  } catch (err) {
    console.error('[Snapshots IPC] Failed to read directory:', err)
    return []
  }
}

function notifySnapshotsUpdated(): void {
  getSnapshotsList().then((snapshots) => {
    console.log(`[Snapshots Watcher] Broadcasting snapshot update to renderers: ${snapshots.length} items`)
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('snapshots:updated', snapshots)
    }
    if (intelWindow && !intelWindow.isDestroyed()) {
      intelWindow.webContents.send('snapshots:updated', snapshots)
    }
    if (snapshotsWindow && !snapshotsWindow.isDestroyed()) {
      snapshotsWindow.webContents.send('snapshots:updated', snapshots)
    }
  })
}

function startWatchingSnapshots(): void {
  const dir = getTodayDir()
  if (!fs.existsSync(dir)) {
    console.log(`[Snapshots Watcher] Today's snapshot folder does not exist yet: ${dir}. Checking parent.`)
    const parentDir = '/Users/kepingbi/Data/QuantEdge'
    if (fs.existsSync(parentDir)) {
      try {
        fileWatcher = fs.watch(parentDir, (eventType, filename) => {
          if (filename && filename === path.basename(dir)) {
            console.log(`[Snapshots Watcher] Today's directory created: ${filename}. Starting folder watcher...`)
            stopWatchingSnapshots()
            startWatchingSnapshots()
            notifySnapshotsUpdated()
          }
        })
      } catch (err) {
        console.error('[Snapshots Watcher] Failed to watch parent folder:', err)
      }
    }
    // Fallback directory creation checker
    setTimeout(() => {
      if (!fileWatcher) startWatchingSnapshots()
    }, 10000)
    return
  }

  try {
    console.log(`[Snapshots Watcher] Starting watcher on: ${dir}`)
    fileWatcher = fs.watch(dir, (eventType, filename) => {
      console.log(`[Snapshots Watcher] Folder change event: ${eventType} for file: ${filename}`)
      notifySnapshotsUpdated()
    })
  } catch (err) {
    console.error(`[Snapshots Watcher] Failed to watch directory ${dir}:`, err)
  }
}

function stopWatchingSnapshots(): void {
  if (fileWatcher) {
    fileWatcher.close()
    fileWatcher = null
  }
}

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
    width: 2560,
    height: 1440,
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
    width: 1600,
    height: 1000,
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

function createSnapshotsWindow(show = true): void {
  snapshotsWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 800,
    minHeight: 600,
    title: 'Snapshots Board',
    backgroundColor: '#0a0a0f',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    show,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  // Lock title to prevent index.html overriding it
  snapshotsWindow.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  // Load the renderer pointing to hash route
  const devServerUrl = process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL
  if (devServerUrl) {
    snapshotsWindow.loadURL(`${devServerUrl}#/snapshots`)
  } else {
    snapshotsWindow.loadFile(path.join(__dirname, '../dist/index.html'), { hash: '/snapshots' })
  }

  forwardConsole(snapshotsWindow, 'Snapshots')
  registerDevShortcuts(snapshotsWindow)

  snapshotsWindow.on('closed', () => {
    snapshotsWindow = null
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

function showSnapshotsWindow(): void {
  if (snapshotsWindow && !snapshotsWindow.isDestroyed()) {
    snapshotsWindow.show()
    snapshotsWindow.focus()
  } else {
    createSnapshotsWindow(true)
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

ipcMain.on('window:open-snapshots', () => {
  console.log('[IPC Router] Opening/Focusing Snapshots Board...')
  showSnapshotsWindow()
})

ipcMain.handle('snapshots:list', async (event, date?: string) => {
  return await getSnapshotsList(date)
})

ipcMain.handle('snapshots:read', async (event, filename: string, date?: string) => {
  if (path.basename(filename) !== filename) {
    throw new Error('Invalid filename path traversal query')
  }
  const dir = getDirForDate(date)
  const filePath = path.join(dir, filename)
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filename}`)
  }
  const data = await fs.promises.readFile(filePath)
  const ext = path.extname(filename).substring(1).toLowerCase()
  const mime = ext === 'jpg' ? 'jpeg' : (ext || 'png')
  return `data:image/${mime};base64,${data.toString('base64')}`
})

ipcMain.handle('snapshots:get-dates', async () => {
  const parentDir = '/Users/kepingbi/Data/QuantEdge'
  if (!fs.existsSync(parentDir)) {
    return [getTodayStr()]
  }
  try {
    const files = await fs.promises.readdir(parentDir, { withFileTypes: true })
    const dates = files
      .filter(f => f.isDirectory() && /^\d{8}$/.test(f.name))
      .map(f => f.name)
    
    const todayStr = getTodayStr()
    if (!dates.includes(todayStr)) {
      dates.push(todayStr)
    }
    return dates.sort((a, b) => b.localeCompare(a))
  } catch (err) {
    console.error('[Snapshots IPC] Failed to read parent directory for dates:', err)
    return [getTodayStr()]
  }
})

ipcMain.handle('snapshots:save', async (event, payload: { category: string; filename: string; base64Data: string }) => {
  const { category, filename, base64Data } = payload

  if (path.basename(filename) !== filename) {
    throw new Error('Invalid filename path traversal query')
  }

  // Sanitize the category name to a clean, lowercase identifier
  const safeCategory = category.trim().replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
  if (!safeCategory) {
    throw new Error('Invalid category name')
  }

  // Extract pure base64 data from a potentially formatted data-URL
  let base64Image = base64Data
  const base64Parts = base64Data.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/)
  if (base64Parts) {
    base64Image = base64Parts[2]
  }

  const buffer = Buffer.from(base64Image, 'base64')

  const dir = getTodayDir()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }

  // Enforce [category]_[HHMMSS].png formatting
  const timeMatch = filename.match(/_(\d{6})\.(png|jpg|jpeg|gif)$/i)
  let finalFilename: string
  if (timeMatch) {
    finalFilename = `${safeCategory}_${timeMatch[1]}.png`
  } else {
    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')
    finalFilename = `${safeCategory}_${hh}${mm}${ss}.png`
  }

  const filePath = path.join(dir, finalFilename)
  await fs.promises.writeFile(filePath, buffer)
  console.log(`[Snapshots IPC] Successfully saved snapshot file: ${filePath}`)
})

ipcMain.handle('clipboard:read-image', async () => {
  const image = clipboard.readImage()
  if (image.isEmpty()) {
    const filePaths = clipboard.read('filenames')
    let paths: string[] = []
    if (typeof filePaths === 'string' && filePaths) {
      try {
        const parsed = JSON.parse(filePaths)
        if (Array.isArray(parsed)) {
          paths = parsed
        }
      } catch (e) {}
    } else if (Array.isArray(filePaths)) {
      paths = filePaths
    }

    if (paths.length === 0) {
      const fileUrl = clipboard.read('public.file-url')
      if (fileUrl && fileUrl.startsWith('file://')) {
        paths = [decodeURIComponent(fileUrl.substring(7))]
      }
    }

    if (paths.length > 0) {
      const filePath = paths[0]
      const ext = path.extname(filePath).toLowerCase()
      if (['.png', '.jpg', '.jpeg', '.gif', '.webp'].includes(ext)) {
        try {
          const data = await fs.promises.readFile(filePath)
          const mime = ext === '.jpg' ? 'jpeg' : ext.substring(1)
          return `data:image/${mime};base64,${data.toString('base64')}`
        } catch (err) {
          console.error(`[Clipboard IPC] Failed to read image file from clipboard path ${filePath}:`, err)
        }
      }
    }
    return null
  }
  return image.toDataURL()
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
        {
          label: 'Show Snapshots Board',
          accelerator: 'CmdOrCtrl+3',
          click: () => showSnapshotsWindow()
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
  createSnapshotsWindow(false)
  startWatchingSnapshots()
})

app.on('window-all-closed', () => {
  app.quit()
})

app.on('activate', () => {
  if (mainWindow === null) createWindow()
  if (intelWindow === null) createIntelWindow()
  if (snapshotsWindow === null) createSnapshotsWindow(false)
})
