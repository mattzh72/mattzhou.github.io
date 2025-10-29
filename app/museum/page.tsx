import Sidebar from '@/components/Sidebar'
import WallGallery from '@/components/WallGallery'
import { getPhotosByOrientation } from '@/lib/photos'

export default async function Museum() {
  const photos = await getPhotosByOrientation()
  let landscape = photos.landscape.map(p => p.path)
  let portrait = photos.portrait.map(p => p.path)
  // fallback to /public/test screenshots if no oriented photos found
  if (landscape.length < 2 || portrait.length < 1) {
    landscape = [
      '/test/' + encodeURIComponent('Screenshot 2025-10-26 at 10.33.27 PM.png'),
      '/test/' + encodeURIComponent('Screenshot 2025-10-26 at 10.33.53 PM.png'),
    ]
    portrait = [
      '/test/' + encodeURIComponent('Screenshot 2025-10-26 at 10.33.41 PM.png'),
    ]
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full max-w-2xl mx-auto px-6 pt-40">
        <Sidebar />
        <div className="mt-8 text-sm text-neutral-500 space-y-1">
          <p>Tap photos to <span className="text-neutral-900">zoom</span></p>
          <p>Tap wall to <span className="text-neutral-900">cycle</span></p>
        </div>
      </div>
      <div className="w-full max-w-6xl mx-auto px-6 pt-8 lg:pt-16 pb-12">
        <section className="w-full">
          <WallGallery landscapePhotos={landscape} portraitPhotos={portrait} />
        </section>
      </div>
    </div>
  )
}
