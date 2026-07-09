import { Buffer as BufferPolyfill } from 'buffer'

type AnimatedFrameOptions = {
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

type NodeWebpMuxModule = {
  Image?: {
    initLib(): Promise<void>
    getEmptyImage(ext?: boolean): Promise<{
      load(source: Uint8Array): Promise<void>
      convertToAnim(): void
      setImageData(
        buffer: Uint8Array,
        options: {
          width: number
          height: number
          quality: number
          exact: boolean
          lossless: number
          method: number
          advanced: {
            alphaQuality: number
            alphaFiltering: number
            useSharpYUV: number
            nearLossless: number
          }
        },
      ): Promise<number>
      save(
        path: null,
        options: {
          width: number
          height: number
          frames: Array<{
            img: unknown
            delay: number
            x: number
            y: number
            blend: boolean
            dispose: boolean
          }>
          loops: number
          bgColor: [number, number, number, number]
        },
      ): Promise<Uint8Array>
    }>
  }
  default?: NodeWebpMuxModule
}

async function ensureBufferGlobal() {
  if ('Buffer' in globalThis) return

  ;(globalThis as typeof globalThis & { Buffer?: typeof BufferPolyfill }).Buffer =
    BufferPolyfill
}

async function getWebpModule() {
  await ensureBufferGlobal()

  const module = (await import('node-webpmux')) as NodeWebpMuxModule
  return module.Image ? module : module.default ?? module
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

export async function convertAnimatedWebpToCompositedWebp(
  webpBlob: Blob,
  options: AnimatedFrameOptions = {},
) {
  const ImageDecoderCtor = window.ImageDecoder

  if (!ImageDecoderCtor) {
    throw new Error('ImageDecoder is not available in this browser')
  }

  const WebP = await getWebpModule()
  if (!WebP.Image) {
    throw new Error('WebP encoder is not available')
  }

  await WebP.Image.initLib()

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
    const maxFramesFromImage = Math.max(1, Math.floor(image.naturalWidth / auraFrameWidth))
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

  const frames: Array<{
    img: unknown
    delay: number
    x: number
    y: number
    blend: boolean
    dispose: boolean
  }> = []
  let elapsedMs = 0

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const result = frameIndex === 0 ? firstDecoded : await decoder.decode({ frameIndex })
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
    const rgbaData = new Uint8Array(imageData.data)
    const still = await WebP.Image.getEmptyImage(true)
    const encodeResult = await still.setImageData(rgbaData, {
      width,
      height,
      quality: 100,
      exact: true,
      lossless: 9,
      method: 6,
      advanced: {
        alphaQuality: 100,
        alphaFiltering: 2,
        useSharpYUV: 1,
        nearLossless: 100,
      },
    })

    if (encodeResult !== 0) {
      frame.close()
      throw new Error('WebP encoding failed')
    }

    const frameDurationUs = typeof frame.duration === 'number' ? frame.duration : 100000
    const delayMs = Math.max(20, Math.round(frameDurationUs / 1000))

    frames.push({
      img: still,
      delay: delayMs,
      x: 0,
      y: 0,
      blend: true,
      dispose: false,
    })

    elapsedMs += delayMs
    frame.close()
  }

  const animation = await WebP.Image.getEmptyImage(true)
  animation.convertToAnim()

  const output = await animation.save(null, {
    width,
    height,
    frames,
    loops: 0,
    bgColor: [0, 0, 0, 0],
  })

  return new Blob([new Uint8Array(output)], { type: 'image/webp' })
}