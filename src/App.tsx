import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  SLOT_ORDER,
  fetchSunflowerCatalog,
  fetchSunflowerNpcPresets,
  type BumpkinSlot,
  type SunflowerCatalog,
  type SunflowerNpcPreset,
} from './lib/sunflower'
import {
  buildSearchFromLoadout,
  buildAnimationUrls,
  buildAuraUrls,
  buildTokenUriFromSelection,
  formatLoadoutForClipboard,
  parseLoadoutFromSearch,
  SLOT_LABELS,
  type SelectedLoadout,
} from './lib/bumpkin'
import { convertAnimatedWebpToGif } from './lib/gif'
import { convertAnimatedWebpToCompositedWebp } from './lib/webp'

type ThemeMode = 'light' | 'dark'
type AppTab = 'main' | 'npcs'

const AURA_FRAME_WIDTH = 20
const AURA_FRAME_HEIGHT = 19
const AURA_FRAME_COUNT = 8
const AURA_FPS = 10
const GIF_SCALE_MIN = 1
const GIF_SCALE_MAX = 6
const GIF_SCALE_DEFAULT = GIF_SCALE_MAX

const DEFAULT_LOADOUT: SelectedLoadout = {
  background: 'Deep Sea Salt Cave Background',
  hair: 'Two-toned Layered',
  body: 'Pirate Potion',
  shirt: 'Olive Royalty Shirt',
  pants: 'Brown Suspenders',
  shoes: 'Black Farmer Boots',
  tool: 'Infernal Bullwhip',
  hat: 'Deep Sea Helm',
  necklace: 'Green Amulet',
  secondaryTool: 'Infernal Drill',
  aura: 'Wisp Aura',
}

function getInitialTab(): AppTab {
  const params = new URLSearchParams(window.location.search)
  return params.get('tab') === 'npcs' ? 'npcs' : 'main'
}

function getInitialNpcQuery() {
  const params = new URLSearchParams(window.location.search)
  return params.get('npc')?.trim() ?? ''
}

function getInitialLoadout() {
  const parsed = parseLoadoutFromSearch(window.location.search)
  return Object.keys(parsed).length > 0 ? parsed : DEFAULT_LOADOUT
}

function AuraSprite({ src, className }: { src: string; className: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    if (!src) return

    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const image = new Image()
    image.crossOrigin = 'anonymous'

    let frame = 0
    let lastFrameAt = 0
    let rafId = 0

    const draw = () => {
      ctx.clearRect(0, 0, AURA_FRAME_WIDTH, AURA_FRAME_HEIGHT)
      ctx.drawImage(
        image,
        frame * AURA_FRAME_WIDTH,
        0,
        AURA_FRAME_WIDTH,
        AURA_FRAME_HEIGHT,
        0,
        0,
        AURA_FRAME_WIDTH,
        AURA_FRAME_HEIGHT,
      )
    }

    const tick = (timestamp: number) => {
      const frameMs = 1000 / AURA_FPS
      if (!lastFrameAt || timestamp - lastFrameAt >= frameMs) {
        frame = (frame + 1) % AURA_FRAME_COUNT
        lastFrameAt = timestamp
        draw()
      }

      rafId = window.requestAnimationFrame(tick)
    }

    image.onload = () => {
      frame = 0
      draw()
      rafId = window.requestAnimationFrame(tick)
    }

    image.src = src

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId)
      }
    }
  }, [src])

  return (
    <canvas
      ref={canvasRef}
      className={className}
      width={AURA_FRAME_WIDTH}
      height={AURA_FRAME_HEIGHT}
    />
  )
}

type PreviewPairProps = {
  loadout: SelectedLoadout
  catalog: SunflowerCatalog | null
  sizePx?: number
  compact?: boolean
  chibiTitle?: string
  iconTitle?: string
  iconErrorUrl?: string
  onIconError?: (url: string) => void
  chibiActionLabel?: string
  onChibiAction?: () => void
  iconActionLabel?: string
  onIconAction?: () => void
  disableChibiAction?: boolean
  disableIconAction?: boolean
}

