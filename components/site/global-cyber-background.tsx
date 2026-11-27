"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { useViewMode } from "@/lib/view-mode"
import {
  applyAmbientThemeToRoot,
  getAmbientPhaseAt,
  STAGE_BASE_2D_NORM,
} from "@/lib/ambient-theme"

const VOLUMETRIC_2D_VS = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = aPos * 0.5 + 0.5;
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`

/**
 * Recovered 2D Volumetric Ambient Fragment Shader (from commit fba1383)
 * upgraded with the current live dynamic color-changing uniforms (uBgB, uGlow, uC1, uC2):
 * - Deep obsidian / near-black base with subtle color-harmonized mid-tone
 * - Controlled radial breathing ambient halos (core, rim, side) + dual FBM silk depth
 * - Smooth 8s–12s organic drift & gentle pointer/scroll parallax
 * - Filmic roll-off, 8-bit anti-banding dither, and strict luminance ceiling for crisp legibility
 * - Opens in Electric Blue and shifts smoothly through the exact same spectrum as 3D mode.
 */
const VOLUMETRIC_2D_FS = `
  precision highp float;

  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uRes;
  uniform vec2 uPointer;
  uniform float uScroll;
  uniform vec3 uBgA;
  uniform vec3 uBgB;
  uniform vec3 uGlow;
  uniform vec3 uC1;
  uniform vec3 uC2;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash12(i + vec2(0.0, 0.0)), hash12(i + vec2(1.0, 0.0)), u.x),
      mix(hash12(i + vec2(0.0, 1.0)), hash12(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.80, 0.60, -0.60, 0.80);
    for (int i = 0; i < 3; i++) {
      v += a * noise2D(p);
      p = rot * p * 2.02 + vec2(11.3, 19.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / max(uRes.y, 1.0);
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

    vec2 drift = vec2(uPointer.x * 0.045, uPointer.y * 0.035 - uScroll * 0.06);
    // Smooth 10s breathing rhythm
    float t = uTime * 0.24;
    float breathe = 0.88 + 0.12 * sin(uTime * 0.62);

    // 1. Deep obsidian near-black base subtly harmonized to active color-shift phase
    vec3 obsidianDeep = uBgA;
    vec3 obsidianMid = mix(uBgA, uBgB * 0.38 + vec3(0.014, 0.016, 0.028), 0.62);
    vec3 col = mix(obsidianDeep, obsidianMid, smoothstep(0.0, 1.0, uv.y * 0.85 + 0.1));

    // 2. Subtle fbm silk texture for depth without glare
    float silk = fbm(p * 1.45 + vec2(t * 0.35, -t * 0.22));
    float silk2 = fbm(p * 2.1 - vec2(t * 0.26, t * 0.18));

    // 3. Controlled radial ambient halos (exact fba1383 geometry, live color-changing hues)
    vec2 coreCenter = vec2(
      0.50 + sin(t * 0.72) * 0.09,
      0.76 + cos(t * 0.58) * 0.06
    ) + drift * 0.45;
    float dCore = length((uv - coreCenter) * vec2(aspect * 0.66, 1.05));
    float coreHalo = exp(-dCore * dCore * 2.35) * breathe;

    vec2 rimCenter = vec2(
      0.18 + cos(t * 0.52) * 0.08,
      0.24 + sin(t * 0.46) * 0.07
    ) - drift * 0.32;
    float dRim = length((uv - rimCenter) * vec2(aspect * 0.62, 1.1));
    float rimHalo = exp(-dRim * dRim * 2.65);

    vec2 sideCenter = vec2(
      0.84 + sin(t * 0.48 + 1.8) * 0.07,
      0.44 + cos(t * 0.44 + 0.9) * 0.08
    ) + drift * 0.28;
    float dSide = length((uv - sideCenter) * vec2(aspect * 0.72, 1.1));
    float sideHalo = exp(-dSide * dSide * 3.1);

    // Strictly capped luminance so foreground cards & text remain crystal clear
    col += uBgB * (coreHalo * (0.42 + silk * 0.14) + rimHalo * 0.26);
    col += uGlow * (coreHalo * coreHalo * (0.30 + silk2 * 0.10) + sideHalo * 0.20);
    col += uC1 * (coreHalo * 0.13 + rimHalo * 0.08 + sideHalo * 0.07);
    col += uC2 * (pow(coreHalo, 3.0) * 0.11 * (0.7 + silk * 0.3));

    // Gentle vignette anchoring the edges into deep obsidian
    float vig = smoothstep(1.38, 0.22, length((uv - 0.5) * vec2(aspect * 0.78, 1.05)));
    col = mix(obsidianDeep, col, mix(0.56, 1.0, vig));

    // Filmic roll-off + strict brightness ceiling
    col = col / (1.0 + col * 0.52);

    // Subtle 8-bit dither to eliminate gradient banding
    float dither = (hash12(gl_FragCoord.xy + fract(uTime * 11.3)) - 0.5) / 255.0;
    col = clamp(col + dither, 0.0, 0.42);

    gl_FragColor = vec4(col, 1.0);
  }
`

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

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
 * Deterministic PRNG so the recovered 992e9d3 monolith terrain, floor pads, and embers
 * render identically and smoothly across sessions.
 */
function mulberry32(seed: number): () => number {
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
 * 1. 3D Cyber Mode ("3d") — Exact Recovery from commit 992e9d3 (Nov 23):
 *    - Expansive 48x48 isometric monolith terrain (2,304 instanced metallic blocks),
 *      infinite cyber circuit floor grid matrix + 64 pulsing neon floor pads,
 *      7 cyber monolith towers with dual vertical laser slits + 42 orbiting satellite data cubes,
 *      3 volumetric undulating laser energy walls (ShaderMaterial), and 700 rising cyber embers.
 *    - Upgraded with the current live dynamic color-changing spectrum (opening in Electric Blue,
 *      then shifting seamlessly through Cyber Violet -> Neon Orchid -> Electric Cyan -> Sapphire),
 *      RoomEnvironment metallic reflections, software-WebGL pacing, and safe WebGL fallbacks.
 *
 * 2. 2D Ambient Mode ("2d") — Exact Recovery from commit fba1383 (Nov 27):
 *    - Volumetric WebGL obsidian FBM silk & radial ambient halo shader with gentle pointer/scroll
 *      parallax and filmic luminance cap (plus live CSS fallback if WebGL is unavailable).
 *    - Driven by the exact same synchronized live color-changing clock as 3D mode, opening in
 *      Electric Blue and cycling through identical hues.
 */
export function GlobalCyberBackground() {
  const threeContainerRef = useRef<HTMLDivElement>(null)
  const volumetric2DCanvasRef = useRef<HTMLCanvasElement>(null)
  const sharedStartMsRef = useRef<number | null>(null)
  const { mode } = useViewMode()
  const [webgl2DReady, setWebgl2DReady] = useState(false)
  const [webgl3DFallback, setWebgl3DFallback] = useState(false)

  const effectiveMode: "2d" | "3d" = mode === "3d" && !webgl3DFallback ? "3d" : "2d"

  // 1. Synchronized live CSS color-changing engine (ALWAYS opens in Electric Blue for BOTH 2D & 3D)
  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    if (sharedStartMsRef.current === null) {
      sharedStartMsRef.current = performance.now()
    }

    const activeElapsed = Math.max(0, (performance.now() - sharedStartMsRef.current) / 1000)
    applyAmbientThemeToRoot(getAmbientPhaseAt(activeElapsed, effectiveMode), effectiveMode)

    let rafId = 0
    let lastAppliedKey = ""
    const colorSpeed = prefersReducedMotion ? 0.4 : 1.0

    const tick = () => {
      rafId = window.requestAnimationFrame(tick)
      if (document.hidden) return
      const startMs = sharedStartMsRef.current ?? performance.now()
      const elapsedSec = ((performance.now() - startMs) / 1000) * colorSpeed
      const state = getAmbientPhaseAt(elapsedSec, effectiveMode)
      const key = `${effectiveMode}|${state.primaryRgb.join(",")}|${state.accentRgb.join(",")}|${state.glowRgb.join(",")}`
      if (key !== lastAppliedKey) {
        lastAppliedKey = key
        applyAmbientThemeToRoot(state, effectiveMode)
      }
    }

    rafId = window.requestAnimationFrame(tick)
    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [effectiveMode])

  // ───────────────────────────────────────────────────────────────────────────
  // 2. RECOVERED 2D BACKGROUND (commit fba1383) + CURRENT COLOR-CHANGING EFFECT
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "3d" && !webgl3DFallback) {
      setWebgl2DReady(false)
      return
    }

    const canvas = volumetric2DCanvasRef.current
    if (!canvas) return

    let gl: WebGLRenderingContext | null = null
    try {
      gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      })
    } catch {
      gl = null
    }

    if (!gl) {
      setWebgl2DReady(false)
      return
    }

    const vs = compileShader(gl, gl.VERTEX_SHADER, VOLUMETRIC_2D_VS)
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, VOLUMETRIC_2D_FS)
    if (!vs || !fs) {
      if (vs) gl.deleteShader(vs)
      if (fs) gl.deleteShader(fs)
      setWebgl2DReady(false)
      return
    }

    const program = gl.createProgram()
    if (!program) {
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      setWebgl2DReady(false)
      return
    }

    gl.attachShader(program, vs)
    gl.attachShader(program, fs)
    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program)
      gl.deleteShader(vs)
      gl.deleteShader(fs)
      setWebgl2DReady(false)
      return
    }

    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    )

    const aPos = gl.getAttribLocation(program, "aPos")
    gl.enableVertexAttribArray(aPos)
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

    const uTime = gl.getUniformLocation(program, "uTime")
    const uRes = gl.getUniformLocation(program, "uRes")
    const uPointer = gl.getUniformLocation(program, "uPointer")
    const uScroll = gl.getUniformLocation(program, "uScroll")
    const uBgA = gl.getUniformLocation(program, "uBgA")
    const uBgB = gl.getUniformLocation(program, "uBgB")
    const uGlow = gl.getUniformLocation(program, "uGlow")
    const uC1 = gl.getUniformLocation(program, "uC1")
    const uC2 = gl.getUniformLocation(program, "uC2")

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const motionRate = prefersReducedMotion ? 0.35 : 1.0
    const colorSpeed = prefersReducedMotion ? 0.4 : 1.0

    let targetPtrX = 0
    let targetPtrY = 0
    let smoothPtrX = 0
    let smoothPtrY = 0
    let scrollRatio = 0
    let contextLost = false
    let isDisposed = false

    const resize = () => {
      if (!gl || contextLost || isDisposed) return
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const w = Math.max(1, Math.floor(window.innerWidth * dpr))
      const h = Math.max(1, Math.floor(window.innerHeight * dpr))
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w
        canvas.height = h
      }
      gl.viewport(0, 0, w, h)
    }

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY
      targetPtrX = (clientX / Math.max(window.innerWidth, 1)) * 2 - 1
      targetPtrY = -((clientY / Math.max(window.innerHeight, 1)) * 2 - 1)
    }

    const onScroll = () => {
      const docHeight =
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          window.innerHeight * 2
        ) - window.innerHeight
      const y = window.scrollY || document.documentElement.scrollTop || 0
      scrollRatio = Math.max(0, Math.min(1, y / Math.max(docHeight, 1)))
    }

    const onContextLost = (e: Event) => {
      e.preventDefault()
      contextLost = true
      if (!isDisposed) setWebgl2DReady(false)
    }

    const onContextRestored = () => {
      contextLost = false
      if (!isDisposed) setWebgl2DReady(true)
    }

    resize()
    window.addEventListener("resize", resize, { passive: true })
    window.addEventListener("mousemove", onPointerMove, { passive: true })
    window.addEventListener("touchmove", onPointerMove, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })
    canvas.addEventListener("webglcontextlost", onContextLost)
    canvas.addEventListener("webglcontextrestored", onContextRestored)

    const drawFrame = (elapsedSec: number) => {
      if (!gl || contextLost || isDisposed) return
      const phase = getAmbientPhaseAt(elapsedSec * colorSpeed, "2d")
      smoothPtrX += (targetPtrX - smoothPtrX) * 0.04
      smoothPtrY += (targetPtrY - smoothPtrY) * 0.04

      try {
        gl.uniform1f(uTime, elapsedSec * motionRate)
        gl.uniform2f(uRes, canvas.width, canvas.height)
        gl.uniform2f(uPointer, smoothPtrX, smoothPtrY)
        gl.uniform1f(uScroll, scrollRatio)
        gl.uniform3f(uBgA, STAGE_BASE_2D_NORM[0], STAGE_BASE_2D_NORM[1], STAGE_BASE_2D_NORM[2])
        gl.uniform3f(uBgB, phase.bgB[0], phase.bgB[1], phase.bgB[2])
        gl.uniform3f(uGlow, phase.glow[0], phase.glow[1], phase.glow[2])
        gl.uniform3f(uC1, phase.c1[0], phase.c1[1], phase.c1[2])
        gl.uniform3f(uC2, phase.c2[0], phase.c2[1], phase.c2[2])

        gl.drawArrays(gl.TRIANGLES, 0, 6)
      } catch {
        contextLost = true
        if (!isDisposed) setWebgl2DReady(false)
      }
    }

    if (sharedStartMsRef.current === null) {
      sharedStartMsRef.current = performance.now()
    }
    drawFrame(Math.max(0, (performance.now() - sharedStartMsRef.current) / 1000))
    setWebgl2DReady(true)

    let rafId = 0
    const loop = () => {
      if (isDisposed) return
      rafId = window.requestAnimationFrame(loop)
      if (document.hidden || contextLost) return
      const startMs = sharedStartMsRef.current ?? performance.now()
      drawFrame(Math.max(0, (performance.now() - startMs) / 1000))
    }

    rafId = window.requestAnimationFrame(loop)

    return () => {
      isDisposed = true
      window.cancelAnimationFrame(rafId)
      window.removeEventListener("resize", resize)
      window.removeEventListener("mousemove", onPointerMove)
      window.removeEventListener("touchmove", onPointerMove)
      window.removeEventListener("scroll", onScroll)
      canvas.removeEventListener("webglcontextlost", onContextLost)
      canvas.removeEventListener("webglcontextrestored", onContextRestored)
      if (gl && !contextLost) {
        try {
          if (buffer) gl.deleteBuffer(buffer)
          gl.deleteProgram(program)
          gl.deleteShader(vs)
          gl.deleteShader(fs)
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }, [mode, webgl3DFallback])

  // ───────────────────────────────────────────────────────────────────────────
  // 3. RECOVERED 3D ANIMATION (commit 992e9d3) + CURRENT COLOR-CHANGING EFFECT
  // ───────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "3d") {
      setWebgl3DFallback(false)
      return
    }

    const container = threeContainerRef.current
    if (!container) return

    let width = Math.max(window.innerWidth, 1)
    let height = Math.max(window.innerHeight, 1)
    let isDisposed = false
    let contextLost = false

    const isSoftwareGl = detectSoftwareWebGL()
    const rand = mulberry32(992932026)

    // Track all disposable Three.js resources to prevent WebGL memory leaks
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
        alpha: true,
        stencil: false,
        depth: true,
      })
    } catch {
      setWebgl3DFallback(true)
      return
    }

    setWebgl3DFallback(false)

    if (sharedStartMsRef.current === null) {
      sharedStartMsRef.current = performance.now()
    }
    const initElapsed = Math.max(0, (performance.now() - sharedStartMsRef.current) / 1000)
    const initPhase = getAmbientPhaseAt(initElapsed, "3d")

    // 1. THREE.JS SCENE & RENDERER SETUP (Exact 992e9d3 framing + DPR cap + Studio PMREM)
    const scene = new THREE.Scene()
    const initBgColor = new THREE.Color().setHSL(initPhase.baseHue, 0.45, 0.042)
    scene.background = initBgColor
    const fog = new THREE.FogExp2(initBgColor.getHex(), 0.012)
    scene.fog = fog

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 500)
    camera.position.set(16, 18, 28)
    camera.lookAt(0, 1.5, 0)

    const maxDPR = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
    renderer.setPixelRatio(maxDPR)
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.45
    renderer.shadowMap.enabled = false

    // Procedural studio reflections so high-metalness monoliths & cyber towers look razor sharp
    try {
      const pmremGenerator = new THREE.PMREMGenerator(renderer)
      const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04)
      scene.environment = envRT.texture
      trackDisposable(envRT)
      pmremGenerator.dispose()
    } catch {
      // Proceed cleanly if PMREM is unavailable
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
      if (!isDisposed) setWebgl3DFallback(true)
    }
    const onWebglContextRestored = () => {
      contextLost = false
      if (!isDisposed) {
        setWebgl3DFallback(false)
        lastFrameNow = performance.now()
        scheduleNext()
      }
    }
    renderer.domElement.addEventListener("webglcontextlost", onWebglContextLost)
    renderer.domElement.addEventListener("webglcontextrestored", onWebglContextRestored)

    // 2. ILLUMINATION & OPTIMIZED LIGHTING (Exact 992e9d3 rig, opening in Electric Blue)
    const ambientLight = new THREE.AmbientLight(0x0d131f, 3.8)
    ambientLight.color.setHSL(initPhase.accentHue, 0.45, 0.18)
    scene.add(ambientLight)

    const dirKey = new THREE.DirectionalLight(0x1f73ff, 3.2)
    dirKey.color.setHSL(initPhase.baseHue, 0.94, 0.56)
    dirKey.position.set(24, 35, 18)
    scene.add(dirKey)

    const dirFill = new THREE.DirectionalLight(0x1a2e4c, 2.2)
    dirFill.color.setHSL(initPhase.fillHue, 0.78, 0.36)
    dirFill.position.set(-28, 25, -20)
    scene.add(dirFill)

    const coreLight1 = new THREE.PointLight(0x1f73ff, 8.0, 50, 1.5)
    coreLight1.color.setHSL(initPhase.baseHue, 0.96, 0.54)
    coreLight1.position.set(0, 4.5, 0)
    scene.add(coreLight1)

    const coreLight2 = new THREE.PointLight(0x38bdf8, 5.5, 40, 1.5)
    coreLight2.color.setHSL(initPhase.accentHue, 0.94, 0.56)
    coreLight2.position.set(16, 3.5, -12)
    scene.add(coreLight2)

    const coreLight3 = new THREE.PointLight(0x2563eb, 5.0, 40, 1.5)
    coreLight3.color.setHSL(initPhase.fillHue, 0.92, 0.52)
    coreLight3.position.set(-16, 3.5, 10)
    scene.add(coreLight3)

    const coreLight4 = new THREE.PointLight(0x60a5fa, 4.5, 35, 1.5)
    coreLight4.color.setHSL((initPhase.baseHue + 0.08) % 1, 0.9, 0.58)
    coreLight4.position.set(-12, 3.0, -18)
    scene.add(coreLight4)

    // 3. EXPANSIVE ISOMETRIC MONOLITH TERRAIN (48 x 48 = 2,304 InstancedMesh monoliths)
    const gridSize = 48
    const count = gridSize * gridSize
    const boxGeo = trackDisposable(new THREE.BoxGeometry(0.94, 1, 0.94))
    boxGeo.translate(0, 0.5, 0)

    const blockMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: 0x0f1520,
        roughness: 0.18,
        metalness: 0.88,
        envMapIntensity: 0.85,
      })
    )

    const instancedTerrain = new THREE.InstancedMesh(boxGeo, blockMat, count)
    instancedTerrain.frustumCulled = false
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
        const isCrevice = rand() < 0.13

        let h = 0.22
        if (isCoreArea) {
          h = 2.4 + rand() * 4.2
        } else if (isSecondaryCore || isTertiaryCore) {
          h = 1.8 + rand() * 3.2
        } else {
          const wave1 = Math.sin(x * 0.22) * Math.cos(z * 0.22)
          const wave2 = Math.cos(x * 0.14 + z * 0.14) * 0.5
          h = 0.2 + Math.abs(wave1 + wave2) * 2.6 + (rand() > 0.84 ? rand() * 1.8 : 0)
        }

        if (isCrevice) h = 0.1

        dummy.position.set(posX, 0, posZ)
        dummy.scale.set(1, h, 1)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        instancedTerrain.setMatrixAt(idx, dummy.matrix)

        if (isCrevice) {
          colorDummy.setHex(0x070d1c)
        } else if (isCoreArea || isSecondaryCore || isTertiaryCore) {
          colorDummy.setHex(0x141a24)
        } else {
          const base = 0.055 + rand() * 0.05
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

    // 4. INFINITE CYBER CIRCUIT FLOOR GRID MATRIX & 64 INSTANCED NEON PADS
    const gridHelper = new THREE.GridHelper(120, 80, 0x38bdf8, 0x262f42)
    gridHelper.position.y = 0.08
    if (gridHelper.material instanceof THREE.Material) {
      trackDisposable(gridHelper.material)
    }
    trackDisposable(gridHelper.geometry)
    scene.add(gridHelper)

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
    instancedFloorTiles.frustumCulled = false

    const tileBaseColor = new THREE.Color().setRGB(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2])
    for (let i = 0; i < tileCount; i++) {
      const rx = (Math.floor(rand() * 44) - 22) * 1.12
      const rz = (Math.floor(rand() * 44) - 22) * 1.12

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

    // 5. 7 SHARED CYBER TOWERS & 42 INSTANCED ORBITING SATELLITE CUBES
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

    const unitBoxGeo = trackDisposable(new THREE.BoxGeometry(1, 1, 1))

    const towerNodeMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: 0x06080d,
        roughness: 0.12,
        metalness: 0.96,
        envMapIntensity: 0.95,
      })
    )
    const towerOuterGlowMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2]),
      })
    )
    const towerHotGlowMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2]),
      })
    )

    const instancedPillars = new THREE.InstancedMesh(unitBoxGeo, towerNodeMat, towerCount)
    instancedPillars.frustumCulled = false

    const instancedOuterSlits = new THREE.InstancedMesh(unitBoxGeo, towerOuterGlowMat, towerCount)
    instancedOuterSlits.frustumCulled = false

    const instancedInnerSlits = new THREE.InstancedMesh(unitBoxGeo, towerHotGlowMat, towerCount)
    instancedInnerSlits.frustumCulled = false

    towerConfigs.forEach((t, i) => {
      dummy.position.set(t.x, (t.h * t.s) / 2, t.z)
      dummy.scale.set(1.5 * t.s, t.h * t.s, 1.5 * t.s)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      instancedPillars.setMatrixAt(i, dummy.matrix)

      dummy.position.set(t.x, (t.h * t.s) / 2, t.z)
      dummy.scale.set(0.38 * t.s, t.h * 0.94 * t.s, 1.56 * t.s)
      dummy.updateMatrix()
      instancedOuterSlits.setMatrixAt(i, dummy.matrix)

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

    const totalSatelliteCubes = towerCount * 6
    const satelliteMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
      })
    )
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

        if (isGlow) {
          colorDummy.setRGB(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2])
        } else {
          colorDummy.setHex(0x06080d)
        }
        instancedSatelliteCubes.setColorAt(satIdx, colorDummy)
        satIdx++
      }
    })
    if (instancedSatelliteCubes.instanceColor) instancedSatelliteCubes.instanceColor.needsUpdate = true
    instancedSatelliteCubes.computeBoundingSphere()
    scene.add(instancedSatelliteCubes)

    // 6. VOLUMETRIC LASER ENERGY WALLS (Exact 992e9d3 Shader Ribbons, synced to live color-shift)
    const wallUniforms = {
      uTime: { value: 0 },
      uColorDark: { value: new THREE.Color(initPhase.glow[0], initPhase.glow[1], initPhase.glow[2]) },
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

    // 7. ASCENDING DATA PARTICLES & CYBER EMBERS (700 particles)
    const particleCount = isSoftwareGl ? 360 : 700
    const particleGeo = trackDisposable(new THREE.BufferGeometry())
    const particlePos = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      particlePos[i * 3] = (rand() - 0.5) * 60
      particlePos[i * 3 + 1] = rand() * 25
      particlePos[i * 3 + 2] = (rand() - 0.5) * 60
    }
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3))

    const particleMat = trackDisposable(
      new THREE.PointsMaterial({
        color: new THREE.Color(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2]),
        size: 0.18,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )
    const particles = new THREE.Points(particleGeo, particleMat)
    particles.frustumCulled = false
    scene.add(particles)

    // 8. INTERACTION CONTROLLER (Passive Mouse, Touch & Scroll)
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

    // 9. CULLING & SUSPENDING (IntersectionObserver & Tab Visibility)
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
      if (isTabActive) lastFrameNow = performance.now()
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    // 10. ANIMATION RENDERING LOOP (Zero GC allocations, Software-WebGL paced)
    const baseCamX = 16
    const baseCamY = 18
    const baseCamZ = 28

    const rotationEuler = new THREE.Euler()
    const rotQuat = new THREE.Quaternion()
    const cubeScaleVec = new THREE.Vector3()
    const c1Color = new THREE.Color()
    const c2Color = new THREE.Color()
    const c3Color = new THREE.Color()
    const glowColor = new THREE.Color()

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const motionRate = prefersReducedMotion ? 0.3 : 1.0
    const colorSpeed = prefersReducedMotion ? 0.4 : 1.0

    let frameId = 0
    let softwareTimerId = 0
    let lastFrameNow = performance.now()
    let elapsed = 0

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
        afterDraw(renderLoop)
      } else {
        frameId = window.requestAnimationFrame(renderLoop)
      }
    }

    const renderLoop = () => {
      if (isDisposed || contextLost) return

      const now = performance.now()
      const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameNow) / 1000))
      lastFrameNow = now

      if (!isVisible || !isTabActive) {
        frameId = window.requestAnimationFrame(renderLoop)
        return
      }

      elapsed += dt * motionRate

      // Shader time update
      wallUniforms.uTime.value = elapsed

      // Normalized scroll progression
      const docHeight =
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          window.innerHeight * 2
        ) - window.innerHeight
      const scrollRatio = Math.min(scrollY / Math.max(docHeight, 1), 1)

      // Smooth camera orbit + scroll panning (exact 992e9d3 trajectory)
      const targetX = baseCamX + mouseX + Math.sin(elapsed * 0.14) * 2.2 + scrollRatio * 8.0
      const targetY = baseCamY + mouseY - scrollRatio * 7.0 + Math.cos(elapsed * 0.12) * 1.5
      const targetZ = baseCamZ - scrollRatio * 6.0 + Math.sin(elapsed * 0.1) * 2.0

      const camDamp = 1 - Math.exp(-2.4 * dt)
      camera.position.x += (targetX - camera.position.x) * camDamp
      camera.position.y += (targetY - camera.position.y) * camDamp
      camera.position.z += (targetZ - camera.position.z) * camDamp
      camera.lookAt(scrollRatio * 4.0, 1.8, -scrollRatio * 4.0)

      // Animate Orbiting Satellite Cubes
      for (let k = 0; k < totalSatelliteCubes; k++) {
        const meta = satelliteMeta[k]
        const cubeY = meta.baseY + Math.sin(elapsed * 2.5 + k) * 0.15
        const cubeX = meta.towerX + Math.cos(meta.angle + elapsed * 0.4) * meta.radius
        const cubeZ = meta.towerZ + Math.sin(meta.angle + elapsed * 0.4) * meta.radius

        rotationEuler.set(elapsed * 0.6 + k * 0.3, elapsed * 1.2 + k * 0.5, 0)
        rotQuat.setFromEuler(rotationEuler)
        cubeScaleVec.set(0.7 * meta.towerScale, 0.7 * meta.towerScale, 0.7 * meta.towerScale)

        dummy.position.set(cubeX, cubeY, cubeZ)
        dummy.quaternion.copy(rotQuat)
        dummy.scale.copy(cubeScaleVec)
        dummy.updateMatrix()

        instancedSatelliteCubes.setMatrixAt(k, dummy.matrix)
      }
      instancedSatelliteCubes.instanceMatrix.needsUpdate = true

      // Synchronized current version color-changing spectrum (opens in Electric Blue at t=0)
      const colorElapsed =
        sharedStartMsRef.current !== null
          ? Math.max(0, (now - sharedStartMsRef.current) / 1000) * colorSpeed
          : 0
      const phase = getAmbientPhaseAt(colorElapsed, "3d")
      const { baseHue, accentHue, fillHue } = phase

      c1Color.setRGB(phase.c1[0], phase.c1[1], phase.c1[2])
      c2Color.setRGB(phase.c2[0], phase.c2[1], phase.c2[2])
      c3Color.setRGB(phase.c3[0], phase.c3[1], phase.c3[2])
      glowColor.setRGB(phase.glow[0], phase.glow[1], phase.glow[2])

      // Luminous obsidian-tinted backdrop & fog matched to active live phase
      if (scene.background instanceof THREE.Color) {
        scene.background.setHSL(baseHue, 0.45, 0.042)
      }
      fog.color.setHSL(baseHue, 0.42, 0.042)
      ambientLight.color.setHSL(accentHue, 0.45, 0.18)

      // Multi-layered harmonic lights synchronized with live spectrum
      dirKey.color.copy(c1Color)
      dirFill.color.setHSL(fillHue, 0.78, 0.36)
      coreLight1.color.copy(c1Color)
      coreLight2.color.copy(c2Color)
      coreLight3.color.setHSL(fillHue, 0.92, 0.52)
      coreLight4.color.copy(c1Color).lerp(c2Color, 0.55)

      towerOuterGlowMat.color.copy(c1Color)
      towerHotGlowMat.color.copy(c2Color).lerp(c3Color, 0.38)
      wallUniforms.uColorDark.value.copy(glowColor)
      wallUniforms.uColorMid.value.copy(c1Color).lerp(c2Color, 0.45)
      wallUniforms.uColorCore.value.copy(c3Color)
      particleMat.color.copy(c2Color).lerp(c3Color, 0.32)

      if (gridHelper.material instanceof THREE.LineBasicMaterial) {
        gridHelper.material.color.setHSL(accentHue, 0.76, 0.54)
      }

      for (let k = 0; k < totalSatelliteCubes; k++) {
        if (satelliteMeta[k].isGlow) {
          const cubeHue = k % 4 === 0 ? accentHue : baseHue
          const cubeLightness = 0.48 + (k % 4) * 0.055
          colorDummy.setHSL(cubeHue, 0.95, cubeLightness)
          instancedSatelliteCubes.setColorAt(k, colorDummy)
        }
      }
      if (instancedSatelliteCubes.instanceColor) {
        instancedSatelliteCubes.instanceColor.needsUpdate = true
      }

      // Dynamic light pulsations
      coreLight1.intensity = 8.4 + Math.sin(elapsed * 3.2) * 3.0
      coreLight2.intensity = 5.8 + Math.cos(elapsed * 2.7) * 2.0
      coreLight3.intensity = 5.4 + Math.sin(elapsed * 2.3) * 1.8
      coreLight4.intensity = 4.8 + Math.cos(elapsed * 2.0) * 1.6

      // Pulsing Floor Pads via Instanced Color Update (harmonized with live color phase)
      for (let i = 0; i < tileCount; i++) {
        const pulse = 0.3 + Math.sin(elapsed * 3.2 + i * 0.35) * 0.32
        const tileHue = i % 3 === 0 ? accentHue : i % 3 === 1 ? baseHue : fillHue
        colorDummy.setHSL(tileHue, 0.94, Math.max(0.16, Math.min(0.7, pulse)))
        instancedFloorTiles.setColorAt(i, colorDummy)
      }
      if (instancedFloorTiles.instanceColor) instancedFloorTiles.instanceColor.needsUpdate = true

      // Upward drifting cyber embers (frame-rate independent)
      const positions = particleGeo.attributes.position.array as Float32Array
      const emberStep = 2.4 * dt * motionRate
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 1] += emberStep
        if (positions[i * 3 + 1] > 25) {
          positions[i * 3 + 1] = 0.1
        }
      }
      particleGeo.attributes.position.needsUpdate = true

      try {
        renderer.render(scene, camera)
      } catch {
        contextLost = true
        if (!isDisposed) setWebgl3DFallback(true)
        return
      }
      scheduleNext()
    }

    // Debounced resize listener
    let resizeTimeout: ReturnType<typeof setTimeout> | undefined
    const handleResize = () => {
      if (resizeTimeout) clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        if (isDisposed || contextLost) return
        width = Math.max(window.innerWidth, 1)
        height = Math.max(window.innerHeight, 1)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
        const dpr = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)
        renderer.setPixelRatio(dpr)
        renderer.setSize(width, height)
      }, 50)
    }

    window.addEventListener("resize", handleResize, { passive: true })

    // Render first Electric Blue frame immediately
    renderLoop()

    return () => {
      isDisposed = true
      if (resizeTimeout) clearTimeout(resizeTimeout)
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(softwareTimerId)
      window.removeEventListener("mousemove", onPointerMove)
      window.removeEventListener("touchmove", onPointerMove)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", handleResize)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      renderer.domElement.removeEventListener("webglcontextlost", onWebglContextLost)
      renderer.domElement.removeEventListener("webglcontextrestored", onWebglContextRestored)
      observer.disconnect()

      for (const item of disposables) {
        try {
          item.dispose()
        } catch {
          // ignore disposal errors
        }
      }
      disposables.length = 0

      try {
        renderer.dispose()
      } catch {
        // ignore renderer disposal errors
      }

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [mode])

  const show2DLayer = mode === "2d" || webgl3DFallback

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden"
      style={{ backgroundColor: show2DLayer ? "#050508" : "#020306" }}
      aria-hidden="true"
    >
      {/* Recovered 2D Volumetric Ambient Layer (commit fba1383) + Live Color-Changing Effect */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ease-out ${
          show2DLayer ? "opacity-100" : "opacity-0"
        }`}
      >
        <div
          className={`absolute inset-0 transition-opacity duration-500 ${
            webgl2DReady ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="rushx-ambient-canvas absolute inset-0" />
          <div className="rushx-ambient-glow absolute -inset-[10%]" />
        </div>

        <canvas
          ref={volumetric2DCanvasRef}
          className={`absolute inset-0 h-full w-full block transition-opacity duration-500 ${
            webgl2DReady ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>

      {/* Recovered 3D Cyber Monolith, Towers & Laser Walls Layer (commit 992e9d3) + Live Color-Changing Effect */}
      <div
        className={`absolute inset-0 transition-opacity duration-500 ease-out ${
          mode === "3d" && !webgl3DFallback ? "opacity-100" : "opacity-0"
        }`}
      >
        <div ref={threeContainerRef} className="absolute inset-0 h-full w-full" />
        {/* Soft Ambient Cyber Vignette (exact 992e9d3 edge softening) */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_36%,rgba(2,3,6,0.55)_100%)] pointer-events-none" />
        {/* Neutral Top Cyber Horizon Line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
      </div>
    </div>
  )
}
