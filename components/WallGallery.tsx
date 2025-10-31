'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createWallConfig, type FrameConfig, type WallConfig, type PhotoSize, type PhotoWithSize } from '@/lib/wall-config'

interface WallGalleryProps {
  landscapePhotos: string[]
  portraitPhotos: string[]
  backgroundUrl?: string
  showPhotos?: boolean
  canvasId?: string
  frameLayout?: 'default' | 'art-gallery-ontario' | 'tate-modern' // default: 2L+1P, art-gallery-ontario: 5P+1L, tate-modern: 3L+5P
}

export default function WallGallery({ landscapePhotos, portraitPhotos, backgroundUrl = '/background.jpg', showPhotos = true, canvasId, frameLayout = 'default' }: WallGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const frameGroupsRef = useRef<THREE.Group[]>([])
  const frameMeshesRef = useRef<THREE.Mesh[]>([]) // references to image meshes for swapping
  const frameImageDimensionsRef = useRef<{width: number, height: number}[]>([]) // store actual image dimensions
  const configRef = useRef<WallConfig | null>(null)
  const rebuildRef = useRef<(cfg: WallConfig) => void>(() => {})
  const swapTextureRef = useRef<(frameIndex: number, src: string, w: number, h: number) => void>(() => {})
  const [uiVisible, setUiVisible] = useState(false)
  const uiVisibleRef = useRef(false)
  useEffect(() => { uiVisibleRef.current = uiVisible }, [uiVisible])
  const [selected, setSelected] = useState(0)
  const [, setTick] = useState(0) // force HUD rerenders when mutating refs
  const animTokenRef = useRef(0) // cancel in-flight camera animations
  const [loaded, setLoaded] = useState(false)
  const [dragState, setDragState] = useState<{mode: 'move' | 'resize', frameIndex: number, startX: number, startY: number, initialFrame: FrameConfig} | null>(null)
  const [wallDims, setWallDims] = useState<{ w: number, h: number } | null>(null)
  const [drawDims, setDrawDims] = useState<{ w: number, h: number } | null>(null)

  // extract clean background name for display
  const backgroundName = backgroundUrl.split('/').pop()?.replace(/\.(jpg|jpeg|png|webp)$/i, '') || 'Unknown'

  // determine frame count based on layout
  const getFrameCounts = () => {
    if (frameLayout === 'art-gallery-ontario') {
      return { numPortrait: 5, numLandscape: 1 }
    } else if (frameLayout === 'tate-modern') {
      return { numPortrait: 5, numLandscape: 3 }
    }
    return { numPortrait: 1, numLandscape: 2 } // default
  }

  const { numPortrait, numLandscape } = getFrameCounts()

  // photo cycling state - dynamic based on layout
  const [landscapeIndex, setLandscapeIndex] = useState(() => Array(numLandscape).fill(0).map((_, i) => i))
  const [portraitIndex, setPortraitIndex] = useState(() => Array(numPortrait).fill(0).map((_, i) => i))
  const landscapeLenRef = useRef(landscapePhotos.length)
  const portraitLenRef = useRef(portraitPhotos.length)
  useEffect(() => { landscapeLenRef.current = landscapePhotos.length }, [landscapePhotos.length])
  useEffect(() => { portraitLenRef.current = portraitPhotos.length }, [portraitPhotos.length])
  // click-based cycling replaces timer; see click handler below

  // fade in effect once loaded
  useEffect(() => {
    if (!loaded || !rendererRef.current) return
    const canvas = rendererRef.current.domElement
    canvas.style.opacity = '1'
  }, [loaded])

  // clamp selected frame when config changes
  useEffect(() => {
    if (configRef.current && selected >= configRef.current.frames.length) {
      setSelected(0)
    }
  }, [configRef.current?.frames.length, selected])

  // swap textures when photos change (no flashing)
  useEffect(() => {
    if (!swapTextureRef.current || !configRef.current) return

    const config = configRef.current

    if (frameLayout === 'art-gallery-ontario') {
      // 5 portraits + 1 landscape
      // frames 0-4 are portraits, frame 5 is landscape
      portraitIndex.forEach((idx, frameIdx) => {
        if (portraitPhotos[idx]) {
          swapTextureRef.current(frameIdx, portraitPhotos[idx], config.frames[frameIdx].w, config.frames[frameIdx].h)
        }
      })
      if (landscapePhotos[landscapeIndex[0]]) {
        swapTextureRef.current(5, landscapePhotos[landscapeIndex[0]], config.frames[5].w, config.frames[5].h)
      }
    } else if (frameLayout === 'tate-modern') {
      // 5 portraits + 3 landscape
      // frames 0-4 are portraits, frames 5-7 are landscape
      portraitIndex.forEach((idx, frameIdx) => {
        if (portraitPhotos[idx]) {
          swapTextureRef.current(frameIdx, portraitPhotos[idx], config.frames[frameIdx].w, config.frames[frameIdx].h)
        }
      })
      landscapeIndex.forEach((idx, landscapeFrameIdx) => {
        const frameIdx = 5 + landscapeFrameIdx // frames 5, 6, 7
        if (landscapePhotos[idx]) {
          swapTextureRef.current(frameIdx, landscapePhotos[idx], config.frames[frameIdx].w, config.frames[frameIdx].h)
        }
      })
    } else {
      // default: 2 landscape + 1 portrait (frame 0, 2 landscape; frame 1 portrait)
      if (landscapePhotos[landscapeIndex[0]]) {
        swapTextureRef.current(0, landscapePhotos[landscapeIndex[0]], config.frames[0].w, config.frames[0].h)
      }
      if (portraitPhotos[portraitIndex[0]]) {
        swapTextureRef.current(1, portraitPhotos[portraitIndex[0]], config.frames[1].w, config.frames[1].h)
      }
      if (landscapePhotos[landscapeIndex[1]]) {
        swapTextureRef.current(2, landscapePhotos[landscapeIndex[1]], config.frames[2].w, config.frames[2].h)
      }
    }
  }, [landscapeIndex, portraitIndex, landscapePhotos, portraitPhotos, frameLayout])

  // handle dragging and resizing
  useEffect(() => {
    if (!dragState) return

    // set cursor
    document.body.style.cursor = dragState.mode === 'move' ? 'move' : 'nwse-resize'

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      if (!configRef.current) return

      const pixelDx = e.clientX - dragState.startX
      const pixelDy = e.clientY - dragState.startY

      // convert screen delta to world delta
      const { dx: worldDx, dy: worldDy } = screenDeltaToWorld(pixelDx, pixelDy)

      const frame = configRef.current.frames[dragState.frameIndex]
      const initial = dragState.initialFrame

      if (dragState.mode === 'move') {
        frame.x = initial.x + worldDx
        frame.y = initial.y + worldDy
      } else if (dragState.mode === 'resize') {
        // simple scaling from center
        const scale = 1 + (pixelDx / 200) // scale factor based on horizontal movement
        const newW = Math.max(50, initial.w * scale)
        const newH = Math.max(50, initial.h * scale)
        frame.w = newW
        frame.h = newH
        // keep centered
        frame.x = initial.x + (initial.w - newW) / 2
        frame.y = initial.y + (initial.h - newH) / 2
      }

      rebuildRef.current(configRef.current)
      setTick(t => t + 1)
    }

    const onMouseUp = () => {
      document.body.style.cursor = ''
      setDragState(null)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      document.body.style.cursor = ''
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [dragState])

  useEffect(() => {
    if (!containerRef.current) return

    const container = containerRef.current
    let wallWidth = 2400
    let wallHeight = 1600
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const wallMeshRef: { current: THREE.Mesh | null } = { current: null }
    const zoomStateRef = { current: { active: false, frameIndex: -1 } }

    // scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x333333) // gray until wall loads
    sceneRef.current = scene

    // use centered camera initially
    const camera = new THREE.OrthographicCamera(-wallWidth/2, wallWidth/2, wallHeight/2, -wallHeight/2, 0.1, 1000)
    camera.position.set(0, 0, 10)
    camera.lookAt(0, 0, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0) // transparent so the page background shows

    // simple fade in effect
    renderer.domElement.style.opacity = '0'
    renderer.domElement.style.transition = 'opacity 1s ease-out'

    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // load wall background image first to get actual dimensions
    const wallLoader = new THREE.TextureLoader()
    wallLoader.load(
      backgroundUrl,
      (wallTexture) => {
      wallTexture.colorSpace = THREE.SRGBColorSpace
      wallTexture.anisotropy = renderer.capabilities.getMaxAnisotropy()

      // get actual dimensions from the loaded image
      const img = wallTexture.image as HTMLImageElement
      wallWidth = img.width
      wallHeight = img.height

      // update camera with actual dimensions (centered)
      camera.left = -wallWidth / 2
      camera.right = wallWidth / 2
      camera.top = wallHeight / 2
      camera.bottom = -wallHeight / 2
      camera.updateProjectionMatrix()
      camera.position.set(0, 0, 10)
      camera.lookAt(0, 0, 0)

      // record natural image dimensions for layout
      setWallDims({ w: wallWidth, h: wallHeight })

      // create wall background plane (centered at origin)
      const wallGeo = new THREE.PlaneGeometry(wallWidth, wallHeight)
      const wallMat = new THREE.MeshBasicMaterial({ map: wallTexture, depthWrite: false })
      const wallMesh = new THREE.Mesh(wallGeo, wallMat)
      wallMesh.position.set(0, 0, 0)
      wallMeshRef.current = wallMesh

      // compute bounding box (verification without console noise)
      wallGeo.computeBoundingBox()

      scene.add(wallMesh)

      // temporarily remove background color to see wall
      scene.background = null

      // no dim overlay (removed per preference)

      // derive a wall tone to softly tint photos (blend into scene)
      const wallToneColor = new THREE.Color(...avgColorFromImage(img))

      // helper to (re)build frames
      function rebuildFrames(cfg: WallConfig) {
        // remove old groups
        frameGroupsRef.current.forEach(g => scene.remove(g))
        frameGroupsRef.current = []
        frameMeshesRef.current = []
        frameImageDimensionsRef.current = []
        // add new groups
        cfg.frames.forEach((frameConfig, idx) => {
          const { group, imgMesh } = createFrame(
            frameConfig,
            cfg.frameStyle.border,
            cfg.frameStyle.shadowOpacity,
            renderer,
            wallToneColor,
            (width: number, height: number) => {
              // callback to store image dimensions
              frameImageDimensionsRef.current[idx] = { width, height }
            }
          )
          scene.add(group)
          frameGroupsRef.current.push(group)
          frameMeshesRef.current.push(imgMesh)
        })
        // no special z-ordering needed without dim overlay
      }
      rebuildRef.current = rebuildFrames

      // helper to swap textures without rebuilding
      function swapTexture(frameIndex: number, src: string, w: number, h: number) {
        const group = frameGroupsRef.current[frameIndex]
        const imgMesh = frameMeshesRef.current[frameIndex]
        if (!group || !imgMesh) return

        const baseMat = imgMesh.material as THREE.MeshBasicMaterial

        const textureLoader = new THREE.TextureLoader()
        textureLoader.load(src, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace
          texture.anisotropy = renderer.capabilities.getMaxAnisotropy()

          // store image dimensions
          frameImageDimensionsRef.current[frameIndex] = {
            width: texture.image.width,
            height: texture.image.height
          }

          // check if this frame is currently zoomed
          const isZoomed = zoomStateRef.current.active && zoomStateRef.current.frameIndex === frameIndex

          if (isZoomed) {
            // if zoomed, show full image
            texture.repeat.set(1, 1)
            texture.offset.set(0, 0)
          } else {
            // implement "object-fit: cover" behavior via repeat/offset
            const imgAspect = texture.image.width / texture.image.height
            const frameAspect = w / h
            if (imgAspect > frameAspect) {
              const scale = frameAspect / imgAspect
              texture.repeat.set(scale, 1)
              texture.offset.set((1 - scale) / 2, 0)
            } else {
              const scale = imgAspect / frameAspect
              texture.repeat.set(1, scale)
              texture.offset.set(0, (1 - scale) / 2)
            }
          }

          // crossfade overlay to avoid any flash
          const overlayMat = new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff, transparent: true, opacity: 0 })
          // keep same desat tweak as base material
          overlayMat.onBeforeCompile = (shader) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              '#include <map_fragment>',
              `#include <map_fragment>\n\n        float _luma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));\n        diffuseColor.rgb = mix(vec3(_luma), diffuseColor.rgb, 0.90);\n        `
            )
          }
          const overlay = new THREE.Mesh(imgMesh.geometry, overlayMat)
          overlay.position.copy(imgMesh.position)
          overlay.position.z += 0.0002
          group.add(overlay)

          const start = performance.now()
          const duration = 250
          function tick(now: number) {
            const t = Math.min(1, (now - start) / duration)
            // ease in-out
            const eased = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t
            overlayMat.opacity = eased
            if (t < 1) {
              requestAnimationFrame(tick)
            } else {
              // swap base texture and clean up
              const oldMap = baseMat.map
              baseMat.map = texture
              baseMat.needsUpdate = true
              group.remove(overlay)
              overlayMat.dispose()
              if (oldMap) oldMap.dispose()
            }
          }
          requestAnimationFrame(tick)
        })
      }
      swapTextureRef.current = swapTexture

      // preload initial photo natural sizes (only if showPhotos is true)
      if (showPhotos) {
        let initialPhotoSrcs: string[] = []
        let isLandscapeMap: boolean[] = []

        if (frameLayout === 'art-gallery-ontario') {
          // 5 portraits + 1 landscape
          portraitIndex.forEach(idx => {
            if (portraitPhotos[idx]) {
              initialPhotoSrcs.push(portraitPhotos[idx])
              isLandscapeMap.push(false)
            }
          })
          if (landscapePhotos[landscapeIndex[0]]) {
            initialPhotoSrcs.push(landscapePhotos[landscapeIndex[0]])
            isLandscapeMap.push(true)
          }
        } else if (frameLayout === 'tate-modern') {
          // 5 portraits + 3 landscape
          portraitIndex.forEach(idx => {
            if (portraitPhotos[idx]) {
              initialPhotoSrcs.push(portraitPhotos[idx])
              isLandscapeMap.push(false)
            }
          })
          landscapeIndex.forEach(idx => {
            if (landscapePhotos[idx]) {
              initialPhotoSrcs.push(landscapePhotos[idx])
              isLandscapeMap.push(true)
            }
          })
        } else {
          // default: 2 landscape + 1 portrait
          initialPhotoSrcs = [
            landscapePhotos[landscapeIndex[0]],
            portraitPhotos[portraitIndex[0]],
            landscapePhotos[landscapeIndex[1]]
          ].filter(Boolean)
          isLandscapeMap = [true, false, true]
        }

        const expectedCount = frameLayout === 'art-gallery-ontario' ? 6 : frameLayout === 'tate-modern' ? 8 : 3

        if (initialPhotoSrcs.length === expectedCount) {
          Promise.all(initialPhotoSrcs.map(loadImageSize)).then((sizes: PhotoSize[]) => {
            const photosWithSizes: PhotoWithSize[] = initialPhotoSrcs.map((src, i) => {
              const size = sizes[i]
              const isLandscape = isLandscapeMap[i]
              return { src, size, isLandscape }
            })

            const config = createWallConfig(wallWidth, wallHeight, photosWithSizes, frameLayout)
            configRef.current = config
            rebuildFrames(config)
            // trigger fade-in effect
            setTimeout(() => setLoaded(true), 100)
          })
        }
      } else {
        // just show background without photos
        setTimeout(() => setLoaded(true), 100)
      }

      // initial resize
      resize()
    },
    undefined,
    (error) => {
      console.error(`Error loading ${backgroundUrl}:`, error)
    })

    // resize handler — scale down to fit parent (contain, no crop), never scale up
    let resizeTimeout: NodeJS.Timeout
    function resize() {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        if (!wallWidth || !wallHeight) return

        // Available width is the parent's content box; fallback to viewport width
        const parent = container.parentElement as HTMLElement | null
        let availW = parent?.clientWidth || window.innerWidth
        // Cap maximum visual width to keep the gallery comfortable on large screens
        const hardMaxW = 1000
        availW = Math.min(availW, hardMaxW)
        // Constrain height to a comfortable max (e.g., 72vh up to 900px)
        const maxH = Math.min(Math.round(window.innerHeight * 0.72), 900)

        const scaleW = availW / wallWidth
        const scaleH = maxH / wallHeight
        const scale = Math.min(scaleW, scaleH, 1)

        const targetW = Math.max(1, Math.round(wallWidth * scale))
        const targetH = Math.max(1, Math.round(wallHeight * scale))

        // Size renderer to the scaled dimensions
        renderer.setSize(targetW, targetH, true)
        setDrawDims({ w: targetW, h: targetH })

        // Show full image in camera (no crop); aspect matches scaled dims
        camera.left = -wallWidth / 2
        camera.right = wallWidth / 2
        camera.top = wallHeight / 2
        camera.bottom = -wallHeight / 2
        camera.updateProjectionMatrix()
      }, 10)
    }

    window.addEventListener('resize', resize)

    // click handling: wall click cycles images; image click zooms
    function onPointerToNDC(ev: MouseEvent) {
      const canvas = renderer.domElement
      const rect = canvas.getBoundingClientRect()
      const x = (ev.clientX - rect.left) / rect.width
      const y = (ev.clientY - rect.top) / rect.height
      pointer.x = x * 2 - 1
      pointer.y = -(y * 2 - 1)
    }

    function animateCameraTo(targetX: number, targetY: number, targetZoom: number, duration = 550) {
      // cancel any in-flight animation by bumping token
      const token = ++animTokenRef.current
      const startX = camera.position.x
      const startY = camera.position.y
      const startZoom = camera.zoom
      const start = performance.now()

      // smoothstep easing (no overshoot, gentler ends)
      const ease = (t: number) => {
        t = Math.min(1, Math.max(0, t))
        return t * t * (3 - 2 * t)
      }

      function tick(now: number) {
        // if a new animation started, stop this one
        if (token !== animTokenRef.current) return
        const t = Math.min(1, (now - start) / duration)
        const e = ease(t)
        camera.position.x = startX + (targetX - startX) * e
        camera.position.y = startY + (targetY - startY) * e
        camera.zoom = startZoom + (targetZoom - startZoom) * e
        camera.updateProjectionMatrix()
        if (t < 1) {
          requestAnimationFrame(tick)
        } else {
          // snap to exact target to avoid residual jitter
          camera.position.set(targetX, targetY, camera.position.z)
          camera.zoom = targetZoom
          camera.updateProjectionMatrix()
        }
      }
      requestAnimationFrame(tick)
    }

    function fitZoomForFrame(frameIndex: number, useActualDimensions: boolean = false): number {
      if (!configRef.current) return 1
      const f = configRef.current.frames[frameIndex]

      let fw = f.w
      let fh = f.h

      // if zooming in and we have actual image dimensions, use those to show full image
      if (useActualDimensions && frameImageDimensionsRef.current[frameIndex]) {
        const imgDims = frameImageDimensionsRef.current[frameIndex]
        const imgAspect = imgDims.width / imgDims.height
        const frameAspect = f.w / f.h

        // calculate what the frame size would be if showing full image
        if (imgAspect > frameAspect) {
          // image is wider - width stays same, height gets smaller
          fh = f.w / imgAspect
        } else {
          // image is taller - height stays same, width gets smaller
          fw = f.h * imgAspect
        }
      }

      // viewport in world units at zoom=1
      const viewW = camera.right - camera.left // equals wallWidth
      const viewH = camera.top - camera.bottom // equals wallHeight
      const margin = 0.9 // keep small padding around image
      const zoomToFitW = viewW / (fw / margin)
      const zoomToFitH = viewH / (fh / margin)
      const z = Math.min(zoomToFitW, zoomToFitH)
      return Math.max(1, Math.min(z, 8))
    }

    // dim overlay removed

    // helper to morph frame to show full uncropped image
    function setFrameToFullImage(frameIndex: number, showFull: boolean) {
      const imgMesh = frameMeshesRef.current[frameIndex]
      if (!imgMesh) return

      const mat = imgMesh.material as THREE.MeshBasicMaterial
      const texture = mat.map
      if (!texture) return

      const f = configRef.current?.frames[frameIndex]
      if (!f) return

      const imgDims = frameImageDimensionsRef.current[frameIndex]
      if (!imgDims) return

      const imgAspect = imgDims.width / imgDims.height
      const frameAspect = f.w / f.h

      let targetW = f.w
      let targetH = f.h

      if (showFull) {
        // show full uncropped image
        texture.repeat.set(1, 1)
        texture.offset.set(0, 0)
        texture.needsUpdate = true

        // calculate dimensions to show full image at original aspect ratio
        if (imgAspect > frameAspect) {
          // image is wider - keep width, reduce height
          targetH = f.w / imgAspect
        } else {
          // image is taller - keep height, reduce width
          targetW = f.h * imgAspect
        }
      } else {
        // restore cropped view (object-fit: cover)
        if (imgAspect > frameAspect) {
          const scale = frameAspect / imgAspect
          texture.repeat.set(scale, 1)
          texture.offset.set((1 - scale) / 2, 0)
        } else {
          const scale = imgAspect / frameAspect
          texture.repeat.set(1, scale)
          texture.offset.set(0, (1 - scale) / 2)
        }
        texture.needsUpdate = true
      }

      // animate geometry resize
      const geo = imgMesh.geometry as THREE.PlaneGeometry
      const startW = geo.parameters.width
      const startH = geo.parameters.height
      const startTime = performance.now()
      const duration = 300

      function animate(now: number) {
        const t = Math.min(1, (now - startTime) / duration)
        const eased = t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t // ease in-out

        const currentW = startW + (targetW - startW) * eased
        const currentH = startH + (targetH - startH) * eased

        // update geometry
        imgMesh.geometry.dispose()
        imgMesh.geometry = new THREE.PlaneGeometry(currentW, currentH)

        if (t < 1) {
          requestAnimationFrame(animate)
        }
      }
      requestAnimationFrame(animate)
    }

    function onClick(ev: MouseEvent) {
      // disable all interactions when in edit mode
      if (uiVisibleRef.current) return

      if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return
      onPointerToNDC(ev)
      raycaster.setFromCamera(pointer, camera)

      // test image meshes first
      const hits = raycaster.intersectObjects(frameMeshesRef.current, false)
      if (hits.length > 0) {
        // find which frame index was clicked
        const first = hits[0].object
        const idx = frameMeshesRef.current.findIndex(m => m === first)
        if (idx !== -1) {
          const f = configRef.current?.frames[idx]
          if (!f) return
          const cx = f.x + f.w / 2
          const cy = f.y + f.h / 2
          if (zoomStateRef.current.active && zoomStateRef.current.frameIndex === idx) {
            // toggle zoom out - restore cropped view
            setFrameToFullImage(idx, false)
            // no dim overlay to adjust
            zoomStateRef.current.active = false
            zoomStateRef.current.frameIndex = -1
            animateCameraTo(0, 0, 1)
          } else {
            // zoom out previous frame if any
            if (zoomStateRef.current.active && zoomStateRef.current.frameIndex !== -1) {
              setFrameToFullImage(zoomStateRef.current.frameIndex, false)
            }
            // zoom in to this frame - show full image
            setFrameToFullImage(idx, true)
            zoomStateRef.current.active = true
            zoomStateRef.current.frameIndex = idx
            // no overlay, keep default z
            const targetZoom = fitZoomForFrame(idx, true)
            animateCameraTo(cx, cy, targetZoom)
          }
        }
        return
      }

      // if not on image, treat as wall click -> cycle
      setLandscapeIndex(prev => prev.map(idx => (idx + 1) % Math.max(landscapeLenRef.current, 1)))
      setPortraitIndex(prev => prev.map(idx => (idx + 1) % Math.max(portraitLenRef.current, 1)))
    }

    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return

      if (e.key === 'Escape') {
        // close HUD if open, otherwise zoom out
        if (uiVisibleRef.current) {
          setUiVisible(false)
        } else {
          // zoom out and restore cropped view
          if (zoomStateRef.current.frameIndex !== -1) {
            setFrameToFullImage(zoomStateRef.current.frameIndex, false)
          }
          // no dim overlay to clear
          zoomStateRef.current.active = false
          zoomStateRef.current.frameIndex = -1
          animateCameraTo(0, 0, 1)
        }
      }

      // toggle HUD with key 'p'
      if (e.key.toLowerCase() === 'p') {
        setUiVisible(v => !v)
      }
    }

    renderer.domElement.addEventListener('click', onClick)
    window.addEventListener('keydown', onKey)

    // render loop
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera)
    })

    // cleanup
    return () => {
      clearTimeout(resizeTimeout)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKey)
      renderer.domElement.removeEventListener('click', onClick)
      renderer.setAnimationLoop(null)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  // convert world coords to screen pixel coords relative to container
  const worldToScreen = (x: number, y: number) => {
    if (!rendererRef.current || !cameraRef.current || !containerRef.current) return { x: 0, y: 0 }

    const canvas = rendererRef.current.domElement
    const canvasRect = canvas.getBoundingClientRect()
    const containerRect = containerRef.current.getBoundingClientRect()
    const camera = cameraRef.current

    // camera is orthographic, centered at (0, 0)
    const worldW = camera.right - camera.left
    const worldH = camera.top - camera.bottom

    // normalize to 0-1 within world space
    const nx = (x - camera.left) / worldW
    const ny = (camera.top - y) / worldH // flip Y

    // convert to pixel coords on canvas
    const canvasX = nx * canvasRect.width
    const canvasY = ny * canvasRect.height

    // offset by canvas position relative to container
    const offsetX = canvasRect.left - containerRect.left
    const offsetY = canvasRect.top - containerRect.top

    return {
      x: offsetX + canvasX,
      y: offsetY + canvasY
    }
  }

  // convert screen pixel delta to world coordinate delta
  const screenDeltaToWorld = (dx: number, dy: number) => {
    if (!rendererRef.current || !cameraRef.current) return { dx: 0, dy: 0 }

    const canvas = rendererRef.current.domElement
    const canvasRect = canvas.getBoundingClientRect()
    const camera = cameraRef.current

    const worldW = camera.right - camera.left
    const worldH = camera.top - camera.bottom

    return {
      dx: (dx / canvasRect.width) * worldW,
      dy: -(dy / canvasRect.height) * worldH // flip Y
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          display: 'block',
          margin: '0 auto',
          width: drawDims?.w ?? wallDims?.w ?? undefined,
          height: drawDims?.h ?? wallDims?.h ?? undefined,
          maxWidth: '100%',
          backgroundColor: 'transparent',
          overflow: 'visible'
        }}
      >
        {/* Interactive overlay for dragging/resizing frames */}
        {uiVisible && showPhotos && configRef.current && rendererRef.current && containerRef.current && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
            zIndex: 10
          }}>
            {configRef.current.frames.map((frame, idx) => {
              const topLeft = worldToScreen(frame.x, frame.y)
              const bottomRight = worldToScreen(frame.x + frame.w, frame.y + frame.h)
              const screenW = bottomRight.x - topLeft.x
              const screenH = bottomRight.y - topLeft.y
              const isSelected = idx === selected

              return (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: topLeft.x,
                    top: topLeft.y,
                    width: screenW,
                    height: screenH,
                    border: isSelected ? '3px solid #00ff00' : '2px dashed rgba(255,255,255,0.6)',
                    backgroundColor: isSelected ? 'rgba(0,255,0,0.1)' : 'rgba(255,255,255,0.05)',
                    pointerEvents: 'auto',
                    cursor: 'move',
                    boxSizing: 'border-box'
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setSelected(idx)
                    setDragState({
                      mode: 'move',
                      frameIndex: idx,
                      startX: e.clientX,
                      startY: e.clientY,
                      initialFrame: { ...frame }
                    })
                  }}
                >
                  {/* Resize handles at corners */}
                  {isSelected && ['nw', 'ne', 'sw', 'se'].map(corner => (
                    <div
                      key={corner}
                      style={{
                        position: 'absolute',
                        width: 12,
                        height: 12,
                        background: '#00ff00',
                        border: '2px solid #000',
                        borderRadius: '50%',
                        ...(corner.includes('n') ? { top: -6 } : { bottom: -6 }),
                        ...(corner.includes('w') ? { left: -6 } : { right: -6 }),
                        cursor: `${corner}-resize`,
                        pointerEvents: 'auto'
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setSelected(idx)
                        setDragState({
                          mode: 'resize',
                          frameIndex: idx,
                          startX: e.clientX,
                          startY: e.clientY,
                          initialFrame: { ...frame }
                        })
                        // store which corner for resize logic
                        ;(e.target as HTMLElement).dataset.corner = corner
                      }}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
      {uiVisible && (
        <div style={{position:'absolute', top:12, right:12, zIndex:1000, background:'rgba(0,0,0,0.9)', color:'#fff', padding:'12px 16px', borderRadius:8, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12, lineHeight:1.5, maxWidth:600, border:'2px solid #00ff00', boxShadow:'0 4px 12px rgba(0,0,0,0.5)'}}>
          <div style={{marginBottom:8, fontSize:14, fontWeight:'bold', color:'#00ff00'}}>
            Editing: {backgroundName} - Frame {selected + 1}
            {dragState && <span style={{marginLeft:8, color:'#ff0', fontSize:11}}>({dragState.mode})</span>}
          </div>
          <div style={{marginBottom:8, fontSize:11, color:'#ccc'}}>Drag frames to move • Drag corner handles to resize • Use inputs for precision</div>
          <div style={{display:'flex', gap:16, alignItems:'center', flexWrap:'wrap'}}>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <span>Select:</span>
              {configRef.current?.frames.map((_, idx) => (
                <label key={idx} style={{display:'inline-flex', alignItems:'center', gap:4, cursor:'pointer'}}>
                  <input
                    type="radio"
                    name={`selFrame-${canvasId}`}
                    checked={selected===idx}
                    onChange={()=>{setSelected(idx); setTick(t=>t+1);}}
                    style={{cursor:'pointer'}}
                  /> {idx + 1}
                </label>
              ))}
            </div>
            <button onClick={()=>setUiVisible(false)} style={{background:'#fff', color:'#000', padding:'4px 8px', borderRadius:4, cursor:'pointer'}}>Hide (ESC)</button>
            <button onClick={()=>{
              if(!configRef.current) return;
              const cfg=configRef.current;
              const payload = JSON.stringify({
                canvas: backgroundName,
                backgroundUrl: backgroundUrl,
                frames: cfg.frames.map(({id, x, y, w, h})=>({id, x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h)}))
              }, null, 2);
              navigator.clipboard?.writeText(payload).then(() => {
                alert(`Configuration for "${backgroundName}" copied to clipboard!`)
              }).catch(()=>{});
            }} style={{background:'#00ff00', color:'#000', padding:'4px 8px', borderRadius:4, cursor:'pointer', fontWeight:'bold'}}>Copy JSON</button>
          </div>
          {!configRef.current && (
            <div style={{marginTop:6}}>Loading wall…</div>
          )}
          {configRef.current?.frames[selected] && (
            <div style={{marginTop:6}}>
              <div style={{display:'flex', gap:8, marginTop:6, flexWrap:'wrap'}}>
                <label>X <input type="number" value={Math.round(configRef.current.frames[selected].x)}
                  onChange={e=>{ const v=Number(e.target.value)||0; const f=configRef.current!.frames[selected]; f.x = v; rebuildRef.current!(configRef.current!); setTick(t=>t+1); }}
                  style={{width:90, color:'#000'}}/></label>
                <label>Y <input type="number" value={Math.round(configRef.current.frames[selected].y)}
                  onChange={e=>{ const v=Number(e.target.value)||0; const f=configRef.current!.frames[selected]; f.y = v; rebuildRef.current!(configRef.current!); setTick(t=>t+1); }}
                  style={{width:90, color:'#000'}}/></label>
                <label>W <input type="number" value={configRef.current.frames[selected].w}
                  onChange={e=>{ const v=Number(e.target.value)||0; const f=configRef.current!.frames[selected]; const d=v - f.w; f.x -= d/2; f.w = v; rebuildRef.current!(configRef.current!); setTick(t=>t+1); }}
                  style={{width:90, color:'#000'}}/></label>
                <label>H <input type="number" value={configRef.current.frames[selected].h}
                  onChange={e=>{ const v=Number(e.target.value)||0; const f=configRef.current!.frames[selected]; const d=v - f.h; f.y -= d/2; f.h = v; rebuildRef.current!(configRef.current!); setTick(t=>t+1); }}
                  style={{width:90, color:'#000'}}/></label>
                <button onClick={()=>{ const f=configRef.current!.frames[selected]; f.w=Math.round(f.w*1.05); f.h=Math.round(f.h*1.05); f.x-=Math.round(f.w*0.025); f.y-=Math.round(f.h*0.025); rebuildRef.current!(configRef.current!); setTick(t=>t+1); }} style={{background:'#fff', color:'#000', padding:'2px 6px', borderRadius:4}}>+5%</button>
                <button onClick={()=>{ const f=configRef.current!.frames[selected]; const nw=Math.max(10, Math.round(f.w*0.95)); const nh=Math.max(10, Math.round(f.h*0.95)); const dx=(nw-f.w)/2; const dy=(nh-f.h)/2; f.x-=dx; f.y-=dy; f.w=nw; f.h=nh; rebuildRef.current!(configRef.current!); setTick(t=>t+1); }} style={{background:'#fff', color:'#000', padding:'2px 6px', borderRadius:4}}>-5%</button>
              </div>
            </div>
          )}
        </div>
      )}
      {/* HUD toggle remains via 'P' key; no visual Show button when hidden */}
    </div>
  )
}

function createFrame(
  config: FrameConfig,
  borderPx: number,
  shadowOpacity: number,
  renderer: THREE.WebGLRenderer,
  wallTone: THREE.Color,
  onDimensionsLoaded?: (width: number, height: number) => void
): { group: THREE.Group; imgMesh: THREE.Mesh } {
  const { x, y, w, h, src, id } = config
  const group = new THREE.Group()

  // soft drop shadow (underneath) using a generated CanvasTexture
  const shadowPad = Math.max(12, Math.round(Math.min(w, h) * 0.025))
  const shadowBlur = Math.max(24, Math.round(Math.min(w, h) * 0.08))
  const shadowOffsetY = Math.round(Math.min(h, 40) * 0.1)

  // add slight variation per frame for realism
  const frameIndex = parseInt(id.split('-')[1]) || 0
  const variation = 0.8 + (frameIndex * 0.1)

  const shadowTex = createSoftShadowTexture(w, h, shadowPad, shadowBlur, shadowOpacity, shadowOffsetY, variation)
  const shadowGeo = new THREE.PlaneGeometry(w + shadowPad * 2, h + shadowPad * 2)
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  const shadow = new THREE.Mesh(shadowGeo, shadowMat)
  shadow.position.set(x + w / 2, y + h / 2, 0.0)
  group.add(shadow)

  // image quad (muted via shader once texture loads)
  const imgGeo = new THREE.PlaneGeometry(w, h)
  const imgPlaceholder = new THREE.MeshBasicMaterial({ color: 0xcccccc })
  const img = new THREE.Mesh(imgGeo, imgPlaceholder)
  img.position.set(x + w / 2, y + h / 2, 0.002)

  const textureLoader = new THREE.TextureLoader()
  textureLoader.load(src, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()

    // store image dimensions via callback
    if (onDimensionsLoaded) {
      onDimensionsLoaded(texture.image.width, texture.image.height)
    }

    // implement "object-fit: cover" behavior
    const imgAspect = texture.image.width / texture.image.height
    const frameAspect = w / h

    if (imgAspect > frameAspect) {
      // image is wider - fit height, crop sides
      const scale = frameAspect / imgAspect
      texture.repeat.set(scale, 1)
      texture.offset.set((1 - scale) / 2, 0)
    } else {
      // image is taller - fit width, crop top/bottom
      const scale = imgAspect / frameAspect
      texture.repeat.set(1, scale)
      texture.offset.set(0, (1 - scale) / 2)
    }

    // Use MeshBasicMaterial and inject desaturation
    const mat = new THREE.MeshBasicMaterial({ map: texture, color: 0xffffff })
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <map_fragment>',
        `#include <map_fragment>\n\n        // luminance-preserving desaturation\n        float _luma = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));\n        diffuseColor.rgb = mix(vec3(_luma), diffuseColor.rgb, 0.90);\n        `
      )
    }
    img.material = mat
  })

  group.add(img)

  return { group, imgMesh: img }
}

