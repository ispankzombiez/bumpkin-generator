import { GIFEncoder, applyPalette, quantize } from 'gifenc'

export type GifConversionOptions = {
  scale?: number
  auraBackUrl?: string
  auraFrontUrl?: string
  auraFrameWidth?: number
  auraFrameHeight?: number
  auraFrameCount?: number
  auraFps?: number
  auraBackTopRatio?: number
  auraFrontTopRatio?: number
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load image: ${url}`))
    image.src = url
  })
}

function getAuraFrameIndex(elapsedMs: number, fps: number, frameCount: number) {
  return Math.floor((elapsedMs / 1000) * fps) % Math.max(1, frameCount)
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
  const baseSize = Math.max(sourceWidth, sourceHeight)
  const width = baseSize * scale
  const height = baseSize * scale
  const chibiHeight = Math.round((sourceHeight / sourceWidth) * width)

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
  context.imageSmoothingEnabled = false

  const auraFrameWidth = options.auraFrameWidth ?? 20
  const auraFrameHeight = options.auraFrameHeight ?? 19
  const auraFrameCount = options.auraFrameCount ?? 8
  const auraFps = options.auraFps ?? 10
  const auraBackTopRatio = options.auraBackTopRatio ?? -0.21
  const auraFrontTopRatio = options.auraFrontTopRatio ?? 0.14
  const auraRenderHeight = Math.round((auraFrameHeight / auraFrameWidth) * width)

  const [auraBackImage, auraFrontImage] = await Promise.all([
    options.auraBackUrl
      ? loadImage(options.auraBackUrl).catch(() => null)
      : Promise.resolve(null),
    options.auraFrontUrl
      ? loadImage(options.auraFrontUrl).catch(() => null)
      : Promise.resolve(null),
  ])

  const drawAuraLayer = (image: HTMLImageElement, topRatio: number, elapsedMs: number) => {
    const maxFramesFromImage = Math.max(
      1,
      Math.floor(image.naturalWidth / auraFrameWidth),
    )
    const totalFrames = Math.max(1, Math.min(auraFrameCount, maxFramesFromImage))
    const frameIndex = getAuraFrameIndex(elapsedMs, auraFps, totalFrames)

    context.drawImage(
      image,
      frameIndex * auraFrameWidth,
      0,
      auraFrameWidth,
      auraFrameHeight,
      0,
      width * topRatio,
      width,
      auraRenderHeight,
    )
  }

  const gif = GIFEncoder()
  let elapsedMs = 0

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const result =
      frameIndex === 0 ? firstDecoded : await decoder.decode({ frameIndex })
    const frame = result.image

    context.clearRect(0, 0, width, height)

    if (auraBackImage) {
      drawAuraLayer(auraBackImage, auraBackTopRatio, elapsedMs)
    }

    context.drawImage(frame, 0, 0, width, chibiHeight)

    if (auraFrontImage) {
      drawAuraLayer(auraFrontImage, auraFrontTopRatio, elapsedMs)
    }

    const imageData = context.getImageData(0, 0, width, height)
    const palette = quantize(imageData.data, 256, {
      format: 'rgba4444',
      oneBitAlpha: 1,
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

    elapsedMs += delayMs

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
