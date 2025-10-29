import Sidebar from '@/components/Sidebar'

export default function Work() {
  return (
    <div className="min-h-screen bg-white">
      <div className="w-full max-w-2xl mx-auto px-6 pt-40">
        <Sidebar />
        <div className="animate-in">
          <section>
            <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-neutral-900 mb-4">Selected work</h1>
            <p className="text-base sm:text-lg leading-relaxed">
              Work content goes here.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