type PreviewActionPayload = {
  loadout: SelectedLoadout
  chibiUrl: string
  iconUrl: string
  auraBackUrl: string
  auraFrontUrl: string
}

type DownloadTarget = PreviewActionPayload & {
  fileBaseName: string
}

function sanitizeFileName(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'bumpkin'
}

function PreviewPair({
  loadout,
  catalog,
  sizePx = 180,
  compact = false,
  chibiTitle = 'Chibi',
  iconTitle = 'Player Icon',
  iconErrorUrl,
  onIconError,
  chibiActionLabel,
  onChibiAction,
  iconActionLabel,
  onIconAction,
  disableChibiAction = false,
  disableIconAction = false,
}: PreviewPairProps) {
  const tokenUri = useMemo(() => {
    if (!catalog) return ''
    return buildTokenUriFromSelection(loadout, catalog.itemIds)
  }, [catalog, loadout])

  const animations = useMemo(() => buildAnimationUrls(tokenUri), [tokenUri])
  const auraId = useMemo(() => {
    if (!catalog) return 0
    const auraName = loadout.aura
    if (!auraName) return 0

    return catalog.itemIds[auraName] ?? 0
  }, [catalog, loadout.aura])
  const auraUrls = useMemo(() => buildAuraUrls(auraId), [auraId])
  const iconLoadError = !!animations.iconUrl && iconErrorUrl === animations.iconUrl
  const actionPayload: PreviewActionPayload | null = tokenUri
    ? {
        loadout,
        chibiUrl: animations.chibiUrl,
        iconUrl: animations.iconUrl,
        auraBackUrl: auraUrls.backUrl,
        auraFrontUrl: auraUrls.frontUrl,
      }
    : null

  return (
    <div
      className={`preview-grid ${compact ? 'preview-grid-compact' : ''}`}
      style={{ ['--sprite-width' as string]: `${sizePx}px` }}
    >
      <article className={`preview-card ${compact ? 'preview-card-compact' : ''}`}>
        <div className="preview-card-head">
          <h3>{chibiTitle}</h3>
          {chibiActionLabel && onChibiAction && (
            <button
              type="button"
              className="btn btn-ghost preview-card-action"
              onClick={() => actionPayload && onChibiAction()}
              disabled={disableChibiAction || !actionPayload}
            >
              {chibiActionLabel}
            </button>
          )}
        </div>
        <div className="preview-media">
          {tokenUri ? (
            <div className="preview-chibi-stack">
              {!!auraUrls.backUrl && (
                <AuraSprite
                  src={auraUrls.backUrl}
                  className="preview-aura-layer preview-aura-back"
                />
              )}
              <img
                src={animations.chibiUrl}
                alt={`${chibiTitle} preview`}
                className="preview-chibi-image"
              />
              {!!auraUrls.frontUrl && (
                <AuraSprite
                  src={auraUrls.frontUrl}
                  className="preview-aura-layer preview-aura-front"
                />
              )}
            </div>
          ) : (
            <p className="placeholder">Equip at least one item to preview.</p>
          )}
        </div>
      </article>

      <article className={`preview-card ${compact ? 'preview-card-compact' : ''}`}>
        <div className="preview-card-head">
          <h3>{iconTitle}</h3>
          {iconActionLabel && onIconAction && (
            <button
              type="button"
              className="btn btn-ghost preview-card-action"
              onClick={() => actionPayload && onIconAction()}
              disabled={disableIconAction || !actionPayload}
            >
              {iconActionLabel}
            </button>
          )}
        </div>
        <div className="preview-media">
          {tokenUri && !iconLoadError ? (
            <img
              src={animations.iconUrl}
              alt={`${iconTitle} preview`}
              className="preview-image preview-icon-image"
              onError={() => onIconError?.(animations.iconUrl)}
            />
          ) : (
            <p className="placeholder">
              {tokenUri
                ? 'Player icon endpoint returned no image for this loadout.'
                : 'Equip at least one item to preview.'}
            </p>
          )}
        </div>
      </article>
    </div>
  )
}

