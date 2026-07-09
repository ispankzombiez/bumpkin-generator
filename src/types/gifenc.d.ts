declare module 'gifenc' {
  export type Palette = number[][]

  export function quantize(
    rgba: Uint8Array | Uint8ClampedArray,
    maxColors: number,
    options?: {
      format?: 'rgb565' | 'rgb444' | 'rgba4444'
      oneBitAlpha?: boolean | number
      clearAlpha?: boolean
      clearAlphaThreshold?: number
      clearAlphaColor?: number
    },
  ): Palette

  export function applyPalette(
    rgba: Uint8Array | Uint8ClampedArray,
    palette: Palette,
    format?: string,
  ): Uint8Array

  export type GIFEncoderStream = {
    writeFrame: (
      index: Uint8Array,
      width: number,
      height: number,
      options?: {
        palette?: Palette
        delay?: number
        repeat?: number
        transparent?: boolean
        transparentIndex?: number
      },
    ) => void
    finish: () => void
    bytes: () => Uint8Array
  }

  export function GIFEncoder(options?: { auto?: boolean }): GIFEncoderStream
}
