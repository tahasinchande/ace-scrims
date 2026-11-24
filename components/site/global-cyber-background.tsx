"use client"

import { useEffect, useRef } from "react"
import * as THREE from "three"
import { useViewMode } from "@/lib/view-mode"
import {
  applyAmbientThemeToRoot,
  getAmbientPhaseAt,
} from "@/lib/ambient-theme"

export function GlobalCyberBackground() {
  const containerRef = useRef<HTMLDivElement>(null)
  const sharedStartMsRef = useRef<number | null>(null)
  const { mode } = useViewMode()

  // Synchronized RandomQbit-inspired continuous color-shifting engine across BOTH 2D & 3D modes.
  // Starts on Electric Cobalt Blue, holds for 2.2s, smoothstep-fades over 3.0s through Teal -> Gold -> Rose -> Violet.
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (sharedStartMsRef.current === null) {
      sharedStartMsRef.current = performance.now()
    }

    const initialPhase = getAmbientPhaseAt(0)
    applyAmbientThemeToRoot(initialPhase)

    if (prefersReducedMotion) return

    let rafId = 0
    let lastAppliedKey = ""

    const tick = () => {
      rafId = window.requestAnimationFrame(tick)
      if (document.hidden) return
      const startMs = sharedStartMsRef.current ?? performance.now()
      const elapsedSec = (performance.now() - startMs) / 1000
      const state = getAmbientPhaseAt(elapsedSec)
      const key = `${state.primaryRgb.join(",")}|${state.glowRgb.join(",")}|${state.accentRgb.join(",")}`
      if (key !== lastAppliedKey) {
        lastAppliedKey = key
        applyAmbientThemeToRoot(state)
      }
    }

    rafId = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [])

  useEffect(() => {
    if (mode !== "3d") return

    const container = containerRef.current
    if (!container) return

    let width = window.innerWidth
    let height = window.innerHeight

    // Track all disposable Three.js resources to prevent WebGL memory leaks
    const disposables: Array<{ dispose: () => void }> = []
    const trackDisposable = <T extends { dispose: () => void }>(resource: T): T => {
      disposables.push(resource)
      return resource
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 1. THREE.JS SCENE & RENDERER SETUP (DPR Capped & High Performance)
    // ─────────────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x020306)
    scene.fog = new THREE.FogExp2(0x020306, 0.012)

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 500)
    camera.position.set(16, 18, 28)
    camera.lookAt(0, 1.5, 0)

    const renderer = new THREE.WebGLRenderer({
      powerPreference: "high-performance",
      antialias: true,
      alpha: true,
      stencil: false,
      depth: true,
    })

    // WebGL Optimization: Limit Pixel Ratio to 1.5 max to avoid GPU fillrate bottleneck on high-DPI displays
    const maxDPR = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 1.5)
    renderer.setPixelRatio(maxDPR)
    renderer.setSize(width, height)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.45

    // Disable shadows to save dynamic shadow map draw calls
    renderer.shadowMap.enabled = false

    renderer.domElement.style.position = "absolute"
    renderer.domElement.style.top = "0"
    renderer.domElement.style.left = "0"
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    renderer.domElement.style.display = "block"
    renderer.domElement.style.pointerEvents = "none"

    container.replaceChildren(renderer.domElement)

    // ─────────────────────────────────────────────────────────────────────────
    // 2. ILLUMINATION & OPTIMIZED LIGHTING
    // ─────────────────────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x0d131f, 3.8)
    scene.add(ambientLight)

    // Key cyber orange directional light
    const dirKey = new THREE.DirectionalLight(0xff6a00, 3.2)
    dirKey.position.set(24, 35, 18)
    scene.add(dirKey)

    // Fill cyan-blue deep shadow light
    const dirFill = new THREE.DirectionalLight(0x1a2e4c, 2.2)
    dirFill.position.set(-28, 25, -20)
    scene.add(dirFill)

    // Glowing Core Point Lights (Optimized distance & decay)
    const coreLight1 = new THREE.PointLight(0xff4500, 8.0, 50, 1.5)
    coreLight1.position.set(0, 4.5, 0)
    scene.add(coreLight1)

    const coreLight2 = new THREE.PointLight(0xff9900, 5.5, 40, 1.5)
    coreLight2.position.set(16, 3.5, -12)
    scene.add(coreLight2)

    const coreLight3 = new THREE.PointLight(0xff3700, 5.0, 40, 1.5)
    coreLight3.position.set(-16, 3.5, 10)
    scene.add(coreLight3)

    const coreLight4 = new THREE.PointLight(0xffaa00, 4.5, 35, 1.5)
    coreLight4.position.set(-12, 3.0, -18)
    scene.add(coreLight4)

    // ─────────────────────────────────────────────────────────────────────────
    // 3. EXPANSIVE ISOMETRIC MONOLITH TERRAIN (InstancedMesh)
    // ─────────────────────────────────────────────────────────────────────────
    const gridSize = 48 // 48 x 48 = 2,304 monoliths
    const count = gridSize * gridSize
    const boxGeo = trackDisposable(new THREE.BoxGeometry(0.94, 1, 0.94))
    boxGeo.translate(0, 0.5, 0)

    const blockMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: 0x0f1520,
        roughness: 0.18,
        metalness: 0.88,
      })
    )

    const instancedTerrain = new THREE.InstancedMesh(boxGeo, blockMat, count)
    instancedTerrain.frustumCulled = true
    const dummy = new THREE.Object3D()
    const colorDummy = new THREE.Color()

    const halfGrid = gridSize / 2
    let idx = 0

    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const posX = (x - halfGrid) * 1.12
        const posZ = (z - halfGrid) * 1.12

        const distFromCenter = Math.sqrt(posX * posX + posZ * posZ)
        const isCoreArea = distFromCenter < 4.5
        const isSecondaryCore = Math.sqrt((posX - 14) ** 2 + (posZ + 10) ** 2) < 3.8
        const isTertiaryCore = Math.sqrt((posX + 14) ** 2 + (posZ - 8) ** 2) < 3.8
        const isCrevice = Math.random() < 0.13

        // Procedural cyber landscape wave calculation
        let h = 0.22
        if (isCoreArea) {
          h = 2.4 + Math.random() * 4.2
        } else if (isSecondaryCore || isTertiaryCore) {
          h = 1.8 + Math.random() * 3.2
        } else {
          const wave1 = Math.sin(x * 0.22) * Math.cos(z * 0.22)
          const wave2 = Math.cos(x * 0.14 + z * 0.14) * 0.5
          h = 0.2 + Math.abs(wave1 + wave2) * 2.6 + (Math.random() > 0.84 ? Math.random() * 1.8 : 0)
        }

        if (isCrevice) h = 0.1

        dummy.position.set(posX, 0, posZ)
        dummy.scale.set(1, h, 1)
        dummy.updateMatrix()
        instancedTerrain.setMatrixAt(idx, dummy.matrix)

        // Color & reflectance
        if (isCrevice) {
          colorDummy.setHex(0x190b05)
        } else if (isCoreArea || isSecondaryCore || isTertiaryCore) {
          colorDummy.setHex(0x141a24)
        } else {
          const base = 0.055 + Math.random() * 0.05
          colorDummy.setRGB(base, base * 1.08, base * 1.28)
        }
        instancedTerrain.setColorAt(idx, colorDummy)
        idx++
      }
    }
    instancedTerrain.instanceMatrix.needsUpdate = true
    if (instancedTerrain.instanceColor) instancedTerrain.instanceColor.needsUpdate = true
    instancedTerrain.computeBoundingSphere()
    scene.add(instancedTerrain)

    // ─────────────────────────────────────────────────────────────────────────
    // 4. INFINITE CYBER CIRCUIT FLOOR GRID MATRIX & INSTANCED NEON PADS
    // ─────────────────────────────────────────────────────────────────────────
    const gridHelper = new THREE.GridHelper(120, 80, 0x9ca3af, 0x262f42)
    gridHelper.position.y = 0.08
    if (gridHelper.material instanceof THREE.Material) {
      trackDisposable(gridHelper.material)
    }
    trackDisposable(gridHelper.geometry)
    scene.add(gridHelper)

    // Glowing Neon Circuit Floor Pads (InstancedMesh: 1 single draw call instead of 64 meshes/materials)
    const tileCount = 64
    const tileGeo = trackDisposable(new THREE.PlaneGeometry(0.92, 0.92))
    tileGeo.rotateX(-Math.PI / 2)

    const floorTileMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
      })
    )

    const instancedFloorTiles = new THREE.InstancedMesh(tileGeo, floorTileMat, tileCount)
    instancedFloorTiles.frustumCulled = true

    // Pre-calculate randomized tile coordinates
    const tilePositions: Array<{ x: number; z: number }> = []
    const tileBaseColor = new THREE.Color(0xff6600)

    for (let i = 0; i < tileCount; i++) {
      const rx = (Math.floor(Math.random() * 44) - 22) * 1.12
      const rz = (Math.floor(Math.random() * 44) - 22) * 1.12
      tilePositions.push({ x: rx, z: rz })

      dummy.position.set(rx, 0.12, rz)
      dummy.scale.set(1, 1, 1)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      instancedFloorTiles.setMatrixAt(i, dummy.matrix)
      instancedFloorTiles.setColorAt(i, tileBaseColor)
    }
    instancedFloorTiles.instanceMatrix.needsUpdate = true
    if (instancedFloorTiles.instanceColor) instancedFloorTiles.instanceColor.needsUpdate = true
    instancedFloorTiles.computeBoundingSphere()
    scene.add(instancedFloorTiles)

    // ─────────────────────────────────────────────────────────────────────────
    // 5. SHARED CYBER TOWERS & INSTANCED SATELLITE CUBES (Extreme Draw Call Optimization)
    // ─────────────────────────────────────────────────────────────────────────
    const towerConfigs = [
      { x: 0, z: 0, s: 1.0, h: 7.2 },
      { x: 15, z: -10, s: 0.8, h: 6.5 },
      { x: -16, z: 12, s: 0.75, h: 6.0 },
      { x: -14, z: -16, s: 0.7, h: 5.8 },
      { x: 20, z: 14, s: 0.65, h: 5.5 },
      { x: 6, z: 22, s: 0.6, h: 5.0 },
      { x: -22, z: -4, s: 0.55, h: 4.8 },
    ]
    const towerCount = towerConfigs.length

    // Reusable Unit Box Geometry for Pillars, Slits & Satellites (Cached & Shared)
    const unitBoxGeo = trackDisposable(new THREE.BoxGeometry(1, 1, 1))

    // Reusable Materials (Cached & Shared across all towers)
    const towerNodeMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: 0x06080d,
        roughness: 0.12,
        metalness: 0.96,
      })
    )
    const towerOrangeGlowMat = trackDisposable(new THREE.MeshBasicMaterial({ color: 0xff4400 }))
    const towerHotGlowMat = trackDisposable(new THREE.MeshBasicMaterial({ color: 0xffa500 }))

    // Tower Pillars (InstancedMesh: 7 instances = 1 draw call)
    const instancedPillars = new THREE.InstancedMesh(unitBoxGeo, towerNodeMat, towerCount)
    instancedPillars.frustumCulled = true

    // Outer Laser Slits (InstancedMesh: 7 instances = 1 draw call)
    const instancedOuterSlits = new THREE.InstancedMesh(unitBoxGeo, towerOrangeGlowMat, towerCount)
    instancedOuterSlits.frustumCulled = true

    // Inner Laser Slits (InstancedMesh: 7 instances = 1 draw call)
    const instancedInnerSlits = new THREE.InstancedMesh(unitBoxGeo, towerHotGlowMat, towerCount)
    instancedInnerSlits.frustumCulled = true

    towerConfigs.forEach((t, i) => {
      // Main pillar transform
      dummy.position.set(t.x, (t.h * t.s) / 2, t.z)
      dummy.scale.set(1.5 * t.s, t.h * t.s, 1.5 * t.s)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      instancedPillars.setMatrixAt(i, dummy.matrix)

      // Outer laser slit transform
      dummy.position.set(t.x, (t.h * t.s) / 2, t.z)
      dummy.scale.set(0.38 * t.s, t.h * 0.94 * t.s, 1.56 * t.s)
      dummy.updateMatrix()
      instancedOuterSlits.setMatrixAt(i, dummy.matrix)

      // Inner laser slit transform
      dummy.position.set(t.x, (t.h * t.s) / 2, t.z)
      dummy.scale.set(0.14 * t.s, t.h * 0.94 * t.s, 1.6 * t.s)
      dummy.updateMatrix()
      instancedInnerSlits.setMatrixAt(i, dummy.matrix)
    })

    instancedPillars.instanceMatrix.needsUpdate = true
    instancedOuterSlits.instanceMatrix.needsUpdate = true
    instancedInnerSlits.instanceMatrix.needsUpdate = true

    instancedPillars.computeBoundingSphere()
    instancedOuterSlits.computeBoundingSphere()
    instancedInnerSlits.computeBoundingSphere()

    scene.add(instancedPillars)
    scene.add(instancedOuterSlits)
    scene.add(instancedInnerSlits)

    // Satellite Orbiting Data Cubes (InstancedMesh: 42 cubes = 1 single draw call instead of 42 meshes!)
    const totalSatelliteCubes = towerCount * 6
    const satelliteMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
      })
    )
    const instancedSatelliteCubes = new THREE.InstancedMesh(unitBoxGeo, satelliteMat, totalSatelliteCubes)
    instancedSatelliteCubes.frustumCulled = true

    type SatelliteMeta = {
      towerX: number
      towerZ: number
      towerScale: number
      baseY: number
      angle: number
      radius: number
      isGlow: boolean
    }
    const satelliteMeta: SatelliteMeta[] = []

    let satIdx = 0
    towerConfigs.forEach((t) => {
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2
        const rad = (1.8 + (i % 2) * 0.5) * t.s
        const isGlow = i % 2 === 0
        const baseY = (t.h * 0.6 + (i % 3) * 0.8) * t.s

        satelliteMeta.push({
          towerX: t.x,
          towerZ: t.z,
          towerScale: t.s,
          baseY,
          angle,
          radius: rad,
          isGlow,
        })

        colorDummy.setHex(isGlow ? 0xff4400 : 0x06080d)
        instancedSatelliteCubes.setColorAt(satIdx, colorDummy)
        satIdx++
      }
    })
    if (instancedSatelliteCubes.instanceColor) instancedSatelliteCubes.instanceColor.needsUpdate = true
    instancedSatelliteCubes.computeBoundingSphere()
    scene.add(instancedSatelliteCubes)

    // ─────────────────────────────────────────────────────────────────────────
    // 6. VOLUMETRIC LASER ENERGY WALLS (Optimized Shader Ribbons)
    // ─────────────────────────────────────────────────────────────────────────
    const wallUniforms = {
      uTime: { value: 0 },
      uColorDark: { value: new THREE.Color(0xd93800) },
      uColorMid: { value: new THREE.Color(0xff7700) },
      uColorCore: { value: new THREE.Color(0xfff0aa) },
    }

    const laserShaderMat = trackDisposable(
      new THREE.ShaderMaterial({
        uniforms: wallUniforms,
        vertexShader: `
          varying vec2 vUv;
          uniform float uTime;
          void main() {
            vUv = uv;
            vec3 pos = position;
            pos.y += sin(pos.x * 0.25 - uTime * 2.8) * 0.24;
            pos.z += cos(pos.x * 0.18 - uTime * 1.8) * 0.18;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uColorDark;
          uniform vec3 uColorMid;
          uniform vec3 uColorCore;
          varying vec2 vUv;

          void main() {
            float fastStreams = sin(vUv.x * 55.0 - uTime * 8.5) * 0.5 + 0.5;
            float pulseWaves = sin(vUv.x * 12.0 - uTime * 3.5) * 0.5 + 0.5;
            
            float beamCore = pow(sin(vUv.y * 3.14159), 2.2);
            float thinIntense = pow(sin(vUv.y * 3.14159), 8.0) * 2.2;
            
            vec3 col = mix(uColorDark, uColorMid, vUv.y);
            col = mix(col, uColorCore, thinIntense + fastStreams * 0.35);
            
            float alpha = (beamCore * 0.85 + fastStreams * 0.18) * (0.8 + pulseWaves * 0.2);
            gl_FragColor = vec4(col * 1.8, alpha);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )

    // Laser wall 1 — Diagonal Main
    const wallGeo1 = trackDisposable(new THREE.PlaneGeometry(48, 6.2, 40, 1))
    wallGeo1.translate(24, 3.1, 0)
    const laserWall1 = new THREE.Mesh(wallGeo1, laserShaderMat)
    laserWall1.position.set(-6, 0.4, -4)
    laserWall1.rotation.y = -Math.PI * 0.22
    scene.add(laserWall1)

    // Laser wall 2 — Crossing Midground
    const wallGeo2 = trackDisposable(new THREE.PlaneGeometry(42, 5.0, 36, 1))
    wallGeo2.translate(21, 2.5, 0)
    const laserWall2 = new THREE.Mesh(wallGeo2, laserShaderMat)
    laserWall2.position.set(-12, 0.3, 10)
    laserWall2.rotation.y = Math.PI * 0.38
    laserWall2.scale.set(0.85, 0.85, 1)
    scene.add(laserWall2)

    // Laser wall 3 — Background Horizon Beam
    const wallGeo3 = trackDisposable(new THREE.PlaneGeometry(55, 4.5, 46, 1))
    wallGeo3.translate(27.5, 2.25, 0)
    const laserWall3 = new THREE.Mesh(wallGeo3, laserShaderMat)
    laserWall3.position.set(-20, 0.2, -18)
    laserWall3.rotation.y = -Math.PI * 0.05
    scene.add(laserWall3)

    // ─────────────────────────────────────────────────────────────────────────
    // 7. ASCENDING DATA PARTICLES & CYBER EMBERS
    // ─────────────────────────────────────────────────────────────────────────
    const particleCount = 700
    const particleGeo = trackDisposable(new THREE.BufferGeometry())
    const particlePos = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      particlePos[i * 3] = (Math.random() - 0.5) * 60
      particlePos[i * 3 + 1] = Math.random() * 25
      particlePos[i * 3 + 2] = (Math.random() - 0.5) * 60
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3))

    const particleMat = trackDisposable(
      new THREE.PointsMaterial({
        color: 0xffb74d,
        size: 0.18,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
      })
    )
    const particles = new THREE.Points(particleGeo, particleMat)
    particles.frustumCulled = true
    scene.add(particles)

    // ─────────────────────────────────────────────────────────────────────────
    // 8. INTERACTION CONTROLLER (Passive Mouse, Touch & Scroll)
    // ─────────────────────────────────────────────────────────────────────────
    let mouseX = 0
    let mouseY = 0
    let scrollY = 0

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY

      const nx = (clientX / (window.innerWidth || 1)) * 2 - 1
      const ny = -(clientY / (window.innerHeight || 1)) * 2 + 1

      mouseX = nx * 5.0
      mouseY = ny * 3.5
    }

    const onScroll = () => {
      scrollY = window.scrollY || document.documentElement.scrollTop || 0
    }

    window.addEventListener("mousemove", onPointerMove, { passive: true })
    window.addEventListener("touchmove", onPointerMove, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })

    // ─────────────────────────────────────────────────────────────────────────
    // 9. CULLING & SUSPENDING (IntersectionObserver & Tab Visibility)
    // ─────────────────────────────────────────────────────────────────────────
    let isVisible = true
    let isTabActive = typeof document !== "undefined" ? !document.hidden : true

    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = Boolean(entry?.isIntersecting)
      },
      { threshold: 0.02 }
    )
    observer.observe(container)

    const onVisibilityChange = () => {
      isTabActive = !document.hidden
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    // ─────────────────────────────────────────────────────────────────────────
    // 10. OPTIMIZED ANIMATION RENDERING LOOP
    // ─────────────────────────────────────────────────────────────────────────
    const clock = new THREE.Clock()
    let frameId: number

    const baseCamX = 16
    const baseCamY = 18
    const baseCamZ = 28

    const rotationEuler = new THREE.Euler()
    const rotQuat = new THREE.Quaternion()
    const cubeScaleVec = new THREE.Vector3()
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const phasePrimaryColor = new THREE.Color()
    const phaseAccentColor = new THREE.Color()
    const phaseSoftColor = new THREE.Color()
    const phaseDeepColor = new THREE.Color()
    const phaseGlowColor = new THREE.Color()

    const renderLoop = () => {
      frameId = requestAnimationFrame(renderLoop)

      // Suspend render loop when out of viewport or tab is inactive to preserve battery & CPU
      if (!isVisible || !isTabActive) {
        return
      }

      const elapsed = clock.getElapsedTime()
      const sharedElapsed =
        sharedStartMsRef.current !== null
          ? (performance.now() - sharedStartMsRef.current) / 1000
          : elapsed

      // Shader time update
      wallUniforms.uTime.value = prefersReducedMotion ? 0 : elapsed

      // Normalized scroll progression
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        window.innerHeight * 2
      ) - window.innerHeight
      const scrollRatio = Math.min(scrollY / Math.max(docHeight, 1), 1)

      // Smooth camera orbit + scroll panning (static calm angle when reduced-motion is enabled)
      const motionElapsed = prefersReducedMotion ? 0 : elapsed
      const targetX = baseCamX + mouseX + Math.sin(motionElapsed * 0.14) * 2.2 + scrollRatio * 8.0
      const targetY = baseCamY + mouseY - scrollRatio * 7.0 + Math.cos(motionElapsed * 0.12) * 1.5
      const targetZ = baseCamZ - scrollRatio * 6.0 + Math.sin(motionElapsed * 0.1) * 2.0

      camera.position.x += (targetX - camera.position.x) * 0.04
      camera.position.y += (targetY - camera.position.y) * 0.04
      camera.position.z += (targetZ - camera.position.z) * 0.04
      camera.lookAt(scrollRatio * 4.0, 1.8, -scrollRatio * 4.0)

      // Animate Orbiting Satellite Cubes (Single batch update on instanced matrix buffer)
      for (let k = 0; k < totalSatelliteCubes; k++) {
        const meta = satelliteMeta[k]
        const cubeY = meta.baseY + Math.sin(motionElapsed * 2.5 + k) * 0.15
        const cubeX = meta.towerX + Math.cos(meta.angle + motionElapsed * 0.4) * meta.radius
        const cubeZ = meta.towerZ + Math.sin(meta.angle + motionElapsed * 0.4) * meta.radius

        rotationEuler.set(motionElapsed * 0.6 + k * 0.3, motionElapsed * 1.2 + k * 0.5, 0)
        rotQuat.setFromEuler(rotationEuler)
        cubeScaleVec.set(0.7 * meta.towerScale, 0.7 * meta.towerScale, 0.7 * meta.towerScale)

        dummy.position.set(cubeX, cubeY, cubeZ)
        dummy.quaternion.copy(rotQuat)
        dummy.scale.copy(cubeScaleVec)
        dummy.updateMatrix()

        instancedSatelliteCubes.setMatrixAt(k, dummy.matrix)
      }
      instancedSatelliteCubes.instanceMatrix.needsUpdate = true

      // Shared RandomQbit-inspired 5-color hold+smoothstep cycle starting on RushX Electric Cobalt Blue
      const phase = prefersReducedMotion
        ? getAmbientPhaseAt(0)
        : getAmbientPhaseAt(sharedElapsed)
      const baseHue = phase.baseHue
      const accentHue = phase.accentHue
      const fillHue = phase.fillHue

      phasePrimaryColor.setRGB(
        phase.primaryRgb[0] / 255,
        phase.primaryRgb[1] / 255,
        phase.primaryRgb[2] / 255,
      )
      phaseAccentColor.setRGB(
        phase.accentRgb[0] / 255,
        phase.accentRgb[1] / 255,
        phase.accentRgb[2] / 255,
      )
      phaseSoftColor.setRGB(
        phase.softRgb[0] / 255,
        phase.softRgb[1] / 255,
        phase.softRgb[2] / 255,
      )
      phaseDeepColor.setRGB(
        (phase.bgWashRgb[0] * 0.36) / 255,
        (phase.bgWashRgb[1] * 0.36) / 255,
        (phase.bgWashRgb[2] * 0.36) / 255,
      )
      phaseGlowColor.setRGB(
        phase.glowRgb[0] / 255,
        phase.glowRgb[1] / 255,
        phase.glowRgb[2] / 255,
      )

      // Luminous obsidian-tinted backdrop & fog matched directly to the active phase wash
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(phaseDeepColor)
      }
      if (scene.fog instanceof THREE.FogExp2) {
        scene.fog.color.copy(phaseDeepColor)
      }
      ambientLight.color.copy(phaseGlowColor).multiplyScalar(0.52)

      // Multi-layered harmonic lights shifting together over time
      dirKey.color.copy(phasePrimaryColor)
      dirFill.color.copy(phaseAccentColor).multiplyScalar(0.75)
      coreLight1.color.copy(phasePrimaryColor)
      coreLight2.color.copy(phaseAccentColor)
      coreLight3.color.copy(phaseGlowColor)
      coreLight4.color.copy(phaseSoftColor)

      towerOrangeGlowMat.color.copy(phasePrimaryColor)
      towerHotGlowMat.color.copy(phaseSoftColor)
      wallUniforms.uColorDark.value.copy(phaseGlowColor).multiplyScalar(0.85)
      wallUniforms.uColorMid.value.copy(phasePrimaryColor)
      wallUniforms.uColorCore.value.copy(phaseSoftColor)
      particleMat.color.copy(phaseSoftColor)

      if (gridHelper.material instanceof THREE.LineBasicMaterial) {
        gridHelper.material.color.copy(phaseAccentColor)
      }

      for (let k = 0; k < totalSatelliteCubes; k++) {
        if (satelliteMeta[k].isGlow) {
          colorDummy.copy(k % 4 === 0 ? phaseSoftColor : k % 2 === 0 ? phasePrimaryColor : phaseAccentColor)
          instancedSatelliteCubes.setColorAt(k, colorDummy)
        }
      }
      if (instancedSatelliteCubes.instanceColor) {
        instancedSatelliteCubes.instanceColor.needsUpdate = true
      }

      // Dynamic light pulsations
      coreLight1.intensity = 8.4 + Math.sin(motionElapsed * 3.2) * 3.0
      coreLight2.intensity = 5.8 + Math.cos(motionElapsed * 2.7) * 2.0
      coreLight3.intensity = 5.4 + Math.sin(motionElapsed * 2.3) * 1.8
      coreLight4.intensity = 4.8 + Math.cos(motionElapsed * 2.0) * 1.6

      // Pulsing Floor Pads via Instanced Color Update (harmonized dual-hue shift)
      for (let i = 0; i < tileCount; i++) {
        const pulse = 0.3 + Math.sin(motionElapsed * 3.2 + i * 0.35) * 0.32
        const tileHue = i % 3 === 0 ? accentHue : i % 3 === 1 ? baseHue : fillHue
        colorDummy.setHSL(tileHue, 0.94, Math.max(0.16, Math.min(0.7, pulse)))
        instancedFloorTiles.setColorAt(i, colorDummy)
      }
      if (instancedFloorTiles.instanceColor) instancedFloorTiles.instanceColor.needsUpdate = true

      // Upward drifting cyber embers
      if (!prefersReducedMotion) {
        const positions = particleGeo.attributes.position.array as Float32Array
        for (let i = 0; i < particleCount; i++) {
          positions[i * 3 + 1] += 0.04
          if (positions[i * 3 + 1] > 25) {
            positions[i * 3 + 1] = 0.1
          }
        }
        particleGeo.attributes.position.needsUpdate = true
      }

      renderer.render(scene, camera)
    }

    renderLoop()

    // ─────────────────────────────────────────────────────────────────────────
    // 11. DEBOUNCED RESIZE LISTENER
    // ─────────────────────────────────────────────────────────────────────────
    let resizeTimeout: NodeJS.Timeout
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        if (!container) return
        width = window.innerWidth
        height = window.innerHeight
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        renderer.setSize(width, height)
      }, 50)
    }

    window.addEventListener("resize", handleResize, { passive: true })

    // ─────────────────────────────────────────────────────────────────────────
    // 12. CLEANUP & MEMORY DISPOSAL (Zero Memory Leaks on Unmount / Mode Switch)
    // ─────────────────────────────────────────────────────────────────────────
    return () => {
      window.removeEventListener("mousemove", onPointerMove)
      window.removeEventListener("touchmove", onPointerMove)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", handleResize)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      observer.disconnect()
      cancelAnimationFrame(frameId)

      // Traverse and dispose all scene objects
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).geometry) {
          ;(obj as THREE.Mesh).geometry.dispose()
        }
        if ((obj as THREE.Mesh).material) {
          const mat = (obj as THREE.Mesh).material
          if (Array.isArray(mat)) {
            mat.forEach((m) => m.dispose())
          } else {
            mat.dispose()
          }
        }
      })

      // Dispose tracked geometries and materials
      disposables.forEach((item) => {
        try {
          item.dispose()
        } catch {
          // ignore already disposed
        }
      })
      disposables.length = 0

      // Dispose WebGLRenderer and release WebGL context
      renderer.dispose()
      renderer.forceContextLoss()

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [mode])

  if (mode !== "3d") {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden"
      >
        {/* Full-viewport top-lit delay-driven color-shifting atmosphere (Electric Blue entrance, zero square boxes, zero solid black lower block) */}
        <div className="rushx-ambient-canvas absolute inset-0 w-full h-full">
          <div className="rushx-ambient-glow absolute inset-0 w-full h-full" />
        </div>

        {/* Subtle radial edge vignette for readability */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_32%,rgba(4,8,18,0.42)_100%)]" />

        {/* Neutral top horizon hairline */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden"
    >
      {/* Three.js Canvas Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full" />

      {/* Soft Ambient Cyber Vignette (Translucent edge-only softening) */}
      <div className="absolute inset-0 bg-radial-gradient from-transparent via-transparent to-[#020306]/55 pointer-events-none" />

      {/* Neutral Top Cyber Horizon Line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
    </div>
  )
}
