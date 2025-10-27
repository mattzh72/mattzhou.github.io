export interface WallConfig {
  wall: {
    src: string
    width: number
    height: number
  }
  frames: FrameConfig[]
  frameStyle: {
    border: number
    shadowOpacity: number
  }
}

export interface FrameConfig {
  id: string
  x: number
  y: number
  w: number
  h: number
  src: string
}

// museum-style arrangement: 3 frames in a row with classic gallery spacing
// coordinates are now centered at origin (0, 0)
export type PhotoSize = { width: number; height: number } | null

export interface PhotoWithSize {
  src: string
  size: PhotoSize
  isLandscape: boolean
}

// Create wall config with smart photo-to-frame matching
export function createWallConfig(
  wallWidth: number,
  wallHeight: number,
  photosWithSizes: PhotoWithSize[]
): WallConfig {
  // separate landscape and portrait photos
  const landscape = photosWithSizes.filter(p => p.isLandscape)
  const portrait = photosWithSizes.filter(p => !p.isLandscape)

  // frame 0: landscape (left), frame 1: portrait (center), frame 2: landscape (right)
  const selectedPhotos = [
    landscape[0] || photosWithSizes[0], // frame 0 - landscape
    portrait[0] || photosWithSizes[1],  // frame 1 - portrait
    landscape[1] || photosWithSizes[2]  // frame 2 - landscape
  ]

  // fixed frame positions from your current layout
  const bakedFrames: FrameConfig[] = [
    {
      id: 'frame-0',
      x: -917.5,
      y: -358,
      w: 572,
      h: 381,
      src: selectedPhotos[0]?.src || '/photos/placeholder.jpg'
    },
    {
      id: 'frame-1',
      x: -48,
      y: -437,
      w: 364,
      h: 551,
      src: selectedPhotos[1]?.src || '/photos/placeholder.jpg'
    },
    {
      id: 'frame-2',
      x: 481,
      y: -253,
      w: 286,
      h: 186,
      src: selectedPhotos[2]?.src || '/photos/placeholder.jpg'
    }
  ]

  return {
    wall: {
      src: '/background.jpg',
      width: wallWidth,
      height: wallHeight
    },
    frames: bakedFrames,
    frameStyle: {
      border: 4,
      shadowOpacity: 0.04
    }
  }
}
