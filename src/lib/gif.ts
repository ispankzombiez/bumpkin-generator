import { GIFEncoder, applyPalette, quantize } from 'gifenc'

export async function convertAnimatedWebpToGif(webpBlob: Blob) {
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
  const width = firstFrame.displayWidth || firstFrame.codedWidth || 0
  const height = firstFrame.displayHeight || firstFrame.codedHeight || 0

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
    const palette = quantize(imageData.data, 256)
    const indexedFrame = applyPalette(imageData.data, palette)

    const frameDurationUs = typeof frame.duration === 'number' ? frame.duration : 100000
    const delayMs = Math.max(20, Math.round(frameDurationUs / 1000))

    gif.writeFrame(indexedFrame, width, height, {
      palette,
      delay: delayMs,
      repeat: 0,
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
