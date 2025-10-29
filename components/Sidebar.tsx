'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'about me' },
  { href: '/work', label: 'work' },
  { href: '/museum', label: 'museum' },
]

export default function Sidebar() {
  const pathname = usePathname()

  const isActive = (href: string) => (pathname === href)

  return (
    <nav className="mb-12">
      <div className="flex items-center gap-4">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={isActive(l.href) ? 'page' : undefined}
            className={`text-sm transition-colors ${
              isActive(l.href) ? 'text-[#002FA7] font-medium' : 'text-[rgb(105,105,105)] hover:text-[#002FA7]'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
