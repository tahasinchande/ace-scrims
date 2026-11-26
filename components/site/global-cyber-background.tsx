"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
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
 * Controlled Low-Brightness Obsidian-Violet 2D Ambient Fragment Shader
 * Inspired by randomqbit.site:
 * - Deep obsidian / near-black base (#050508 -> #09070F)
 * - Strictly controlled radial violet/purple ambient glow (#6B2FA8 -> #3E1A6E -> #050508)
 * - Slow 8s–12s organic breathing drift & gentle pointer parallax
 * - High foreground legibility: never glaring or washed out.
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

    // 1. Deep obsidian near-black base (#050508 -> #09070F)
    vec3 obsidianDeep = uBgA;
    vec3 obsidianMid = vec3(0.035, 0.027, 0.059); // #09070F
    vec3 col = mix(obsidianDeep, obsidianMid, smoothstep(0.0, 1.0, uv.y * 0.85 + 0.1));

    // 2. Subtle fbm silk texture for depth without glare
    float silk = fbm(p * 1.45 + vec2(t * 0.35, -t * 0.22));
    float silk2 = fbm(p * 2.1 - vec2(t * 0.26, t * 0.18));

    // 3. Controlled radial violet ambient aura (#6B2FA8 -> #3E1A6E -> #050508)
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
    col += uGlow * (coreHalo * coreHalo * (0.28 + silk2 * 0.10) + sideHalo * 0.18);
    col += uC2 * (pow(coreHalo, 3.0) * 0.10 * (0.7 + silk * 0.3));

    // Gentle vignette anchoring the edges into #050508 obsidian
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
 * Detect software WebGL (SwiftShader, llvmpipe, WARP) for frame pacing & DPR cost control.
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

/** Deterministic PRNG so the skyline silhouette is architectural and consistent across renders */
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
 * Procedural high-contrast building facade CanvasTexture:
 * Dark architectural obsidian concrete with crisp, selectively lit cyan / ice-white / subtle warm windows.
 */
function createCityWindowTextures(): {
  map: THREE.CanvasTexture
  emissiveMap: THREE.CanvasTexture
} {
  const width = 256
  const height = 512

  const diffuseCanvas = document.createElement("canvas")
  diffuseCanvas.width = width
  diffuseCanvas.height = height
  const dCtx = diffuseCanvas.getContext("2d")

  const emissiveCanvas = document.createElement("canvas")
  emissiveCanvas.width = width
  emissiveCanvas.height = height
  const eCtx = emissiveCanvas.getContext("2d")

  if (dCtx && eCtx) {
    // Dark slate-obsidian skyscraper skin
    const baseGrad = dCtx.createLinearGradient(0, 0, 0, height)
    baseGrad.addColorStop(0, "#050914")
    baseGrad.addColorStop(0.55, "#070f1f")
    baseGrad.addColorStop(1, "#091829")
    dCtx.fillStyle = baseGrad
    dCtx.fillRect(0, 0, width, height)

    eCtx.fillStyle = "#000000"
    eCtx.fillRect(0, 0, width, height)

    const rand = mulberry32(90210)
    const cols = 12
    const rows = 36
    const padX = 5
    const padY = 5
    const cellW = width / cols
    const cellH = height / rows

    // Subtle structural mullion grooves
    dCtx.fillStyle = "rgba(18, 42, 68, 0.25)"
    for (let c = 0; c < cols; c++) {
      dCtx.fillRect(Math.floor(c * cellW), 0, 1, height)
    }

    // Crisp architectural window grid (selective floors & suites lit)
    for (let r = 1; r < rows - 1; r++) {
      // Occasional dark mechanical floor
      if (r % 9 === 0) continue
      const floorActivity = 0.22 + rand() * 0.42

      for (let c = 1; c < cols - 1; c++) {
        const roll = rand()
        const wx = Math.floor(c * cellW + padX * 0.5)
        const wy = Math.floor(r * cellH + padY * 0.5)
        const ww = Math.max(3, Math.floor(cellW - padX))
        const wh = Math.max(3, Math.floor(cellH - padY))

        if (roll < floorActivity) {
          const tintRoll = rand()
          let winColor: string
          if (tintRoll < 0.58) {
            // Crisp cyan-ice window
            winColor = rand() < 0.45 ? "#cffafe" : "#67e8f9"
          } else if (tintRoll < 0.86) {
            // Bright ice-white office light
            winColor = "#e0f2fe"
          } else {
            // Subtle pale cyan-teal glow
            winColor = "#22d3ee"
          }

          dCtx.fillStyle = winColor
          dCtx.fillRect(wx, wy, ww, wh)

          eCtx.fillStyle = winColor
          eCtx.fillRect(wx, wy, ww, wh)
        } else {
          // Subtle unlit glass reflection
          dCtx.fillStyle = "#081426"
          dCtx.fillRect(wx, wy, ww, wh)
        }
      }
    }

    // Subtle cyan roof trim line
    dCtx.fillStyle = "rgba(103, 232, 249, 0.45)"
    dCtx.fillRect(0, 0, width, 3)
    eCtx.fillStyle = "rgba(56, 189, 248, 0.42)"
    eCtx.fillRect(0, 0, width, 3)
  }

  const map = new THREE.CanvasTexture(diffuseCanvas)
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.RepeatWrapping
  map.colorSpace = THREE.SRGBColorSpace
  map.needsUpdate = true

  const emissiveMap = new THREE.CanvasTexture(emissiveCanvas)
  emissiveMap.wrapS = THREE.RepeatWrapping
  emissiveMap.wrapT = THREE.RepeatWrapping
  emissiveMap.colorSpace = THREE.SRGBColorSpace
  emissiveMap.needsUpdate = true

  return { map, emissiveMap }
}

export function GlobalCyberBackground() {
  const threeContainerRef = useRef<HTMLDivElement>(null)
  const volumetric2DCanvasRef = useRef<HTMLCanvasElement>(null)
  const sharedStartMsRef = useRef<number | null>(null)
  const { mode } = useViewMode()
  const [webgl2DReady, setWebgl2DReady] = useState(false)
  const [webgl3DFallback, setWebgl3DFallback] = useState(false)

  const effectiveMode: "2d" | "3d" = mode === "3d" && !webgl3DFallback ? "3d" : "2d"

  // Mode-aware theme synchronizer:
  // - "3d": Cyber Cyan Horizon accents (#06B6D4 / #38BDF8 / #CFFAFE)
  // - "2d": Controlled Obsidian Violet accents (#8C44D4 / #9B5DE5 / #6B2FA8)
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
    const colorSpeed = prefersReducedMotion ? 0.35 : 1.0

    const tick = () => {
      rafId = window.requestAnimationFrame(tick)
      if (document.hidden) return
      const startMs = sharedStartMsRef.current ?? performance.now()
      const elapsedSec = ((performance.now() - startMs) / 1000) * colorSpeed
      const state = getAmbientPhaseAt(elapsedSec, effectiveMode)
      const key = `${effectiveMode}|${state.primaryRgb.join(",")}|${state.glowRgb.join(",")}|${state.accentRgb.join(",")}`
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 2D AMBIENT MODE: CONTROLLED OBSIDIAN-VIOLET GLOW (randomqbit.site direction)
  // ─────────────────────────────────────────────────────────────────────────────
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

    resize()
    window.addEventListener("resize", resize, { passive: true })
    window.addEventListener("mousemove", onPointerMove, { passive: true })
    window.addEventListener("touchmove", onPointerMove, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })
    canvas.addEventListener("webglcontextlost", onContextLost)

    const drawFrame = (elapsedSec: number) => {
      if (!gl || contextLost || isDisposed) return
      const phase = getAmbientPhaseAt(elapsedSec * motionRate, "2d")
      smoothPtrX += (targetPtrX - smoothPtrX) * 0.04
      smoothPtrY += (targetPtrY - smoothPtrY) * 0.04

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
    }

    const initStart = sharedStartMsRef.current ?? performance.now()
    drawFrame((performance.now() - initStart) / 1000)
    setWebgl2DReady(true)

    let rafId = 0
    const loop = () => {
      if (isDisposed) return
      rafId = window.requestAnimationFrame(loop)
      if (document.hidden || contextLost) return
      const startMs = sharedStartMsRef.current ?? performance.now()
      drawFrame((performance.now() - startMs) / 1000)
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 3D CYBER MODE: DEEP NIGHT SKY + SCATTERED STARS + EXTRUDED BLOCKY CITYSCAPE
  // SILHOUETTE WITH CRISP LIT WINDOWS + BRIGHT CYAN/ICE-WHITE HORIZON LIGHT BAND
  // + RECEDING PERSPECTIVE GRID PLANE (Recovered from previous Ace Scrims deploy)
  // ─────────────────────────────────────────────────────────────────────────────
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
      setWebgl3DFallback(true)
      return
    }

    setWebgl3DFallback(false)

    const scene = new THREE.Scene()
    const nightSkyHex = 0x020612
    scene.background = new THREE.Color(nightSkyHex)
    const fog = new THREE.FogExp2(0x031120, 0.0088)
    scene.fog = fog

    // Horizon-framing perspective camera looking straight across the grid toward the glowing skyline
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.2, 500)
    camera.position.set(0, 8.2, 46)
    camera.lookAt(0, 6.2, -90)

    const maxDPR = isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 1.75)
    renderer.setPixelRatio(maxDPR)
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    renderer.shadowMap.enabled = false

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
      if (!isDisposed) {
        setWebgl3DFallback(true)
      }
    }
    renderer.domElement.addEventListener("webglcontextlost", onWebglContextLost)

    // 1. Lighting Rig: Subtle cool rim & cyan horizon backlight spilling onto the skyline
    const hemiLight = new THREE.HemisphereLight(0x38bdf8, 0x020612, 0.72)
    scene.add(hemiLight)

    const horizonBackLight = new THREE.DirectionalLight(0x67e8f9, 1.85)
    horizonBackLight.position.set(0, 12, -130)
    scene.add(horizonBackLight)

    const cyanFillLeft = new THREE.PointLight(0x06b6d4, 18, 120, 1.5)
    cyanFillLeft.position.set(-28, 10, -56)
    scene.add(cyanFillLeft)

    const cyanFillRight = new THREE.PointLight(0x22d3ee, 18, 120, 1.5)
    cyanFillRight.position.set(28, 10, -56)
    scene.add(cyanFillRight)

    // 2. DEEP NIGHT SKY + BRIGHT CYAN / ICE-WHITE HORIZON LIGHT BAND BACKDROP
    const skyUniforms = {
      uTime: { value: 0 },
      uCyanGlow: { value: new THREE.Color(0x0ea5c6) },
      uIceBand: { value: new THREE.Color(0xd8fbff) },
      uTealSpill: { value: new THREE.Color(0x0b5f7a) },
    }
    const skyGeo = trackDisposable(new THREE.PlaneGeometry(520, 220, 1, 1))
    const skyMat = trackDisposable(
      new THREE.ShaderMaterial({
        uniforms: skyUniforms,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uCyanGlow;
          uniform vec3 uIceBand;
          uniform vec3 uTealSpill;
          varying vec2 vUv;

          void main() {
            // Horizon line sits at ~36% from bottom of sky plane (aligned with ground grid y=0)
            float hY = 0.345;
            float dy = vUv.y - hY;

            // Deep night sky zenith (#01040c) -> midnight slate-navy above horizon
            vec3 zenith = vec3(0.008, 0.016, 0.044);
            vec3 midSky = vec3(0.016, 0.046, 0.095);
            vec3 col = mix(midSky, zenith, smoothstep(0.02, 0.62, max(0.0, dy)));

            // Gentle 8s–12s atmospheric pulse along the horizon
            float pulse = 0.90 + 0.10 * sin(uTime * 0.78);
            float sweep = 0.86 + 0.14 * cos((vUv.x - 0.5) * 3.8 + uTime * 0.52);

            // Wide atmospheric cyan-teal glow spilling upwards behind the skyline
            float upperAura = exp(-pow(max(0.0, dy) * 5.2, 1.45)) * step(-0.02, dy);
            col += uTealSpill * upperAura * 0.92 * pulse;

            // Tighter bright cyan band hugging the horizon
            float cyanBand = exp(-pow(dy * 15.5, 2.0)) * sweep;
            col += uCyanGlow * cyanBand * 1.18 * pulse;

            // Razor-crisp ice-white horizontal horizon light line
            float iceCore = exp(-pow(dy * 54.0, 2.0)) * (0.92 + 0.08 * sin(uTime * 1.05));
            col += uIceBand * iceCore * 1.42;

            // Horizontal edge attenuation so the band feels vast & cinematic
            float xFade = 1.0 - smoothstep(0.32, 0.52, abs(vUv.x - 0.5));
            col = mix(zenith, col, 0.35 + 0.65 * xFade);

            gl_FragColor = vec4(col, 1.0);
          }
        `,
        depthWrite: false,
        fog: false,
      })
    )
    const skyBackdrop = new THREE.Mesh(skyGeo, skyMat)
    skyBackdrop.position.set(0, 34, -210)
    scene.add(skyBackdrop)

    // 3. SCATTERED TWINKLING STARS & UPPER ATMOSPHERE PARTICLES
    const starCount = isSoftwareGl ? 520 : 950
    const starGeo = trackDisposable(new THREE.BufferGeometry())
    const starPositions = new Float32Array(starCount * 3)
    const starSizes = new Float32Array(starCount)
    const starPhases = new Float32Array(starCount)
    const starTints = new Float32Array(starCount)

    const starRand = mulberry32(421337)
    for (let i = 0; i < starCount; i++) {
      // Spread across upper sky behind and above the skyline
      const sx = (starRand() - 0.5) * 340
      const sy = 10 + Math.pow(starRand(), 0.72) * 112
      const sz = -70 - starRand() * 130
      starPositions[i * 3] = sx
      starPositions[i * 3 + 1] = sy
      starPositions[i * 3 + 2] = sz
      starSizes[i] = 1.2 + Math.pow(starRand(), 2.2) * 3.2
      starPhases[i] = starRand() * Math.PI * 2
      starTints[i] = starRand()
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPositions, 3))
    starGeo.setAttribute("aSize", new THREE.BufferAttribute(starSizes, 1))
    starGeo.setAttribute("aPhase", new THREE.BufferAttribute(starPhases, 1))
    starGeo.setAttribute("aTint", new THREE.BufferAttribute(starTints, 1))

    const starUniforms = {
      uTime: { value: 0 },
      uPixelRatio: { value: maxDPR },
    }
    const starMat = trackDisposable(
      new THREE.ShaderMaterial({
        uniforms: starUniforms,
        vertexShader: `
          attribute float aSize;
          attribute float aPhase;
          attribute float aTint;
          uniform float uTime;
          uniform float uPixelRatio;
          varying float vAlpha;
          varying float vTint;

          void main() {
            vec3 pos = position;
            // Subtle 10s–12s ambient particle drift
            pos.x += sin(uTime * 0.18 + aPhase) * 1.4;
            pos.y += cos(uTime * 0.14 + aPhase * 1.3) * 0.75;

            float twinkle = 0.45 + 0.55 * sin(uTime * (0.75 + aTint * 0.9) + aPhase);
            vAlpha = twinkle;
            vTint = aTint;

            vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
            gl_PointSize = clamp(aSize * uPixelRatio * (185.0 / max(1.0, -mvPosition.z)), 1.0, 5.5);
            gl_Position = projectionMatrix * mvPosition;
          }
        `,
        fragmentShader: `
          varying float vAlpha;
          varying float vTint;

          void main() {
            float d = length(gl_PointCoord - vec2(0.5));
            if (d > 0.5) discard;
            float core = smoothstep(0.5, 0.08, d);
            vec3 whiteStar = vec3(0.92, 0.97, 1.0);
            vec3 cyanStar = vec3(0.45, 0.91, 0.99);
            vec3 col = mix(whiteStar, cyanStar, step(0.58, vTint));
            gl_FragColor = vec4(col, core * vAlpha * 0.92);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      })
    )
    const starField = new THREE.Points(starGeo, starMat)
    starField.frustumCulled = false
    scene.add(starField)

    // 4. PERSPECTIVE CYBER GRID PLANE RECEDING TOWARD THE HORIZON (Analytic anti-aliased — no fwidth!)
    const gridUniforms = {
      uTime: { value: 0 },
      uGridColor: { value: new THREE.Color(0x06b6d4) },
      uGridAccent: { value: new THREE.Color(0x67e8f9) },
      uHorizonGlow: { value: new THREE.Color(0x164e63) },
    }
    const gridGeo = trackDisposable(new THREE.PlaneGeometry(340, 220, 1, 1))
    gridGeo.rotateX(-Math.PI / 2)

    const gridMat = trackDisposable(
      new THREE.ShaderMaterial({
        uniforms: gridUniforms,
        vertexShader: `
          varying vec3 vWorldPos;
          void main() {
            vec4 worldPosition = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPosition.xyz;
            gl_Position = projectionMatrix * viewMatrix * worldPosition;
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uGridColor;
          uniform vec3 uGridAccent;
          uniform vec3 uHorizonGlow;
          varying vec3 vWorldPos;

          void main() {
            // Smooth forward glide of perspective grid lines toward viewer
            vec2 coord = vec2(vWorldPos.x * 0.24, (vWorldPos.z + uTime * 3.6) * 0.24);
            vec2 cell = abs(fract(coord - 0.5) - 0.5);

            // Analytic line thickness scaling slightly with distance to avoid shimmer
            float depthFactor = clamp((-vWorldPos.z + 45.0) / 170.0, 0.0, 1.0);
            float thickness = mix(0.014, 0.045, depthFactor);
            float feather = mix(0.016, 0.055, depthFactor);

            float lineX = 1.0 - smoothstep(thickness, thickness + feather, cell.x);
            float lineZ = 1.0 - smoothstep(thickness, thickness + feather, cell.y);
            float gridLine = max(lineX, lineZ);

            // Major structural grid lines every 4 cells
            vec2 majorCoord = coord * 0.25;
            vec2 majorCell = abs(fract(majorCoord - 0.5) - 0.5);
            float majorLine = max(
              1.0 - smoothstep(thickness * 0.7, thickness * 0.7 + feather * 0.85, majorCell.x),
              1.0 - smoothstep(thickness * 0.7, thickness * 0.7 + feather * 0.85, majorCell.y)
            );

            // Subtle dark glossy obsidian ground base reflecting the cyan horizon spill
            vec3 groundBase = vec3(0.008, 0.018, 0.036);
            float horizonSpill = exp(-pow((vWorldPos.z + 82.0) / 56.0, 2.0));
            float centerReflect = exp(-pow(vWorldPos.x / 58.0, 2.0));
            vec3 col = groundBase + uHorizonGlow * horizonSpill * (0.45 + 0.55 * centerReflect);

            // Luminous cyan-teal perspective lines brightening toward the horizon
            float pulse = 0.88 + 0.12 * sin(uTime * 0.85 - vWorldPos.z * 0.04);
            col += uGridColor * gridLine * (0.36 + 0.42 * horizonSpill) * pulse;
            col += uGridAccent * majorLine * (0.38 + 0.45 * horizonSpill);

            // Smooth lateral and near/far fade
            float lateralFade = 1.0 - smoothstep(55.0, 155.0, abs(vWorldPos.x));
            float farFade = 1.0 - smoothstep(-95.0, -142.0, vWorldPos.z);
            float nearFade = smoothstep(54.0, 24.0, vWorldPos.z);
            float alpha = clamp(lateralFade * farFade * nearFade, 0.0, 1.0);

            gl_FragColor = vec4(col, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
      })
    )
    const gridPlane = new THREE.Mesh(gridGeo, gridMat)
    gridPlane.position.set(0, 0, -44)
    scene.add(gridPlane)

    // 5. DARK EXTRUDED / BLOCKY CITYSCAPE SILHOUETTE WITH CRISP LIT WINDOWS
    const { map: cityMap, emissiveMap: cityEmissiveMap } = createCityWindowTextures()
    trackDisposable(cityMap)
    trackDisposable(cityEmissiveMap)

    const buildingGeo = trackDisposable(new THREE.BoxGeometry(1, 1, 1))
    buildingGeo.translate(0, 0.5, 0)

    // Foreground & mid-ground skyscraper material with crisp lit windows
    const cityMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: 0x0b1629,
        map: cityMap,
        emissive: new THREE.Color(0x7dd3fc),
        emissiveMap: cityEmissiveMap,
        emissiveIntensity: 1.05,
        roughness: 0.72,
        metalness: 0.28,
      })
    )

    // Deep silhouette back-row towers (darker blocky silhouettes framing the glowing cyan band)
    const silhouetteMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: 0x040914,
        emissive: new THREE.Color(0x0c4a6e),
        emissiveIntensity: 0.22,
        roughness: 0.85,
        metalness: 0.15,
      })
    )

    const cityRand = mulberry32(202607)
    type BuildingSpec = {
      x: number
      z: number
      w: number
      h: number
      d: number
    }
    const litBuildings: BuildingSpec[] = []
    const silhouetteBuildings: BuildingSpec[] = []

    // Multi-layered metropolitan skyline spanning left-to-right across the mid-ground horizon
    const rows = [
      { zBase: -64, count: 34, spreadX: 162, minH: 5.5, maxH: 22.0, lit: true },
      { zBase: -80, count: 44, spreadX: 196, minH: 9.0, maxH: 32.0, lit: true },
      { zBase: -98, count: 52, spreadX: 230, minH: 11.0, maxH: 38.0, lit: false },
    ]

    for (const row of rows) {
      for (let i = 0; i < row.count; i++) {
        const normX = (i / Math.max(1, row.count - 1)) * 2 - 1 // -1..1
        const jitterX = (cityRand() - 0.5) * (row.spreadX / row.count) * 1.15
        const x = normX * (row.spreadX * 0.5) + jitterX
        const z = row.zBase + (cityRand() - 0.5) * 10

        // Dramatic stepped downtown silhouette: slightly taller skyline clusters flanking a breathing center horizon vista
        const clusterProfile =
          0.62 +
          0.42 * Math.abs(Math.sin(normX * Math.PI * 1.65)) +
          0.26 * Math.exp(-Math.pow((Math.abs(normX) - 0.34) * 3.8, 2))
        const w = 2.8 + cityRand() * 5.2
        const d = 3.2 + cityRand() * 5.5
        const h = (row.minH + cityRand() * (row.maxH - row.minH)) * clusterProfile

        const spec = { x, z, w, h, d }
        if (row.lit) {
          litBuildings.push(spec)
        } else {
          silhouetteBuildings.push(spec)
        }
      }
    }

    const dummy = new THREE.Object3D()

    const instancedLitCity = new THREE.InstancedMesh(buildingGeo, cityMat, litBuildings.length)
    instancedLitCity.frustumCulled = false
    litBuildings.forEach((b, idx) => {
      dummy.position.set(b.x, 0, b.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(b.w, b.h, b.d)
      dummy.updateMatrix()
      instancedLitCity.setMatrixAt(idx, dummy.matrix)
    })
    instancedLitCity.instanceMatrix.needsUpdate = true
    scene.add(instancedLitCity)

    const instancedSilhouetteCity = new THREE.InstancedMesh(
      buildingGeo,
      silhouetteMat,
      silhouetteBuildings.length
    )
    instancedSilhouetteCity.frustumCulled = false
    silhouetteBuildings.forEach((b, idx) => {
      dummy.position.set(b.x, 0, b.z)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(b.w, b.h, b.d)
      dummy.updateMatrix()
      instancedSilhouetteCity.setMatrixAt(idx, dummy.matrix)
    })
    instancedSilhouetteCity.instanceMatrix.needsUpdate = true
    scene.add(instancedSilhouetteCity)

    // 6. ATMOSPHERIC CYAN-TEAL HORIZON GLOW SPILL PLANE (Soft volumetric bloom bridging skyline & grid)
    const spillUniforms = {
      uTime: { value: 0 },
      uGlowColor: { value: new THREE.Color(0x22d3ee) },
    }
    const spillGeo = trackDisposable(new THREE.PlaneGeometry(280, 30, 1, 1))
    const spillMat = trackDisposable(
      new THREE.ShaderMaterial({
        uniforms: spillUniforms,
        vertexShader: `
          varying vec2 vUv;
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float uTime;
          uniform vec3 uGlowColor;
          varying vec2 vUv;
          void main() {
            float yBand = exp(-pow((vUv.y - 0.42) * 3.8, 2.0));
            float xFade = 1.0 - smoothstep(0.18, 0.5, abs(vUv.x - 0.5));
            float pulse = 0.84 + 0.16 * sin(uTime * 0.72 + vUv.x * 4.0);
            float alpha = yBand * xFade * 0.34 * pulse;
            gl_FragColor = vec4(uGlowColor, alpha);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: false,
      })
    )
    const horizonSpill = new THREE.Mesh(spillGeo, spillMat)
    horizonSpill.position.set(0, 4.2, -74)
    scene.add(horizonSpill)

    // 7. PASSIVE POINTER & SCROLL PARALLAX INPUTS
    let targetMouseX = 0
    let targetMouseY = 0
    let smoothMouseX = 0
    let smoothMouseY = 0
    let scrollY = 0

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0]?.clientX ?? 0 : e.clientX
      const clientY = "touches" in e ? e.touches[0]?.clientY ?? 0 : e.clientY
      targetMouseX = (clientX / Math.max(window.innerWidth, 1)) * 2 - 1
      targetMouseY = -((clientY / Math.max(window.innerHeight, 1)) * 2 - 1)
    }

    const onScroll = () => {
      scrollY = window.scrollY || document.documentElement.scrollTop || 0
    }

    window.addEventListener("mousemove", onPointerMove, { passive: true })
    window.addEventListener("touchmove", onPointerMove, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })

    // Tab visibility pause only (never IntersectionObserver on fixed inset-0)
    let isTabActive = typeof document !== "undefined" ? !document.hidden : true
    const onVisibilityChange = () => {
      isTabActive = !document.hidden
      if (isTabActive) {
        lastFrameNow = performance.now()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const motionRate = prefersReducedMotion ? 0.3 : 1.0

    const c1Color = new THREE.Color()
    const c2Color = new THREE.Color()
    const c3Color = new THREE.Color()
    const glowColor = new THREE.Color()

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

      if (!isTabActive) {
        frameId = window.requestAnimationFrame(renderFrame)
        return
      }

      motionElapsed += dt * motionRate
      const colorElapsed =
        sharedStartMsRef.current !== null
          ? Math.max(0, (now - sharedStartMsRef.current) / 1000) * (prefersReducedMotion ? 0.35 : 1.0)
          : motionElapsed
      const phase = getAmbientPhaseAt(colorElapsed, "3d")

      c1Color.setRGB(phase.c1[0], phase.c1[1], phase.c1[2])
      c2Color.setRGB(phase.c2[0], phase.c2[1], phase.c2[2])
      c3Color.setRGB(phase.c3[0], phase.c3[1], phase.c3[2])
      glowColor.setRGB(phase.glow[0], phase.glow[1], phase.glow[2])

      // Synchronize horizon band, grid, and skyline glow smoothly (6s–12s breathing loops)
      skyUniforms.uTime.value = motionElapsed
      skyUniforms.uCyanGlow.value.copy(c1Color).lerp(c2Color, 0.35)
      skyUniforms.uIceBand.value.copy(c3Color)
      skyUniforms.uTealSpill.value.copy(glowColor)

      starUniforms.uTime.value = motionElapsed

      gridUniforms.uTime.value = motionElapsed
      gridUniforms.uGridColor.value.copy(c1Color)
      gridUniforms.uGridAccent.value.copy(c2Color).lerp(c3Color, 0.25)
      gridUniforms.uHorizonGlow.value.copy(glowColor).multiplyScalar(0.55)

      spillUniforms.uTime.value = motionElapsed
      spillUniforms.uGlowColor.value.copy(c2Color)

      cityMat.emissive.copy(c2Color).lerp(c3Color, 0.4)
      cityMat.emissiveIntensity = 0.96 + 0.14 * Math.sin(motionElapsed * 0.72)

      cyanFillLeft.color.copy(c1Color)
      cyanFillRight.color.copy(c2Color)
      horizonBackLight.color.copy(c3Color)

      // Smooth autonomous camera drift (8s–12s loop) + gentle mouse & scroll parallax
      const damp = 1 - Math.exp(-3.2 * dt)
      smoothMouseX += (targetMouseX - smoothMouseX) * damp
      smoothMouseY += (targetMouseY - smoothMouseY) * damp

      const docHeight =
        Math.max(
          document.body.scrollHeight,
          document.documentElement.scrollHeight,
          window.innerHeight * 2
        ) - window.innerHeight
      const scrollRatio = Math.min(1, Math.max(0, scrollY / Math.max(docHeight, 1)))

      const autoSwayX = Math.sin(motionElapsed * 0.52) * 3.4
      const autoBobY = Math.cos(motionElapsed * 0.68) * 0.58

      camera.position.x = autoSwayX + smoothMouseX * 3.2
      camera.position.y = 8.2 + autoBobY + smoothMouseY * 1.15 - scrollRatio * 1.8
      camera.position.z = 46 - scrollRatio * 6.0
      camera.lookAt(smoothMouseX * 4.5, 6.4 + smoothMouseY * 1.4 - scrollRatio * 1.2, -90)

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
      starUniforms.uPixelRatio.value = dpr
      renderer.setSize(width, height)
    }

    window.addEventListener("resize", handleResize, { passive: true })

    // Render first frame immediately
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
  }, [mode])

  const show2DLayer = mode === "2d" || webgl3DFallback

  return (
    <div
      className="fixed inset-0 z-0 pointer-events-none select-none overflow-hidden"
      style={{ backgroundColor: show2DLayer ? "#050508" : "#020612" }}
      aria-hidden="true"
    >
      {/* 2D Ambient Layer: Controlled Low-Brightness Obsidian-Violet Glow */}
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

      {/* 3D Cyber Cityscape & Horizon Grid Layer */}
      <div
        ref={threeContainerRef}
        className={`absolute inset-0 transition-opacity duration-500 ease-out ${
          mode === "3d" && !webgl3DFallback ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  )
}
