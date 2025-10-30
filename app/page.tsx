import Sidebar from '@/components/Sidebar'

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      <div className="w-full max-w-2xl mx-auto px-6 pt-40">
        <Sidebar />
        <div className="animate-in">
          <section>
            <p className="text-base leading-relaxed mb-4">
              I'm currently exploring computer vision projects. 
            </p>
            <p className="text-base leading-relaxed mb-2">
              Previously, I was the second hire at Letta, a research company focused on memory AI agents. I was involved in many parts of the stack:
            </p>
            <ul className="text-base leading-relaxed mb-4 ml-6 space-y-1">
              <li>• Rewriting the OSS to support <a href="https://www.letta.com/case-studies/bilt" className="text-[#002FA7] hover:opacity-80" target="_blank" rel="noopener noreferrer">a million agents</a></li>
              <li>• Designing agent <a href="https://www.letta.com/blog/letta-filesystem" className="text-[#002FA7] hover:opacity-80" target="_blank" rel="noopener noreferrer">tooling</a></li>
              <li>• <a href="https://www.letta.com/blog/letta-evals" className="text-[#002FA7] hover:opacity-80" target="_blank" rel="noopener noreferrer">Evals</a>, synthetic data, and RL environments</li>
            </ul>
            <p className="text-base leading-relaxed mb-4">
              Before that, I was an engineer at Databricks, working on systems and deployment. During this time, I also was working on{' '}
              <a href="https://ai.stanford.edu/~yzzhang/projects/scene-language/" className="text-[#002FA7] hover:opacity-80" target="_blank" rel="noopener noreferrer">generative 3D models</a>
              {' '}at Stanford.
            </p>
            <p className="text-base leading-relaxed mb-4">
              I studied at Berkeley.
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
