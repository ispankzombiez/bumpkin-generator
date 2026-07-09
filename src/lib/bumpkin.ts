import type { BumpkinSlot, ItemIdMap } from './sunflower'

export type SelectedLoadout = Partial<Record<BumpkinSlot, string>>

const TOKEN_SLOT_INDEX: Record<BumpkinSlot, number> = {
  background: 0,
  body: 1,
  hair: 2,
  shirt: 3,
  pants: 4,
  shoes: 5,
  tool: 6,
  hat: 7,
  necklace: 8,
  secondaryTool: 9,
  coat: 10,
  onesie: 11,
  suit: 12,
  wings: 13,
  dress: 14,
  beard: 15,
  aura: 16,
  eyes: 17,
  mouth: 18,
}

export const SLOT_LABELS: Record<BumpkinSlot, string> = {
  background: 'Background',
  body: 'Body',
  hair: 'Hair',
  shirt: 'Shirt',
  pants: 'Pants',
  shoes: 'Shoes',
  tool: 'Tool',
  hat: 'Hat',
  necklace: 'Necklace',
  secondaryTool: 'Secondary Tool',
  coat: 'Coat',
  onesie: 'Onesie',
  suit: 'Suit',
  wings: 'Wings',
  dress: 'Dress',
  beard: 'Beard',
  aura: 'Aura',
  eyes: 'Eyes',
  mouth: 'Mouth',
}

const ANIMATION_BASE_URL = 'https://animations.sunflower-land.com/animated_webp'
const PROFILE_ICON_BASE_URL = 'https://animations.sunflower-land.com/bumpkin_image'

export function buildTokenUriFromSelection(
  selected: SelectedLoadout,
  itemIds: ItemIdMap,
) {
  const slots = Array(19).fill(0) as number[]

  for (const [slot, itemName] of Object.entries(selected)) {
    if (!itemName) continue

    const index = TOKEN_SLOT_INDEX[slot as BumpkinSlot]
    const itemId = itemIds[itemName]

    if (typeof index === 'number' && typeof itemId === 'number') {
      slots[index] = itemId
    }
  }

  while (slots.length > 0 && slots[slots.length - 1] === 0) {
    slots.pop()
  }

  return slots.join('_')
}

export function buildAnimationUrls(tokenUri: string) {
  if (!tokenUri) {
    return { chibiUrl: '', iconUrl: '' }
  }

  const base = `${ANIMATION_BASE_URL}/0_v1_${tokenUri}`

  return {
    chibiUrl: `${base}/idle-small`,
    iconUrl: `${PROFILE_ICON_BASE_URL}/0_v1_${tokenUri}/100`,
  }
}

const VALID_SLOTS = new Set<keyof typeof SLOT_LABELS>(
  Object.keys(SLOT_LABELS) as Array<keyof typeof SLOT_LABELS>,
)

export function parseLoadoutFromSearch(search: string): SelectedLoadout {
  const params = new URLSearchParams(search)
  const next: SelectedLoadout = {}

  for (const [key, value] of params.entries()) {
    if (!VALID_SLOTS.has(key as keyof typeof SLOT_LABELS)) continue
    if (!value.trim()) continue

    next[key as BumpkinSlot] = value
  }

  return next
}

export function buildSearchFromLoadout(selected: SelectedLoadout): string {
  const params = new URLSearchParams()

  for (const [slot, item] of Object.entries(selected)) {
    if (!item) continue
    params.set(slot, item)
  }

  return params.toString()
}
