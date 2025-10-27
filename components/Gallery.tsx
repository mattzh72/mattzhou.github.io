'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import type { Photo } from '@/lib/photos'

interface GalleryProps {
  photos: Photo[]
}

export default function Gallery({ photos }: GalleryProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [showFlash, setShowFlash] = useState(false)

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedPhoto) {
        setSelectedPhoto(null)
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [selectedPhoto])

  const handlePhotoClick = (photo: Photo) => {
    setShowFlash(true)
    setTimeout(() => {
      setShowFlash(false)
      setSelectedPhoto(photo)
    }, 50)
  }

  const handleClose = () => {
    setSelectedPhoto(null)
  }

  return (
    <>
      <div className="container mx-auto px-6 pt-12 pb-12">
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-12">
          {photos.map((photo) => (
            <div
              key={photo.name}
              onClick={() => handlePhotoClick(photo)}
              className="relative w-full aspect-[3/2] overflow-hidden bg-neutral-200 hover:opacity-90 transition-opacity cursor-pointer"
            >
              <Image
                src={photo.path}
                alt={photo.alt}
                fill
                className="object-cover"
                sizes="(max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 16vw, 12vw"
              />
            </div>
          ))}
        </div>
      </div>

      {showFlash && (
        <div className="fixed inset-0 bg-white z-50" />
      )}

      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black z-40 flex items-center justify-center p-8"
          onClick={handleClose}
        >
          <div className="relative w-full h-full max-w-7xl max-h-full">
            <Image
              src={selectedPhoto.path}
              alt={selectedPhoto.alt}
              fill
              className="object-contain"
              sizes="100vw"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}
    </>
  )
}
