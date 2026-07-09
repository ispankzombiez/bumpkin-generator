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

const SOURCE_URL =
  'https://raw.githubusercontent.com/sunflower-land/sunflower-land/main/src/features/game/types/bumpkin.ts'

const CACHE_KEY = 'bumpkin-generator.catalog.v1'

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

  const openingBrace = source.indexOf('{', markerIndex)
  if (openingBrace < 0) {
    throw new Error(`Object start not found for marker: ${marker}`)
  }

  let depth = 0
  let inString = false
  let quoteChar = ''

  for (let i = openingBrace; i < source.length; i += 1) {
    const char = source[i]
    const previous = i > 0 ? source[i - 1] : ''

    if (inString) {
      if (char === quoteChar && previous !== '\\') {
        inString = false
        quoteChar = ''
      }
      continue
    }

    if (char === '"' || char === "'") {
      inString = true
      quoteChar = char
      continue
    }

    if (char === '{') depth += 1
    if (char === '}') {
      depth -= 1
      if (depth === 0) {
        return source.slice(openingBrace, i + 1)
      }
    }
  }

  throw new Error(`Object end not found for marker: ${marker}`)
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
