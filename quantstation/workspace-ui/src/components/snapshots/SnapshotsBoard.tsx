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

  // 1. Mount effect: Fetch snapshots and subscribe to directory changes
  useEffect(() => {
    let active = true

    const fetchSnapshots = async () => {
      try {
        setLoading(true)
        const list = await window.electronAPI.getSnapshots()
        if (active) {
          console.log(`[SnapshotsBoard] Loaded ${list.length} snapshots on mount.`)
          setSnapshots(list)
        }
      } catch (err) {
        console.error('[SnapshotsBoard] Failed to load snapshots:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchSnapshots()

    // Subscribe to IPC file-watcher updates
    const unsubscribe = window.electronAPI.onSnapshotsUpdated((updatedList) => {
      console.log(`[SnapshotsBoard] Folder update: received ${updatedList.length} snapshots.`)
      setSnapshots(updatedList)
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  // 2. Sync selection state when snapshots list, active category, or autoFollow toggles update
  useEffect(() => {
    if (snapshots.length === 0) {
      setActiveCategory('')
      setSelectedSnapshot(null)
      return
    }

    // 2a. Determine active category: keep current if still valid, otherwise fall back to first
    const currentCategoryValid = activeCategory && snapshots.some(s => s.category === activeCategory)
    const targetCategory = currentCategoryValid ? activeCategory : snapshots[0].category

    if (targetCategory !== activeCategory) {
      setActiveCategory(targetCategory)
    }

    // 2b. Determine selected snapshot within the category
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

  // 2. Fetch Selected Image Content (Base64)
  useEffect(() => {
    if (!selectedSnapshot) {
      setImgData(null)
      return
    }

    let active = true
    const loadImage = async () => {
      try {
        setImgLoading(true)
        const base64Data = await window.electronAPI.readSnapshot(selectedSnapshot.filename)
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
  }, [selectedSnapshot])

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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'var(--qs-bg-primary)',
      color: 'var(--qs-text-primary)',
      fontFamily: 'var(--qs-font-sans)',
      overflow: 'hidden',
    }}>
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
            <div className="panel__header" style={{ borderBottom: '1px solid var(--qs-border)' }}>
              <span className="panel__title">Categories</span>
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
                <div style={{
                  width: fitMode === 'fit' ? '100%' : fitMode === 'fill' ? '100%' : 'auto',
                  height: fitMode === 'fit' ? '100%' : fitMode === 'fill' ? '100%' : 'auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: 'auto',
                  transform: `scale(${zoomLevel})`,
                  transformOrigin: 'center center',
                  transition: 'transform 150ms ease-out',
                }}>
                  <img
                    src={imgData}
                    alt={selectedSnapshot?.filename}
                    style={{
                      maxWidth: fitMode === 'fit' ? '100%' : fitMode === 'original' ? 'none' : '100%',
                      maxHeight: fitMode === 'fit' ? '100%' : fitMode === 'original' ? 'none' : '100%',
                      objectFit: fitMode === 'fill' ? 'cover' : 'contain',
                      borderRadius: 'var(--qs-radius-sm)',
                      boxShadow: '0 8px 30px rgba(0, 0, 0, 0.6)',
                      border: '1px solid var(--qs-border)',
                      userSelect: 'none',
                    }}
                  />
                </div>
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
    </div>
  )
}
