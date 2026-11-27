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
 * Deterministic PRNG so skyline buildings, lit windows, and starfields render cleanly and consistently.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Unified RushX / Ace Scrims Background Engine:
 *
 * 1. 3D Cyber Mode ("3d"):
 *    - Recovers the signature November 23 3D Cyber Horizon & Cityscape scene (deep starry sky,
 *      receding glowing perspective cyber grid, dark metallic cityscape silhouette with crisp
 *      lit windows & vertical cyber laser towers, luminous horizontal horizon light band with
 *      atmospheric spill, orbiting geometric nodes, rising sparks, and smooth parallax drift).
 *    - INITIAL OPENING COLOR is BLUE (Electric Blue / Ice Cyan), then smoothly color-shifts
 *      through Cyber Violet / Purple -> Neon Orchid -> Electric Cyan -> Luminous Sapphire -> Blue.
 *
 * 2. 2D Ambient Mode ("2d"):
 *    - Recovers the dedicated 2D Ambient obsidian aurora background (silky multi-layer fluid
 *      radial waves + drifting ambient light particles on an obsidian low-glare base).
 *    - Driven by the EXACT SAME live color-changing clock as 3D mode, opening on BLUE and
 *      smoothly shifting through identical hues while preserving dedicated 2D ambient motion.
 *    - Cross-fades smoothly with 3D mode (pausing inactive renderers to protect FPS/battery)
 *      and acts as the automatic fallback if WebGL is unavailable on a device.
 */
