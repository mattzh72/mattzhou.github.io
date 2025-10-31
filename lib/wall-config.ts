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
  label?: string
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
        w: 61,
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
        x: 185,
        y: -61,
        w: 178,
        h: 266,
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
        x: -754,
        y: -229,
        w: 122,
        h: 160,
        src: portrait[0]?.src || '/photos/placeholder.jpg',
        label: 'David Zwirner Gallery in New York City'
      },
      {
        id: 'frame-1',
        x: 195,
        y: -227,
        w: 84,
        h: 126,
        src: portrait[1]?.src || '/photos/placeholder.jpg',
        label: 'Gagosian Gallery'
      },
      {
        id: 'frame-2',
        x: -832,
        y: 254,
        w: 114,
        h: 171,
        src: portrait[2]?.src || '/photos/placeholder.jpg',
        label: 'White Cube London'
      },
      {
        id: 'frame-3',
        x: 339,
        y: -70,
        w: 371,
        h: 553,
        src: portrait[3]?.src || '/photos/placeholder.jpg',
        label: 'Hauser & Wirth'
      },
      {
        id: 'frame-4',
        x: 702,
        y: -308,
        w: 124,
        h: 184,
        src: portrait[4]?.src || '/photos/placeholder.jpg',
        label: 'Pace Gallery'
      },
      {
        id: 'frame-5',
        x: -280,
        y: 198,
        w: 174,
        h: 117,
        src: landscape[0]?.src || '/photos/placeholder.jpg',
        label: 'Sadie Coles HQ'
      },
      {
        id: 'frame-6',
        x: -542,
        y: -363,
        w: 535,
        h: 355,
        src: landscape[1]?.src || '/photos/placeholder.jpg',
        label: 'Lisson Gallery'
      },
      {
        id: 'frame-7',
        x: 560,
        y: -248,
        w: 119,
        h: 80,
        src: landscape[2]?.src || '/photos/placeholder.jpg',
        label: 'Marian Goodman Gallery'
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
