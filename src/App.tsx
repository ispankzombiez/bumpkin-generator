import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  SLOT_ORDER,
  fetchSunflowerCatalog,
  type BumpkinSlot,
  type SunflowerCatalog,
} from './lib/sunflower'
import {
  buildSearchFromLoadout,
  buildAnimationUrls,
  buildTokenUriFromSelection,
  parseLoadoutFromSearch,
  SLOT_LABELS,
  type SelectedLoadout,
} from './lib/bumpkin'

type ThemeMode = 'light' | 'dark'

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem('bumpkin-generator.theme')
    if (stored === 'dark' || stored === 'light') return stored

    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })
  const [catalog, setCatalog] = useState<SunflowerCatalog | null>(null)
  const [selected, setSelected] = useState<SelectedLoadout>(() =>
    parseLoadoutFromSearch(window.location.search),
  )
  const [activeSlot, setActiveSlot] = useState<BumpkinSlot | null>(null)
  const [slotQuery, setSlotQuery] = useState('')
  const [failedIconFor, setFailedIconFor] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)

  useEffect(() => {
    void loadCatalog()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('bumpkin-generator.theme', theme)
  }, [theme])

  useEffect(() => {
    const search = buildSearchFromLoadout(selected)
    const query = search ? `?${search}` : ''
    const next = `${window.location.pathname}${query}${window.location.hash}`
    window.history.replaceState(null, '', next)
  }, [selected])

  async function loadCatalog(forceRefresh = false) {
    setLoading(true)
    setError('')

    try {
      const data = await fetchSunflowerCatalog(forceRefresh)
      setCatalog(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load wearables.')
    } finally {
      setLoading(false)
    }
  }

  function onSlotChange(slot: BumpkinSlot, value: string) {
    setSelected((previous) => {
      const next = { ...previous }

      if (!value) {
        delete next[slot]
      } else {
        next[slot] = value
      }

      return next
    })
  }

  function clearAllSlots() {
    setSelected({})
  }

  const tokenUri = useMemo(() => {
    if (!catalog) return ''
    return buildTokenUriFromSelection(selected, catalog.itemIds)
  }, [catalog, selected])

  const animations = useMemo(() => buildAnimationUrls(tokenUri), [tokenUri])
  const iconLoadError = !!animations.iconUrl && failedIconFor === animations.iconUrl

  const activeSlotItems = useMemo(() => {
    if (!activeSlot) return []

    const items = catalog?.itemsBySlot[activeSlot] ?? []
    const query = slotQuery.trim().toLowerCase()

    if (!query) return items
    return items.filter((item) => item.toLowerCase().includes(query))
  }, [activeSlot, catalog, slotQuery])

  const shareUrl = window.location.href

  async function copyToken() {
    if (!tokenUri) return

    try {
      await navigator.clipboard.writeText(tokenUri)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopiedShare(true)
      window.setTimeout(() => setCopiedShare(false), 1400)
    } catch {
      setCopiedShare(false)
    }
  }

  async function downloadImage(url: string, filename: string) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error('Asset download failed')

      const blob = await response.blob()
      const blobUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>
            Bumpkin Generator <span className="title-tag">by iSPANK</span>
          </h1>
          <p className="subtitle">
            Live catalog from Sunflower Land source, instant chibi + icon preview,
            and one-click downloads.
          </p>
        </div>
        <div className="topbar-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => void loadCatalog(true)}
            disabled={loading}
          >
            {loading ? 'Syncing...' : 'Refresh Catalog'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => setTheme((previous) => (previous === 'dark' ? 'light' : 'dark'))}
          >
            {theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
          </button>
        </div>
      </header>

      {!!error && <p className="error-banner">{error}</p>}

      <section className="workspace-grid">
        <div className="panel loadout-panel">
          <div className="panel-header">
            <div className="panel-title-row">
              <h2>Equip</h2>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={clearAllSlots}
                disabled={Object.keys(selected).length === 0}
              >
                Clear All
              </button>
            </div>
            {catalog && (
              <p className="meta-line">
                {Object.keys(catalog.itemIds).length} items from live source
              </p>
            )}
          </div>

          <div className="slot-grid">
            {SLOT_ORDER.map((slot) => {
              const hasItems = (catalog?.itemsBySlot[slot]?.length ?? 0) > 0

              return (
                <div key={slot} className="slot-field">
                  <span>{SLOT_LABELS[slot]}</span>
                  <div className="slot-picker-row">
                    <button
                      type="button"
                      className="slot-picker-button"
                      disabled={loading || !hasItems}
                      onClick={() => {
                        setSlotQuery('')
                        setActiveSlot(slot)
                      }}
                    >
                      {selected[slot] ?? `Select ${SLOT_LABELS[slot]}`}
                    </button>
                    <button
                      type="button"
                      className="slot-clear-button"
                      disabled={!selected[slot]}
                      onClick={() => onSlotChange(slot, '')}
                      aria-label={`Clear ${SLOT_LABELS[slot]}`}
                    >
                      ×
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="panel preview-panel">
          <div className="panel-header">
            <h2>Preview</h2>
          </div>

          <div className="preview-grid">
            <article className="preview-card">
              <h3>Chibi (idle-small)</h3>
              {tokenUri ? (
                <img
                  src={animations.chibiUrl}
                  alt="Bumpkin chibi preview"
                  className="preview-image"
                />
              ) : (
                <p className="placeholder">Equip at least one item to preview.</p>
              )}
              <button
                type="button"
                className="btn"
                disabled={!tokenUri}
                onClick={() => void downloadImage(animations.chibiUrl, 'bumpkin-chibi.webp')}
              >
                Download Chibi
              </button>
            </article>

            <article className="preview-card">
              <h3>Player Icon (idle)</h3>
              {tokenUri && !iconLoadError ? (
                <img
                  key={animations.iconUrl}
                  src={animations.iconUrl}
                  alt="Bumpkin player icon preview"
                  className="preview-image"
                  onError={() => setFailedIconFor(animations.iconUrl)}
                />
              ) : (
                <p className="placeholder">
                  {tokenUri
                    ? 'Player icon endpoint returned no image for this loadout.'
                    : 'Equip at least one item to preview.'}
                </p>
              )}
              <button
                type="button"
                className="btn"
                disabled={!tokenUri}
                onClick={() => void downloadImage(animations.iconUrl, 'bumpkin-icon.webp')}
              >
                Download Icon
              </button>
            </article>
          </div>

          <div className="token-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void copyToken()}
              disabled={!tokenUri}
            >
              {copied ? 'Copied' : 'Copy Token URI'}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void copyShareLink()}
            >
              {copiedShare ? 'Link Copied' : 'Copy Share Link'}
            </button>
            <a
              className="btn btn-ghost"
              href={
                catalog?.sourceUrl ??
                'https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/features/game/types/bumpkin.ts'
              }
              target="_blank"
              rel="noreferrer"
            >
              View Live Source
            </a>
          </div>
        </div>
      </section>

      <footer className="footer-note">
        Catalog updates are automatic from the Sunflower Land repository. If they
        add new wearables, they appear here on refresh.
      </footer>

      {activeSlot && (
        <div
          className="picker-backdrop"
          onClick={() => {
            setActiveSlot(null)
            setSlotQuery('')
          }}
        >
          <div className="picker-modal" onClick={(event) => event.stopPropagation()}>
            <div className="picker-head">
              <h3>Choose {SLOT_LABELS[activeSlot]}</h3>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setActiveSlot(null)
                  setSlotQuery('')
                }}
              >
                Close
              </button>
            </div>

            <input
              type="text"
              className="picker-search"
              placeholder={`Search ${SLOT_LABELS[activeSlot]}`}
              value={slotQuery}
              onChange={(event) => setSlotQuery(event.target.value)}
              autoFocus
            />

            <div className="picker-list">
              <button
                type="button"
                className={`picker-item ${!selected[activeSlot] ? 'active' : ''}`}
                onClick={() => {
                  onSlotChange(activeSlot, '')
                  setActiveSlot(null)
                  setSlotQuery('')
                }}
              >
                None
              </button>
              {activeSlotItems.map((item) => (
                <button
                  type="button"
                  key={`${activeSlot}-${item}`}
                  className={`picker-item ${selected[activeSlot] === item ? 'active' : ''}`}
                  onClick={() => {
                    onSlotChange(activeSlot, item)
                    setActiveSlot(null)
                    setSlotQuery('')
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default App