export function GlobalCyberBackground() {
  const threeContainerRef = useRef<HTMLDivElement>(null)
  const ambient2dCanvasRef = useRef<HTMLCanvasElement>(null)
  const sharedStartMsRef = useRef<number | null>(null)
  const { mode } = useViewMode()
  const modeRef = useRef<"2d" | "3d">(mode)
  const [webglUnavailable, setWebglUnavailable] = useState(false)

  // Synchronize mode ref & data attribute immediately without recreating WebGL
  useEffect(() => {
    modeRef.current = mode
    if (typeof document !== "undefined") {
      document.documentElement.dataset.viewMode = mode
    }
  }, [mode])

  // 1. Synchronized live CSS color-changing engine (ALWAYS opens in Electric Blue for BOTH 2D & 3D)
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
    const colorSpeed = prefersReducedMotion ? 0.4 : 1.0

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

  // 2. Dedicated 2D Ambient Canvas Layer (silky drifting obsidian aurora orbs + ambient starlight)
  //    Active whenever mode === "2d" OR WebGL is unavailable as a graceful fallback.
  useEffect(() => {
    const canvas = ambient2dCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const rand = mulberry32(20261123)
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    let width = Math.max(window.innerWidth, 1)
    let height = Math.max(window.innerHeight, 1)

    const resize = () => {
      width = Math.max(window.innerWidth, 1)
      height = Math.max(window.innerHeight, 1)
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener("resize", resize, { passive: true })

    // Drifting micro-particles for subtle 2D ambient depth
    const dustCount = prefersReducedMotion ? 28 : 64
    const dust = Array.from({ length: dustCount }, () => ({
      x: rand(),
      y: rand(),
      r: 0.7 + rand() * 1.5,
      vx: (rand() - 0.5) * 0.008,
      vy: -(0.004 + rand() * 0.012),
      alpha: 0.16 + rand() * 0.42,
      twinkle: rand() * Math.PI * 2,
    }))

    let pointerX = 0.5
    let pointerY = 0.3
    let smoothPtrX = 0.5
    let smoothPtrY = 0.3

    const onPointerMove = (e: MouseEvent) => {
      pointerX = e.clientX / Math.max(window.innerWidth, 1)
      pointerY = e.clientY / Math.max(window.innerHeight, 1)
    }
    window.addEventListener("mousemove", onPointerMove, { passive: true })

    let rafId = 0
    let lastNow = performance.now()
    let isDisposed = false

    const render2D = () => {
      if (isDisposed) return
      rafId = window.requestAnimationFrame(render2D)

      // Only draw when 2D Ambient is visible or serving as WebGL fallback
      if (document.hidden || (modeRef.current === "3d" && !webglUnavailable)) {
        lastNow = performance.now()
        return
      }

      const now = performance.now()
      const dt = Math.min(0.05, Math.max(0.001, (now - lastNow) / 1000))
      lastNow = now

      const startMs = sharedStartMsRef.current ?? now
      const elapsed = Math.max(0, (now - startMs) / 1000)
      const motionT = elapsed * (prefersReducedMotion ? 0.28 : 1.0)
      const colorT = elapsed * (prefersReducedMotion ? 0.4 : 1.0)
      const phase = getAmbientPhaseAt(colorT, "2d")

      const damp = 1 - Math.exp(-2.8 * dt)
      smoothPtrX += (pointerX - smoothPtrX) * damp
      smoothPtrY += (pointerY - smoothPtrY) * damp

      const [pr, pg, pb] = phase.primaryRgb
      const [ar, ag, ab] = phase.accentRgb
      const [gr, gg, gb] = phase.glowRgb
      const [sr, sg, sb] = phase.softRgb
      const [dr, dg, db] = phase.deepRgb

      // Controlled obsidian base gradient (never glaring, crisp legibility)
      const baseGrad = ctx.createLinearGradient(0, 0, 0, height)
      baseGrad.addColorStop(0, `rgb(${Math.round(4 + dr * 0.45)}, ${Math.round(6 + dg * 0.45)}, ${Math.round(14 + db * 0.55)})`)
      baseGrad.addColorStop(0.55, "#050712")
      baseGrad.addColorStop(1, "#03040a")
      ctx.fillStyle = baseGrad
      ctx.fillRect(0, 0, width, height)

      // Ambient Orb 1 — Top-center breathing radial halo (randomqbit.site controlled glow)
      const orb1X = width * (0.5 + Math.sin(motionT * 0.24) * 0.14 + (smoothPtrX - 0.5) * 0.08)
      const orb1Y = height * (0.18 + Math.cos(motionT * 0.19) * 0.07 + (smoothPtrY - 0.3) * 0.06)
      const orb1R = Math.max(width, height) * 0.58
      const g1 = ctx.createRadialGradient(orb1X, orb1Y, 0, orb1X, orb1Y, orb1R)
      g1.addColorStop(0, `rgba(${pr}, ${pg}, ${pb}, 0.26)`)
      g1.addColorStop(0.36, `rgba(${gr}, ${gg}, ${gb}, 0.16)`)
      g1.addColorStop(0.7, `rgba(${dr}, ${dg}, ${db}, 0.06)`)
      g1.addColorStop(1, "rgba(4, 6, 14, 0)")
      ctx.fillStyle = g1
      ctx.fillRect(0, 0, width, height)

      // Ambient Orb 2 — Drifting secondary accent plume (right-mid)
      const orb2X = width * (0.78 + Math.cos(motionT * 0.21) * 0.12)
      const orb2Y = height * (0.52 + Math.sin(motionT * 0.27) * 0.14)
      const orb2R = Math.max(width, height) * 0.46
      const g2 = ctx.createRadialGradient(orb2X, orb2Y, 0, orb2X, orb2Y, orb2R)
      g2.addColorStop(0, `rgba(${ar}, ${ag}, ${ab}, 0.17)`)
      g2.addColorStop(0.45, `rgba(${pr}, ${pg}, ${pb}, 0.08)`)
      g2.addColorStop(1, "rgba(4, 6, 14, 0)")
      ctx.fillStyle = g2
      ctx.fillRect(0, 0, width, height)

      // Ambient Orb 3 — Lower-left atmospheric depth plume
      const orb3X = width * (0.18 + Math.sin(motionT * 0.17 + 1.7) * 0.1)
      const orb3Y = height * (0.78 + Math.cos(motionT * 0.22 + 0.8) * 0.1)
      const orb3R = Math.max(width, height) * 0.48
      const g3 = ctx.createRadialGradient(orb3X, orb3Y, 0, orb3X, orb3Y, orb3R)
      g3.addColorStop(0, `rgba(${gr}, ${gg}, ${gb}, 0.22)`)
      g3.addColorStop(0.5, `rgba(${pr}, ${pg}, ${pb}, 0.08)`)
      g3.addColorStop(1, "rgba(4, 6, 14, 0)")
      ctx.fillStyle = g3
      ctx.fillRect(0, 0, width, height)

      // Subtle horizon aurora ribbon (ties 2D Ambient visually to the 3D Cyber horizon)
      const horizonY = height * (0.46 + Math.sin(motionT * 0.26) * 0.025)
      const bandGrad = ctx.createLinearGradient(0, horizonY - 90, 0, horizonY + 110)
      bandGrad.addColorStop(0, "rgba(0,0,0,0)")
      bandGrad.addColorStop(0.45, `rgba(${pr}, ${pg}, ${pb}, 0.08)`)
      bandGrad.addColorStop(0.5, `rgba(${sr}, ${sg}, ${sb}, 0.11)`)
      bandGrad.addColorStop(0.58, `rgba(${ar}, ${ag}, ${ab}, 0.06)`)
      bandGrad.addColorStop(1, "rgba(0,0,0,0)")
      ctx.fillStyle = bandGrad
      ctx.fillRect(0, horizonY - 90, width, 200)

      // Fine drifting ambient light particles
      const speedScale = prefersReducedMotion ? 0.25 : 1.0
      for (let i = 0; i < dust.length; i++) {
        const p = dust[i]
        p.x += p.vx * dt * speedScale
        p.y += p.vy * dt * speedScale
        if (p.y < -0.02) {
          p.y = 1.02
          p.x = (p.x + 0.37) % 1
        }
        if (p.x < -0.02) p.x = 1.02
        if (p.x > 1.02) p.x = -0.02

        const pulse = 0.55 + 0.45 * Math.sin(motionT * 1.4 + p.twinkle)
        const a = p.alpha * pulse
        ctx.beginPath()
        ctx.arc(p.x * width, p.y * height, p.r, 0, Math.PI * 2)
        ctx.fillStyle =
          i % 3 === 0
            ? `rgba(${sr}, ${sg}, ${sb}, ${a.toFixed(3)})`
            : `rgba(${ar}, ${ag}, ${ab}, ${(a * 0.85).toFixed(3)})`
        ctx.fill()
      }
    }

    rafId = window.requestAnimationFrame(render2D)
    return () => {
      isDisposed = true
      window.cancelAnimationFrame(rafId)
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onPointerMove)
    }
  }, [webglUnavailable])

  // 3. November 23 3D Cyber Horizon & Cityscape WebGL Scene (BLUE Initial Color + Dynamic Color-Shift)
  useEffect(() => {
    const container = threeContainerRef.current
    if (!container) return

    let width = Math.max(window.innerWidth, 1)
    let height = Math.max(window.innerHeight, 1)
    let isDisposed = false
    let contextLost = false

    const isSoftwareGl = detectSoftwareWebGL()
    const rand = mulberry32(11232026)

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
    const initPhase = getAmbientPhaseAt(0, "3d")

    // Scene, Deep Night Obsidian Fog, Perspective Camera & Studio Reflections
    const scene = new THREE.Scene()
    const stageColor = new THREE.Color(
      STAGE_BASE_NORM[0] + initPhase.bgB[0] * 0.22,
      STAGE_BASE_NORM[1] + initPhase.bgB[1] * 0.22,
      STAGE_BASE_NORM[2] + initPhase.bgB[2] * 0.26
    )
    scene.background = stageColor.clone()
    const fog = new THREE.FogExp2(stageColor.getHex(), 0.0155)
    scene.fog = fog

    const baseCamX = 0
    const baseCamY = 8.4
    const baseCamZ = 31.5
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 340)
    camera.position.set(baseCamX, baseCamY, baseCamZ)
    camera.lookAt(0, 3.6, -24)

    const maxDPR = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75)
    renderer.setPixelRatio(maxDPR)
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
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

    // Lighting Rig — Opens in Electric Blue, shifts smoothly through Nov 23 Purple/Violet/Cyan
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x04091a, 1.15)
    scene.add(hemiLight)

    const dirKey = new THREE.DirectionalLight(0x1f73ff, 2.4)
    dirKey.position.set(16, 26, 22)
    scene.add(dirKey)

    const dirHorizonRim = new THREE.DirectionalLight(0x38bdf8, 2.8)
    dirHorizonRim.position.set(0, 10, -48)
    scene.add(dirHorizonRim)

    const horizonGlowLight1 = new THREE.PointLight(0x1f73ff, 14.0, 95, 1.35)
    horizonGlowLight1.position.set(0, 5.5, -24)
    scene.add(horizonGlowLight1)

    const horizonGlowLight2 = new THREE.PointLight(0x38bdf8, 10.0, 75, 1.4)
    horizonGlowLight2.position.set(-22, 6.2, -16)
    scene.add(horizonGlowLight2)

    const horizonGlowLight3 = new THREE.PointLight(0x2563eb, 10.0, 75, 1.4)
    horizonGlowLight3.position.set(22, 6.2, -16)
    scene.add(horizonGlowLight3)

    // A. UPPER NIGHT SKY STARFIELD
    const starCount = isSoftwareGl ? 320 : 680
    const starGeo = trackDisposable(new THREE.BufferGeometry())
    const starPos = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      starPos[i * 3] = (rand() - 0.5) * 180
      starPos[i * 3 + 1] = 8 + rand() * 58
      starPos[i * 3 + 2] = -20 - rand() * 140
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3))
    const starMat = trackDisposable(
      new THREE.PointsMaterial({
        color: new THREE.Color(initPhase.c3[0], initPhase.c3[1], initPhase.c3[2]),
        size: 0.34,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    const starField = new THREE.Points(starGeo, starMat)
    starField.frustumCulled = false
    scene.add(starField)

    // B. LUMINOUS HORIZONTAL HORIZON LIGHT BAND & ATMOSPHERIC SPILL
    const horizonUniforms = {
      uTime: { value: 0 },
      uPrimary: { value: new THREE.Color(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2]) },
      uAccent: { value: new THREE.Color(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2]) },
      uCore: { value: new THREE.Color(initPhase.c3[0], initPhase.c3[1], initPhase.c3[2]) },
    }
    const horizonGeo = trackDisposable(new THREE.PlaneGeometry(220, 48, 1, 1))
    const horizonMat = trackDisposable(
      new THREE.ShaderMaterial({
        uniforms: horizonUniforms,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uPrimary;
          uniform vec3 uAccent;
          uniform vec3 uCore;
          varying vec2 vUv;

          void main() {
            float y = vUv.y;
            float xDist = abs(vUv.x - 0.5) * 2.0;
            float horizMask = 1.0 - smoothstep(0.12, 1.0, xDist);

            // Crisp horizontal light band near the skyline base (y ~ 0.24)
            float dBand = abs(y - 0.24);
            float coreBeam = exp(-dBand * 34.0) * (0.95 + 0.08 * sin(uTime * 1.1));
            float midHalo = exp(-dBand * 8.2) * 0.62;
            float upperAura = exp(-max(0.0, y - 0.22) * 3.4) * 0.34 * horizMask;

            // Gentle horizontal energy shimmer traveling along the horizon
            float wave = 0.88 + 0.12 * sin(vUv.x * 14.0 - uTime * 0.85);

            vec3 col = uPrimary * upperAura + uAccent * midHalo * wave + uCore * coreBeam;
            float alpha = clamp((coreBeam * 0.92 + midHalo * 0.65 + upperAura * 0.48) * (0.35 + 0.65 * horizMask), 0.0, 0.96);
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    )
    const horizonBand = new THREE.Mesh(horizonGeo, horizonMat)
    horizonBand.position.set(0, 12.2, -56)
    scene.add(horizonBand)

    // C. RECEDING PERSPECTIVE CIRCUIT GRID PLANE (Analytic anti-aliased — no fwidth)
    const gridUniforms = {
      uTime: { value: 0 },
      uPrimary: { value: new THREE.Color(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2]) },
      uAccent: { value: new THREE.Color(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2]) },
      uSoft: { value: new THREE.Color(initPhase.c3[0], initPhase.c3[1], initPhase.c3[2]) },
    }
    const gridGeo = trackDisposable(new THREE.PlaneGeometry(170, 150, 1, 1))
    gridGeo.rotateX(-Math.PI / 2)

    const gridMat = trackDisposable(
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
            vec2 scrolled = vec2(vWorldXZ.x, vWorldXZ.y + uTime * 2.4);
            vec2 g = scrolled * 0.42;
            vec2 f = abs(fract(g - 0.5) - 0.5);

            // Perspective-safe line width softening in distance
            float depthFactor = clamp((28.0 - vWorldXZ.y) / 96.0, 0.0, 1.0);
            float lineWidth = mix(0.014, 0.042, depthFactor);
            float lineX = 1.0 - smoothstep(lineWidth * 0.5, lineWidth * 1.9, f.x);
            float lineZ = 1.0 - smoothstep(lineWidth * 0.5, lineWidth * 1.9, f.y);
            float line = max(lineX, lineZ);

            // Flowing horizon energy pulse spilling across the grid
            float pulse = smoothstep(0.42, 1.0, sin(vWorldXZ.y * 0.14 + uTime * 1.8) * 0.5 + 0.5);
            float horizonSpill = exp(-abs(vWorldXZ.y + 34.0) * 0.055) * 0.52;

            vec3 col = mix(uPrimary, uAccent, pulse * 0.65) * line * (0.48 + pulse * 0.34);
            col += uSoft * (line * pulse * 0.24 + horizonSpill * 0.36);
            col += uAccent * horizonSpill * 0.26;

            float radialFade = 1.0 - smoothstep(26.0, 74.0, abs(vWorldXZ.x));
            float zFade = smoothstep(-74.0, -42.0, vWorldXZ.y) * (1.0 - smoothstep(14.0, 32.0, vWorldXZ.y));
            float alpha = clamp((line * (0.58 + pulse * 0.26) + horizonSpill * 0.42) * radialFade * zFade, 0.0, 0.88);
            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    )
    const gridMesh = new THREE.Mesh(gridGeo, gridMat)
    gridMesh.position.set(0, 0, -14)
    scene.add(gridMesh)

    // D. EXTRUDED DARK CYBER CITYSCAPE SILHOUETTE WITH CRISP LIT WINDOWS & VERTICAL LASER SLITS
    const unitBoxGeo = trackDisposable(new THREE.BoxGeometry(1, 1, 1))
    unitBoxGeo.translate(0, 0.5, 0)

    const buildingMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: 0x080d1e,
        roughness: 0.28,
        metalness: 0.86,
        envMapIntensity: 1.15,
      })
    )

    type BuildingSpec = {
      x: number
      z: number
      w: number
      h: number
      d: number
      phase: number
      isHeroTower: boolean
    }
    const buildings: BuildingSpec[] = []

    // Mid-ground cityscape skyline ridge across left, center-back, and right flanks
    for (let i = 0; i < 68; i++) {
      const sideBias = (i / 67) * 2 - 1 // -1 .. +1
      const x = sideBias * 44 + (rand() - 0.5) * 3.6
      const centerDip = Math.abs(sideBias) < 0.24 ? 0.62 : 1.0
      const z = -22 - rand() * 28
      const w = 1.6 + rand() * 2.8
      const d = 1.6 + rand() * 2.8
      const h = (3.4 + rand() * 11.2) * centerDip
      buildings.push({
        x,
        z,
        w,
        h,
        d,
        phase: rand() * Math.PI * 2,
        isHeroTower: h > 9.2,
      })
    }

    // Flanking foreground cyber monolith towers for 3D depth framing
    const flankSpecs = [
      { x: -24, z: -8, w: 2.2, h: 10.5, d: 2.2 },
      { x: -18, z: -14, w: 1.9, h: 8.6, d: 1.9 },
      { x: 24, z: -8, w: 2.2, h: 10.8, d: 2.2 },
      { x: 18, z: -14, w: 1.9, h: 8.9, d: 1.9 },
      { x: -29, z: 2, w: 2.6, h: 11.6, d: 2.6 },
      { x: 29, z: 2, w: 2.6, h: 11.4, d: 2.6 },
    ]
    for (const f of flankSpecs) {
      buildings.push({ ...f, phase: rand() * Math.PI * 2, isHeroTower: true })
    }

    const instancedBuildings = new THREE.InstancedMesh(unitBoxGeo, buildingMat, buildings.length)
    instancedBuildings.frustumCulled = false
    const dummy = new THREE.Object3D()
    const colorDummy = new THREE.Color()

    buildings.forEach((b, idx) => {
      dummy.position.set(b.x, 0, b.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(b.w, b.h, b.d)
      dummy.updateMatrix()
      instancedBuildings.setMatrixAt(idx, dummy.matrix)
      colorDummy.setRGB(0.04, 0.07, 0.16)
      instancedBuildings.setColorAt(idx, colorDummy)
    })
    instancedBuildings.instanceMatrix.needsUpdate = true
    if (instancedBuildings.instanceColor) instancedBuildings.instanceColor.needsUpdate = true
    scene.add(instancedBuildings)

    // Crisp Lit Windows across the skyline buildings
    type WindowSpec = {
      x: number
      y: number
      z: number
      w: number
      h: number
      seed: number
      bright: number
    }
    const windowSpecs: WindowSpec[] = []
    for (const b of buildings) {
      const cols = Math.max(2, Math.floor(b.w * 1.5))
      const rows = Math.max(2, Math.floor(b.h * 0.85))
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (rand() > 0.34) continue
          const wx = b.x - b.w * 0.36 + (cols > 1 ? (c / (cols - 1)) * (b.w * 0.72) : 0)
          const wy = 0.8 + (r / Math.max(rows, 1)) * (b.h - 1.35)
          const wz = b.z + b.d * 0.5 + 0.03
          windowSpecs.push({
            x: wx,
            y: wy,
            z: wz,
            w: 0.18 + rand() * 0.14,
            h: 0.14 + rand() * 0.12,
            seed: rand() * Math.PI * 2,
            bright: 0.45 + rand() * 0.55,
          })
        }
      }
    }

    const windowGeo = trackDisposable(new THREE.PlaneGeometry(1, 1))
    const windowMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    const instancedWindows = new THREE.InstancedMesh(windowGeo, windowMat, windowSpecs.length)
    instancedWindows.frustumCulled = false
    windowSpecs.forEach((w, idx) => {
      dummy.position.set(w.x, w.y, w.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(w.w, w.h, 1)
      dummy.updateMatrix()
      instancedWindows.setMatrixAt(idx, dummy.matrix)
      colorDummy.setRGB(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2])
      instancedWindows.setColorAt(idx, colorDummy)
    })
    instancedWindows.instanceMatrix.needsUpdate = true
    if (instancedWindows.instanceColor) instancedWindows.instanceColor.needsUpdate = true
    scene.add(instancedWindows)

    // Glowing Vertical Cyber Laser Slits on Hero Towers
    const heroTowers = buildings.filter((b) => b.isHeroTower)
    const slitMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2]),
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    const instancedSlits = new THREE.InstancedMesh(unitBoxGeo, slitMat, heroTowers.length)
    instancedSlits.frustumCulled = false
    heroTowers.forEach((b, idx) => {
      dummy.position.set(b.x, 0.25, b.z + b.d * 0.5 + 0.04)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(0.12, b.h * 0.92, 0.06)
      dummy.updateMatrix()
      instancedSlits.setMatrixAt(idx, dummy.matrix)
    })
    instancedSlits.instanceMatrix.needsUpdate = true
    scene.add(instancedSlits)

    // E. FLOATING ORBITING CYBER NODES + RISING ATMOSPHERIC SPARKS
    const nodeCount = isSoftwareGl ? 20 : 34
    const nodeGeo = trackDisposable(new THREE.OctahedronGeometry(0.28, 0))
    const nodeMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    const instancedNodes = new THREE.InstancedMesh(nodeGeo, nodeMat, nodeCount)
    instancedNodes.frustumCulled = false
    const nodeMeta = Array.from({ length: nodeCount }, () => ({
      baseX: (rand() - 0.5) * 54,
      baseY: 2.2 + rand() * 14,
      baseZ: -6 - rand() * 32,
      speed: 0.35 + rand() * 0.55,
      radius: 0.6 + rand() * 1.4,
      phase: rand() * Math.PI * 2,
      scale: 0.55 + rand() * 0.9,
    }))
    scene.add(instancedNodes)

    const sparkCount = isSoftwareGl ? 240 : 480
    const sparkGeo = trackDisposable(new THREE.BufferGeometry())
    const sparkPos = new Float32Array(sparkCount * 3)
    const sparkBaseX = new Float32Array(sparkCount)
    const sparkBaseZ = new Float32Array(sparkCount)
    const sparkSpeed = new Float32Array(sparkCount)
    const sparkSeed = new Float32Array(sparkCount)

    for (let i = 0; i < sparkCount; i++) {
      const sx = (rand() - 0.5) * 68
      const sy = rand() * 24
      const sz = 10 - rand() * 62
      sparkPos[i * 3] = sx
      sparkPos[i * 3 + 1] = sy
      sparkPos[i * 3 + 2] = sz
      sparkBaseX[i] = sx
      sparkBaseZ[i] = sz
      sparkSpeed[i] = 0.65 + rand() * 1.45
      sparkSeed[i] = rand() * Math.PI * 2
    }
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3))

    const sparkMat = trackDisposable(
      new THREE.PointsMaterial({
        color: new THREE.Color(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2]),
        size: 0.2,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    const sparks = new THREE.Points(sparkGeo, sparkMat)
    sparks.frustumCulled = false
    scene.add(sparks)

    // Passive Pointer & Scroll Parallax
    let targetMouseX = 0
    let targetMouseY = 0
    let smoothMouseX = 0
    let smoothMouseY = 0
    let scrollY = 0

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY
      targetMouseX = ((clientX / Math.max(window.innerWidth, 1)) * 2 - 1) * 3.4
      targetMouseY = -((clientY / Math.max(window.innerHeight, 1)) * 2 - 1) * 1.8
    }
    const onScroll = () => {
      scrollY = window.scrollY || document.documentElement.scrollTop || 0
    }
    window.addEventListener("mousemove", onPointerMove, { passive: true })
    window.addEventListener("touchmove", onPointerMove, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })

    let isTabActive = typeof document !== "undefined" ? !document.hidden : true
    const onVisibilityChange = () => {
      isTabActive = !document.hidden
      if (isTabActive) lastFrameNow = performance.now()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    // Pre-allocated math objects (zero GC in loop)
    const c1Color = new THREE.Color()
    const c2Color = new THREE.Color()
    const c3Color = new THREE.Color()
    const bgTintColor = new THREE.Color()
    const tempColor = new THREE.Color()
    const baseDark = new THREE.Color(0x050918)

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let frameId = 0
    let softwareTimerId = 0
    let lastFrameNow = performance.now()
    let motionElapsed = 0

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

      // Pause 3D WebGL draw calls while in 2D Ambient mode or background tab (zero frame-rate waste)
      if (!isTabActive || modeRef.current !== "3d") {
        frameId = window.requestAnimationFrame(renderFrame)
        return
      }

      const spatialRate = prefersReducedMotion ? 0.3 : 1.0
      motionElapsed += dt * spatialRate

      // Unified live color-changing clock (starts Electric Blue at t=0, shifts into Nov 23 Purple -> Orchid -> Cyan -> Blue)
      const colorElapsed =
        sharedStartMsRef.current !== null
          ? Math.max(0, (now - sharedStartMsRef.current) / 1000) * (prefersReducedMotion ? 0.4 : 1.0)
          : 0
      const phase = getAmbientPhaseAt(colorElapsed, "3d")

      c1Color.setRGB(phase.c1[0], phase.c1[1], phase.c1[2])
      c2Color.setRGB(phase.c2[0], phase.c2[1], phase.c2[2])
      c3Color.setRGB(phase.c3[0], phase.c3[1], phase.c3[2])

      bgTintColor.setRGB(
        STAGE_BASE_NORM[0] + phase.bgB[0] * 0.22,
        STAGE_BASE_NORM[1] + phase.bgB[1] * 0.22,
        STAGE_BASE_NORM[2] + phase.bgB[2] * 0.26
      )
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(bgTintColor)
      }
      fog.color.copy(bgTintColor)

      // Update dynamic color lights
      hemiLight.color.copy(c2Color)
      hemiLight.groundColor.copy(bgTintColor)
      dirKey.color.copy(c1Color)
      dirHorizonRim.color.copy(c2Color)
      horizonGlowLight1.color.copy(c1Color)
      horizonGlowLight1.intensity = 13.5 + Math.sin(motionElapsed * 1.1) * 2.0
      horizonGlowLight2.color.copy(c2Color)
      horizonGlowLight3.color.copy(c1Color).lerp(c2Color, 0.5)

      // Update horizon light band & perspective grid shaders
      horizonUniforms.uTime.value = motionElapsed
      horizonUniforms.uPrimary.value.copy(c1Color)
      horizonUniforms.uAccent.value.copy(c2Color)
      horizonUniforms.uCore.value.copy(c3Color)

      gridUniforms.uTime.value = motionElapsed
      gridUniforms.uPrimary.value.copy(c1Color)
      gridUniforms.uAccent.value.copy(c2Color)
      gridUniforms.uSoft.value.copy(c3Color)

      // Subtle starfield drift & tint
      starMat.color.copy(c3Color).lerp(c2Color, 0.25)
      starField.position.x = Math.sin(motionElapsed * 0.08) * 2.2

      // Cityscape subtle reflection tint + vertical laser slits
      slitMat.color.copy(c2Color).lerp(c3Color, 0.35)
      for (let i = 0; i < buildings.length; i++) {
        const b = buildings[i]
        const rimGlow = 0.14 + 0.08 * (Math.sin(motionElapsed * 0.7 + b.phase) * 0.5 + 0.5)
        tempColor.copy(baseDark).lerp(c1Color, rimGlow)
        instancedBuildings.setColorAt(i, tempColor)
      }
      if (instancedBuildings.instanceColor) instancedBuildings.instanceColor.needsUpdate = true

      // Lit windows subtle shimmer synchronized to live color palette
      for (let i = 0; i < windowSpecs.length; i++) {
        const w = windowSpecs[i]
        const shimmer = 0.65 + 0.35 * Math.sin(motionElapsed * 1.25 + w.seed)
        tempColor
          .copy(c2Color)
          .lerp(c3Color, w.bright * 0.55)
          .multiplyScalar(shimmer)
        instancedWindows.setColorAt(i, tempColor)
      }
      if (instancedWindows.instanceColor) instancedWindows.instanceColor.needsUpdate = true

      // Floating cyber nodes gentle orbit
      for (let i = 0; i < nodeCount; i++) {
        const n = nodeMeta[i]
        const angle = motionElapsed * n.speed + n.phase
        dummy.position.set(
          n.baseX + Math.cos(angle) * n.radius,
          n.baseY + Math.sin(angle * 0.8) * 0.65,
          n.baseZ + Math.sin(angle * 0.6) * n.radius * 0.6
        )
        dummy.rotation.set(angle * 0.7, angle * 1.1, 0)
        dummy.scale.set(n.scale, n.scale, n.scale)
        dummy.updateMatrix()
        instancedNodes.setMatrixAt(i, dummy.matrix)
        tempColor.copy(c1Color).lerp(c3Color, (i % 3) * 0.32)
        instancedNodes.setColorAt(i, tempColor)
      }
      instancedNodes.instanceMatrix.needsUpdate = true
      if (instancedNodes.instanceColor) instancedNodes.instanceColor.needsUpdate = true

      // Rising atmospheric sparks
      sparkMat.color.copy(c2Color).lerp(c3Color, 0.38)
      const positions = sparkGeo.attributes.position.array as Float32Array
      for (let i = 0; i < sparkCount; i++) {
        const yIndex = i * 3 + 1
        let y = positions[yIndex] + sparkSpeed[i] * dt * spatialRate
        if (y > 24) y = 0.3
        positions[yIndex] = y
        const drift = motionElapsed * 0.42 + sparkSeed[i]
        positions[i * 3] = sparkBaseX[i] + Math.sin(drift) * 0.9
        positions[i * 3 + 2] = sparkBaseZ[i] + Math.cos(drift) * 0.9
      }
      sparkGeo.attributes.position.needsUpdate = true

      // Smooth autonomous camera drift (8s-12s gentle loops) + pointer & scroll parallax
      const damp = 1 - Math.exp(-3.0 * dt)
      smoothMouseX += (targetMouseX - smoothMouseX) * damp
      smoothMouseY += (targetMouseY - smoothMouseY) * damp

      const docHeight =
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          window.innerHeight * 2
        ) - window.innerHeight
      const scrollRatio = Math.min(1, Math.max(0, scrollY / Math.max(docHeight, 1)))

      const autoX = Math.sin(motionElapsed * 0.26) * 2.8
      const autoY = Math.cos(motionElapsed * 0.22) * 0.85
      const autoZ = Math.cos(motionElapsed * 0.18) * 1.6

      const targetCamX = baseCamX + autoX + smoothMouseX * 0.72
      const targetCamY = baseCamY + autoY + smoothMouseY * 0.48 - scrollRatio * 2.2
      const targetCamZ = baseCamZ + autoZ - scrollRatio * 3.8

      camera.position.x += (targetCamX - camera.position.x) * damp
      camera.position.y += (targetCamY - camera.position.y) * damp
      camera.position.z += (targetCamZ - camera.position.z) * damp
      camera.lookAt(
        smoothMouseX * 0.45,
        3.6 + smoothMouseY * 0.28 - scrollRatio * 0.9,
        -24
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

    // Render initial Electric Blue frame immediately when starting in 3D
    if (modeRef.current === "3d") {
      renderFrame()
    } else {
      frameId = window.requestAnimationFrame(renderFrame)
    }

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

  const show2D = mode === "2d" || webglUnavailable

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden bg-[#040712]"
      aria-hidden="true"
    >
      {/* Dedicated 2D Ambient Layer (Obsidian Color-Shifting Fluid Aurora + Drifting Starlight, starts in BLUE) */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ease-out ${
          show2D ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="rushx-ambient-canvas absolute inset-0" />
        <div className="rushx-ambient-glow absolute -inset-[10%]" />
        <canvas
          ref={ambient2dCanvasRef}
          className="absolute inset-0 h-full w-full block"
        />
      </div>

      {/* November 23 3D Cyber Horizon & Cityscape Layer (Starts in BLUE, smoothly color-shifts through Purple/Cyan/Blue) */}
      <div
        ref={threeContainerRef}
        className={`absolute inset-0 transition-opacity duration-500 ease-out ${
          show2D ? "opacity-0" : "opacity-100"
        }`}
      />

      {/* Subtle controlled contrast scrim so foreground headings, lobby cards, and buttons stay razor-sharp */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ease-out ${
          show2D ? "bg-[#03050d]/22 opacity-100" : "bg-[#03050d]/24 opacity-100"
        }`}
      />
    </div>
  )
}
