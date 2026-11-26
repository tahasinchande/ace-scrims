"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { useViewMode } from "@/lib/view-mode"
import {
  applyAmbientThemeToRoot,
  getAmbientPhaseAt,
  STAGE_BASE_NORM,
} from "@/lib/ambient-theme"

/**
 * Detect software WebGL (SwiftShader, llvmpipe, WARP) for rendering cost & frame pacing.
 */
function detectSoftwareWebGL(): boolean {
  if (typeof document === "undefined") return false
  try {
    const probeCanvas = document.createElement("canvas")
    const gl = probeCanvas.getContext("webgl2") || probeCanvas.getContext("webgl")
    if (!gl) return true
    const ext = gl.getExtension("WEBGL_debug_renderer_info")
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER
    const gpu = String(gl.getParameter(param) || "")
    gl.getExtension("WEBGL_lose_context")?.loseContext()
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu)
  } catch {
    return false
  }
}

/**
 * Unified Ace Scrims / RushX Background Engine:
 * - Recovers the ORIGINAL first 3D Cyber Monolith/Tower/Circuit-Grid/Laser-Ribbon/Ember scene
 *   with all original orange accents converted into Electric Blue / Cyan-Blue on initial load.
 * - Continuously shifts through smooth, balanced colors (starting on Blue for BOTH 2D & 3D).
 * - In "3D" ("3D Cyber") mode: Full live 3D animation (undulating monolith terrain, breathing towers,
 *   orbiting data cubes, pulsing circuit pads, sweeping laser ribbons, rising embers, camera & parallax).
 * - In "2D" ("2D Ambient") mode: Built directly on the EXACT SAME 3D foundation where ONLY the
 *   smooth continuous color-changing effect remains active with 100% identical colors (calm frozen
 *   architecture + subtle contrast scrim so text, cards, and buttons remain crisp and never washed out).
 * - Never recreates or resets WebGL context when switching between 2D and 3D modes!
 */