function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    const stored = window.localStorage.getItem('bumpkin-generator.theme')
    if (stored === 'dark' || stored === 'light') return stored

    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  })
  const [activeTab, setActiveTab] = useState<AppTab>(() => getInitialTab())
  const [catalog, setCatalog] = useState<SunflowerCatalog | null>(null)
  const [selected, setSelected] = useState<SelectedLoadout>(() => getInitialLoadout())
  const [npcPresets, setNpcPresets] = useState<SunflowerNpcPreset[]>([])
  const [npcLoading, setNpcLoading] = useState(true)
  const [npcError, setNpcError] = useState('')
  const [npcQuery, setNpcQuery] = useState(() => getInitialNpcQuery())
  const [activeSlot, setActiveSlot] = useState<BumpkinSlot | null>(null)
  const [slotQuery, setSlotQuery] = useState('')
  const [failedIconFor, setFailedIconFor] = useState('')
  const [copiedNpcName, setCopiedNpcName] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copiedShare, setCopiedShare] = useState(false)
  const [chibiDownloadOpen, setChibiDownloadOpen] = useState(false)
  const [convertingDownload, setConvertingDownload] = useState(false)
  const [gifError, setGifError] = useState('')
  const [gifScale, setGifScale] = useState(GIF_SCALE_DEFAULT)
  const [downloadTarget, setDownloadTarget] = useState<DownloadTarget | null>(null)

  useEffect(() => {
    void loadCatalog()
  }, [])

  useEffect(() => {
    void loadNpcPresets()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    window.localStorage.setItem('bumpkin-generator.theme', theme)
  }, [theme])

  useEffect(() => {
    const params = new URLSearchParams()

    if (activeTab === 'npcs') {
      params.set('tab', 'npcs')
      if (npcQuery.trim()) {
        params.set('npc', npcQuery.trim())
      }
    } else {
      const search = buildSearchFromLoadout(selected)
      const loadoutParams = new URLSearchParams(search)

      for (const [key, value] of loadoutParams.entries()) {
        params.set(key, value)
      }
    }

    const query = params.toString()
    const next = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`
    window.history.replaceState(null, '', next)
  }, [selected, activeTab, npcQuery])

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

  async function loadNpcPresets(forceRefresh = false) {
    setNpcLoading(true)
    setNpcError('')

    try {
      const presets = await fetchSunflowerNpcPresets(forceRefresh)
      setNpcPresets(presets)
    } catch (err) {
      setNpcError(err instanceof Error ? err.message : 'Could not load NPC presets.')
    } finally {
      setNpcLoading(false)
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

  function applyLoadout(nextLoadout: SelectedLoadout) {
    setSelected(nextLoadout)
    setActiveTab('main')
    setNpcQuery('')
    setActiveSlot(null)
    setSlotQuery('')
    setFailedIconFor('')
  }

  async function copyNpcPreset(name: string, equipped: SelectedLoadout) {
    try {
      await navigator.clipboard.writeText(formatLoadoutForClipboard(equipped, name))
      setCopiedNpcName(name)
      window.setTimeout(() => setCopiedNpcName(''), 1400)
    } catch {
      setCopiedNpcName('')
    }
  }

  const tokenUri = useMemo(() => {
    if (!catalog) return ''
    return buildTokenUriFromSelection(selected, catalog.itemIds)
  }, [catalog, selected])

  const animations = useMemo(() => buildAnimationUrls(tokenUri), [tokenUri])
  const auraId = useMemo(() => {
    if (!catalog) return 0
    const auraName = selected.aura
    if (!auraName) return 0

    return catalog.itemIds[auraName] ?? 0
  }, [catalog, selected.aura])
  const auraUrls = useMemo(() => buildAuraUrls(auraId), [auraId])
  const showHeaderMiniBumpkin = !!animations.chibiUrl
  const mainPreviewActionPayload: PreviewActionPayload | null = tokenUri
    ? {
        loadout: selected,
        chibiUrl: animations.chibiUrl,
        iconUrl: animations.iconUrl,
        auraBackUrl: auraUrls.backUrl,
        auraFrontUrl: auraUrls.frontUrl,
      }
    : null

  const visibleNpcPresets = useMemo(() => {
    const query = npcQuery.trim().toLowerCase()

    if (!query) return npcPresets

    return npcPresets.filter((preset) => {
      if (preset.name.toLowerCase().includes(query)) return true

      return Object.values(preset.equipped).some((item) =>
        item?.toLowerCase().includes(query),
      )
    })
  }, [npcPresets, npcQuery])

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
      downloadBlob(blob, filename)
    } catch {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  function downloadBlob(blob: Blob, filename: string) {
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(blobUrl)
  }

  function openChibiDownload(payload: PreviewActionPayload, fileBaseName: string) {
    setDownloadTarget({ ...payload, fileBaseName })
    setGifError('')
    setGifScale(GIF_SCALE_DEFAULT)
    setChibiDownloadOpen(true)
  }

  function buildChibiExportOptions() {
    if (!downloadTarget) return null

    return {
      scale: gifScale,
      auraBackUrl: downloadTarget.auraBackUrl,
      auraFrontUrl: downloadTarget.auraFrontUrl,
      auraFrameWidth: AURA_FRAME_WIDTH,
      auraFrameHeight: AURA_FRAME_HEIGHT,
      auraFrameCount: AURA_FRAME_COUNT,
      auraFps: AURA_FPS,
      auraBackTopRatio: -0.21,
      auraFrontTopRatio: 0.14,
    }
  }

  async function downloadChibiAsWebp() {
    if (!downloadTarget) return

    const exportOptions = buildChibiExportOptions()
    if (!exportOptions) return

    setConvertingDownload(true)
    setGifError('')

    try {
      const response = await fetch(downloadTarget.chibiUrl)
      if (!response.ok) throw new Error('Could not fetch chibi animation')

      const webpBlob = await response.blob()
      const compositedWebpBlob = await convertAnimatedWebpToCompositedWebp(
        webpBlob,
        exportOptions,
      )

      downloadBlob(compositedWebpBlob, `${downloadTarget.fileBaseName}-chibi.webp`)
      setChibiDownloadOpen(false)
    } catch {
      setGifError(
        'WebP conversion failed in this browser. Try Chrome/Edge, or use GIF for now.',
      )
    } finally {
      setConvertingDownload(false)
    }
  }

  async function downloadChibiAsGif() {
    if (!downloadTarget) return

    const exportOptions = buildChibiExportOptions()
    if (!exportOptions) return

    setConvertingDownload(true)
    setGifError('')

    try {
      const response = await fetch(downloadTarget.chibiUrl)
      if (!response.ok) throw new Error('Could not fetch chibi animation')

      const webpBlob = await response.blob()
      const gifBlob = await convertAnimatedWebpToGif(webpBlob, exportOptions)

      downloadBlob(gifBlob, `${downloadTarget.fileBaseName}-chibi.gif`)
      setChibiDownloadOpen(false)
    } catch {
      setGifError(
        'GIF conversion failed in this browser. Try Chrome/Edge, or use WebP for now.',
      )
    } finally {
      setConvertingDownload(false)
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <h1>
            Bumpkin Generator{' '}
            <span className="title-tag">
              by{' '}
              <a
                href="https://sunflower-land.com/play/#/visit/1128976301583508"
                target="_blank"
                rel="noreferrer"
                className="title-link"
              >
                iSPANK
              </a>
              {showHeaderMiniBumpkin && (
                <span className="title-mini-bumpkin" aria-hidden="true">
                  <span className="title-mini-stack">
                    {!!auraUrls.backUrl && (
                      <AuraSprite
                        src={auraUrls.backUrl}
                        className="title-mini-aura title-mini-aura-back"
                      />
                    )}
                    <img
                      src={animations.chibiUrl}
                      alt=""
                      className="title-mini-image"
                    />
                    {!!auraUrls.frontUrl && (
                      <AuraSprite
                        src={auraUrls.frontUrl}
                        className="title-mini-aura title-mini-aura-front"
                      />
                    )}
                  </span>
                </span>
              )}
            </span>
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

      <div className="tab-bar" role="tablist" aria-label="Preview tabs">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'main'}
          className={`tab-button ${activeTab === 'main' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('main')
            setNpcQuery('')
          }}
        >
          Main
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'npcs'}
          className={`tab-button ${activeTab === 'npcs' ? 'active' : ''}`}
          onClick={() => setActiveTab('npcs')}
        >
          NPC&apos;s
        </button>
      </div>

      {activeTab === 'main' ? (
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

            <PreviewPair
              loadout={selected}
              catalog={catalog}
              sizePx={180}
              iconErrorUrl={failedIconFor}
              onIconError={(url) => setFailedIconFor(url)}
              chibiActionLabel="Download"
              onChibiAction={() => {
                if (!mainPreviewActionPayload) return
                openChibiDownload(mainPreviewActionPayload, 'bumpkin')
              }}
              iconActionLabel="Download"
              onIconAction={() => {
                if (!mainPreviewActionPayload) return
                void downloadImage(mainPreviewActionPayload.iconUrl, 'bumpkin-icon.webp')
              }}
              disableChibiAction={!tokenUri}
              disableIconAction={!tokenUri}
            />

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
      ) : (
        <section className="workspace-grid npc-workspace">
          <div className="panel npc-panel">
            <div className="panel-header">
              <div className="panel-title-row">
                <h2>NPC Presets</h2>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void loadNpcPresets(true)}
                  disabled={npcLoading}
                >
                  {npcLoading ? 'Syncing...' : 'Refresh NPCs'}
                </button>
              </div>
              <p className="meta-line">
                {npcPresets.length} presets from the live Sunflower source
              </p>
            </div>

            <input
              type="text"
              className="picker-search npc-search"
              placeholder="Search NPCs or items"
              value={npcQuery}
              onChange={(event) => setNpcQuery(event.target.value)}
            />

            {!!npcError && <p className="error-banner">{npcError}</p>}

            {npcLoading ? (
              <div className="placeholder">Loading NPC presets...</div>
            ) : (
              <div className="npc-grid">
                {visibleNpcPresets.map((preset) => {
                  const copied = copiedNpcName === preset.name

                  return (
                    <article key={preset.name} className="npc-card">
                      <div className="panel-title-row npc-card-head">
                        <h3>{preset.name}</h3>
                        <span className="meta-line">
                          {Object.keys(preset.equipped).length} items
                        </span>
                      </div>

                      <PreviewPair
                        loadout={preset.equipped}
                        catalog={catalog}
                        sizePx={140}
                        compact
                        chibiActionLabel="Download"
                        onChibiAction={() => {
                          if (!catalog) return

                          const npcTokenUri = buildTokenUriFromSelection(
                            preset.equipped,
                            catalog.itemIds,
                          )
                          if (!npcTokenUri) return

                          const npcAnimations = buildAnimationUrls(npcTokenUri)
                          const npcAuraId = preset.equipped.aura
                            ? (catalog.itemIds[preset.equipped.aura] ?? 0)
                            : 0
                          const npcAuraUrls = buildAuraUrls(npcAuraId)

                          openChibiDownload(
                            {
                              loadout: preset.equipped,
                              chibiUrl: npcAnimations.chibiUrl,
                              iconUrl: npcAnimations.iconUrl,
                              auraBackUrl: npcAuraUrls.backUrl,
                              auraFrontUrl: npcAuraUrls.frontUrl,
                            },
                            `npc-${sanitizeFileName(preset.name)}`,
                          )
                        }}
                        iconActionLabel="Download"
                        onIconAction={() => {
                          if (!catalog) return

                          const npcTokenUri = buildTokenUriFromSelection(
                            preset.equipped,
                            catalog.itemIds,
                          )
                          if (!npcTokenUri) return

                          const npcAnimations = buildAnimationUrls(npcTokenUri)
                          void downloadImage(
                            npcAnimations.iconUrl,
                            `npc-${sanitizeFileName(preset.name)}-icon.webp`,
                          )
                        }}
                        disableChibiAction={!catalog}
                        disableIconAction={!catalog}
                      />

                      <div className="npc-card-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => void copyNpcPreset(preset.name, preset.equipped)}
                        >
                          {copied ? 'Copied' : 'Copy Items'}
                        </button>
                        <button
                          type="button"
                          className="btn"
                          onClick={() => applyLoadout(preset.equipped)}
                        >
                          Use Preset
                        </button>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}

            {!npcLoading && visibleNpcPresets.length === 0 && (
              <div className="placeholder">No NPC presets match your search.</div>
            )}
          </div>
        </section>
      )}

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

      {chibiDownloadOpen && (
        <div
          className="picker-backdrop"
          onClick={() => {
            if (!convertingDownload) setChibiDownloadOpen(false)
          }}
        >
          <div className="picker-modal" onClick={(event) => event.stopPropagation()}>
            <div className="picker-head">
              <h3>Download Chibi As</h3>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setChibiDownloadOpen(false)}
                disabled={convertingDownload}
              >
                Close
              </button>
            </div>

            <div className="download-format-grid">
              <button
                type="button"
                className="btn"
                onClick={() => void downloadChibiAsWebp()}
                disabled={convertingDownload}
              >
                {convertingDownload ? 'Preparing...' : 'WebP (Animated)'}
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => void downloadChibiAsGif()}
                disabled={convertingDownload}
              >
                {convertingDownload ? 'Converting...' : 'GIF (Converted)'}
              </button>
            </div>

            <div className="gif-controls">
              <label htmlFor="gif-scale-slider">
                Export Size: {gifScale}x
              </label>
              <input
                id="gif-scale-slider"
                type="range"
                min={GIF_SCALE_MIN}
                max={GIF_SCALE_MAX}
                step={1}
                value={gifScale}
                onChange={(event) => setGifScale(Number(event.target.value))}
                disabled={convertingDownload}
              />
            </div>

            <div className="gif-preview-wrap">
              <p className="meta-line">Preview</p>
              <div className="gif-live-preview-stage">
                <div
                  className="preview-chibi-stack gif-live-preview-stack"
                  style={{ ['--sprite-width' as string]: `${70 * gifScale}px` }}
                >
                  {!!downloadTarget?.auraBackUrl && (
                    <AuraSprite
                      src={downloadTarget.auraBackUrl}
                      className="preview-aura-layer preview-aura-back"
                    />
                  )}
                  <img
                    src={downloadTarget?.chibiUrl ?? ''}
                    alt="GIF preview"
                    className="preview-chibi-image"
                  />
                  {!!downloadTarget?.auraFrontUrl && (
                    <AuraSprite
                      src={downloadTarget.auraFrontUrl}
                      className="preview-aura-layer preview-aura-front"
                    />
                  )}
                </div>
              </div>
            </div>

            {!!gifError && <p className="error-banner">{gifError}</p>}
          </div>
        </div>
      )}
    </main>
  )
}

export default App
