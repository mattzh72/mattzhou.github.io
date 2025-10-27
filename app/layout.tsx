import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Photo Portfolio',
  description: 'A collection of photography',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'Helvetica, Arial, sans-serif' }} className="tracking-tight">{children}</body>
    </html>
  )
}
