import React, { useEffect, useState } from 'react'
import { SnapshotMeta } from '../../../electron/preload'

/**
 * SnapshotsBoard — Independent Window & Page for Trader Snapshots
 *
 * Implements category tabs, a chronological vertical timeline,
 * image loading via IPC, zoom/fit controls, and an "Auto-Follow Latest" real-time sync toggle.
 */
export const SnapshotsBoard: React.FC = () => {
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string>('')
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotMeta | null>(null)
  const [imgData, setImgData] = useState<string | null>(null)
  const [imgLoading, setImgLoading] = useState(false)
  const [autoFollow, setAutoFollow] = useState(true)
  const [fitMode, setFitMode] = useState<'fit' | 'fill' | 'original'>('fit')
  const [zoomLevel, setZoomLevel] = useState(1)
  const [naturalWidth, setNaturalWidth] = useState<number>(0)
  const [naturalHeight, setNaturalHeight] = useState<number>(0)

  // Save, Drag-and-drop, Clipboard Paste States
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [pendingImgData, setPendingImgData] = useState<string | null>(null)
  const [modalCategory, setModalCategory] = useState('')
  const [modalFilename, setModalFilename] = useState('')
  const [isDragOver, setIsDragOver] = useState(false)
  const [saving, setSaving] = useState(false)

  // availableDates state
  const [availableDates, setAvailableDates] = useState<string[]>([])
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [showWeek, setShowWeek] = useState(false)

  const getTodayStr = () => {
    const now = new Date()
    const yyyy = now.getFullYear()
    const mm = String(now.getMonth() + 1).padStart(2, '0')
    const dd = String(now.getDate()).padStart(2, '0')
    return `${yyyy}${mm}${dd}`
  }

  const triggerSaveModal = (base64Data: string, originalName?: string) => {
    setPendingImgData(base64Data)
    const existingCategories = Array.from(new Set(snapshots.map(s => s.category)))
    setModalCategory(activeCategory || (existingCategories[0] || 'misc'))

    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const ss = String(now.getSeconds()).padStart(2, '0')
    
    let targetFilename = `snapshot_${hh}${mm}${ss}.png`
    if (originalName) {
      const match = originalName.match(/^(.*)_(\d{6})\.(png|jpg|jpeg|gif)$/i)
      if (match) {
        targetFilename = `${match[1].replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}_${match[2]}.png`
      } else {
        const cleanName = originalName.substring(0, originalName.lastIndexOf('.')).replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
        targetFilename = `${cleanName || 'snapshot'}_${hh}${mm}${ss}.png`
      }
    } else {
      targetFilename = `${(activeCategory || 'copied').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()}_${hh}${mm}${ss}.png`
    }

    setModalFilename(targetFilename)
    setIsSaveModalOpen(true)
  }

  const handleModalCategoryChange = (newCategory: string) => {
    setModalCategory(newCategory)
    const cleanCat = newCategory.trim().replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase() || 'snapshot'
    const timeMatch = modalFilename.match(/_(\d{6})\.png$/i)
    if (timeMatch) {
      setModalFilename(`${cleanCat}_${timeMatch[1]}.png`)
    } else {
      const now = new Date()
      const hh = String(now.getHours()).padStart(2, '0')
      const mm = String(now.getMinutes()).padStart(2, '0')
      const ss = String(now.getSeconds()).padStart(2, '0')
      setModalFilename(`${cleanCat}_${hh}${mm}${ss}.png`)
    }
  }

  const handleSaveSnapshot = async () => {
    if (!pendingImgData || !modalCategory.trim()) return
    try {
      setSaving(true)
      const cleanCat = modalCategory.trim().replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
      
      let finalName = modalFilename.trim()
      if (!finalName.toLowerCase().endsWith('.png')) {
        finalName = finalName.replace(/\.[^/.]+$/, "") + '.png'
      }
      
      if (!finalName.startsWith(cleanCat + '_')) {
        const timeMatch = finalName.match(/_(\d{6})\.png$/i)
        if (timeMatch) {
          finalName = `${cleanCat}_${timeMatch[1]}.png`
        } else {
          const now = new Date()
          const hh = String(now.getHours()).padStart(2, '0')
          const mm = String(now.getMinutes()).padStart(2, '0')
          const ss = String(now.getSeconds()).padStart(2, '0')
          finalName = `${cleanCat}_${hh}${mm}${ss}.png`
        }
      }

      await window.electronAPI.saveSnapshot({
        category: cleanCat,
        filename: finalName,
        base64Data: pendingImgData,
      })

      // Switch to today's view if currently looking at a past day
      const today = getTodayStr()
      if (selectedDate !== today) {
        const dates = await window.electronAPI.getAvailableDates()
        setAvailableDates(dates)
        setSelectedDate(today)
      }

      setActiveCategory(cleanCat)
      setAutoFollow(true)
      setIsSaveModalOpen(false)
      setPendingImgData(null)
    } catch (err) {
      console.error('[SnapshotsBoard] Failed to save snapshot:', err)
      alert(`Failed to save snapshot: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      const file = files[0]
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (event) => {
          if (event.target?.result) {
            triggerSaveModal(event.target.result as string, file.name)
          }
        }
        reader.readAsDataURL(file)
      } else {
        alert('Only image files are supported (PNG, JPG, JPEG, GIF)')
      }
    }
  }

  // Reset natural size when snapshot selection changes
  useEffect(() => {
    setNaturalWidth(0)
    setNaturalHeight(0)
  }, [selectedSnapshot])

  // Global clipboard paste event listener
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const activeEl = document.activeElement
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return
      }

      // 1. Try native Electron clipboard reading (robust, handles screenshots & copied files)
      try {
        const base64Data = await window.electronAPI.readClipboardImage()
        if (base64Data) {
          triggerSaveModal(base64Data)
          e.preventDefault()
          return
        }
      } catch (err) {
        console.error('[SnapshotsBoard] Failed to read native clipboard:', err)
      }

      // 2. Standard web clipboard parsing fallback
      const items = e.clipboardData?.items
      if (!items) return

      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          const file = item.getAsFile()
          if (file) {
            const reader = new FileReader()
            reader.onload = (event) => {
              if (event.target?.result) {
                triggerSaveModal(event.target.result as string)
              }
            }
            reader.readAsDataURL(file)
          }
          e.preventDefault()
          break
        }
      }
    }

    window.addEventListener('paste', handlePaste)
    return () => {
      window.removeEventListener('paste', handlePaste)
    }
  }, [activeCategory, snapshots])

  const handleRefresh = async () => {
    try {
      setLoading(true)
      const dates = await window.electronAPI.getAvailableDates()
      setAvailableDates(dates)
      const today = getTodayStr()
      const newSelectedDate = dates.includes(selectedDate) ? selectedDate : (dates.includes(today) ? today : (dates[0] || today))
      if (newSelectedDate !== selectedDate) {
        setSelectedDate(newSelectedDate)
      } else {
        let datesToFetch = [newSelectedDate]
        if (showWeek) {
          const startIndex = dates.indexOf(newSelectedDate)
          const targetIndex = startIndex !== -1 ? startIndex : 0
          datesToFetch = dates.slice(targetIndex, targetIndex + 7)
        }

        const promises = datesToFetch.map(async (d) => {
          try {
            return await window.electronAPI.getSnapshots(d)
          } catch (err) {
            return []
          }
        })

        const results = await Promise.all(promises)
        const mergedList = results.flat().sort((a, b) => a.mtime - b.mtime)
        setSnapshots(mergedList)
      }
    } catch (err) {
      console.error('[SnapshotsBoard] Failed to refresh snapshots:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteSnapshot = async () => {
    if (!selectedSnapshot) return
    const filename = selectedSnapshot.filename
    const confirmDelete = window.confirm(`Are you sure you want to delete the snapshot "${filename}"?`)
    if (!confirmDelete) return

    try {
      setImgLoading(true)
      const success = await window.electronAPI.deleteSnapshot(filename, selectedDate)
      if (success) {
        setSnapshots(prev => prev.filter(s => s.filename !== filename))
        setSelectedSnapshot(null)
      } else {
        alert('Failed to delete snapshot.')
      }
    } catch (err) {
      console.error('[SnapshotsBoard] Failed to delete snapshot:', err)
      alert(`Error deleting snapshot: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setImgLoading(false)
    }
  }

  // 1. Fetch available dates on mount
  useEffect(() => {
    let active = true
    const fetchDates = async () => {
      try {
        const dates = await window.electronAPI.getAvailableDates()
        if (active) {
          setAvailableDates(dates)
          const today = getTodayStr()
          setSelectedDate(dates.includes(today) ? today : (dates[0] || today))
        }
      } catch (err) {
        console.error('[SnapshotsBoard] Failed to fetch available dates:', err)
        const today = getTodayStr()
        setAvailableDates([today])
        setSelectedDate(today)
      }
    }
    fetchDates()
    return () => {
      active = false
    }
  }, [])

  // 2. Fetch snapshots when selectedDate changes or showWeek changes
  useEffect(() => {
    if (!selectedDate) return
    let active = true

    const fetchSnapshotsForDate = async () => {
      try {
        setLoading(true)
        
        let datesToFetch = [selectedDate]
        if (showWeek) {
          const startIndex = availableDates.indexOf(selectedDate)
          const targetIndex = startIndex !== -1 ? startIndex : 0
          datesToFetch = availableDates.slice(targetIndex, targetIndex + 7)
        }

        const promises = datesToFetch.map(async (d) => {
          try {
            return await window.electronAPI.getSnapshots(d)
          } catch (err) {
            console.error(`[SnapshotsBoard] Failed to fetch snapshots for date ${d}:`, err)
            return []
          }
        })

        const results = await Promise.all(promises)
        
        if (active) {
          const mergedList = results.flat().sort((a, b) => a.mtime - b.mtime)
          console.log(`[SnapshotsBoard] Loaded ${mergedList.length} snapshots for dates: ${datesToFetch.join(', ')}.`)
          setSnapshots(mergedList)
        }
      } catch (err) {
        console.error(`[SnapshotsBoard] Failed to load snapshots:`, err)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchSnapshotsForDate()

    return () => {
      active = false
    }
  }, [selectedDate, showWeek, availableDates])

  // 3. Listen to file-watcher updates (only updates if today's date is currently active or within week range)
  useEffect(() => {
    const unsubscribe = window.electronAPI.onSnapshotsUpdated(async (updatedList) => {
      const today = getTodayStr()
      if (selectedDate === today || showWeek) {
        console.log(`[SnapshotsBoard] Folder update detected. Reloading...`)
        const dates = await window.electronAPI.getAvailableDates()
        setAvailableDates(dates)

        let datesToFetch = [selectedDate]
        if (showWeek) {
          const startIndex = dates.indexOf(selectedDate)
          const targetIndex = startIndex !== -1 ? startIndex : 0
          datesToFetch = dates.slice(targetIndex, targetIndex + 7)
        }

        const promises = datesToFetch.map(async (d) => {
          try {
            return await window.electronAPI.getSnapshots(d)
          } catch (err) {
            return []
          }
        })
        const results = await Promise.all(promises)
        const mergedList = results.flat().sort((a, b) => a.mtime - b.mtime)
        setSnapshots(mergedList)
      }
    })

    return () => {
      unsubscribe()
    }
  }, [selectedDate, showWeek])

  // 4. Sync selection state when snapshots list, active category, or autoFollow toggles update
  useEffect(() => {
    if (snapshots.length === 0) {
      setActiveCategory('')
      setSelectedSnapshot(null)
      return
    }

    // Determine active category: keep current if still valid, otherwise fall back to first
    const currentCategoryValid = activeCategory && snapshots.some(s => s.category === activeCategory)
    const targetCategory = currentCategoryValid ? activeCategory : snapshots[0].category

    if (targetCategory !== activeCategory) {
      setActiveCategory(targetCategory)
    }

    // Determine selected snapshot within the category
    const categorySnapshots = snapshots.filter(s => s.category === targetCategory)
    if (categorySnapshots.length > 0) {
      const latestOfCategory = categorySnapshots[categorySnapshots.length - 1]

      if (autoFollow) {
        // Auto-follow latest snapshot
        if (selectedSnapshot?.filename !== latestOfCategory.filename) {
          setSelectedSnapshot(latestOfCategory)
        }
      } else {
        // Keep current selected if valid, otherwise fallback to latest
        const currentSelectionValid = selectedSnapshot && snapshots.some(s => s.filename === selectedSnapshot.filename && s.category === targetCategory)
        if (!currentSelectionValid) {
          setSelectedSnapshot(latestOfCategory)
        }
      }
    } else {
      setSelectedSnapshot(null)
    }
  }, [snapshots, autoFollow, activeCategory, selectedSnapshot?.filename])

  // 5. Fetch Selected Image Content (Base64)
  useEffect(() => {
    if (!selectedSnapshot) {
      setImgData(null)
      return
    }

    let active = true
    const loadImage = async () => {
      try {
        setImgLoading(true)
        const base64Data = await window.electronAPI.readSnapshot(selectedSnapshot.filename, selectedDate)
        if (active) {
          setImgData(base64Data)
          setZoomLevel(1) // Reset zoom on image change
        }
      } catch (err) {
        console.error(`[SnapshotsBoard] Failed to read snapshot file ${selectedSnapshot.filename}:`, err)
        if (active) setImgData(null)
      } finally {
        if (active) setImgLoading(false)
      }
    }

    loadImage()

    return () => {
      active = false
    }
  }, [selectedSnapshot, selectedDate])

  // Format date option labels for historic select UI
  const formatDateLabel = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr
    const yyyy = dateStr.substring(0, 4)
    const mm = dateStr.substring(4, 6)
    const dd = dateStr.substring(6, 8)
    
    const dateObj = new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd))
    const today = new Date()
    const isToday = dateObj.toDateString() === today.toDateString()
    
    const yesterday = new Date()
    yesterday.setDate(today.getDate() - 1)
    const isYesterday = dateObj.toDateString() === yesterday.toDateString()

    const dateFormatted = `${yyyy}-${mm}-${dd}`
    if (isToday) return `${dateFormatted} (Today)`
    if (isYesterday) return `${dateFormatted} (Yesterday)`
    return dateFormatted
  }

  // Format filename prefix to category human-readable title
  const formatCategory = (cat: string) => {
    return cat
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Format HHMMSS -> HH:MM:SS
  const formatTime = (ts: string) => {
    if (ts.length === 6) {
      return `${ts.substring(0, 2)}:${ts.substring(2, 4)}:${ts.substring(4, 6)}`
    }
    return ts
  }

  // Group snapshot metadata by category
  const categories = Array.from(new Set(snapshots.map(s => s.category)))
  const activeSnapshots = snapshots.filter(s => s.category === activeCategory)

  // Handle category tab change
  const handleCategoryChange = (cat: string) => {
    setActiveCategory(cat)
    const catSnapshots = snapshots.filter(s => s.category === cat)
    if (catSnapshots.length > 0) {
      // If auto-follow, pick latest, otherwise pick latest too as a starting point
      setSelectedSnapshot(catSnapshots[catSnapshots.length - 1])
    }
  }

  return (
    <div 
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: 'var(--qs-bg-primary)',
        color: 'var(--qs-text-primary)',
        fontFamily: 'var(--qs-font-sans)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragOver && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 10, 15, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          border: '2px dashed var(--qs-blue)',
          margin: '16px',
          borderRadius: 'var(--qs-radius-lg)',
          transition: 'all 0.2s ease-in-out',
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>📥</div>
          <div style={{
            fontSize: 'var(--qs-font-lg)',
            fontWeight: 600,
            color: 'var(--qs-text-primary)',
            marginBottom: '8px',
          }}>
            Drop Image Here
          </div>
          <div style={{
            fontSize: 'var(--qs-font-sm)',
            color: 'var(--qs-text-muted)',
          }}>
            Release to categorize and save snapshot
          </div>
        </div>
      )}

      {/* ── Custom Title Bar ──────────────────────────────── */}
      <div className="titlebar" style={{ flexShrink: 0 }}>
        <span className="titlebar__title">Snapshots Board</span>
        
        {/* Navigation Launchers */}
        <div style={{ display: 'flex', gap: '8px', WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={() => window.electronAPI?.openWorkspaceWindow()}
            style={{
              fontFamily: 'var(--qs-font-sans)',
              fontSize: 'var(--qs-font-xs)',
              background: 'var(--qs-bg-tertiary)',
              border: '1px solid var(--qs-border)',
              borderRadius: 'var(--qs-radius-sm)',
              color: 'var(--qs-text-secondary)',
              padding: '4px 10px',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all var(--qs-transition-fast)',
            }}
            className="titlebar-btn"
          >
            Workspace
          </button>
          <button
            onClick={() => window.electronAPI?.openIntelWindow()}
            style={{
              fontFamily: 'var(--qs-font-sans)',
              fontSize: 'var(--qs-font-xs)',
              background: 'var(--qs-bg-tertiary)',
              border: '1px solid var(--qs-border)',
              borderRadius: 'var(--qs-radius-sm)',
              color: 'var(--qs-text-secondary)',
              padding: '4px 10px',
              cursor: 'pointer',
              outline: 'none',
              transition: 'all var(--qs-transition-fast)',
            }}
            className="titlebar-btn"
          >
            Intel Dashboard
          </button>
        </div>

        {/* Date Display */}
        <span style={{
          fontFamily: 'var(--qs-font-mono)',
          fontSize: 'var(--qs-font-xs)',
          color: 'var(--qs-text-secondary)',
          background: 'var(--qs-bg-tertiary)',
          padding: '2px 8px',
          borderRadius: 'var(--qs-radius-sm)',
          marginLeft: 'auto',
        }}>
          TODAY: {new Date().toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' })}
        </span>
      </div>

      {/* ── Main Layout Workspace ─────────────────────────── */}
      {loading ? (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          fontFamily: 'var(--qs-font-mono)',
          fontSize: 'var(--qs-font-sm)',
          color: 'var(--qs-text-secondary)',
        }}>
          Scanning snapshots folder...
        </div>
      ) : snapshots.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          flex: 1,
          gap: '16px',
          padding: '40px',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: '32px',
            color: 'var(--qs-text-muted)',
          }}>
            📸
          </div>
          <h2 style={{
            fontSize: 'var(--qs-font-lg)',
            fontWeight: 500,
            color: 'var(--qs-text-secondary)',
          }}>
            No snapshots found for today
          </h2>
          <p style={{
            fontSize: 'var(--qs-font-sm)',
            color: 'var(--qs-text-muted)',
            maxWidth: '400px',
            lineHeight: 1.6,
          }}>
            Waiting for snapshots to be generated in <code style={{
              fontFamily: 'var(--qs-font-mono)',
              background: 'var(--qs-bg-secondary)',
              padding: '2px 6px',
              borderRadius: '4px',
              border: '1px solid var(--qs-border)',
              fontSize: '11px',
            }}>/Users/kepingbi/Data/QuantEdge/{new Date().getFullYear()}{String(new Date().getMonth() + 1).padStart(2, '0')}{String(new Date().getDate()).padStart(2, '0')}</code>
          </p>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginTop: '8px',
            fontSize: 'var(--qs-font-xs)',
            color: 'var(--qs-text-muted)',
            fontFamily: 'var(--qs-font-mono)',
          }}>
            <span className="pulse-dot pulse-dot--active" /> Watching directory for new updates...
          </div>

          <div style={{ marginTop: '20px', display: 'flex', gap: '12px', zIndex: 5 }}>
            <label style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'var(--qs-blue)',
              color: '#ffffff',
              padding: '8px 16px',
              borderRadius: 'var(--qs-radius-md)',
              fontSize: 'var(--qs-font-sm)',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'var(--qs-blue-hover)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'var(--qs-blue)'}
            >
              <input 
                type="file" 
                accept="image/*" 
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) {
                    const reader = new FileReader()
                    reader.onload = (event) => {
                      if (event.target?.result) {
                        triggerSaveModal(event.target.result as string, file.name)
                      }
                    }
                    reader.readAsDataURL(file)
                  }
                  e.target.value = ''
                }}
                style={{ display: 'none' }}
              />
              📁 Upload Snapshot
            </label>
            <button 
              onClick={async () => {
                try {
                  const base64Data = await window.electronAPI.readClipboardImage()
                  if (base64Data) {
                    triggerSaveModal(base64Data)
                  } else {
                    alert('No image or image file found on the clipboard. Copy an image or screenshot file first.')
                  }
                } catch (err) {
                  alert(`Failed to paste clipboard: ${err instanceof Error ? err.message : String(err)}`)
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: 'var(--qs-bg-tertiary)',
                color: 'var(--qs-text-secondary)',
                border: '1px solid var(--qs-border)',
                padding: '8px 16px',
                borderRadius: 'var(--qs-radius-md)',
                fontSize: 'var(--qs-font-sm)',
                cursor: 'pointer',
                transition: 'background var(--qs-transition-fast)',
                outline: 'none',
              }}
              className="titlebar-btn"
            >
              📋 Paste Clipboard (Cmd+V)
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '220px 1fr 240px',
          flex: 1,
          overflow: 'hidden',
          background: 'var(--qs-border)',
          gap: '1px',
        }}>
          {/* 1. Left Sidebar: Categories Navigation */}
          <div style={{
            background: 'var(--qs-bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div className="panel__header" style={{ 
              borderBottom: '1px solid var(--qs-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingRight: '8px'
            }}>
              <span className="panel__title">Categories</span>
              
              <label style={{
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '24px',
                height: '24px',
                borderRadius: 'var(--qs-radius-sm)',
                background: 'var(--qs-bg-tertiary)',
                border: '1px solid var(--qs-border)',
                color: 'var(--qs-text-secondary)',
                transition: 'all var(--qs-transition-fast)',
                fontSize: '14px',
              }}
              className="titlebar-btn"
              title="Upload Image File"
              >
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) {
                      const reader = new FileReader()
                      reader.onload = (event) => {
                        if (event.target?.result) {
                          triggerSaveModal(event.target.result as string, file.name)
                        }
                      }
                      reader.readAsDataURL(file)
                    }
                    e.target.value = ''
                  }} 
                  style={{ display: 'none' }} 
                />
                +
              </label>
            </div>

            {/* Date Selector Dropdown */}
            <div style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--qs-border)',
              background: 'var(--qs-bg-tertiary)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
            }}>
              <label style={{
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                color: 'var(--qs-text-muted)',
                letterSpacing: '0.05em',
              }}>
                Select Date
              </label>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <select
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value)
                    setZoomLevel(1)
                    setAutoFollow(true)
                  }}
                  disabled={showWeek}
                  style={{
                    background: 'var(--qs-bg-primary)',
                    border: '1px solid var(--qs-border)',
                    borderRadius: 'var(--qs-radius-sm)',
                    color: showWeek ? 'var(--qs-text-muted)' : 'var(--qs-text-primary)',
                    padding: '6px 8px',
                    fontSize: 'var(--qs-font-xs)',
                    fontFamily: 'var(--qs-font-mono)',
                    outline: 'none',
                    cursor: showWeek ? 'not-allowed' : 'pointer',
                    flex: 1,
                    opacity: showWeek ? 0.6 : 1,
                  }}
                >
                  {availableDates.map((dateVal) => (
                    <option key={dateVal} value={dateVal}>
                      {formatDateLabel(dateVal)}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleRefresh}
                  title="Refresh Snapshots Folder"
                  style={{
                    background: 'var(--qs-bg-tertiary)',
                    border: '1px solid var(--qs-border)',
                    borderRadius: 'var(--qs-radius-sm)',
                    color: 'var(--qs-text-secondary)',
                    padding: '6px 10px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all var(--qs-transition-fast)',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.color = 'var(--qs-text-primary)'}
                  onMouseOut={(e) => e.currentTarget.style.color = 'var(--qs-text-secondary)'}
                >
                  ⟳
                </button>
              </div>

              {/* Show Week Checkbox Toggle */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '11px',
                color: 'var(--qs-text-secondary)',
                cursor: 'pointer',
                userSelect: 'none',
                marginTop: '4px',
              }}>
                <input
                  type="checkbox"
                  checked={showWeek}
                  onChange={(e) => {
                    setShowWeek(e.target.checked)
                    setZoomLevel(1)
                    setAutoFollow(true)
                  }}
                  style={{
                    cursor: 'pointer',
                    accentColor: 'var(--qs-blue)',
                  }}
                />
                Show entire week (Last 7 days)
              </label>
            </div>
            
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '12px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}>
              {categories.map((cat) => {
                const count = snapshots.filter(s => s.category === cat).length
                const isActive = cat === activeCategory
                return (
                  <button
                    key={cat}
                    onClick={() => handleCategoryChange(cat)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: isActive ? 'var(--qs-bg-tertiary)' : 'transparent',
                      border: '1px solid',
                      borderColor: isActive ? 'var(--qs-border)' : 'transparent',
                      borderRadius: 'var(--qs-radius-md)',
                      color: isActive ? 'var(--qs-text-primary)' : 'var(--qs-text-secondary)',
                      fontFamily: 'var(--qs-font-sans)',
                      fontSize: 'var(--qs-font-sm)',
                      fontWeight: isActive ? 600 : 400,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all var(--qs-transition-fast)',
                      outline: 'none',
                    }}
                  >
                    <span>{formatCategory(cat)}</span>
                    <span style={{
                      fontFamily: 'var(--qs-font-mono)',
                      fontSize: 'var(--qs-font-xs)',
                      background: isActive ? 'var(--qs-bg-elevated)' : 'var(--qs-bg-tertiary)',
                      color: isActive ? 'var(--qs-blue)' : 'var(--qs-text-muted)',
                      padding: '2px 6px',
                      borderRadius: '10px',
                      border: '1px solid var(--qs-border)',
                    }}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
            
            {/* Watcher Status Footnote */}
            <div style={{
              padding: '12px',
              borderTop: '1px solid var(--qs-border)',
              background: 'var(--qs-bg-tertiary)',
              fontSize: '11px',
              color: 'var(--qs-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span className="pulse-dot pulse-dot--active" style={{ flexShrink: 0 }} />
              <span>Directory watcher active</span>
            </div>
          </div>

          {/* 2. Middle Panel: Interactive Image Frame */}
          <div style={{
            background: 'var(--qs-bg-primary)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {/* Viewport Toolbar */}
            <div className="panel__header" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              borderBottom: '1px solid var(--qs-border)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="panel__title">
                  {selectedSnapshot ? formatCategory(selectedSnapshot.category) : ''}
                </span>
                {selectedSnapshot && (
                  <span style={{
                    fontFamily: 'var(--qs-font-mono)',
                    fontSize: 'var(--qs-font-xs)',
                    color: 'var(--qs-text-muted)',
                    background: 'var(--qs-bg-secondary)',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}>
                    {formatTime(selectedSnapshot.timestamp)}
                  </span>
                )}
              </div>

              {/* View options */}
              {imgData && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={handleDeleteSnapshot}
                    style={{
                      background: 'var(--qs-red-bg)',
                      border: '1px solid var(--qs-red)',
                      color: 'var(--qs-red)',
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '4px 10px',
                      borderRadius: 'var(--qs-radius-sm)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      outline: 'none',
                      marginRight: '8px',
                      transition: 'all var(--qs-transition-fast)',
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.background = 'var(--qs-red)'
                      e.currentTarget.style.color = '#ffffff'
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.background = 'var(--qs-red-bg)'
                      e.currentTarget.style.color = 'var(--qs-red)'
                    }}
                  >
                    🗑 Delete
                  </button>
                  {selectedDate !== getTodayStr() && (
                    <button
                      onClick={async () => {
                        if (!imgData || !selectedSnapshot) return
                        triggerSaveModal(imgData, selectedSnapshot.filename)
                      }}
                      style={{
                        background: 'var(--qs-blue)',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '11px',
                        fontWeight: 600,
                        padding: '4px 10px',
                        borderRadius: 'var(--qs-radius-sm)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        outline: 'none',
                        marginRight: '8px',
                        transition: 'background var(--qs-transition-fast)',
                      }}
                      onMouseOver={(e) => e.currentTarget.style.background = 'var(--qs-blue-hover)'}
                      onMouseOut={(e) => e.currentTarget.style.background = 'var(--qs-blue)'}
                    >
                      📋 Copy to Today
                    </button>
                  )}
                  {/* Zoom Controls */}
                  <div style={{
                    display: 'flex',
                    background: 'var(--qs-bg-secondary)',
                    border: '1px solid var(--qs-border)',
                    borderRadius: 'var(--qs-radius-sm)',
                    overflow: 'hidden',
                  }}>
                    <button
                      onClick={() => setZoomLevel(prev => Math.max(0.5, prev - 0.2))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--qs-text-secondary)',
                        fontFamily: 'var(--qs-font-mono)',
                        fontSize: '13px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                      title="Zoom Out"
                    >
                      -
                    </button>
                    <span style={{
                      fontFamily: 'var(--qs-font-mono)',
                      fontSize: '11px',
                      color: 'var(--qs-text-secondary)',
                      padding: '2px 4px',
                      display: 'flex',
                      alignItems: 'center',
                      background: 'var(--qs-bg-tertiary)',
                    }}>
                      {Math.round(zoomLevel * 100)}%
                    </span>
                    <button
                      onClick={() => setZoomLevel(prev => Math.min(3, prev + 0.2))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--qs-text-secondary)',
                        fontFamily: 'var(--qs-font-mono)',
                        fontSize: '13px',
                        fontWeight: 600,
                        padding: '2px 8px',
                        cursor: 'pointer',
                        outline: 'none',
                      }}
                      title="Zoom In"
                    >
                      +
                    </button>
                  </div>

                  {/* Aspect Ratio Fit Modes */}
                  <div style={{
                    display: 'flex',
                    background: 'var(--qs-bg-secondary)',
                    border: '1px solid var(--qs-border)',
                    borderRadius: 'var(--qs-radius-sm)',
                  }}>
                    {(['fit', 'fill', 'original'] as const).map((mode) => (
                      <button
                        key={mode}
                        onClick={() => {
                          setFitMode(mode)
                          setZoomLevel(1)
                        }}
                        style={{
                          background: fitMode === mode ? 'var(--qs-bg-hover)' : 'transparent',
                          border: 'none',
                          color: fitMode === mode ? 'var(--qs-text-primary)' : 'var(--qs-text-muted)',
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          fontWeight: fitMode === mode ? 600 : 400,
                          padding: '3px 8px',
                          cursor: 'pointer',
                          outline: 'none',
                          borderRadius: 'var(--qs-radius-sm)',
                        }}
                      >
                        {mode}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Interactive Image Frame Viewport */}
            <div style={{
              flex: 1,
              position: 'relative',
              overflow: 'auto',
              display: 'flex',
              padding: '16px',
              background: '#040406', // Slightly darker cockpit-like backing
            }}>
              {imgLoading ? (
                <div style={{
                  margin: 'auto',
                  fontFamily: 'var(--qs-font-mono)',
                  fontSize: 'var(--qs-font-sm)',
                  color: 'var(--qs-text-secondary)',
                }}>
                  Loading high-res image...
                </div>
              ) : imgData ? (
                <img
                  src={imgData}
                  alt={selectedSnapshot?.filename}
                  onLoad={(e) => {
                    const img = e.currentTarget
                    setNaturalWidth(img.naturalWidth)
                    setNaturalHeight(img.naturalHeight)
                  }}
                  style={{
                    // Centering & layout overflow support (margin: auto)
                    margin: 'auto',
                    userSelect: 'none',
                    borderRadius: 'var(--qs-radius-sm)',
                    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
                    border: '1px solid var(--qs-border)',
                    
                    // Width & height layout parameters
                    width: fitMode === 'fill'
                      ? `calc(${100 * zoomLevel}% - 32px)` 
                      : fitMode === 'original' && naturalWidth
                        ? `${naturalWidth * zoomLevel}px`
                        : 'auto',
                    height: fitMode === 'fill'
                      ? `calc(${100 * zoomLevel}% - 32px)`
                      : fitMode === 'original' && naturalHeight
                        ? `${naturalHeight * zoomLevel}px`
                        : 'auto',

                    // Bounds boundaries constraints
                    maxWidth: fitMode === 'fit' ? `calc(${100 * zoomLevel}% - 32px)` : 'none',
                    maxHeight: fitMode === 'fit' ? `calc(${100 * zoomLevel}% - 32px)` : 'none',
                    
                    // Fitting method
                    objectFit: fitMode === 'fill' ? 'cover' : 'contain',
                    
                    // Smooth transition on zoom changes
                    transition: 'width 150ms ease-out, height 150ms ease-out, max-width 150ms ease-out, max-height 150ms ease-out',
                  }}
                />
              ) : (
                <div style={{
                  margin: 'auto',
                  color: 'var(--qs-text-muted)',
                  fontSize: 'var(--qs-font-sm)',
                }}>
                  Select a snapshot to render
                </div>
              )}
            </div>
          </div>

          {/* 3. Right Sidebar: Vertical Captures Timeline */}
          <div style={{
            background: 'var(--qs-bg-secondary)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            <div className="panel__header" style={{ 
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--qs-border)'
            }}>
              <span className="panel__title">Timeline</span>
              
              {/* Auto Follow Toggle */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontSize: '10px',
                color: 'var(--qs-text-secondary)',
                userSelect: 'none',
              }}>
                <input
                  type="checkbox"
                  checked={autoFollow}
                  onChange={(e) => setAutoFollow(e.target.checked)}
                  style={{
                    cursor: 'pointer',
                    accentColor: 'var(--qs-blue)',
                  }}
                />
                Auto-Follow
              </label>
            </div>

            {/* Scrollable Timeline List */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '16px 12px',
              position: 'relative',
            }}>
              {/* Chronological Vertical line connector */}
              {activeSnapshots.length > 1 && (
                <div style={{
                  position: 'absolute',
                  left: '21px',
                  top: '24px',
                  bottom: '24px',
                  width: '2px',
                  background: 'var(--qs-border)',
                  zIndex: 0,
                }} />
              )}

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                position: 'relative',
                zIndex: 1,
              }}>
                {activeSnapshots.map((item, index) => {
                  const isActive = selectedSnapshot?.filename === item.filename
                  const isLatest = index === activeSnapshots.length - 1
                  
                  return (
                    <div
                      key={item.filename}
                      onClick={() => {
                        setSelectedSnapshot(item)
                        // If they click a past one, temporarily turn off auto-follow
                        // so it doesn't immediately jump back on a background folder update
                        if (!isLatest && autoFollow) {
                          setAutoFollow(false)
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      {/* Node point marker */}
                      <div style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '50%',
                        background: isActive ? 'var(--qs-blue-bg)' : 'var(--qs-bg-tertiary)',
                        border: '2px solid',
                        borderColor: isActive 
                          ? 'var(--qs-blue)' 
                          : isLatest 
                            ? 'var(--qs-green)' 
                            : 'var(--qs-border)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginTop: '2px',
                        flexShrink: 0,
                        transition: 'all var(--qs-transition-fast)',
                      }}>
                        <div style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: isActive 
                            ? 'var(--qs-blue)' 
                            : isLatest 
                              ? 'var(--qs-green)' 
                              : 'transparent',
                        }} />
                      </div>

                      {/* Detail block */}
                      <div style={{
                        flex: 1,
                        background: isActive ? 'var(--qs-bg-tertiary)' : 'var(--qs-bg-primary)',
                        border: '1px solid',
                        borderColor: isActive ? 'var(--qs-blue)' : 'var(--qs-border)',
                        borderRadius: 'var(--qs-radius-md)',
                        padding: '6px 10px',
                        transition: 'all var(--qs-transition-fast)',
                        boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.4)' : 'none',
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '4px',
                        }}>
                          <span style={{
                            fontFamily: 'var(--qs-font-mono)',
                            fontSize: 'var(--qs-font-sm)',
                            fontWeight: isActive ? 600 : 500,
                            color: isActive ? 'var(--qs-text-primary)' : 'var(--qs-text-secondary)',
                          }}>
                            {formatTime(item.timestamp)}
                            {showWeek && item.date && (
                              <span style={{
                                fontSize: '10px',
                                color: 'var(--qs-text-muted)',
                                marginLeft: '6px',
                                background: 'var(--qs-bg-secondary)',
                                padding: '1px 4px',
                                borderRadius: '3px',
                                border: '1px solid var(--qs-border)',
                                display: 'inline-block',
                                verticalAlign: 'middle',
                              }}>
                                {item.date.substring(4, 6)}/{item.date.substring(6, 8)}
                              </span>
                            )}
                          </span>

                          {isLatest && (
                            <span style={{
                              fontFamily: 'var(--qs-font-sans)',
                              fontSize: '9px',
                              fontWeight: 600,
                              background: 'var(--qs-green-bg)',
                              color: 'var(--qs-green)',
                              padding: '1px 4px',
                              borderRadius: '3px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.04em',
                            }}>
                              Latest
                            </span>
                          )}
                        </div>
                        
                        <div style={{
                          fontSize: '10px',
                          color: 'var(--qs-text-muted)',
                          marginTop: '2px',
                          fontFamily: 'var(--qs-font-mono)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '150px',
                        }}>
                          {item.filename}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Save / Categorization Modal ──────────────────── */}
      {isSaveModalOpen && pendingImgData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 10, 15, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
        }}>
          <div style={{
            background: 'var(--qs-bg-secondary)',
            border: '1px solid var(--qs-border)',
            borderRadius: 'var(--qs-radius-lg)',
            width: '450px',
            maxWidth: '95%',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}>
            {/* Modal Header */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--qs-border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--qs-bg-tertiary)',
            }}>
              <span style={{ fontWeight: 600, fontSize: 'var(--qs-font-md)', color: 'var(--qs-text-primary)' }}>
                Categorize Snapshot
              </span>
              <button
                onClick={() => {
                  setIsSaveModalOpen(false)
                  setPendingImgData(null)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--qs-text-muted)',
                  cursor: 'pointer',
                  fontSize: '18px',
                  outline: 'none',
                }}
              >
                &times;
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Image Preview Thumbnail */}
              <div style={{
                width: '100%',
                height: '140px',
                background: '#040406',
                border: '1px solid var(--qs-border)',
                borderRadius: 'var(--qs-radius-md)',
                overflow: 'hidden',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <img
                  src={pendingImgData}
                  alt="Preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                  }}
                />
              </div>

              {/* Category Input (Autocomplete) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: 'var(--qs-font-xs)', fontWeight: 600, color: 'var(--qs-text-secondary)' }}>
                  Category
                </label>
                <input
                  type="text"
                  list="modal-categories"
                  value={modalCategory}
                  onChange={(e) => handleModalCategoryChange(e.target.value)}
                  placeholder="e.g. charts, orders, general"
                  style={{
                    background: 'var(--qs-bg-primary)',
                    border: '1px solid var(--qs-border)',
                    borderRadius: 'var(--qs-radius-sm)',
                    color: 'var(--qs-text-primary)',
                    padding: '8px 12px',
                    fontSize: 'var(--qs-font-sm)',
                    outline: 'none',
                    fontFamily: 'var(--qs-font-sans)',
                  }}
                />
                <datalist id="modal-categories">
                  {categories.map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>

              {/* Filename Input */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: 'var(--qs-font-xs)', fontWeight: 600, color: 'var(--qs-text-secondary)' }}>
                  Filename
                </label>
                <input
                  type="text"
                  value={modalFilename}
                  onChange={(e) => setModalFilename(e.target.value)}
                  placeholder="filename.png"
                  style={{
                    background: 'var(--qs-bg-primary)',
                    border: '1px solid var(--qs-border)',
                    borderRadius: 'var(--qs-radius-sm)',
                    color: 'var(--qs-text-primary)',
                    padding: '8px 12px',
                    fontSize: 'var(--qs-font-mono)',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: '10px', color: 'var(--qs-text-muted)' }}>
                  Saved as a PNG file inside the today's snapshot folder.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--qs-border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              background: 'var(--qs-bg-tertiary)',
            }}>
              <button
                onClick={() => {
                  setIsSaveModalOpen(false)
                  setPendingImgData(null)
                }}
                disabled={saving}
                style={{
                  background: 'transparent',
                  border: '1px solid var(--qs-border)',
                  color: 'var(--qs-text-secondary)',
                  padding: '8px 16px',
                  borderRadius: 'var(--qs-radius-sm)',
                  cursor: 'pointer',
                  fontSize: 'var(--qs-font-sm)',
                  fontWeight: 500,
                  outline: 'none',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSnapshot}
                disabled={saving || !modalCategory.trim() || !modalFilename.trim()}
                style={{
                  background: 'var(--qs-blue)',
                  border: 'none',
                  color: '#ffffff',
                  padding: '8px 20px',
                  borderRadius: 'var(--qs-radius-sm)',
                  cursor: (saving || !modalCategory.trim() || !modalFilename.trim()) ? 'not-allowed' : 'pointer',
                  fontSize: 'var(--qs-font-sm)',
                  fontWeight: 500,
                  outline: 'none',
                  opacity: (saving || !modalCategory.trim() || !modalFilename.trim()) ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {saving ? 'Saving...' : 'Save to Board'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
