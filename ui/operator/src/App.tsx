import React, { useEffect, useRef, useState } from 'react'
import { apiBase, startDemo, setThreshold as updateThreshold, setOpcuaEnabled } from './api'

type EventMsg = { ts: string; frame_id: string; detections: any[] }

export default function App() {
  const [events, setEvents] = useState<EventMsg[]>([])
  const [threshold, setThreshold] = useState<number>(0.5)
  const [opcuaEnabled, setOpcua] = useState<boolean>(false)
  const evtSourceRef = useRef<EventSource | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [frameUrl, setFrameUrl] = useState<string>('')

  useEffect(() => {
    const url = `${apiBase}/events`
    const es = new EventSource(url)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        setEvents((prev) => [data, ...prev].slice(0, 50))
      } catch {}
    }
    evtSourceRef.current = es
    return () => es.close()
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      setFrameUrl(`${apiBase}/last_frame?nocache=${Date.now()}`)
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ fontFamily: 'sans-serif', padding: 16 }}>
      <h2>EdgeSight QA - Operator</h2>
      <div style={{ display: 'flex', gap: 16 }}>
        <button onClick={() => startDemo()}>Start Demo</button>
        <label>
          Threshold: {threshold.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={threshold}
            onChange={(e) => {
              const v = parseFloat(e.target.value)
              setThreshold(v)
              updateThreshold(v)
            }}
          />
        </label>
        <label>
          OPC UA
          <input
            type="checkbox"
            checked={opcuaEnabled}
            onChange={(e) => {
              setOpcua(e.target.checked)
              setOpcuaEnabled(e.target.checked)
            }}
          />
        </label>
      </div>
      <h3>Recent Events</h3>
      <div style={{ position: 'relative', width: 640, height: 360 }}>
        <img src={frameUrl} alt="last frame" width={640} height={360} style={{ position: 'absolute', top: 0, left: 0 }} />
        <canvas ref={canvasRef} width={640} height={360} style={{ position: 'absolute', top: 0, left: 0 }} />
      </div>
      {events[0] && (
        <DrawBoxes canvasRef={canvasRef} detections={events[0].detections} />
      )}
      <ul>
        {events.map((ev, idx) => (
          <li key={idx}>
            {ev.ts} - {ev.frame_id} - dets: {ev.detections?.length ?? 0}
            {ev.detections?.map((d: any, j: number) => (
              <span key={j}> [{d.class_id ?? 'cls'}:{(d.score ?? 0).toFixed(2)}]</span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

function DrawBoxes({ canvasRef, detections }: { canvasRef: React.RefObject<HTMLCanvasElement>, detections: any[] }) {
  React.useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.strokeStyle = 'red'
    ctx.lineWidth = 2
    detections?.forEach((d: any) => {
      const [x, y, w, h] = d.bbox || [0, 0, 0, 0]
      ctx.strokeRect(x, y, w, h)
    })
  }, [canvasRef, detections])
  return null
}


