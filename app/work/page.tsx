import Sidebar from '@/components/Sidebar'
import Link from 'next/link'
import { getAllBlogPosts } from '@/lib/blog'

export default function Work() {
  const posts = getAllBlogPosts()

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full max-w-2xl mx-auto px-6 pt-40">
        <Sidebar />
        <div className="animate-in">
          <section>
            <div className="space-y-8">
              {posts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/work/${post.slug}`}
                  className="block group"
                >
                  <h2 className="text-lg font-medium tracking-tight text-neutral-900 group-hover:text-[#002FA7] transition-colors">
                    {post.title}
                  </h2>
                  <p className="text-sm text-neutral-600 mt-1">
                    {post.subheader}
                  </p>
                  <p className="text-xs text-neutral-400 mt-2">
                    {post.date}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