// Note: This rebuildFrames is not used - the one inside useEffect is used instead

// --- Helpers ---
function loadImageSize(src: string): Promise<PhotoSize> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || img.width, height: img.naturalHeight || img.height })
    img.onerror = () => resolve(null)
    img.src = src
  })
}
function avgColorFromImage(image: HTMLImageElement): [number, number, number] {
  const w = 64
  const h = Math.max(1, Math.round((image.height / image.width) * w))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(image, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  let r = 0, g = 0, b = 0
  const total = w * h
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]
    g += data[i + 1]
    b += data[i + 2]
  }
  return [r / total / 255, g / total / 255, b / total / 255]
}

function createSoftShadowTexture(
  innerW: number,
  innerH: number,
  pad: number,
  blur: number,
  opacity: number,
  offsetY: number,
  variation: number = 1.0
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  const cw = Math.max(2, Math.round(innerW + pad * 2))
  const ch = Math.max(2, Math.round(innerH + pad * 2))
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, cw, ch)

  // realistic bottom shadow - paper pinned at corners
  const bottomY = pad + innerH
  const leftX = pad
  const rightX = pad + innerW
  const centerX = cw / 2

  // shadow height varies - thin at corners, thick in middle
  const centerBowHeight = Math.min(10, innerW * 0.015) * variation // thinner, with variation
  const edgeBowHeight = 0.5 * variation // very thin at edges (pinned points)

  // solid dark shadow (no gradient for uniform color)
  const shadowOpacity = 0.55 // much darker

  ctx.fillStyle = `rgba(0,0,0,${shadowOpacity})`

  // draw organic curved shadow path with variable thickness
  ctx.beginPath()
  ctx.moveTo(leftX, bottomY) // start at bottom left corner

  // cubic bezier for more control over the curve
  // thin at edges, thick in middle
  ctx.bezierCurveTo(
    leftX + innerW * 0.25, bottomY + centerBowHeight * 0.7,  // control point 1
    rightX - innerW * 0.25, bottomY + centerBowHeight * 0.7, // control point 2
    rightX, bottomY                                          // end at bottom right
  )

  // continue path down for gradient fade (also curved)
  ctx.bezierCurveTo(
    rightX - innerW * 0.25, bottomY + centerBowHeight * 1.5,
    leftX + innerW * 0.25, bottomY + centerBowHeight * 1.5,
    leftX, bottomY + edgeBowHeight
  )
  ctx.closePath()

  // apply slight blur for softness
  ctx.filter = `blur(${Math.min(3, blur * 0.4)}px)`
  ctx.fill()

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = (THREE as any).NoColorSpace ?? THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w * 0.5, h * 0.5)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h)
  ctx.lineTo(x + rr, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr)
  ctx.lineTo(x, y + rr)
  ctx.quadraticCurveTo(x, y, x + rr, y)
  ctx.closePath()
}

