import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpeg: FFmpeg | null = null
let loadingPromise: Promise<void> | null = null

async function ensureFfmpegLoaded() {
  if (!ffmpeg) {
    ffmpeg = new FFmpeg()
  }

  if (!loadingPromise) {
    const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/esm'

    loadingPromise = (async () => {
      await ffmpeg!.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      })
    })()
  }

  await loadingPromise
  return ffmpeg
}

export async function convertAnimatedWebpToGif(webpBlob: Blob) {
  const ffmpegInstance = await ensureFfmpegLoaded()

  const inputFile = `input-${Date.now()}.webp`
  const outputFile = `output-${Date.now()}.gif`

  await ffmpegInstance.writeFile(inputFile, await fetchFile(webpBlob))

  await ffmpegInstance.exec([
    '-i',
    inputFile,
    '-vf',
    'fps=15,scale=iw:-1:flags=lanczos',
    '-loop',
    '0',
    outputFile,
  ])

  const data = await ffmpegInstance.readFile(outputFile)
  const bytes =
    data instanceof Uint8Array
      ? new Uint8Array(data)
      : new TextEncoder().encode(String(data))

  await ffmpegInstance.deleteFile(inputFile)
  await ffmpegInstance.deleteFile(outputFile)

  return new Blob([bytes.buffer], { type: 'image/gif' })
}
