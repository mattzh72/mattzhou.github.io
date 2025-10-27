import Gallery from '@/components/Gallery'
import { getPhotos } from '@/lib/photos'

export default async function Home() {
  const photos = await getPhotos()

  return (
    <main className="min-h-screen flex">
      <nav className="fixed left-0 top-0 px-6 pt-12">
        <div className="flex flex-col gap-4 text-sm font-bold text-right">
          <a href="#about" className="text-black hover:text-neutral-600 transition-colors">about</a>
          <a href="#work" className="text-black hover:text-neutral-600 transition-colors">photo</a>
          <a href="#contact" className="text-black hover:text-neutral-600 transition-colors">contact</a>
        </div>
      </nav>
      <div className="flex-1 pl-24">
        <Gallery photos={photos} />
      </div>
    </main>
  )
}
