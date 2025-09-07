import { useEffect, useRef } from 'react'
import '../styles/theme.css'

const VIDEO = '/media/offline/can_vid.mp4'
const POSTER = '/media/offline/can_poster.webp'

export default function OfflineStage({ onPlay, onEnded }: { onPlay?: () => void; onEnded?: () => void }) {
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
    const draw = () => {
      ctx.clearRect(0, 0, c.width, c.height)
      const w = c.width * 0.18, h = c.height * 0.28
      const x = c.width * 0.52, y = c.height * 0.36
      ctx.lineWidth = 2.5
      ctx.strokeStyle = '#ff315f'
      ctx.shadowColor = 'rgba(255,0,168,.35)'
      ctx.shadowBlur = 8
      ctx.strokeRect(x, y, w, h)
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [])

  const playFromStart = () => {
    if (!videoRef.current) return
    videoRef.current.currentTime = 0
    videoRef.current.play()
    onPlay?.()
  }

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
          onEnded={onEnded}
        />
        <canvas ref={overlayRef} className="stage-overlay" />
      </div>
      <button className="btn-primary" onClick={playFromStart}>Play offline clip</button>
    </div>
  )
}


