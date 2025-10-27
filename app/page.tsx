import WallGallery from '@/components/WallGallery'
import { getPhotosByOrientation } from '@/lib/photos'

export default async function Home() {
  const photos = await getPhotosByOrientation()

  return (
    <main className="w-full h-screen overflow-hidden">
      <WallGallery
        landscapePhotos={photos.landscape.map(p => p.path)}
        portraitPhotos={photos.portrait.map(p => p.path)}
      />
    </main>
  )
}
