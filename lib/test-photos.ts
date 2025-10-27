import fs from 'fs/promises'
import path from 'path'

export interface TestPhoto {
  name: string
  path: string
  alt: string
}

export async function getTestPhotos(): Promise<TestPhoto[]> {
  const dir = path.join(process.cwd(), 'public', 'test')
  try {
    const files = await fs.readdir(dir)
    const images = files
      .filter(file => ['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(path.extname(file).toLowerCase()))
      .slice(0, 3)
      .map(file => {
        const alt = path.parse(file).name.replace(/_/g, ' ')
        // URL-encode to safely serve files with spaces/special chars
        return {
          name: file,
          path: `/test/${encodeURIComponent(file)}`,
          alt,
        }
      })
    return images
  } catch (e) {
    console.error('Error reading public/test:', e)
    return []
  }
}

