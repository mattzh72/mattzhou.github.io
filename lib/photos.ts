import fs from 'fs/promises'
import path from 'path'

export interface Photo {
  name: string
  path: string
  alt: string
}

export async function getPhotos(): Promise<Photo[]> {
  const photosDirectory = path.join(process.cwd(), 'public', 'photos')

  try {
    const files = await fs.readdir(photosDirectory)

    const photos = files
      .filter(file => {
        const ext = path.extname(file).toLowerCase()
        return ['.jpg', '.jpeg', '.png', '.webp', '.avif'].includes(ext)
      })
      .map(file => {
        const name = path.parse(file).name
        const formattedName = name
          .replace(/_Web(-\d+)?$/, '')
          .replace(/_/g, ' ')
          .replace(/-/g, ' ')

        return {
          name: file,
          path: `/photos/${file}`,
          alt: formattedName,
        }
      })

    return photos
  } catch (error) {
    console.error('Error reading photos directory:', error)
    return []
  }
}
