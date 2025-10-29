import Sidebar from '@/components/Sidebar'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <div className="w-full max-w-2xl mx-auto px-6 pt-40">
        <Sidebar />
        <div className="animate-in">
          <section>
            <h1 className="sr-only">About</h1>
            <p className="text-base leading-relaxed mb-4">
              I'm currently exploring computer vision projects in Oxford.
            </p>
            <p className="text-base leading-relaxed">
              In my spare time I explore the world through my lens, aiming to capture moments that tell honest stories.
            </p>
            <p className="text-base leading-relaxed mt-4">
              Contact: mattzh1314 on
              {' '}
              <a href="https://x.com/Mattzh1314" className="text-[#002FA7] hover:opacity-80">X</a>,
              {' '}
              <a href="https://www.instagram.com/mattzh1314/" className="text-[#002FA7] hover:opacity-80">meta</a>,
              {' '}and gmail
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