export function GlobalCyberBackground() {
  const threeContainerRef = useRef<HTMLDivElement>(null)
  const sharedStartMsRef = useRef<number | null>(null)
  const { mode } = useViewMode()
  const modeRef = useRef<"2d" | "3d">(mode)
  const [webglUnavailable, setWebglUnavailable] = useState(false)

  // Keep live mode ref synchronized immediately without tearing down WebGL
  useEffect(() => {
    modeRef.current = mode
    if (typeof document !== "undefined") {
      document.documentElement.dataset.viewMode = mode
    }
  }, [mode])

  // Synchronized color-changing CSS variable engine (starts Electric Blue on both 2D & 3D)
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (sharedStartMsRef.current === null) {
      sharedStartMsRef.current = performance.now()
    }

    const initPhase = getAmbientPhaseAt(0, modeRef.current)
    applyAmbientThemeToRoot(initPhase, modeRef.current)

    let rafId = 0
    let lastAppliedKey = ""
    const colorSpeed = prefersReducedMotion ? 0.45 : 1.0

    const tick = () => {
      rafId = window.requestAnimationFrame(tick)
      if (document.hidden) return
      const startMs = sharedStartMsRef.current ?? performance.now()
      const elapsedSec = ((performance.now() - startMs) / 1000) * colorSpeed
      const state = getAmbientPhaseAt(elapsedSec, modeRef.current)
      const key = `${modeRef.current}|${state.primaryRgb.join(",")}|${state.accentRgb.join(",")}|${state.glowRgb.join(",")}`
      if (key !== lastAppliedKey) {
        lastAppliedKey = key
        applyAmbientThemeToRoot(state, modeRef.current)
      }
    }

    rafId = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [])

  // Single unified Three.js scene backing BOTH "3D Cyber" (full motion + color-changing)
  // and "2D Ambient" (exact same 3D foundation with ONLY color-changing active).
  useEffect(() => {
    const container = threeContainerRef.current
    if (!container) return

    let width = Math.max(window.innerWidth, 1)
    let height = Math.max(window.innerHeight, 1)
    let isDisposed = false
    let contextLost = false

    const isSoftwareGl = detectSoftwareWebGL()

    const disposables: Array<{ dispose: () => void }> = []
    const trackDisposable = <T extends { dispose: () => void }>(resource: T): T => {
      disposables.push(resource)
      return resource
    }

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({
        powerPreference: "high-performance",
        antialias: !isSoftwareGl,
        alpha: false,
        stencil: false,
        depth: true,
      })
    } catch {
      setWebglUnavailable(true)
      return
    }

    setWebglUnavailable(false)

    if (sharedStartMsRef.current === null) {
      sharedStartMsRef.current = performance.now()
    }
    const initPhase = getAmbientPhaseAt(0, modeRef.current)

    // 1. Scene, Deep Obsidian Blue Fog, Isometric Perspective Camera & Subtle Reflections
    const scene = new THREE.Scene()
    const stageColor = new THREE.Color(
      STAGE_BASE_NORM[0] + initPhase.bgB[0] * 0.24,
      STAGE_BASE_NORM[1] + initPhase.bgB[1] * 0.24,
      STAGE_BASE_NORM[2] + initPhase.bgB[2] * 0.28
    )
    scene.background = stageColor.clone()
    const fog = new THREE.FogExp2(stageColor.getHex(), 0.017)
    scene.fog = fog

    const baseCamX = 16.5
    const baseCamY = 15.2
    const baseCamZ = 27.0
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 360)
    camera.position.set(baseCamX, baseCamY, baseCamZ)
    camera.lookAt(0, 2.4, 0)

    const maxDPR = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75)
    renderer.setPixelRatio(maxDPR)
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.18
    renderer.shadowMap.enabled = false

    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer)
      const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04)
      scene.environment = envRT.texture
      trackDisposable(envRT)
      pmremGenerator.dispose()
    } catch {
      // Proceed cleanly if PMREM is restricted
    }

    renderer.domElement.style.position = "absolute"
    renderer.domElement.style.top = "0"
    renderer.domElement.style.left = "0"
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    renderer.domElement.style.display = "block"
    renderer.domElement.style.pointerEvents = "none"

    container.replaceChildren(renderer.domElement)

    const onWebglContextLost = (e: Event) => {
      e.preventDefault()
      contextLost = true
      if (!isDisposed) setWebglUnavailable(true)
    }
    renderer.domElement.addEventListener("webglcontextlost", onWebglContextLost)

    // 2. Blue-Anchored Multi-Point Lighting Rig (replaces legacy orange/amber rig)
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x04091a, 1.2)
    scene.add(hemiLight)

    const dirKey = new THREE.DirectionalLight(0x1f73ff, 2.7)
    dirKey.position.set(24, 34, 20)
    scene.add(dirKey)

    const dirRim = new THREE.DirectionalLight(0x38bdf8, 2.0)
    dirRim.position.set(-28, 22, -24)
    scene.add(dirRim)

    const coreLight1 = new THREE.PointLight(0x1f73ff, 11.0, 56, 1.45)
    coreLight1.position.set(0, 6.5, 0)
    scene.add(coreLight1)

    const coreLight2 = new THREE.PointLight(0x38bdf8, 8.5, 48, 1.45)
    coreLight2.position.set(15, 5.2, -10)
    scene.add(coreLight2)

    const coreLight3 = new THREE.PointLight(0x2563eb, 8.0, 48, 1.45)
    coreLight3.position.set(-16, 4.8, 12)
    scene.add(coreLight3)

    // 3. GLOWING CIRCUIT GRID FLOOR PLANE (Analytic anti-aliased — no fwidth)
    const gridUniforms = {
      uTime: { value: 0 },
      uPrimary: { value: new THREE.Color(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2]) },
      uAccent: { value: new THREE.Color(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2]) },
      uSoft: { value: new THREE.Color(initPhase.c3[0], initPhase.c3[1], initPhase.c3[2]) },
    }
    const circuitGeo = trackDisposable(new THREE.PlaneGeometry(110, 110, 1, 1))
    circuitGeo.rotateX(-Math.PI / 2)

    const circuitMat = trackDisposable(
      new THREE.ShaderMaterial({
        uniforms: gridUniforms,
        vertexShader: `
          varying vec2 vWorldXZ;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldXZ = wp.xz;
            gl_Position = projectionMatrix * viewMatrix * wp;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uPrimary;
          uniform vec3 uAccent;
          uniform vec3 uSoft;
          varying vec2 vWorldXZ;

          void main() {
            vec2 g = vWorldXZ * 0.606;
            vec2 f = abs(fract(g - 0.5) - 0.5);
            float lineX = 1.0 - smoothstep(0.014, 0.048, f.x);
            float lineZ = 1.0 - smoothstep(0.014, 0.048, f.y);
            float line = max(lineX, lineZ);

            // Flowing radial energy ring sweeping across the circuit grid
            float r = length(vWorldXZ);
            float pulseRing = smoothstep(0.55, 1.0, sin(r * 0.24 - uTime * 1.45) * 0.5 + 0.5);

            vec3 col = mix(uPrimary, uAccent, pulseRing * 0.65) * line * (0.42 + pulseRing * 0.32);
            col += uSoft * line * pulseRing * 0.22;

            float distFade = 1.0 - smoothstep(22.0, 52.0, r);
            float alpha = clamp(line * distFade * (0.48 + pulseRing * 0.25), 0.0, 0.85);
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    )
    const circuitMesh = new THREE.Mesh(circuitGeo, circuitMat)
    circuitMesh.position.y = 0.06
    scene.add(circuitMesh)

    // 4. ORIGINAL 32×32 (1,024) DARK METALLIC MONOLITH TERRAIN BLOCKS
    const gridSize = 32
    const monolithCount = gridSize * gridSize
    const boxGeo = trackDisposable(new THREE.BoxGeometry(0.96, 1, 0.96))
    boxGeo.translate(0, 0.5, 0)

    const blockMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: 0x0d172e,
        roughness: 0.28,
        metalness: 0.84,
        envMapIntensity: 1.25,
      })
    )

    const instancedTerrain = new THREE.InstancedMesh(boxGeo, blockMat, monolithCount)
    instancedTerrain.frustumCulled = false
    const dummy = new THREE.Object3D()
    const colorDummy = new THREE.Color()

    const monolithPosX = new Float32Array(monolithCount)
    const monolithPosZ = new Float32Array(monolithCount)
    const monolithBaseH = new Float32Array(monolithCount)
    const monolithDist = new Float32Array(monolithCount)

    const halfGrid = gridSize / 2
    let mIdx = 0
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const px = (x - halfGrid) * 1.65
        const pz = (z - halfGrid) * 1.65
        const dist = Math.sqrt(px * px + pz * pz)

        monolithPosX[mIdx] = px
        monolithPosZ[mIdx] = pz
        monolithDist[mIdx] = dist
        monolithBaseH[mIdx] =
          dist < 6.4
            ? 2.1 + ((x * 7 + z * 13) % 10) * 0.24
            : 0.5 + Math.abs(Math.sin(x * 0.34) * Math.cos(z * 0.34)) * 1.75

        dummy.position.set(px, -0.42, pz)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, monolithBaseH[mIdx], 1)
        dummy.updateMatrix()
        instancedTerrain.setMatrixAt(mIdx, dummy.matrix)

        colorDummy.setRGB(0.05, 0.1, 0.22)
        instancedTerrain.setColorAt(mIdx, colorDummy)
        mIdx++
      }
    }
    instancedTerrain.instanceMatrix.needsUpdate = true
    if (instancedTerrain.instanceColor) instancedTerrain.instanceColor.needsUpdate = true
    scene.add(instancedTerrain)

    // 5. 64 PULSING LUMINOUS FLOOR ENERGY PADS (converted from original orange to blue color-cycle)
    const padCount = 64
    const padGeo = trackDisposable(new THREE.PlaneGeometry(1.18, 1.18))
    padGeo.rotateX(-Math.PI / 2)
    const padMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    const instancedPads = new THREE.InstancedMesh(padGeo, padMat, padCount)
    instancedPads.frustumCulled = false

    const padCoords: Array<{ x: number; z: number; phase: number; h: number }> = []
    for (let i = 0; i < padCount; i++) {
      const gx = (i * 5 + 3) % gridSize
      const gz = (i * 11 + 7) % gridSize
      const idx = gx * gridSize + gz
      const px = monolithPosX[idx]
      const pz = monolithPosZ[idx]
      const ph = monolithBaseH[idx]
      padCoords.push({ x: px, z: pz, phase: i * 0.47, h: ph })
      dummy.position.set(px, ph - 0.38, pz)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, 1)
      dummy.updateMatrix()
      instancedPads.setMatrixAt(i, dummy.matrix)
      colorDummy.setRGB(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2])
      instancedPads.setColorAt(i, colorDummy)
    }
    instancedPads.instanceMatrix.needsUpdate = true
    if (instancedPads.instanceColor) instancedPads.instanceColor.needsUpdate = true
    scene.add(instancedPads)

    // 6. 7 ORIGINAL CYBER TOWERS WITH GLOWING VERTICAL LASER SLITS & 42 ORBITING DATA CUBES
    const towerConfigs = [
      { x: 0, z: 0, s: 1.08, h: 7.6 },
      { x: 15, z: -10, s: 0.86, h: 6.7 },
      { x: -16, z: 12, s: 0.82, h: 6.2 },
      { x: -14, z: -16, s: 0.74, h: 5.9 },
      { x: 20, z: 14, s: 0.68, h: 5.5 },
      { x: 6, z: 22, s: 0.62, h: 5.1 },
      { x: -22, z: -4, s: 0.58, h: 4.9 },
    ]
    const towerCount = towerConfigs.length
    const unitBoxGeo = trackDisposable(new THREE.BoxGeometry(1, 1, 1))

    const towerNodeMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: 0x071024,
        roughness: 0.2,
        metalness: 0.9,
        envMapIntensity: 1.4,
      })
    )
    const towerOuterGlowMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2]),
      })
    )
    const towerInnerGlowMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2]),
      })
    )

    const instancedPillars = new THREE.InstancedMesh(unitBoxGeo, towerNodeMat, towerCount)
    const instancedOuterSlits = new THREE.InstancedMesh(unitBoxGeo, towerOuterGlowMat, towerCount)
    const instancedInnerSlits = new THREE.InstancedMesh(unitBoxGeo, towerInnerGlowMat, towerCount)
    instancedPillars.frustumCulled = false
    instancedOuterSlits.frustumCulled = false
    instancedInnerSlits.frustumCulled = false
    scene.add(instancedPillars)
    scene.add(instancedOuterSlits)
    scene.add(instancedInnerSlits)

    const totalSatelliteCubes = towerCount * 6
    const satelliteMat = trackDisposable(new THREE.MeshBasicMaterial({ color: 0xffffff }))
    const instancedSatelliteCubes = new THREE.InstancedMesh(
      unitBoxGeo,
      satelliteMat,
      totalSatelliteCubes
    )
    instancedSatelliteCubes.frustumCulled = false

    type SatelliteMeta = {
      towerX: number
      towerZ: number
      towerScale: number
      baseY: number
      angle: number
      radius: number
      isGlow: boolean
      accentMix: number
      orbitSpeed: number
    }
    const satelliteMeta: SatelliteMeta[] = []
    const darkSatColor = new THREE.Color(0x0a1630)

    let satIdx = 0
    towerConfigs.forEach((t, tIdx) => {
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2
        const rad = (2.0 + (i % 2) * 0.65) * t.s
        const isGlow = i % 2 === 0
        const baseY = (t.h * 0.58 + (i % 3) * 0.85) * t.s
        const accentMix = ((tIdx + i) % 3) * 0.35

        satelliteMeta.push({
          towerX: t.x,
          towerZ: t.z,
          towerScale: t.s,
          baseY,
          angle,
          radius: rad,
          isGlow,
          accentMix,
          orbitSpeed: (i % 2 === 0 ? 0.62 : -0.45) * (0.9 + (tIdx % 3) * 0.14),
        })

        if (isGlow) {
          colorDummy.setRGB(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2])
        } else {
          colorDummy.copy(darkSatColor)
        }
        instancedSatelliteCubes.setColorAt(satIdx, colorDummy)
        satIdx++
      }
    })
    if (instancedSatelliteCubes.instanceColor) instancedSatelliteCubes.instanceColor.needsUpdate = true
    scene.add(instancedSatelliteCubes)

    // 7. ORIGINAL VOLUMETRIC LASER WALLS / ENERGY RIBBONS (blue-anchored, continuous color-shift)
    const wallUniforms = {
      uTime: { value: 0 },
      uColorDark: {
        value: new THREE.Color(initPhase.glow[0] * 1.35, initPhase.glow[1] * 1.35, initPhase.glow[2] * 1.35),
      },
      uColorMid: { value: new THREE.Color(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2]) },
      uColorCore: { value: new THREE.Color(initPhase.c3[0], initPhase.c3[1], initPhase.c3[2]) },
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
            pos.y += sin(pos.x * 0.20 - uTime * 2.4) * 0.42;
            pos.z += cos(pos.x * 0.15 - uTime * 1.8) * 0.36;
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
            float fastStreams = sin(vUv.x * 42.0 - uTime * 7.2) * 0.5 + 0.5;
            float pulseWaves = sin(vUv.x * 9.0 - uTime * 2.8) * 0.5 + 0.5;

            float beamCore = pow(sin(vUv.y * 3.14159), 2.1);
            float thinIntense = pow(sin(vUv.y * 3.14159), 7.5) * 1.7;

            vec3 col = mix(uColorDark, uColorMid, vUv.y);
            col = mix(col, uColorCore, clamp(thinIntense + fastStreams * 0.28, 0.0, 1.0));

            float alpha = (beamCore * 0.58 + fastStreams * 0.16) * (0.76 + pulseWaves * 0.24);
            gl_FragColor = vec4(col * 1.25, alpha);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )

    const beamSpecs = [
      { len: 54, h: 5.8, x: -12, y: 1.4, z: -6, rotY: -Math.PI * 0.22, scale: 1.0 },
      { len: 46, h: 4.8, x: -16, y: 1.2, z: 10, rotY: Math.PI * 0.36, scale: 0.9 },
      { len: 56, h: 4.4, x: -24, y: 1.0, z: -18, rotY: -Math.PI * 0.06, scale: 1.0 },
      { len: 46, h: 4.8, x: -8, y: 2.0, z: 16, rotY: -Math.PI * 0.42, scale: 0.85 },
    ]
    const laserWalls: THREE.Mesh[] = []
    for (const spec of beamSpecs) {
      const geo = trackDisposable(new THREE.PlaneGeometry(spec.len, spec.h, 40, 1))
      geo.translate(spec.len / 2, spec.h / 2, 0)
      const mesh = new THREE.Mesh(geo, laserShaderMat)
      mesh.position.set(spec.x, spec.y, spec.z)
      mesh.rotation.y = spec.rotY
      mesh.scale.set(spec.scale, spec.scale, 1)
      scene.add(mesh)
      laserWalls.push(mesh)
    }

    // 8. 760 RISING LUMINOUS EMBERS (converted from orange embers to blue/color-cycling embers)
    const particleCount = isSoftwareGl ? 420 : 760
    const particleGeo = trackDisposable(new THREE.BufferGeometry())
    const particlePos = new Float32Array(particleCount * 3)
    const particleBaseX = new Float32Array(particleCount)
    const particleBaseY = new Float32Array(particleCount)
    const particleBaseZ = new Float32Array(particleCount)
    const particleSpeed = new Float32Array(particleCount)
    const particleSeed = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      const px = (Math.random() - 0.5) * 66
      const py = Math.random() * 25
      const pz = (Math.random() - 0.5) * 66
      particlePos[i * 3] = px
      particlePos[i * 3 + 1] = py
      particlePos[i * 3 + 2] = pz
      particleBaseX[i] = px
      particleBaseY[i] = py
      particleBaseZ[i] = pz
      particleSpeed[i] = 1.2 + Math.random() * 2.0
      particleSeed[i] = Math.random() * Math.PI * 2
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3))

    const particleMat = trackDisposable(
      new THREE.PointsMaterial({
        color: new THREE.Color(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2]),
        size: 0.22,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    const particles = new THREE.Points(particleGeo, particleMat)
    particles.frustumCulled = false
    scene.add(particles)

    // 9. PASSIVE POINTER & SCROLL INPUTS (applied only in 3D mode)
    let targetMouseX = 0
    let targetMouseY = 0
    let smoothMouseX = 0
    let smoothMouseY = 0
    let scrollY = 0

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY
      targetMouseX = ((clientX / Math.max(window.innerWidth, 1)) * 2 - 1) * 4.4
      targetMouseY = -((clientY / Math.max(window.innerHeight, 1)) * 2 - 1) * 2.8
    }

    const onScroll = () => {
      scrollY = window.scrollY || document.documentElement.scrollTop || 0
    }

    window.addEventListener("mousemove", onPointerMove, { passive: true })
    window.addEventListener("touchmove", onPointerMove, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })

    // Tab visibility pause only
    let isTabActive = typeof document !== "undefined" ? !document.hidden : true
    const onVisibilityChange = () => {
      isTabActive = !document.hidden
      if (isTabActive) lastFrameNow = performance.now()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    // Pre-allocated math objects
    const rotationEuler = new THREE.Euler()
    const rotQuat = new THREE.Quaternion()
    const cubeScaleVec = new THREE.Vector3()
    const c1Color = new THREE.Color()
    const c2Color = new THREE.Color()
    const c3Color = new THREE.Color()
    const bgTintColor = new THREE.Color()
    const tempBlockColor = new THREE.Color()
    const tempPadColor = new THREE.Color()
    const tempSatColor = new THREE.Color()
    const baseDarkBlock = new THREE.Color(0x060d1f)

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let frameId = 0
    let softwareTimerId = 0
    let lastFrameNow = performance.now()
    // 3D geometric motion clock (advances in "3d" mode, pauses smoothly in "2d" mode!)
    let motionElapsed = 0
    // Smooth transition blend: 1.0 = full 3D motion, 0.0 = 2D color-changing-only mode
    let motionBlend = modeRef.current === "3d" ? 1 : 0

    function afterDraw(cb: () => void) {
      if (isDisposed || contextLost) return
      const gl = renderer.getContext()
      if (typeof WebGL2RenderingContext !== "undefined" && gl instanceof WebGL2RenderingContext) {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0)
        gl.flush()
        const poll = () => {
          if (isDisposed || contextLost) {
            if (sync) gl.deleteSync(sync)
            return
          }
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS)
          if (state === gl.UNSIGNALED) {
            softwareTimerId = window.setTimeout(poll, 8)
          } else {
            if (sync) gl.deleteSync(sync)
            softwareTimerId = window.setTimeout(cb, 55)
          }
        }
        softwareTimerId = window.setTimeout(poll, 8)
      } else {
        softwareTimerId = window.setTimeout(cb, 65)
      }
    }

    const scheduleNext = () => {
      if (isDisposed || contextLost) return
      if (isSoftwareGl) {
        afterDraw(renderFrame)
      } else {
        frameId = window.requestAnimationFrame(renderFrame)
      }
    }

    const renderFrame = () => {
      if (isDisposed || contextLost) return

      const now = performance.now()
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameNow) / 1000))
      lastFrameNow = now

      if (!isTabActive) {
        frameId = window.requestAnimationFrame(renderFrame)
        return
      }

      const is3D = modeRef.current === "3d"
      const targetBlend = is3D ? 1 : 0
      const blendRate = 1 - Math.exp(-4.5 * dt)
      motionBlend += (targetBlend - motionBlend) * blendRate

      // Advance 3D spatial motion clock ONLY proportional to motionBlend (0 in 2D mode!)
      const spatialRate = (prefersReducedMotion ? 0.35 : 1.0) * motionBlend
      motionElapsed += dt * spatialRate

      // Color-changing clock ALWAYS runs smoothly across BOTH 2D & 3D modes (starts Electric Blue!)
      const colorElapsed =
        sharedStartMsRef.current !== null
          ? Math.max(0, (now - sharedStartMsRef.current) / 1000) * (prefersReducedMotion ? 0.45 : 1.0)
          : 0
      const phase = getAmbientPhaseAt(colorElapsed, modeRef.current)

      c1Color.setRGB(phase.c1[0], phase.c1[1], phase.c1[2])
      c2Color.setRGB(phase.c2[0], phase.c2[1], phase.c2[2])
      c3Color.setRGB(phase.c3[0], phase.c3[1], phase.c3[2])

      // Background & Fog: controlled obsidian tinted with identical live color phase
      bgTintColor.setRGB(
        STAGE_BASE_NORM[0] + phase.bgB[0] * 0.24,
        STAGE_BASE_NORM[1] + phase.bgB[1] * 0.24,
        STAGE_BASE_NORM[2] + phase.bgB[2] * 0.28
      )
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(bgTintColor)
      }
      fog.color.copy(bgTintColor)

      // Synchronized lights (colors ALWAYS update; orbital motion only when in 3D mode)
      hemiLight.color.copy(c2Color)
      hemiLight.groundColor.copy(bgTintColor)
      dirKey.color.copy(c1Color)
      dirRim.color.copy(c2Color)

      coreLight1.color.copy(c1Color)
      coreLight1.intensity = 10.5 + Math.sin(motionElapsed * 2.2) * 2.6 * motionBlend
      coreLight1.position.x = Math.sin(motionElapsed * 0.5) * 6.0 * motionBlend
      coreLight1.position.z = Math.cos(motionElapsed * 0.45) * 6.0 * motionBlend

      coreLight2.color.copy(c2Color)
      coreLight2.intensity = 8.4 + Math.cos(motionElapsed * 1.9) * 2.2 * motionBlend
      coreLight2.position.x = 15 + Math.cos(motionElapsed * 0.4) * 4.2 * motionBlend
      coreLight2.position.z = -10 + Math.sin(motionElapsed * 0.45) * 4.2 * motionBlend

      coreLight3.color.copy(c1Color).lerp(c2Color, 0.45)
      coreLight3.intensity = 7.8 + Math.sin(motionElapsed * 1.7 + 1.2) * 2.0 * motionBlend

      // Circuit Grid Floor: color updates in both modes, radial pulse moves only in 3D mode
      gridUniforms.uTime.value = motionElapsed
      gridUniforms.uPrimary.value.copy(c1Color)
      gridUniforms.uAccent.value.copy(c2Color)
      gridUniforms.uSoft.value.copy(c3Color)

      // 1,024 Monolith Terrain Blocks: static architectural base in 2D, undulating wave in 3D, identical live color tint!
      for (let i = 0; i < monolithCount; i++) {
        const px = monolithPosX[i]
        const pz = monolithPosZ[i]
        const dist = monolithDist[i]
        const wave =
          motionBlend > 0.002
            ? (Math.sin(px * 0.14 - motionElapsed * 1.35) *
                Math.cos(pz * 0.14 - motionElapsed * 1.05) *
                1.05 +
                Math.sin(dist * 0.24 - motionElapsed * 1.75) * 0.55) *
              motionBlend
            : 0

        const h = Math.max(0.3, monolithBaseH[i] + wave)
        dummy.position.set(px, -0.42, pz)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1, h, 1)
        dummy.updateMatrix()
        instancedTerrain.setMatrixAt(i, dummy.matrix)

        const crest = Math.max(0, Math.min(1, (h - 1.0) / 3.2))
        tempBlockColor
          .copy(baseDarkBlock)
          .lerp(c1Color, crest * 0.42)
          .lerp(c2Color, crest * crest * 0.36)
        instancedTerrain.setColorAt(i, tempBlockColor)
      }
      instancedTerrain.instanceMatrix.needsUpdate = true
      if (instancedTerrain.instanceColor) instancedTerrain.instanceColor.needsUpdate = true

      // 64 Pulsing Floor Energy Pads: live color-shifting in both modes, height follows monoliths
      for (let i = 0; i < padCount; i++) {
        const pad = padCoords[i]
        const glowMix = 0.45 + 0.55 * (Math.sin(colorElapsed * 1.2 + pad.phase) * 0.5 + 0.5)
        tempPadColor.copy(c1Color).lerp(c2Color, glowMix).lerp(c3Color, 0.18)
        instancedPads.setColorAt(i, tempPadColor)
      }
      if (instancedPads.instanceColor) instancedPads.instanceColor.needsUpdate = true

      // 7 Cyber Towers + Glowing Vertical Laser Slits
      towerOuterGlowMat.color.copy(c1Color)
      towerInnerGlowMat.color.copy(c2Color).lerp(c3Color, 0.42)

      for (let i = 0; i < towerCount; i++) {
        const t = towerConfigs[i]
        const breathe = 1 + Math.sin(motionElapsed * 1.5 + i * 0.9) * 0.07 * motionBlend
        const th = t.h * t.s * breathe

        dummy.position.set(t.x, th / 2, t.z)
        dummy.rotation.set(0, 0, 0)
        dummy.scale.set(1.45 * t.s, th, 1.45 * t.s)
        dummy.updateMatrix()
        instancedPillars.setMatrixAt(i, dummy.matrix)

        dummy.position.set(t.x, th / 2, t.z)
        dummy.scale.set(0.38 * t.s, th * 0.95, 1.54 * t.s)
        dummy.updateMatrix()
        instancedOuterSlits.setMatrixAt(i, dummy.matrix)

        dummy.position.set(t.x, th / 2, t.z)
        dummy.scale.set(0.15 * t.s, th * 0.95, 1.58 * t.s)
        dummy.updateMatrix()
        instancedInnerSlits.setMatrixAt(i, dummy.matrix)
      }
      instancedPillars.instanceMatrix.needsUpdate = true
      instancedOuterSlits.instanceMatrix.needsUpdate = true
      instancedInnerSlits.instanceMatrix.needsUpdate = true

      // 42 Orbiting Satellite Data Cubes (orbit smoothly in 3D, hold composed frame in 2D, color-shift in both!)
      for (let k = 0; k < totalSatelliteCubes; k++) {
        const meta = satelliteMeta[k]
        const orbitAngle = meta.angle + motionElapsed * meta.orbitSpeed
        const cubeY = meta.baseY + Math.sin(motionElapsed * 2.1 + k) * 0.32 * motionBlend
        const cubeX = meta.towerX + Math.cos(orbitAngle) * meta.radius
        const cubeZ = meta.towerZ + Math.sin(orbitAngle) * meta.radius

        rotationEuler.set(
          motionElapsed * 0.75 + k * 0.3,
          motionElapsed * 1.25 + k * 0.5,
          0
        )
        rotQuat.setFromEuler(rotationEuler)
        cubeScaleVec.set(0.66 * meta.towerScale, 0.66 * meta.towerScale, 0.66 * meta.towerScale)

        dummy.position.set(cubeX, cubeY, cubeZ)
        dummy.quaternion.copy(rotQuat)
        dummy.scale.copy(cubeScaleVec)
        dummy.updateMatrix()
        instancedSatelliteCubes.setMatrixAt(k, dummy.matrix)

        if (meta.isGlow) {
          tempSatColor.copy(c1Color).lerp(c2Color, meta.accentMix).lerp(c3Color, 0.16)
          instancedSatelliteCubes.setColorAt(k, tempSatColor)
        }
      }
      instancedSatelliteCubes.instanceMatrix.needsUpdate = true
      if (instancedSatelliteCubes.instanceColor) instancedSatelliteCubes.instanceColor.needsUpdate = true

      // Sweeping Volumetric Laser Walls (color shifts continuously in BOTH modes; waves flow in 3D only)
      wallUniforms.uTime.value = motionElapsed
      wallUniforms.uColorDark.value.setRGB(
        phase.glow[0] * 1.35,
        phase.glow[1] * 1.35,
        phase.glow[2] * 1.35
      )
      wallUniforms.uColorMid.value.copy(c1Color).lerp(c2Color, 0.45)
      wallUniforms.uColorCore.value.copy(c3Color)
      laserWalls.forEach((wall, idx) => {
        wall.position.y =
          1.1 + idx * 0.24 + Math.sin(motionElapsed * 0.8 + idx * 1.4) * 0.48 * motionBlend
      })

      // Rising Embers (live color-shift in BOTH modes; rise/swirl in 3D only)
      particleMat.color.copy(c2Color).lerp(c3Color, 0.32)
      if (motionBlend > 0.002) {
        const positions = particleGeo.attributes.position.array as Float32Array
        for (let i = 0; i < particleCount; i++) {
          const yIndex = i * 3 + 1
          let y = positions[yIndex] + particleSpeed[i] * dt * spatialRate
          if (y > 25) y = 0.2
          positions[yIndex] = y

          const swirl = motionElapsed * 0.5 + particleSeed[i]
          positions[i * 3] = particleBaseX[i] + Math.sin(swirl) * 1.2 * motionBlend
          positions[i * 3 + 2] = particleBaseZ[i] + Math.cos(swirl) * 1.2 * motionBlend
        }
        particleGeo.attributes.position.needsUpdate = true
      }

      // Camera: calm architectural lock in 2D mode; smooth autonomous glide + pointer/scroll parallax in 3D mode
      const damp = 1 - Math.exp(-3.4 * dt)
      smoothMouseX += (targetMouseX * motionBlend - smoothMouseX) * damp
      smoothMouseY += (targetMouseY * motionBlend - smoothMouseY) * damp

      const docHeight =
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          window.innerHeight * 2
        ) - window.innerHeight
      const scrollRatio = Math.min(1, Math.max(0, scrollY / Math.max(docHeight, 1)))

      const autoX = Math.sin(motionElapsed * 0.34) * 3.8 * motionBlend
      const autoY = Math.cos(motionElapsed * 0.28) * 1.25 * motionBlend
      const autoZ = Math.cos(motionElapsed * 0.24) * 2.4 * motionBlend

      const targetCamX = baseCamX + autoX + smoothMouseX * 0.65
      const targetCamY = baseCamY + autoY + smoothMouseY * 0.45 - scrollRatio * 3.2 * motionBlend
      const targetCamZ = baseCamZ + autoZ - scrollRatio * 3.6 * motionBlend

      camera.position.x += (targetCamX - camera.position.x) * damp
      camera.position.y += (targetCamY - camera.position.y) * damp
      camera.position.z += (targetCamZ - camera.position.z) * damp
      camera.lookAt(
        smoothMouseX * 0.28,
        2.4 + smoothMouseY * 0.2 - scrollRatio * 1.2 * motionBlend,
        0
      )

      renderer.render(scene, camera)
      scheduleNext()
    }

    const handleResize = () => {
      if (isDisposed || contextLost) return
      width = Math.max(window.innerWidth, 1)
      height = Math.max(window.innerHeight, 1)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      const dpr = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75)
      renderer.setPixelRatio(dpr)
      renderer.setSize(width, height)
    }

    window.addEventListener("resize", handleResize, { passive: true })

    // Render initial Electric Blue frame immediately
    renderFrame()

    return () => {
      isDisposed = true
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(softwareTimerId)
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("mousemove", onPointerMove)
      window.removeEventListener("touchmove", onPointerMove)
      window.removeEventListener("scroll", onScroll)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      renderer.domElement.removeEventListener("webglcontextlost", onWebglContextLost)
      for (const resource of disposables) {
        try {
          resource.dispose()
        } catch {
          // ignore disposal errors
        }
      }
      try {
        renderer.dispose()
      } catch {
        // ignore renderer disposal errors
      }
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden bg-[#030612]"
      aria-hidden="true"
    >
      {/* Safe CSS Color-Shifting Fallback if WebGL is unavailable on a device */}
      {webglUnavailable && (
        <div className="absolute inset-0">
          <div className="rushx-ambient-canvas absolute inset-0" />
          <div className="rushx-ambient-glow absolute -inset-[10%]" />
        </div>
      )}

      {/* Unified Three.js Canvas backing BOTH 3D Cyber (motion + color shift) and 2D Ambient (color shift only) */}
      <div
        ref={threeContainerRef}
        className={`absolute inset-0 transition-opacity duration-500 ease-out ${
          webglUnavailable ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Controlled contrast readability veil — slightly calmer in 2D mode while keeping identical colors */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ease-out ${
          mode === "2d" ? "bg-[#030612]/38 opacity-100" : "bg-[#030612]/16 opacity-100"
        }`}
      />
    </div>
  )
}
