import { useEffect, useRef, forwardRef, useImperativeHandle } from 'react'
import '../styles/theme.css'

const VIDEO = '/media/offline/can_vid.mp4'
const POSTER = '/media/offline/can_poster.webp'

type OfflineStageProps = { onPlay?: () => void; onEnded?: () => void }
export type OfflineStageHandle = { play: () => void }

const OfflineStage = forwardRef<OfflineStageHandle, OfflineStageProps>(function OfflineStage({ onPlay, onEnded }, ref) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const resize = () => {
      const v = videoRef.current, c = overlayRef.current
      if (!v || !c) return
      const r = v.getBoundingClientRect()
      c.width = Math.floor(r.width)
      c.height = Math.floor(r.height)
    }
    resize()
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])

  useEffect(() => {
    const c = overlayRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    let raf = 0
    const startMs = performance.now()
    const inch = 96
    // Transient extra boxes
    type Extra = { x: number; y: number; w: number; h: number; vx: number; vy: number; end: number; stepMs: number; lastStep: number }
    const extras: Extra[] = []
    for (let i = 0; i < 7; i++) {
      const sz = (0.15 + Math.random() * 0.35) * inch
      extras.push({
        x: Math.random() * Math.max(1, c.width - sz),
        y: Math.random() * Math.max(1, c.height - sz),
        w: sz,
        h: sz * (0.7 + Math.random() * 0.6),
        vx: (Math.random() * 2 - 1) * (c.width * 0.01),
        vy: (Math.random() * 2 - 1) * (c.height * 0.01),
        end: 2.6 + Math.random() * 2.0,
        stepMs: 60 + Math.random() * 80,
        lastStep: 0,
      })
    }

    const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
    const lerp = (a: number, b: number, u: number) => a + (b - a) * u

    const draw = () => {
      const now = performance.now()
      const elapsed = (now - startMs) / 1000 // seconds
      const t = Math.min(5, elapsed)
      ctx.clearRect(0, 0, c.width, c.height)

      // Main box positions per spec
      const pos0 = { x: 0, y: 0, w: c.width, h: c.height }
      const pos1 = { x: 0, y: (c.height - c.height * 0.5) / 2, w: c.width, h: c.height * 0.5 }
      const osc = (u: number) => (Math.sin(u * Math.PI * 6) + 1) / 2
      const pos2X = osc(clamp((t - 1) / 1.5, 0, 1)) * (c.width - pos1.w)
      const pos2 = { x: pos2X, y: pos1.y, w: pos1.w, h: pos1.h }
      const halfIn = 0.5 * inch
      const quarterIn = 0.25 * inch
      const pos3a = { x: 3 * inch, y: c.height - halfIn - halfIn, w: halfIn, h: halfIn }
      const pos3b = { x: 3 * inch, y: c.height - halfIn - quarterIn, w: quarterIn, h: quarterIn }
      const targetSize = 0.65 * inch
      const centerX = (c.width - targetSize) / 2
      const centerY = (c.height - targetSize) / 2
      const endX = centerX - 0.25 * inch
      const endY = c.height - 0.75 * inch - targetSize
      const pos4a = { x: centerX, y: centerY, w: targetSize, h: targetSize }
      const pos4b = { x: endX, y: endY, w: targetSize, h: targetSize }

      let curX = 0, curY = 0, curW = 0, curH = 0
      if (t <= 1) {
        const u = t / 1
        curX = lerp(pos0.x, pos1.x, u)
        curY = lerp(pos0.y, pos1.y, u)
        curW = lerp(pos0.w, pos1.w, u)
        curH = lerp(pos0.h, pos1.h, u)
      } else if (t <= 2.5) {
        curX = pos2.x; curY = pos2.y; curW = pos2.w; curH = pos2.h
      } else if (t <= 4) {
        const u = (t - 2.5) / 1.5
        curX = lerp(pos3a.x, pos3b.x, u)
        curY = lerp(pos3a.y, pos3b.y, u)
        curW = lerp(pos3a.w, pos3b.w, u)
        curH = lerp(pos3a.h, pos3b.h, u)
      } else {
        const u = clamp((t - 4) / 1, 0, 1)
        curX = lerp(pos4a.x, pos4b.x, u)
        curY = lerp(pos4a.y, pos4b.y, u)
        curW = lerp(pos4a.w, pos4b.w, u)
        curH = lerp(pos4a.h, pos4b.h, u)
      }

      // Draw main box
      ctx.lineWidth = 3
      ctx.strokeStyle = '#ff315f'
      ctx.shadowColor = 'rgba(255,0,168,.35)'
      ctx.shadowBlur = 10
      ctx.strokeRect(curX, curY, curW, curH)
      ctx.shadowBlur = 0

      // Update/draw extras with choppy steps and abrupt disappearance
      for (let i = 0; i < extras.length; i++) {
        const ex = extras[i]
        if (t > ex.end) continue
        const ms = t * 1000
        if (ms - ex.lastStep >= ex.stepMs) {
          ex.lastStep = ms
          if (Math.random() < 0.15) ex.vx = -ex.vx
          if (Math.random() < 0.15) ex.vy = -ex.vy
          ex.x = Math.round(ex.x + ex.vx)
          ex.y = Math.round(ex.y + ex.vy)
          if (Math.random() < 0.1) {
            const dw = (Math.random() * 2 - 1) * 4
            const dh = (Math.random() * 2 - 1) * 4
            ex.w = Math.max(8, ex.w + dw)
            ex.h = Math.max(8, ex.h + dh)
          }
          if (ex.x < 0) { ex.x = 0; ex.vx = Math.abs(ex.vx) }
          if (ex.y < 0) { ex.y = 0; ex.vy = Math.abs(ex.vy) }
          if (ex.x + ex.w > c.width) { ex.x = c.width - ex.w; ex.vx = -Math.abs(ex.vx) }
          if (ex.y + ex.h > c.height) { ex.y = c.height - ex.h; ex.vy = -Math.abs(ex.vy) }
        }
        ctx.save()
        ctx.lineWidth = 2
        ctx.strokeStyle = `rgba(255,77,79,1)`
        ctx.shadowColor = `rgba(255,77,79,0.6)`
        ctx.shadowBlur = 8
        ctx.strokeRect(ex.x, ex.y, ex.w, ex.h)
        ctx.restore()
      }

      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const playFromStart = () => {
    if (!videoRef.current || !overlayRef.current) return
    // restart video
    videoRef.current.currentTime = 0
    videoRef.current.play()
    // restart overlay animation by resetting effect state
    const c = overlayRef.current
    const ctx = c.getContext('2d')!
    // Simple clear triggers draw loop to restart based on current time baseline
    ctx.clearRect(0, 0, c.width, c.height)
    onPlay?.()
  }

  useImperativeHandle(ref, () => ({
    play: playFromStart
  }), [])

  return (
    <div className="stage">
      <div className="video-wrap">
        <video
          ref={videoRef}
          className="stage-video"
          src={VIDEO}
          poster={POSTER}
          preload="auto"
          playsInline
          muted
          autoPlay
          onEnded={onEnded}
        />
        <canvas ref={overlayRef} className="stage-overlay" />
      </div>
    </div>
  )
})

export default OfflineStage


