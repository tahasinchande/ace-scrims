"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { useViewMode } from "@/lib/view-mode"
import {
  applyAmbientThemeToRoot,
  getAmbientPhaseAt,
  STAGE_BASE_NORM,
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
 * Volumetric 2D Atmospheric Fragment Shader
 * - Grounded directly in RandomQbit's upper-hero color-field composition (FS_BG: bgA/bgB/uGlow)
 *   without any brain, orb, or sphere graphic.
 * - Adds multi-layer drifting domain-warped organic light fields & depth parallax so 2D mode
 *   feels genuinely volumetric and dimensional, with subtle blue-noise dithering for zero banding.
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
  uniform vec3 uC3;

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
    for (int i = 0; i < 4; i++) {
      v += a * noise2D(p);
      p = rot * p * 2.02 + vec2(17.1, 31.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / max(uRes.y, 1.0);
    vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

    // Subtle pointer + scroll atmospheric parallax
    vec2 drift = vec2(uPointer.x * 0.06, uPointer.y * 0.045 - uScroll * 0.08);
    float t = uTime * 0.12;

    // 1. RandomQbit upper-stage base washes (bgA + top-left bgB + upper-right & upper-center uGlow)
    vec3 col = uBgA;
    float g1 = clamp(1.0 - length((uv - vec2(0.02, 1.0) - drift * 0.35) * vec2(0.95, 1.22)), 0.0, 1.0);
    col = mix(col, uBgB * 1.45, smoothstep(0.0, 1.0, g1) * 0.92);

    float g2 = clamp(1.0 - length((uv - vec2(0.98, 0.74) + drift * 0.4) * vec2(1.32, 0.96)), 0.0, 1.0);
    col += uGlow * 0.65 * pow(g2, 1.65);

    vec2 centerBloomPos = vec2(0.5 + sin(t * 0.85) * 0.07, 0.72 + cos(t * 0.65) * 0.04) + drift * 0.55;
    float dCenter = length((uv - centerBloomPos) * vec2(aspect * 0.62, 1.1));
    col += uGlow * 0.85 * exp(-dCenter * dCenter * 1.35);

    // 2. Volumetric multi-depth domain-warped light fields (overlapping, organically blended)
    vec2 q = vec2(
      fbm(p * 1.35 + vec2(t * 0.55, -t * 0.35)),
      fbm(p * 1.35 + vec2(-t * 0.42 + 4.3, t * 0.51 + 1.9))
    );
    float veilA = fbm(p * 1.45 + 1.55 * q + vec2(t * 0.25, -t * 0.18));
    float veilB = fbm(p * 2.1 - 1.25 * q + vec2(-t * 0.32, t * 0.22));

    // Soft overlapping radial light volumes at staggered depths
    vec2 field1Center = vec2(
      0.24 + sin(t * 0.95) * 0.11,
      0.76 + cos(t * 0.72) * 0.08
    ) + drift * 0.5;
    float f1 = exp(-pow(length((uv - field1Center) * vec2(aspect * 0.68, 1.05)), 2.0) * 1.85);

    vec2 field2Center = vec2(
      0.78 + cos(t * 0.82) * 0.10,
      0.66 + sin(t * 0.68) * 0.09
    ) - drift * 0.45;
    float f2 = exp(-pow(length((uv - field2Center) * vec2(aspect * 0.72, 1.08)), 2.0) * 2.15);

    vec2 field3Center = vec2(
      0.52 + sin(t * 0.60 + 2.1) * 0.14,
      0.24 + cos(t * 0.54 + 1.4) * 0.08
    ) + drift * 0.3;
    float f3 = exp(-pow(length((uv - field3Center) * vec2(aspect * 0.56, 1.15)), 2.0) * 1.65);

    // Volumetric blending: rich depth without washing out foreground readability
    col += uC1 * (f1 * (0.24 + veilA * 0.22));
    col += uC2 * (f2 * (0.20 + veilB * 0.20));
    col += mix(uBgB, uC1, 0.42) * (f3 * (0.24 + veilA * 0.14));

    // Soft specular caustic ribbon high in the atmosphere (pure light field, no hard shapes)
    float caustic = smoothstep(0.46, 0.88, veilA * 0.6 + veilB * 0.4) * (f1 * 0.55 + f2 * 0.55);
    col += mix(uC2, uC3, 0.42) * caustic * 0.16;

    // Gentle vertical atmospheric depth gradient so hero pops & lower content remains calm and legible
    float upperLift = smoothstep(0.0, 0.92, uv.y);
    col *= mix(0.76, 1.06, upperLift);

    // Subtle cinematic edge vignette
    float vig = smoothstep(1.38, 0.28, length((uv - 0.5) * vec2(aspect * 0.78, 1.02)));
    col *= mix(0.58, 1.0, vig);

    // Subtle filmic tone curve to prevent harsh clipping
    col = col / (1.0 + col * 0.38);

    // Procedural hash dithering to eliminate 8-bit gradient banding
    float dither = (hash12(gl_FragCoord.xy + fract(uTime * 13.7)) - 0.5) / 255.0;
    col = clamp(col + dither, 0.0, 1.0);

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

export function GlobalCyberBackground() {
  const threeContainerRef = useRef<HTMLDivElement>(null)
  const volumetric2DCanvasRef = useRef<HTMLCanvasElement>(null)
  const sharedStartMsRef = useRef<number | null>(null)
  const { mode } = useViewMode()
  const [webgl2DReady, setWebgl2DReady] = useState(false)
  const [webgl3DFallback, setWebgl3DFallback] = useState(false)

  // Synchronized RandomQbit continuous color-shifting engine across BOTH 2D & 3D modes.
  // Anchored on RushX Electric Blue (#1F73FF / #40B8FF), holds 2.2s, smoothstep-fades 3.0s
  // through Teal -> Solar Gold -> Neon Rose -> Electric Violet -> Electric Blue.
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

  // ─────────────────────────────────────────────────────────────────────────────
  // 2D MODE: VOLUMETRIC WEBGL COLOR-FIELD ATMOSPHERE (with CSS fallback)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode === "3d") {
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

    // Fullscreen quad (2 triangles)
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
    const uC3 = gl.getUniformLocation(program, "uC3")

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    let targetPtrX = 0
    let targetPtrY = 0
    let smoothPtrX = 0
    let smoothPtrY = 0
    let scrollRatio = 0
    let contextLost = false

    const resize = () => {
      if (!gl || contextLost) return
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
      const docHeight = Math.max(
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
      setWebgl2DReady(false)
    }

    resize()
    window.addEventListener("resize", resize, { passive: true })
    window.addEventListener("mousemove", onPointerMove, { passive: true })
    window.addEventListener("touchmove", onPointerMove, { passive: true })
    window.addEventListener("scroll", onScroll, { passive: true })
    canvas.addEventListener("webglcontextlost", onContextLost)

    const drawFrame = (elapsedSec: number) => {
      if (!gl || contextLost) return
      const phase = getAmbientPhaseAt(prefersReducedMotion ? 0 : elapsedSec)
      smoothPtrX += (targetPtrX - smoothPtrX) * 0.04
      smoothPtrY += (targetPtrY - smoothPtrY) * 0.04

      gl.uniform1f(uTime, prefersReducedMotion ? 0 : elapsedSec)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform2f(uPointer, smoothPtrX, smoothPtrY)
      gl.uniform1f(uScroll, scrollRatio)
      gl.uniform3f(uBgA, STAGE_BASE_NORM[0], STAGE_BASE_NORM[1], STAGE_BASE_NORM[2])
      gl.uniform3f(uBgB, phase.bgB[0], phase.bgB[1], phase.bgB[2])
      gl.uniform3f(uGlow, phase.glow[0], phase.glow[1], phase.glow[2])
      gl.uniform3f(uC1, phase.c1[0], phase.c1[1], phase.c1[2])
      gl.uniform3f(uC2, phase.c2[0], phase.c2[1], phase.c2[2])
      gl.uniform3f(uC3, phase.c3[0], phase.c3[1], phase.c3[2])

      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    // Paint initial frame synchronously on Electric Blue entrance
    const initStart = sharedStartMsRef.current ?? performance.now()
    drawFrame((performance.now() - initStart) / 1000)
    setWebgl2DReady(true)

    let rafId = 0
    const loop = () => {
      rafId = window.requestAnimationFrame(loop)
      if (document.hidden || contextLost) return
      const startMs = sharedStartMsRef.current ?? performance.now()
      drawFrame((performance.now() - startMs) / 1000)
    }

    if (!prefersReducedMotion) {
      rafId = window.requestAnimationFrame(loop)
    }

    return () => {
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
  }, [mode])

  // ─────────────────────────────────────────────────────────────────────────────
  // 3D MODE: PRESERVED ISOMETRIC MONOLITH & CYBER TOWER ARCHITECTURE
  // Upgraded with Dynamic Blue-Anchored RandomQbit Multi-Color Lighting & Shaders
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== "3d") {
      setWebgl3DFallback(false)
      return
    }

    const container = threeContainerRef.current
    if (!container) return

    let width = window.innerWidth
    let height = window.innerHeight

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
        antialias: true,
        alpha: true,
        stencil: false,
        depth: true,
      })
    } catch {
      setWebgl3DFallback(true)
      return
    }

    setWebgl3DFallback(false)

    // Start immediately on the shared clock's current phase (Electric Blue at t=0)
    const initialElapsed =
      sharedStartMsRef.current !== null
        ? Math.max(0, (performance.now() - sharedStartMsRef.current) / 1000)
        : 0
    const initPhase = getAmbientPhaseAt(initialElapsed)

    // ─────────────────────────────────────────────────────────────────────────
    // 1. THREE.JS SCENE & RENDERER SETUP (DPR Capped & High Performance)
    // ─────────────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    const stageColor = new THREE.Color(
      STAGE_BASE_NORM[0] + initPhase.bgB[0] * 0.25,
      STAGE_BASE_NORM[1] + initPhase.bgB[1] * 0.25,
      STAGE_BASE_NORM[2] + initPhase.bgB[2] * 0.25
    )
    scene.background = stageColor.clone()
    const fog = new THREE.FogExp2(stageColor.getHex(), 0.0115)
    scene.fog = fog

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 500)
    camera.position.set(16, 18, 28)
    camera.lookAt(0, 1.5, 0)

    const maxDPR = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 1.5)
    renderer.setPixelRatio(maxDPR)
    renderer.setSize(width, height)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.42
    renderer.shadowMap.enabled = false

    renderer.domElement.style.position = "absolute"
    renderer.domElement.style.top = "0"
    renderer.domElement.style.left = "0"
    renderer.domElement.style.width = "100%"
    renderer.domElement.style.height = "100%"
    renderer.domElement.style.display = "block"
    renderer.domElement.style.pointerEvents = "none"

    container.replaceChildren(renderer.domElement)

    let contextLost = false
    const onWebglContextLost = (e: Event) => {
      e.preventDefault()
      contextLost = true
      setWebgl3DFallback(true)
    }
    renderer.domElement.addEventListener("webglcontextlost", onWebglContextLost)

    // ─────────────────────────────────────────────────────────────────────────
    // 2. DYNAMIC MULTI-COLOR ILLUMINATION (Starts Electric Blue, Shifts Harmoniously)
    // ─────────────────────────────────────────────────────────────────────────
    const ambientLight = new THREE.AmbientLight(0x0c1b36, 3.6)
    scene.add(ambientLight)

    const dirKey = new THREE.DirectionalLight(0x1f73ff, 3.1)
    dirKey.position.set(24, 35, 18)
    scene.add(dirKey)

    const dirFill = new THREE.DirectionalLight(0x0d2b5c, 2.3)
    dirFill.position.set(-28, 25, -20)
    scene.add(dirFill)

    const coreLight1 = new THREE.PointLight(0x1f73ff, 8.2, 52, 1.5)
    coreLight1.position.set(0, 4.5, 0)
    scene.add(coreLight1)

    const coreLight2 = new THREE.PointLight(0x40b8ff, 5.6, 42, 1.5)
    coreLight2.position.set(16, 3.5, -12)
    scene.add(coreLight2)

    const coreLight3 = new THREE.PointLight(0x1f73ff, 5.1, 42, 1.5)
    coreLight3.position.set(-16, 3.5, 10)
    scene.add(coreLight3)

    const coreLight4 = new THREE.PointLight(0x40b8ff, 4.6, 36, 1.5)
    coreLight4.position.set(-12, 3.0, -18)
    scene.add(coreLight4)

    // ─────────────────────────────────────────────────────────────────────────
    // 3. EXPANSIVE ISOMETRIC MONOLITH TERRAIN (Preserved 48x48 InstancedMesh)
    // ─────────────────────────────────────────────────────────────────────────
    const gridSize = 48 // 48 x 48 = 2,304 monoliths
    const count = gridSize * gridSize
    const boxGeo = trackDisposable(new THREE.BoxGeometry(0.94, 1, 0.94))
    boxGeo.translate(0, 0.5, 0)

    const blockMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: 0x0e1626,
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

        if (isCrevice) {
          colorDummy.setHex(0x071126)
        } else if (isCoreArea || isSecondaryCore || isTertiaryCore) {
          colorDummy.setHex(0x121d33)
        } else {
          const base = 0.055 + Math.random() * 0.05
          colorDummy.setRGB(base * 0.92, base * 1.08, base * 1.38)
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
    // 4. INFINITE CYBER CIRCUIT FLOOR GRID MATRIX & INSTANCED GLOWING PADS
    // ─────────────────────────────────────────────────────────────────────────
    const gridHelper = new THREE.GridHelper(120, 80, 0x3b82f6, 0x1e2c4a)
    gridHelper.position.y = 0.08
    if (gridHelper.material instanceof THREE.Material) {
      gridHelper.material.transparent = true
      gridHelper.material.opacity = 0.42
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
        opacity: 0.84,
      })
    )

    const instancedFloorTiles = new THREE.InstancedMesh(tileGeo, floorTileMat, tileCount)
    instancedFloorTiles.frustumCulled = true

    const tileBaseColor = new THREE.Color(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2])

    for (let i = 0; i < tileCount; i++) {
      const rx = (Math.floor(Math.random() * 44) - 22) * 1.12
      const rz = (Math.floor(Math.random() * 44) - 22) * 1.12

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
    // 5. PRESERVED CYBER TOWERS & INSTANCED SATELLITE CUBES
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

    const unitBoxGeo = trackDisposable(new THREE.BoxGeometry(1, 1, 1))

    const towerNodeMat = trackDisposable(
      new THREE.MeshStandardMaterial({
        color: 0x060a14,
        roughness: 0.14,
        metalness: 0.94,
      })
    )
    const towerOuterGlowMat = trackDisposable(
      new THREE.MeshBasicMaterial({ color: new THREE.Color(initPhase.c1[0], initPhase.c1[1], initPhase.c1[2]) })
    )
    const towerInnerGlowMat = trackDisposable(
      new THREE.MeshBasicMaterial({ color: new THREE.Color(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2]) })
    )

    const instancedPillars = new THREE.InstancedMesh(unitBoxGeo, towerNodeMat, towerCount)
    instancedPillars.frustumCulled = true

    const instancedOuterSlits = new THREE.InstancedMesh(unitBoxGeo, towerOuterGlowMat, towerCount)
    instancedOuterSlits.frustumCulled = true

    const instancedInnerSlits = new THREE.InstancedMesh(unitBoxGeo, towerInnerGlowMat, towerCount)
    instancedInnerSlits.frustumCulled = true

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

    // Satellite Orbiting Data Cubes (42 instanced cubes)
    const totalSatelliteCubes = towerCount * 6
    const satelliteMat = trackDisposable(
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
      })
    )
    const instancedSatelliteCubes = new THREE.InstancedMesh(unitBoxGeo, satelliteMat, totalSatelliteCubes)
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
    }
    const satelliteMeta: SatelliteMeta[] = []
    const darkSatColor = new THREE.Color(0x070d1c)

    let satIdx = 0
    towerConfigs.forEach((t, tIdx) => {
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2
        const rad = (1.8 + (i % 2) * 0.5) * t.s
        const isGlow = i % 2 === 0
        const baseY = (t.h * 0.6 + (i % 3) * 0.8) * t.s
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
    instancedSatelliteCubes.computeBoundingSphere()
    scene.add(instancedSatelliteCubes)

    // ─────────────────────────────────────────────────────────────────────────
    // 6. VOLUMETRIC LASER ENERGY WALLS (Dynamic Multi-Color Shader Ribbons)
    // ─────────────────────────────────────────────────────────────────────────
    const wallUniforms = {
      uTime: { value: 0 },
      uColorDark: { value: new THREE.Color(initPhase.glow[0] * 1.4, initPhase.glow[1] * 1.4, initPhase.glow[2] * 1.4) },
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
            float thinIntense = pow(sin(vUv.y * 3.14159), 8.0) * 1.85;

            vec3 col = mix(uColorDark, uColorMid, vUv.y);
            col = mix(col, uColorCore, clamp(thinIntense + fastStreams * 0.32, 0.0, 1.0));

            float alpha = (beamCore * 0.78 + fastStreams * 0.16) * (0.8 + pulseWaves * 0.2);
            gl_FragColor = vec4(col * 1.55, alpha);
          }
        `,
        transparent: true,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    )

    const wallGeo1 = trackDisposable(new THREE.PlaneGeometry(48, 6.2, 40, 1))
    wallGeo1.translate(24, 3.1, 0)
    const laserWall1 = new THREE.Mesh(wallGeo1, laserShaderMat)
    laserWall1.position.set(-6, 0.4, -4)
    laserWall1.rotation.y = -Math.PI * 0.22
    scene.add(laserWall1)

    const wallGeo2 = trackDisposable(new THREE.PlaneGeometry(42, 5.0, 36, 1))
    wallGeo2.translate(21, 2.5, 0)
    const laserWall2 = new THREE.Mesh(wallGeo2, laserShaderMat)
    laserWall2.position.set(-12, 0.3, 10)
    laserWall2.rotation.y = Math.PI * 0.38
    laserWall2.scale.set(0.85, 0.85, 1)
    scene.add(laserWall2)

    const wallGeo3 = trackDisposable(new THREE.PlaneGeometry(55, 4.5, 46, 1))
    wallGeo3.translate(27.5, 2.25, 0)
    const laserWall3 = new THREE.Mesh(wallGeo3, laserShaderMat)
    laserWall3.position.set(-20, 0.2, -18)
    laserWall3.rotation.y = -Math.PI * 0.05
    scene.add(laserWall3)

    // ─────────────────────────────────────────────────────────────────────────
    // 7. ASCENDING DATA PARTICLES & ATMOSPHERIC EMBERS
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
        color: new THREE.Color(initPhase.c2[0], initPhase.c2[1], initPhase.c2[2]),
        size: 0.18,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
      })
    )
    const particles = new THREE.Points(particleGeo, particleMat)
    particles.frustumCulled = false
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
    // 10. ANIMATION LOOP WITH SYNCHRONIZED BLUE-ANCHORED DYNAMIC COLOR SHIFTING
    // ─────────────────────────────────────────────────────────────────────────
    const clock = new THREE.Clock()
    let frameId = 0

    const baseCamX = 16
    const baseCamY = 18
    const baseCamZ = 28

    const rotationEuler = new THREE.Euler()
    const rotQuat = new THREE.Quaternion()
    const cubeScaleVec = new THREE.Vector3()
    const c1Color = new THREE.Color()
    const c2Color = new THREE.Color()
    const c3Color = new THREE.Color()
    const bgTintColor = new THREE.Color()
    const fillColor = new THREE.Color()
    const tempSatColor = new THREE.Color()

    const prefersReducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches

    const renderLoop = () => {
      frameId = requestAnimationFrame(renderLoop)

      if (!isVisible || !isTabActive || contextLost) {
        return
      }

      const elapsed = clock.getElapsedTime()
      const motionElapsed = prefersReducedMotion ? 0 : elapsed
      const colorElapsed =
        prefersReducedMotion || sharedStartMsRef.current === null
          ? 0
          : Math.max(0, (performance.now() - sharedStartMsRef.current) / 1000)

      const phase = getAmbientPhaseAt(colorElapsed)

      c1Color.setRGB(phase.c1[0], phase.c1[1], phase.c1[2])
      c2Color.setRGB(phase.c2[0], phase.c2[1], phase.c2[2])
      c3Color.setRGB(phase.c3[0], phase.c3[1], phase.c3[2])

      // Subtle atmospheric stage & fog tint harmonized with active phase
      bgTintColor.setRGB(
        STAGE_BASE_NORM[0] + phase.bgB[0] * 0.28,
        STAGE_BASE_NORM[1] + phase.bgB[1] * 0.28,
        STAGE_BASE_NORM[2] + phase.bgB[2] * 0.28
      )
      if (scene.background instanceof THREE.Color) {
        scene.background.copy(bgTintColor)
      }
      fog.color.copy(bgTintColor)

      // Synchronized multi-color scene lighting (blue-anchored -> mixed harmonious tones)
      ambientLight.color.setRGB(
        0.04 + phase.bgB[0] * 0.9,
        0.06 + phase.bgB[1] * 0.9,
        0.12 + phase.bgB[2] * 0.9
      )
      dirKey.color.copy(c1Color)
      fillColor.setRGB(
        0.06 + phase.glow[0] * 0.85,
        0.09 + phase.glow[1] * 0.85,
        0.16 + phase.glow[2] * 0.85
      )
      dirFill.color.copy(fillColor)

      coreLight1.color.copy(c1Color)
      coreLight2.color.copy(c2Color)
      coreLight3.color.copy(c1Color).lerp(c2Color, 0.35)
      coreLight4.color.copy(c2Color).lerp(c3Color, 0.22)

      // Tower emissive slits & rising embers
      towerOuterGlowMat.color.copy(c1Color)
      towerInnerGlowMat.color.copy(c2Color).lerp(c3Color, 0.38)
      particleMat.color.copy(c2Color).lerp(c3Color, 0.32)

      // Volumetric laser walls shader uniforms
      wallUniforms.uTime.value = motionElapsed
      wallUniforms.uColorDark.value.setRGB(
        phase.glow[0] * 1.45,
        phase.glow[1] * 1.45,
        phase.glow[2] * 1.45
      )
      wallUniforms.uColorMid.value.copy(c1Color).lerp(c2Color, 0.35)
      wallUniforms.uColorCore.value.copy(c3Color)

      // Normalized scroll progression
      const docHeight = Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight,
        window.innerHeight * 2
      ) - window.innerHeight
      const scrollRatio = Math.min(scrollY / Math.max(docHeight, 1), 1)

      // Smooth camera orbit + scroll panning (100% preserved motion)
      const targetX = baseCamX + mouseX + Math.sin(motionElapsed * 0.14) * 2.2 + scrollRatio * 8.0
      const targetY = baseCamY + mouseY - scrollRatio * 7.0 + Math.cos(motionElapsed * 0.12) * 1.5
      const targetZ = baseCamZ - scrollRatio * 6.0 + Math.sin(motionElapsed * 0.1) * 2.0

      camera.position.x += (targetX - camera.position.x) * 0.04
      camera.position.y += (targetY - camera.position.y) * 0.04
      camera.position.z += (targetZ - camera.position.z) * 0.04
      camera.lookAt(scrollRatio * 4.0, 1.8, -scrollRatio * 4.0)

      // Animate Orbiting Satellite Cubes + sync glowing cube colors
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
        if (meta.isGlow) {
          tempSatColor.copy(c1Color).lerp(c2Color, meta.accentMix)
          instancedSatelliteCubes.setColorAt(k, tempSatColor)
        }
      }
      instancedSatelliteCubes.instanceMatrix.needsUpdate = true
      if (instancedSatelliteCubes.instanceColor) instancedSatelliteCubes.instanceColor.needsUpdate = true

      // Core light pulsations
      coreLight1.intensity = 8.2 + Math.sin(motionElapsed * 3.2) * 2.8
      coreLight2.intensity = 5.6 + Math.cos(motionElapsed * 2.7) * 2.0
      coreLight3.intensity = 5.1 + Math.sin(motionElapsed * 2.3) * 1.8
      coreLight4.intensity = 4.6 + Math.cos(motionElapsed * 2.0) * 1.6

      // Pulsing Floor Pads synced to blended primary/accent phase colors
      for (let i = 0; i < tileCount; i++) {
        const pulse = 0.32 + (Math.sin(motionElapsed * 3.2 + i * 0.35) * 0.5 + 0.5) * 0.68
        const mixFactor = (i % 4) * 0.25
        colorDummy.copy(c1Color).lerp(c2Color, mixFactor).multiplyScalar(pulse)
        instancedFloorTiles.setColorAt(i, colorDummy)
      }
      if (instancedFloorTiles.instanceColor) instancedFloorTiles.instanceColor.needsUpdate = true

      // Upward drifting atmospheric particles
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
    let resizeTimeout: ReturnType<typeof setTimeout>
    const handleResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(() => {
        if (!container || contextLost) return
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
      clearTimeout(resizeTimeout)
      window.removeEventListener("mousemove", onPointerMove)
      window.removeEventListener("touchmove", onPointerMove)
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", handleResize)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      renderer.domElement.removeEventListener("webglcontextlost", onWebglContextLost)
      observer.disconnect()
      cancelAnimationFrame(frameId)

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

      disposables.forEach((item) => {
        try {
          item.dispose()
        } catch {
          // ignore already disposed
        }
      })
      disposables.length = 0

      try {
        renderer.dispose()
        renderer.forceContextLoss()
      } catch {
        // ignore disposal errors on lost context
      }

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement)
      }
    }
  }, [mode])

  // Render 2D Volumetric Atmosphere (also serves as graceful fallback if 3D WebGL is unavailable)
  if (mode !== "3d" || webgl3DFallback) {
    return (
      <div
        aria-hidden="true"
        className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden bg-[#020308]"
      >
        {/* CSS volumetric atmospheric fallback layer (visible immediately before WebGL initializes or if WebGL is unavailable) */}
        <div
          className="rushx-ambient-canvas absolute inset-0 w-full h-full transition-opacity duration-700"
          style={{ opacity: webgl2DReady ? 0.18 : 1 }}
        >
          <div className="rushx-ambient-glow absolute inset-0 w-full h-full" />
        </div>

        {/* GPU-accelerated Volumetric 2D RandomQbit-inspired Shader Canvas (zero brain/orb graphic) */}
        {mode !== "3d" && (
          <canvas
            ref={volumetric2DCanvasRef}
            className="absolute inset-0 h-full w-full block transition-opacity duration-700"
            style={{ opacity: webgl2DReady ? 1 : 0 }}
          />
        )}

        {/* Subtle radial edge vignette for crisp foreground contrast */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_36%,rgba(2,3,8,0.44)_100%)]" />

        {/* Neutral top horizon hairline */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      </div>
    )
  }

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden bg-[#020308]"
    >
      {/* Three.js Canvas Container */}
      <div ref={threeContainerRef} className="absolute inset-0 w-full h-full" />

      {/* Soft Ambient Vignette (Translucent edge-only softening) */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(2,3,8,0.52)_100%)] pointer-events-none" />

      {/* Neutral Top Cyber Horizon Line */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
    </div>
  )
}