function createPaperTexture(size = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // subtle noise centered around mid-gray (to avoid global darkening)
  const img = ctx.createImageData(size, size)
  const data = img.data
  for (let i = 0; i < data.length; i += 4) {
    // 120..136 range (~0.47..0.53 sRGB)
    const n = 120 + Math.floor(Math.random() * 17)
    data[i] = n
    data[i + 1] = n
    data[i + 2] = n
    data[i + 3] = 255
  }
  ctx.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipMapLinearFilter
  tex.needsUpdate = true
  return tex
}

function createPaperPhotoMaterial(
  texture: THREE.Texture,
  wallTone: THREE.Color,
  opts: {
    saturation: number
    contrast: number
    exposure: number
    tintStrength: number
    paperTex: THREE.Texture
    paperStrength: number
    paperScale: number
    edgeStrength: number
    edgeSoftness: number
  }
): THREE.ShaderMaterial {
  const uniforms = {
    map: { value: texture },
    uTint: { value: new THREE.Vector3(wallTone.r, wallTone.g, wallTone.b) },
    uSaturation: { value: opts.saturation },
    uContrast: { value: opts.contrast },
    uExposure: { value: opts.exposure },
    uTintStrength: { value: opts.tintStrength },
    paperTex: { value: opts.paperTex },
    uPaperStrength: { value: opts.paperStrength },
    uPaperScale: { value: opts.paperScale },
    uEdgeStrength: { value: opts.edgeStrength },
    uEdgeSoftness: { value: opts.edgeSoftness },
  }

  const vertexShader = `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  const fragmentShader = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D map;
    uniform vec3 uTint; // sRGB
    uniform float uSaturation;
    uniform float uContrast;
    uniform float uExposure;
    uniform float uTintStrength;
    uniform sampler2D paperTex;
    uniform float uPaperStrength;
    uniform float uPaperScale;
    uniform float uEdgeStrength;
    uniform float uEdgeSoftness;

    #include <common>
    #include <color_space_pars_fragment>

    vec3 adjustSaturation(vec3 color, float sat) {
      // Rec. 709 luma
      float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
      return mix(vec3(l), color, sat);
    }

    vec3 adjustContrast(vec3 color, float contrast) {
      return (color - 0.5) * contrast + 0.5;
    }

    void main() {
      vec4 texel = texture2D(map, vUv);
      // Decode texture to linear using three.js color management
      vec3 col0 = mapTexelToLinear(texel).rgb;
      float l0 = dot(col0, vec3(0.2126, 0.7152, 0.0722));
      vec3 col = col0;

      // exposure (simple scale)
      col *= uExposure;

      // subtle tint toward wall tone (convert uTint from sRGB to linear)
      vec3 tintLin = SRGBToLinear(uTint);
      col = mix(col, tintLin, uTintStrength);

      // minimal desaturation in linear space
      col = adjustSaturation(col, uSaturation);
      // no contrast change (unless uContrast != 1.0)
      col = adjustContrast(col, uContrast);

      // lock to original luminance
      float l1 = max(1e-5, dot(col, vec3(0.2126, 0.7152, 0.0722)));
      col *= (l0 / l1);

      // paper grain path (disabled by strength=0)
      float paper = texture2D(paperTex, vUv * uPaperScale).r;
      float centered = (paper - 0.5) * 2.0;
      col *= (1.0 + centered * uPaperStrength);

      // faint edge falloff
      vec2 e = min(vUv, 1.0 - vUv);
      float d = min(e.x, e.y);
      float edge = smoothstep(0.0, uEdgeSoftness, d);
      float edgeMul = mix(1.0 - uEdgeStrength, 1.0, edge);
      col *= edgeMul;

      col = clamp(col, 0.0, 1.0);
      gl_FragColor = vec4(col, 1.0);
      // Encode to renderer output color space
      #include <colorspace_fragment>
    }
  `

  const mat = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader })
  mat.toneMapped = false
  return mat
}
