import { GIFEncoder, applyPalette, quantize } from 'gifenc'

export type GifConversionOptions = {
  scale?: number
}

function findTransparentIndex(palette: number[][]) {
  for (let i = 0; i < palette.length; i += 1) {
    const color = palette[i]
    if (color.length >= 4 && color[3] === 0) {
      return i
    }
  }

  return -1
}

export async function convertAnimatedWebpToGif(
  webpBlob: Blob,
  options: GifConversionOptions = {},
) {
  const ImageDecoderCtor = window.ImageDecoder

  if (!ImageDecoderCtor) {
    throw new Error('ImageDecoder is not available in this browser')
  }

  const data = await webpBlob.arrayBuffer()
  const decoder = new ImageDecoderCtor({
    data,
    type: 'image/webp',
  })

  await decoder.tracks.ready

  const track = decoder.tracks.selectedTrack
  const frameCount = Math.max(1, track?.frameCount ?? 1)

  const firstDecoded = await decoder.decode({ frameIndex: 0 })
  const firstFrame = firstDecoded.image
  const sourceWidth = firstFrame.displayWidth || firstFrame.codedWidth || 0
  const sourceHeight = firstFrame.displayHeight || firstFrame.codedHeight || 0
  const scale = Math.max(1, Math.floor(options.scale ?? 1))
  const width = sourceWidth * scale
  const height = sourceHeight * scale

  if (!width || !height) {
    firstFrame.close()
    throw new Error('Invalid frame dimensions from decoder')
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height

  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) {
    throw new Error('Could not initialize canvas context')
  }

  const gif = GIFEncoder()

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const result =
      frameIndex === 0 ? firstDecoded : await decoder.decode({ frameIndex })
    const frame = result.image

    context.clearRect(0, 0, width, height)
    context.drawImage(frame, 0, 0, width, height)

    const imageData = context.getImageData(0, 0, width, height)
    const palette = quantize(imageData.data, 256, {
      format: 'rgba4444',
      oneBitAlpha: true,
      clearAlpha: false,
    })
    const indexedFrame = applyPalette(imageData.data, palette, 'rgba4444')
    const transparentIndex = findTransparentIndex(palette)

    const frameDurationUs = typeof frame.duration === 'number' ? frame.duration : 100000
    const delayMs = Math.max(20, Math.round(frameDurationUs / 1000))

    gif.writeFrame(indexedFrame, width, height, {
      palette,
      delay: delayMs,
      repeat: 0,
      transparent: transparentIndex >= 0,
      transparentIndex: transparentIndex >= 0 ? transparentIndex : 0,
    })

    frame.close()
  }

  gif.finish()
  const bytes = gif.bytes()

  if (!bytes || bytes.byteLength === 0) {
    throw new Error('GIF conversion produced an empty file')
  }

  const safeBytes = new Uint8Array(bytes.byteLength)
  safeBytes.set(bytes)

  return new Blob([safeBytes.buffer], { type: 'image/gif' })
}
