import React, { useEffect, useRef, useState } from 'react'
import { apiBase, startDemo, setThreshold } from './api'

type EventMsg = { ts: string; frame_id: string; detections: any[] }

export default function App() {
  const [events, setEvents] = useState<EventMsg[]>([])
  const [threshold, setThreshold] = useState<number>(0.5)
  const evtSourceRef = useRef<EventSource | null>(null)

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
              setThreshold(v)
            }}
          />
        </label>
      </div>
      <h3>Recent Events</h3>
      <ul>
        {events.map((ev, idx) => (
          <li key={idx}>{ev.ts} - {ev.frame_id} - dets: {ev.detections?.length ?? 0}</li>
        ))}
      </ul>
    </div>
  )
}


