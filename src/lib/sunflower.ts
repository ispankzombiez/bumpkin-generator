export type BumpkinSlot =
  | 'background'
  | 'body'
  | 'hair'
  | 'shirt'
  | 'pants'
  | 'shoes'
  | 'tool'
  | 'hat'
  | 'necklace'
  | 'secondaryTool'
  | 'coat'
  | 'onesie'
  | 'suit'
  | 'wings'
  | 'dress'
  | 'beard'
  | 'aura'
  | 'eyes'
  | 'mouth'

export const SLOT_ORDER: BumpkinSlot[] = [
  'background',
  'body',
  'hair',
  'shirt',
  'pants',
  'dress',
  'shoes',
  'tool',
  'hat',
  'necklace',
  'secondaryTool',
  'coat',
  'onesie',
  'suit',
  'wings',
  'beard',
  'aura',
  'eyes',
  'mouth',
]

export type ItemIdMap = Record<string, number>
export type ItemPartMap = Record<string, BumpkinSlot>

export type SunflowerCatalog = {
  sourceUrl: string
  fetchedAt: string
  itemIds: ItemIdMap
  itemPart: ItemPartMap
  itemsBySlot: Record<BumpkinSlot, string[]>
}

export type SunflowerNpcPreset = {
  name: string
  equipped: Partial<Record<BumpkinSlot, string>>
}

const SOURCE_URL =
  'https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/features/game/types/bumpkin.ts'

const NPC_SOURCE_URL =
  'https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/lib/npcs.ts'

const CACHE_KEY = 'bumpkin-generator.catalog.v1'
const NPC_CACHE_KEY = 'bumpkin-generator.npcs.v1'

export async function fetchSunflowerCatalog(
  forceRefresh = false,
): Promise<SunflowerCatalog> {
  if (!forceRefresh) {
    const cached = readCachedCatalog()
    if (cached) return cached
  }

  try {
    const response = await fetch(SOURCE_URL, { cache: 'no-store' })

    if (!response.ok) {
      throw new Error(`Source request failed with status ${response.status}`)
    }

    const source = await response.text()
    const itemIdsLiteral = extractObjectLiteral(source, 'export const ITEM_IDS')
    const itemPartLiteral = extractObjectLiteral(
      source,
      'export const BUMPKIN_ITEM_PART',
    )

    const itemIds = parseFlatObject(itemIdsLiteral, 'number') as ItemIdMap
    const itemPart = parseFlatObject(itemPartLiteral, 'string') as ItemPartMap

    const itemsBySlot = buildItemsBySlot(itemPart)

    const catalog: SunflowerCatalog = {
      sourceUrl: SOURCE_URL,
      fetchedAt: new Date().toISOString(),
      itemIds,
      itemPart,
      itemsBySlot,
    }

    writeCachedCatalog(catalog)
    return catalog
  } catch (error) {
    const fallback = readCachedCatalog()
    if (fallback) return fallback

    throw error instanceof Error
      ? error
      : new Error('Failed to load Sunflower Land wearables source.')
  }
}

export async function fetchSunflowerNpcPresets(
  forceRefresh = false,
): Promise<SunflowerNpcPreset[]> {
  if (!forceRefresh) {
    const cached = readCachedNpcPresets()
    if (cached) return cached
  }

  try {
    const response = await fetch(NPC_SOURCE_URL, { cache: 'no-store' })

    if (!response.ok) {
      throw new Error(`NPC source request failed with status ${response.status}`)
    }

    const source = await response.text()
    const npcLiteral = extractObjectLiteral(source, 'export const NPC_WEARABLES')
    const presets = parseNpcPresets(npcLiteral)

    writeCachedNpcPresets(presets)
    return presets
  } catch (error) {
    const fallback = readCachedNpcPresets()
    if (fallback) return fallback

    throw error instanceof Error
      ? error
      : new Error('Failed to load Sunflower Land NPC presets.')
  }
}

function buildItemsBySlot(itemPart: ItemPartMap) {
  const bySlot = Object.fromEntries(
    SLOT_ORDER.map((slot) => [slot, [] as string[]]),
  ) as Record<BumpkinSlot, string[]>

  for (const [item, slot] of Object.entries(itemPart)) {
    if (SLOT_ORDER.includes(slot)) {
      bySlot[slot].push(item)
    }
  }

  for (const slot of SLOT_ORDER) {
    bySlot[slot].sort((a, b) => a.localeCompare(b))
  }

  return bySlot
}

function parseFlatObject(
  objectLiteral: string,
  valueType: 'number' | 'string',
): Record<string, number | string> {
  const result: Record<string, number | string> = {}
  const body = objectLiteral.slice(1, -1)
  const lines = body.split('\n')

  for (const rawLine of lines) {
    const withoutComment = rawLine.replace(/\/\/.*$/, '').trim()
    if (!withoutComment) continue

    const line = withoutComment.endsWith(',')
      ? withoutComment.slice(0, -1)
      : withoutComment

    const separator = line.indexOf(':')
    if (separator < 0) continue

    const keyToken = line.slice(0, separator).trim()
    const valueToken = line.slice(separator + 1).trim()

    const key = unquoteToken(keyToken)
    const value =
      valueType === 'number' ? Number(valueToken) : unquoteToken(valueToken)

    if (!key) continue
    if (valueType === 'number' && Number.isNaN(value)) continue

    result[key] = value
  }

  return result
}

function unquoteToken(token: string) {
  const value = token.trim()

  if (value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1)
  }

  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1)
  }

  return value
}

function extractObjectLiteral(source: string, marker: string) {
  const markerIndex = source.indexOf(marker)
  if (markerIndex < 0) {
    throw new Error(`Marker not found in source: ${marker}`)
  }

  const afterMarker = source.slice(markerIndex)
  const openingBrace = afterMarker.indexOf('{')
  if (openingBrace < 0) {
    throw new Error(`Object start not found for marker: ${marker}`)
  }

  const fromBrace = afterMarker.slice(openingBrace)
  const terminator = fromBrace.match(/\n\s*};/)

  if (!terminator || terminator.index == null) {
    throw new Error(`Object end not found for marker: ${marker}`)
  }

  const endIndex = terminator.index + terminator[0].length
  return fromBrace.slice(0, endIndex)
}

function readCachedCatalog(): SunflowerCatalog | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return null

    return JSON.parse(raw) as SunflowerCatalog
  } catch {
    return null
  }
}

function writeCachedCatalog(catalog: SunflowerCatalog) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(catalog))
  } catch {
    // Ignore localStorage write failures.
  }
}

function parseNpcPresets(objectLiteral: string): SunflowerNpcPreset[] {
  const normalized = stripComments(objectLiteral)
    .replace(/;\s*$/, '')
    .replace(/([{,]\s*)([A-Za-z0-9_]+)\s*:/g, '$1"$2":')
    .replace(/,\s*}/g, '}')

  const parsed = JSON.parse(normalized) as Record<string, Partial<Record<BumpkinSlot, string>>>

  return Object.entries(parsed).map(([name, equipped]) => ({
    name,
    equipped,
  }))
}

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
}

function readCachedNpcPresets(): SunflowerNpcPreset[] | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(NPC_CACHE_KEY)
    if (!raw) return null

    return JSON.parse(raw) as SunflowerNpcPreset[]
  } catch {
    return null
  }
}

function writeCachedNpcPresets(presets: SunflowerNpcPreset[]) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(NPC_CACHE_KEY, JSON.stringify(presets))
  } catch {
    // Ignore localStorage write failures.
  }
}
