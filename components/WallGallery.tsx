'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { createWallConfig, type FrameConfig, type WallConfig, type PhotoSize, type PhotoWithSize } from '@/lib/wall-config'

interface WallGalleryProps {
  landscapePhotos: string[]
  portraitPhotos: string[]
}

export default function WallGallery({ landscapePhotos, portraitPhotos }: WallGalleryProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null)
  const frameGroupsRef = useRef<THREE.Group[]>([])
  const frameMeshesRef = useRef<THREE.Mesh[]>([]) // references to image meshes for swapping
  const configRef = useRef<WallConfig | null>(null)
  const rebuildRef = useRef<(cfg: WallConfig) => void>(() => {})
  const swapTextureRef = useRef<(frameIndex: number, src: string, w: number, h: number) => void>(() => {})
  const [uiVisible, setUiVisible] = useState(false)
  const [selected, setSelected] = useState(0)
  const [, setTick] = useState(0) // force HUD rerenders when mutating refs

  // photo cycling state
  const [landscapeIndex, setLandscapeIndex] = useState([0, 1])
  const [portraitIndex, setPortraitIndex] = useState(0)
  const landscapeLenRef = useRef(landscapePhotos.length)
  const portraitLenRef = useRef(portraitPhotos.length)
  useEffect(() => { landscapeLenRef.current = landscapePhotos.length }, [landscapePhotos.length])
  useEffect(() => { portraitLenRef.current = portraitPhotos.length }, [portraitPhotos.length])
  // click-based cycling replaces timer; see click handler below

  // swap textures when photos change (no flashing)
  useEffect(() => {
    if (!swapTextureRef.current || !configRef.current) return

    const config = configRef.current

    // swap frame 0 (landscape)
    if (landscapePhotos[landscapeIndex[0]]) {
      swapTextureRef.current(0, landscapePhotos[landscapeIndex[0]], config.frames[0].w, config.frames[0].h)
    }

    // swap frame 1 (portrait)
    if (portraitPhotos[portraitIndex]) {
      swapTextureRef.current(1, portraitPhotos[portraitIndex], config.frames[1].w, config.frames[1].h)
    }

    // swap frame 2 (landscape)
    if (landscapePhotos[landscapeIndex[1]]) {
      swapTextureRef.current(2, landscapePhotos[landscapeIndex[1]], config.frames[2].w, config.frames[2].h)
    }
  }, [landscapeIndex, portraitIndex, landscapePhotos, portraitPhotos])

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
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // load wall background image first to get actual dimensions
    const wallLoader = new THREE.TextureLoader()
    wallLoader.load(
      '/background.jpg',
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

      // derive a wall tone to softly tint photos (blend into scene)
      const wallToneColor = new THREE.Color(...avgColorFromImage(img))

      // helper to (re)build frames
      function rebuildFrames(cfg: WallConfig) {
        // remove old groups
        frameGroupsRef.current.forEach(g => scene.remove(g))
        frameGroupsRef.current = []
        frameMeshesRef.current = []
        // add new groups
        cfg.frames.forEach(frameConfig => {
          const { group, imgMesh } = createFrame(frameConfig, cfg.frameStyle.border, cfg.frameStyle.shadowOpacity, renderer, wallToneColor)
          scene.add(group)
          frameGroupsRef.current.push(group)
          frameMeshesRef.current.push(imgMesh)
        })
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

      // preload initial photo natural sizes
      const initialPhotoSrcs = [
        landscapePhotos[landscapeIndex[0]],
        portraitPhotos[portraitIndex],
        landscapePhotos[landscapeIndex[1]]
      ].filter(Boolean)

      if (initialPhotoSrcs.length === 3) {
        Promise.all(initialPhotoSrcs.map(loadImageSize)).then((sizes: PhotoSize[]) => {
          const photosWithSizes: PhotoWithSize[] = initialPhotoSrcs.map((src, i) => {
            const size = sizes[i]
            const isLandscape = i !== 1 // frame 0 and 2 are landscape, frame 1 is portrait
            return { src, size, isLandscape }
          })

          const config = createWallConfig(wallWidth, wallHeight, photosWithSizes)
          configRef.current = config
          rebuildFrames(config)
        })
      }

      // initial resize
      resize()
    },
    undefined,
    (error) => {
      console.error('Error loading background.jpg:', error)
    })

    // resize handler
    let resizeTimeout: NodeJS.Timeout
    function resize() {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        const { clientWidth: cw, clientHeight: ch } = container
        const aspect = wallWidth / wallHeight

        let targetW = cw
        let targetH = Math.round(cw / aspect)

        if (targetH > ch) {
          targetH = ch
          targetW = Math.round(ch * aspect)
        }

        renderer.setSize(targetW, targetH, true)
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

    function animateCameraTo(targetX: number, targetY: number, targetZoom: number, duration = 450) {
      const startX = camera.position.x
      const startY = camera.position.y
      const startZoom = camera.zoom
      const start = performance.now()
      function tick(now: number) {
        const t = Math.min(1, (now - start) / duration)
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
        camera.position.x = startX + (targetX - startX) * eased
        camera.position.y = startY + (targetY - startY) * eased
        camera.zoom = startZoom + (targetZoom - startZoom) * eased
        camera.updateProjectionMatrix()
        if (t < 1) requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    }

    function fitZoomForFrame(frameIndex: number): number {
      if (!configRef.current) return 1
      const f = configRef.current.frames[frameIndex]
      const fw = f.w
      const fh = f.h
      // viewport in world units at zoom=1
      const viewW = camera.right - camera.left // equals wallWidth
      const viewH = camera.top - camera.bottom // equals wallHeight
      const margin = 0.9 // keep small padding around image
      const zoomToFitW = viewW / (fw / margin)
      const zoomToFitH = viewH / (fh / margin)
      const z = Math.min(zoomToFitW, zoomToFitH)
      return Math.max(1, Math.min(z, 8))
    }

    function onClick(ev: MouseEvent) {
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
            // toggle zoom out
            zoomStateRef.current.active = false
            zoomStateRef.current.frameIndex = -1
            animateCameraTo(0, 0, 1)
          } else {
            // zoom in to this frame
            zoomStateRef.current.active = true
            zoomStateRef.current.frameIndex = idx
            const targetZoom = fitZoomForFrame(idx)
            animateCameraTo(cx, cy, targetZoom)
          }
        }
        return
      }

      // if not on image, treat as wall click -> cycle
      setLandscapeIndex(prev => [
        (prev[0] + 1) % Math.max(landscapeLenRef.current, 1),
        (prev[1] + 1) % Math.max(landscapeLenRef.current, 1)
      ])
      setPortraitIndex(prev => (prev + 1) % Math.max(portraitLenRef.current, 1))
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // zoom out
        zoomStateRef.current.active = false
        zoomStateRef.current.frameIndex = -1
        animateCameraTo(0, 0, 1)
      }
    }

    renderer.domElement.addEventListener('click', onClick)
    window.addEventListener('keydown', onKey)

    // toggle HUD with key 'p'
    function onKeyToggle(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (e.key.toLowerCase() === 'p') setUiVisible(v => !v)
    }
    window.addEventListener('keydown', onKeyToggle)

    // render loop
    renderer.setAnimationLoop(() => {
      renderer.render(scene, camera)
    })

    // cleanup
    return () => {
      clearTimeout(resizeTimeout)
      window.removeEventListener('resize', resize)
      window.removeEventListener('keydown', onKeyToggle)
      window.removeEventListener('keydown', onKey)
      renderer.domElement.removeEventListener('click', onClick)
      renderer.setAnimationLoop(null)
      renderer.dispose()
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <>
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: 'min(72vh, 900px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          overflow: 'hidden'
        }}
      />
      {uiVisible && (
        <div style={{position:'fixed', top:12, left:12, zIndex:1000, background:'rgba(0,0,0,0.6)', color:'#fff', padding:'10px 12px', borderRadius:8, fontFamily:'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize:12, lineHeight:1.4}}>
          <div style={{marginBottom:6}}>Controls: select via HUD • Set position and size with inputs • Use buttons for quick scale • Copy JSON</div>
          <div style={{display:'flex', gap:16, alignItems:'center', flexWrap:'wrap'}}>
            <div style={{display:'flex', gap:8, alignItems:'center'}}>
              <span>Select:</span>
              <label style={{display:'inline-flex', alignItems:'center', gap:4}}>
                <input type="radio" name="selFrame" checked={selected===0} onChange={()=>setSelected(0)} /> 1
              </label>
              <label style={{display:'inline-flex', alignItems:'center', gap:4}}>
                <input type="radio" name="selFrame" checked={selected===1} onChange={()=>setSelected(1)} /> 2
              </label>
              <label style={{display:'inline-flex', alignItems:'center', gap:4}}>
                <input type="radio" name="selFrame" checked={selected===2} onChange={()=>setSelected(2)} /> 3
              </label>
            </div>
            <button onClick={()=>setUiVisible(false)} style={{background:'#fff', color:'#000', padding:'2px 6px', borderRadius:4}}>Hide</button>
            <button onClick={()=>{ if(!configRef.current) return; const cfg=configRef.current; const payload = JSON.stringify(cfg.frames.map(({id, x, y, w, h, src})=>({id,x,y,w,h,src})), null, 2); navigator.clipboard?.writeText(payload).catch(()=>{}); }} style={{background:'#fff', color:'#000', padding:'2px 6px', borderRadius:4}}>Copy JSON</button>
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
    </>
  )
}

function createFrame(
  config: FrameConfig,
  borderPx: number,
  shadowOpacity: number,
  renderer: THREE.WebGLRenderer,
  wallTone: THREE.Color
): { group: THREE.Group; imgMesh: THREE.Mesh } {
  const { x, y, w, h, src, id } = config
  const group = new THREE.Group()

  const outerW = w + borderPx * 2
  const outerH = h + borderPx * 2

  // soft drop shadow (underneath) using a generated CanvasTexture
  // very subtle soft shadow with per-frame variation
  const shadowPad = Math.max(12, Math.round(Math.min(outerW, outerH) * 0.025))
  const shadowBlur = Math.max(24, Math.round(Math.min(outerW, outerH) * 0.08))
  const shadowOffsetY = Math.round(Math.min(outerH, 40) * 0.1) // tiny offset

  // add slight variation per frame for realism
  const frameIndex = parseInt(id.split('-')[1]) || 0
  const variation = 0.8 + (frameIndex * 0.1) // 0.8, 0.9, 1.0 for frames 0,1,2

  const shadowTex = createSoftShadowTexture(outerW, outerH, shadowPad, shadowBlur, shadowOpacity, shadowOffsetY, variation)
  const shadowGeo = new THREE.PlaneGeometry(outerW + shadowPad * 2, outerH + shadowPad * 2)
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })
  const shadow = new THREE.Mesh(shadowGeo, shadowMat)
  shadow.position.set(x + w / 2, y + h / 2, 0.0)
  group.add(shadow)

  // slim white frame
  const borderGeo = new THREE.PlaneGeometry(outerW, outerH)
  // border color: exact rgb(213,213,213) (#d5d5d5)
  const borderMat = new THREE.MeshBasicMaterial({ color: 0xD5D5D5 })
  const border = new THREE.Mesh(borderGeo, borderMat)
  border.position.set(x + w / 2, y + h / 2, 0.001)
  group.add(border)

  // image quad (muted via shader once texture loads)
  const imgGeo = new THREE.PlaneGeometry(w, h)
  const imgPlaceholder = new THREE.MeshBasicMaterial({ color: 0xcccccc })
  const img = new THREE.Mesh(imgGeo, imgPlaceholder)
  img.position.set(x + w / 2, y + h / 2, 0.002)

  const textureLoader = new THREE.TextureLoader()
  textureLoader.load(src, (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy()

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

  // add thumbtacks at four corners
  const tackSize = Math.min(5, Math.max(2.5, w * 0.01)) // smaller
  const tackInset = borderPx * 0.5 // position on the border

  // corner positions (relative to frame)
  const corners = [
    { x: x + tackInset, y: y + tackInset },                    // top-left
    { x: x + w - tackInset, y: y + tackInset },                // top-right
    { x: x + tackInset, y: y + h - tackInset },                // bottom-left
    { x: x + w - tackInset, y: y + h - tackInset }             // bottom-right
  ]

  corners.forEach(corner => {
    const tack = createThumbtack(corner.x, corner.y, tackSize)
    group.add(tack)
  })

  return { group, imgMesh: img }
}

function createThumbtack(x: number, y: number, size: number): THREE.Group {
  const group = new THREE.Group()

  // small shadow underneath tack (pointing straight down)
  const shadowGeo = new THREE.CircleGeometry(size * 0.6, 16)
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    transparent: true,
    opacity: 0.3
  })
  const shadow = new THREE.Mesh(shadowGeo, shadowMat)
  shadow.position.set(x, y - size * 0.15, 0.003) // straight down
  group.add(shadow)

  // clear thumbtack (translucent with slight tint)
  const tackGeo = new THREE.CircleGeometry(size * 0.5, 16)
  const tackMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.3 // clear but still visible
  })
  const tack = new THREE.Mesh(tackGeo, tackMat)
  tack.position.set(x, y, 0.004)
  group.add(tack)

  return group
}

function rebuildFrames(config: WallConfig) {
  const renderer = rendererRef.current!
  const scene = sceneRef.current!
  // remove old groups
  frameGroupsRef.current.forEach(g => scene.remove(g))
  frameGroupsRef.current = []
  frameMeshesRef.current = []
  // add new groups
  config.frames.forEach(frameConfig => {
    const { group, imgMesh } = createFrame(frameConfig, config.frameStyle.border, config.frameStyle.shadowOpacity, renderer, new THREE.Color(1,1,1))
    scene.add(group)
    frameGroupsRef.current.push(group)
    frameMeshesRef.current.push(imgMesh)
  })
}

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
