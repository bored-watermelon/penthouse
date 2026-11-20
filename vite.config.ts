import { readFileSync } from 'node:fs'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import { imagetools } from 'vite-imagetools'

/**
 * The width and height of an MP4/MOV, read from its track header ("tkhd" box), so a clip can be laid out before it
 * has downloaded, the way vite-imagetools' metadata does it for pictures. Undefined if the file doesn't say.
 */
function videoSize(file: string): { width: number; height: number } | undefined {
  const buf = readFileSync(file)
  for (let at = buf.indexOf('tkhd'); at !== -1; at = buf.indexOf('tkhd', at + 4)) {
    const size = buf.readUInt32BE(at - 4)
    // width and height are the box's last 8 bytes, as 16.16 fixed point; an audio track has them at 0
    const width = buf.readUInt32BE(at - 4 + size - 8) / 65536
    const height = buf.readUInt32BE(at - 4 + size - 4) / 65536
    if (width > 0 && height > 0) return { width: Math.round(width), height: Math.round(height) }
  }
  return undefined
}

/** `import clip from './x.mp4?video-meta'` gives `{ src, width, height }`. */
function videoMeta(): Plugin {
  const QUERY = '?video-meta'
  return {
    name: 'video-meta',
    enforce: 'pre',
    load(id) {
      if (!id.endsWith(QUERY)) return
      const file = id.slice(0, -QUERY.length)
      const { width, height } = videoSize(file) ?? { width: 1, height: 1 }
      return `import src from ${JSON.stringify(`${file}?url`)}\nexport default { src, width: ${width}, height: ${height} }`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [basicSsl(), react(), imagetools(), videoMeta()],
  server: { allowedHosts: true },
})
