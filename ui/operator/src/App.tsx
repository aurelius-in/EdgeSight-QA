import React, { useEffect, useRef, useState } from 'react'
import { apiBase, startDemo, setThreshold as updateThreshold, setOpcuaEnabled, setDemoForce } from './api'

type EventMsg = { ts: string; frame_id: string; detections: any[] }

export default function App() {
  const [events, setEvents] = useState<EventMsg[]>([])
  const [threshold, setThreshold] = useState<number>(0.5)
  const [opcuaEnabled, setOpcua] = useState<boolean>(false)
  const [latencyP95, setLatencyP95] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [resultsCount, setResultsCount] = useState<number>(0)
  const [mqttCount, setMqttCount] = useState<number>(0)
  const [adapterUp, setAdapterUp] = useState<boolean>(false)
  const [demoForce, setDemo] = useState<boolean>(true)
  const [opcuaCount, setOpcuaCount] = useState<number>(0)
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
      const d = new Date().toISOString().slice(0,10)
      fetch(`${apiBase}/governance/summary?date_from=${d}&date_to=${d}`)
        .then(r => r.json())
        .then(j => setLatencyP95(j?.latency_p95_ms ?? 0))
        .catch(() => {})
      fetch(`${apiBase}/config`).then(r=>r.json()).then(j=> setOpcua(!!j?.opcua_enabled)).catch(()=>{})
      fetch(`${apiBase}/healthz`).then(r => setAdapterUp(r.ok)).catch(()=> setAdapterUp(false))
      fetch(`${apiBase}/metrics`).then(r=>r.text()).then(txt => {
        const m = /results_received_total\s+(\d+(?:\.\d+)?)/.exec(txt)
        if (m) setResultsCount(parseFloat(m[1]))
        const m2 = /mqtt_published_total\s+(\d+(?:\.\d+)?)/.exec(txt)
        if (m2) setMqttCount(parseFloat(m2[1]))
        const m3 = /opcua_published_total\s+(\d+(?:\.\d+)?)/.exec(txt)
        if (m3) setOpcuaCount(parseFloat(m3[1]))
      }).catch(()=>{})
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
    <div style={{ fontFamily: 'sans-serif', padding: 16 }}>
      <h2>EdgeSight QA - Operator</h2>
      <div style={{ display: 'flex', gap: 16 }}>
        <button onClick={() => startDemo()}>Start Demo</button>
        <span>p95: {latencyP95.toFixed(1)} ms</span>
        <span>Adapter: {adapterUp ? 'up' : 'down'}</span>
        <span>Results: {resultsCount} | MQTT: {mqttCount} | OPC UA: {opcuaCount}</span>
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
              setOpcuaEnabled(e.target.checked).catch(() => setErrorMsg('Failed to update OPC UA'))
            }}
          />
        </label>
        <label>
          Demo Force
          <input
            type="checkbox"
            checked={demoForce}
            onChange={(e) => {
              setDemo(e.target.checked)
              setDemoForce(e.target.checked).catch(()=> setErrorMsg('Failed to update demo mode'))
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
    {errorMsg && (
      <div style={{ position: 'fixed', bottom: 16, right: 16, background: '#f56565', color: 'white', padding: 8 }}>
        {errorMsg}
        <button onClick={() => setErrorMsg('')} style={{ marginLeft: 8 }}>x</button>
      </div>
    )}
    </>
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
    ctx.fillStyle = 'rgba(255,0,0,0.8)'
    ctx.font = '12px sans-serif'
    detections?.forEach((d: any) => {
      const [x, y, w, h] = d.bbox || [0, 0, 0, 0]
      ctx.strokeRect(x, y, w, h)
      const label = `${d.class_id ?? 'cls'}:${(d.score ?? 0).toFixed(2)}`
      ctx.fillText(label, x + 2, Math.max(10, y - 4))
    })
  }, [canvasRef, detections])
  return null
}


