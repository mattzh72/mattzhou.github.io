import fs from 'fs/promises'
import path from 'path'

export interface Photo {
  name: string
  path: string
  alt: string
}

export interface PhotosByOrientation {
  landscape: Photo[]
  portrait: Photo[]
}

async function getPhotosFromFolder(folderName: string): Promise<Photo[]> {
  const photosDirectory = path.join(process.cwd(), 'public', 'photos', folderName)

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
          path: `/photos/${folderName}/${file}`,
          alt: formattedName,
        }
      })

    return photos
  } catch (error) {
    console.error(`Error reading photos/${folderName} directory:`, error)
    return []
  }
}

export async function getPhotos(): Promise<Photo[]> {
  const landscape = await getPhotosFromFolder('landscape')
  const portrait = await getPhotosFromFolder('portrait')
  return [...landscape, ...portrait]
}

export async function getPhotosByOrientation(): Promise<PhotosByOrientation> {
  const landscape = await getPhotosFromFolder('landscape')
  const portrait = await getPhotosFromFolder('portrait')
  return { landscape, portrait }
}
