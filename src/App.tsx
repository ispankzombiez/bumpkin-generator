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

function App() {
  const [catalog, setCatalog] = useState<SunflowerCatalog | null>(null)
  const [selected, setSelected] = useState<SelectedLoadout>(() =>
    parseLoadoutFromSearch(window.location.search),
  )
  const [filters, setFilters] = useState<Partial<Record<BumpkinSlot, string>>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)

  useEffect(() => {
    void loadCatalog()
  }, [])

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

  function onFilterChange(slot: BumpkinSlot, value: string) {
    setFilters((previous) => ({ ...previous, [slot]: value }))
  }

  const tokenUri = useMemo(() => {
    if (!catalog) return ''
    return buildTokenUriFromSelection(selected, catalog.itemIds)
  }, [catalog, selected])

  const animations = useMemo(() => buildAnimationUrls(tokenUri), [tokenUri])

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
          <p className="eyebrow">Sunflower Land Wearable Studio</p>
          <h1>Bumpkin Generator</h1>
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
        </div>
      </header>

      {!!error && <p className="error-banner">{error}</p>}

      <section className="workspace-grid">
        <div className="panel loadout-panel">
          <div className="panel-header">
            <h2>Equip</h2>
            {catalog && (
              <p className="meta-line">
                {Object.keys(catalog.itemIds).length} items from live source
              </p>
            )}
          </div>

          <div className="slot-grid">
            {SLOT_ORDER.map((slot) => {
              const items = catalog?.itemsBySlot[slot] ?? []
              const filter = (filters[slot] ?? '').trim().toLowerCase()
              const filteredItems = filter
                ? items.filter((item) => item.toLowerCase().includes(filter))
                : items

              return (
                <label key={slot} className="slot-field">
                  <span>{SLOT_LABELS[slot]}</span>
                  <input
                    className="slot-filter"
                    type="text"
                    placeholder={`Search ${SLOT_LABELS[slot]}`}
                    value={filters[slot] ?? ''}
                    onChange={(event) => onFilterChange(slot, event.target.value)}
                    disabled={loading || items.length === 0}
                  />
                  <select
                    value={selected[slot] ?? ''}
                    onChange={(event) => onSlotChange(slot, event.target.value)}
                    disabled={loading || items.length === 0}
                  >
                    <option value="">None</option>
                    {filteredItems.map((item) => (
                      <option key={`${slot}-${item}`} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
              )
            })}
          </div>
        </div>

        <div className="panel preview-panel">
          <div className="panel-header">
            <h2>Preview</h2>
            <p className="meta-line">Token URI: {tokenUri || 'N/A'}</p>
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
              {tokenUri ? (
                <img
                  src={animations.iconUrl}
                  alt="Bumpkin player icon preview"
                  className="preview-image"
                />
              ) : (
                <p className="placeholder">Equip at least one item to preview.</p>
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
    </main>
  )
}

export default App
