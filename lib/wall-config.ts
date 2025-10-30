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
  photosWithSizes: PhotoWithSize[],
  layout: 'default' | 'art-gallery-ontario' | 'tate-modern' = 'default'
): WallConfig {
  // separate landscape and portrait photos
  const landscape = photosWithSizes.filter(p => p.isLandscape)
  const portrait = photosWithSizes.filter(p => !p.isLandscape)

  let bakedFrames: FrameConfig[]

  if (layout === 'art-gallery-ontario') {
    // 5 portraits + 1 landscape - positions adjusted via P tool
    bakedFrames = [
      {
        id: 'frame-0',
        x: -792,
        y: -114,
        w: 141,
        h: 210,
        src: portrait[0]?.src || '/photos/placeholder.jpg'
      },
      {
        id: 'frame-1',
        x: -740,
        y: 316,
        w: 65,
        h: 92,
        src: portrait[1]?.src || '/photos/placeholder.jpg'
      },
      {
        id: 'frame-2',
        x: -247,
        y: -124,
        w: 280,
        h: 421,
        src: portrait[2]?.src || '/photos/placeholder.jpg'
      },
      {
        id: 'frame-3',
        x: 189,
        y: -57,
        w: 175,
        h: 262,
        src: portrait[3]?.src || '/photos/placeholder.jpg'
      },
      {
        id: 'frame-4',
        x: 404,
        y: 143,
        w: 142,
        h: 213,
        src: portrait[4]?.src || '/photos/placeholder.jpg'
      },
      {
        id: 'frame-5',
        x: 526,
        y: -94,
        w: 215,
        h: 144,
        src: landscape[0]?.src || '/photos/placeholder.jpg'
      }
    ]
  } else if (layout === 'tate-modern') {
    // 5 portraits + 3 landscape - positions adjusted via P tool
    bakedFrames = [
      {
        id: 'frame-0',
        x: -370,
        y: -106,
        w: 50,
        h: 53,
        src: portrait[0]?.src || '/photos/placeholder.jpg'
      },
      {
        id: 'frame-1',
        x: 91,
        y: -115,
        w: 56,
        h: 63,
        src: portrait[1]?.src || '/photos/placeholder.jpg'
      },
      {
        id: 'frame-2',
        x: -415,
        y: 117,
        w: 114,
        h: 171,
        src: portrait[2]?.src || '/photos/placeholder.jpg'
      },
      {
        id: 'frame-3',
        x: 170,
        y: -32,
        w: 183,
        h: 274,
        src: portrait[3]?.src || '/photos/placeholder.jpg'
      },
      {
        id: 'frame-4',
        x: 354,
        y: -155,
        w: 55,
        h: 82,
        src: portrait[4]?.src || '/photos/placeholder.jpg'
      },
      {
        id: 'frame-5',
        x: -138,
        y: 101,
        w: 82,
        h: 55,
        src: landscape[0]?.src || '/photos/placeholder.jpg'
      },
      {
        id: 'frame-6',
        x: -269,
        y: -181,
        w: 267,
        h: 177,
        src: landscape[1]?.src || '/photos/placeholder.jpg'
      },
      {
        id: 'frame-7',
        x: 275,
        y: -122,
        w: 60,
        h: 50,
        src: landscape[2]?.src || '/photos/placeholder.jpg'
      }
    ]
  } else {
    // default: 2 landscape + 1 portrait
    const selectedPhotos = [
      landscape[0] || photosWithSizes[0], // frame 0 - landscape
      portrait[0] || photosWithSizes[1],  // frame 1 - portrait
      landscape[1] || photosWithSizes[2]  // frame 2 - landscape
    ]

    bakedFrames = [
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
  }

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
