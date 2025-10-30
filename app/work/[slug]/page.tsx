import Sidebar from '@/components/Sidebar'
import { getBlogPost, getAllBlogPosts } from '@/lib/blog'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'

export async function generateStaticParams() {
  const posts = getAllBlogPosts()
  return posts.map((post) => ({
    slug: post.slug,
  }))
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  const post = getBlogPost(params.slug)

  if (!post) {
    notFound()
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="w-full max-w-2xl mx-auto px-6 pt-40">
        <Sidebar />
        <div className="animate-in">
          <article>
            <header className="mb-8">
              <h1 className="text-2xl font-medium tracking-tight text-neutral-900 mb-2">
                {post.title}
              </h1>
              <p className="text-sm text-neutral-600 mb-3">
                {post.subheader}
              </p>
              <p className="text-xs text-neutral-400">
                {post.date}
              </p>
            </header>
            <div className="prose prose-neutral prose-sm max-w-none">
              <ReactMarkdown>{post.content}</ReactMarkdown>
            </div>
            <p className="text-xs text-neutral-500 mt-8 text-right">
              <a href="https://x.com/Mattzh1314" className="text-[#002FA7] hover:opacity-80" target="_blank" rel="noopener noreferrer">X</a>
              <span className="text-neutral-900 mx-2">•</span>
              <a href="https://www.instagram.com/mattzh1314/" className="text-[#002FA7] hover:opacity-80" target="_blank" rel="noopener noreferrer">Instagram</a>
              <span className="text-neutral-900 mx-2">•</span>
              <a href="mailto:mattzh1314@gmail.com" className="text-[#002FA7] hover:opacity-80">Email</a>
            </p>
          </article>
        </div>
      </div>
    </div>
  )
}
