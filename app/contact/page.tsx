import Sidebar from '@/components/Sidebar'

export default function Contact() {
  return (
    <div className="min-h-screen bg-white">
      <div className="w-full max-w-2xl mx-auto px-6 pt-40">
        <Sidebar />
        <div className="animate-in">
          <section>
            <p className="text-base leading-relaxed mb-4">
              I am an avid photographer. I make a lot of prints for friends & family, so if you want a print, let's be friends!
            </p>
            <p className="text-base leading-relaxed mb-4">
              I'm open to collaborating on both technical and creative projects - feel free to reach out!
            </p>
            <p className="text-xs text-neutral-500 mt-8 text-right">
              <a href="https://x.com/Mattzh1314" className="text-[#002FA7] hover:opacity-80" target="_blank" rel="noopener noreferrer">X</a>
              <span className="text-neutral-900 mx-2">•</span>
              <a href="https://www.instagram.com/mattzh1314/" className="text-[#002FA7] hover:opacity-80" target="_blank" rel="noopener noreferrer">Instagram</a>
              <span className="text-neutral-900 mx-2">•</span>
              <a href="mailto:mattzh1314@gmail.com" className="text-[#002FA7] hover:opacity-80">Email</a>
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
