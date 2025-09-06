import React, { useEffect, useRef, useState } from 'react'
import { apiBase, startDemo, setThreshold as updateThreshold, setOpcuaEnabled, setDemoForce } from './api'
import { mockStream } from './mock'
const inferBase = (import.meta as any).env.VITE_INFERENCE_API_BASE || 'http://localhost:9003'

type EventMsg = { ts: string; frame_id: string; detections: any[]; corr_id?: string; trace_id?: string }

export default function App() {
  const [events, setEvents] = useState<EventMsg[]>([])
  const [threshold, setThreshold] = useState<number>(0.5)
  const [opcuaEnabled, setOpcua] = useState<boolean>(false)
  const [latencyP95, setLatencyP95] = useState<number>(0)
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [resultsCount, setResultsCount] = useState<number>(0)
  const [mqttCount, setMqttCount] = useState<number>(0)
  const [adapterUp, setAdapterUp] = useState<boolean>(false)
  const [offlineForce, setOffline] = useState<boolean>(true)
  const [opcuaCount, setOpcuaCount] = useState<number>(0)
  const [sseConnected, setSseConnected] = useState<boolean>(false)
  const [captureUp, setCaptureUp] = useState<boolean>(false)
  const [preprocessUp, setPreprocessUp] = useState<boolean>(false)
  const [inferenceUp, setInferenceUp] = useState<boolean>(false)
  const [captureFps, setCaptureFps] = useState<number>(0)
  const [captureDrops, setCaptureDrops] = useState<number>(0)
  const evtSourceRef = useRef<EventSource | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [frameUrl, setFrameUrl] = useState<string>('')
  const [classFilter, setClassFilter] = useState<string>('')
  const [legend, setLegend] = useState<Record<string, string>>({})
  const [avgPreMs, setAvgPreMs] = useState<number>(0)
  const [avgInferMs, setAvgInferMs] = useState<number>(0)
  const [showHero, setShowHero] = useState<boolean>(true)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'l') { setShowHero(false); startDemo() }
      if (e.key.toLowerCase() === 'o') { setOffline(true); setDemoForce(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const url = `${apiBase}/events`
    let es: EventSource | null = null
    let useMock = false
    try {
      es = new EventSource(url)
    } catch {
      useMock = true
    }
    let retryMs = 1000
    if (es) {
      es.onopen = () => setSseConnected(true)
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          setEvents((prev) => [data, ...prev].slice(0, 50))
        } catch {}
      }
      es.onerror = () => {
        es!.close()
        setSseConnected(false)
        setTimeout(() => {
          try { es = new EventSource(url); evtSourceRef.current = es } catch { useMock = true }
        }, retryMs)
        retryMs = Math.min(retryMs * 2, 15000)
      }
      evtSourceRef.current = es
    }

    // Fallback mock stream when backend is unreachable
    let mockTimer: number | undefined
    if (!es) useMock = true
    if (useMock) {
      setSseConnected(true)
      const gen = mockStream()
      const tick = () => {
        const next = gen.next().value
        setEvents((prev) => [next, ...prev].slice(0, 50))
        mockTimer = window.setTimeout(tick, 220)
      }
      tick()
    }
    return () => { if (es) es.close(); if (mockTimer) clearTimeout(mockTimer) }
  }, [])

  useEffect(() => {
    // initialize from inference config
    fetch(`${inferBase}/config`).then(r=>r.json()).then(cfg => {
      if (typeof cfg?.conf_threshold === 'number') setThreshold(cfg.conf_threshold)
      if (typeof cfg?.offline_force === 'boolean') setOffline(cfg.offline_force)
    }).catch(()=>{})
    const id = setInterval(() => {
      setFrameUrl(`${apiBase}/last_frame?nocache=${Date.now()}`)
      const d = new Date().toISOString().slice(0,10)
      fetch(`${apiBase}/governance/summary?date_from=${d}&date_to=${d}`)
        .then(r => r.json())
        .then(j => setLatencyP95(j?.latency_p95_ms ?? 0))
        .catch(() => {})
      fetch(`${apiBase}/config`).then(r=>r.json()).then(j=> setOpcua(!!j?.opcua_enabled)).catch(()=>{})
      fetch(`${apiBase}/healthz`).then(r => setAdapterUp(r.ok)).catch(()=> setAdapterUp(false))
      fetch('http://localhost:9001/healthz').then(r => setCaptureUp(r.ok)).catch(()=> setCaptureUp(false))
      fetch('http://localhost:9002/healthz').then(r => setPreprocessUp(r.ok)).catch(()=> setPreprocessUp(false))
      fetch(`${inferBase}/healthz`).then(r => setInferenceUp(r.ok)).catch(()=> setInferenceUp(false))
      fetch(`${apiBase}/metrics`).then(r=>r.text()).then(txt => {
        const m = /results_received_total\s+(\d+(?:\.\d+)?)/.exec(txt)
        if (m) setResultsCount(parseFloat(m[1]))
        const m2 = /mqtt_published_total\s+(\d+(?:\.\d+)?)/.exec(txt)
        if (m2) setMqttCount(parseFloat(m2[1]))
        const m3 = /opcua_published_total\s+(\d+(?:\.\d+)?)/.exec(txt)
        if (m3) setOpcuaCount(parseFloat(m3[1]))
      }).catch(()=>{})
      fetch('http://localhost:9001/metrics').then(r=>r.text()).then(txt => {
        const f = /capture_fps\s+(\d+(?:\.\d+)?)/.exec(txt)
        if (f) setCaptureFps(parseFloat(f[1]))
        const d = /capture_frames_dropped_total\s+(\d+(?:\.\d+)?)/.exec(txt)
        if (d) setCaptureDrops(parseFloat(d[1]))
      }).catch(()=>{})
      fetch('http://localhost:9002/metrics').then(r=>r.text()).then(txt => {
        // Parse preprocess_time_ms histogram avg from sum/count
        const sum = /preprocess_time_ms_sum\s+(\d+(?:\.\d+)?)/.exec(txt)
        const count = /preprocess_time_ms_count\s+(\d+(?:\.\d+)?)/.exec(txt)
        if (sum && count) {
          const avg = parseFloat(sum[1]) / Math.max(1, parseFloat(count[1]))
          setAvgPreMs(avg)
        }
      }).catch(()=>{})
      fetch(`${inferBase}/metrics`).then(r=>r.text()).then(txt => {
        const sum = /model_infer_ms_sum\s+(\d+(?:\.\d+)?)/.exec(txt)
        const count = /model_infer_ms_count\s+(\d+(?:\.\d+)?)/.exec(txt)
        if (sum && count) {
          const avg = parseFloat(sum[1]) / Math.max(1, parseFloat(count[1]))
          setAvgInferMs(avg)
        }
      }).catch(()=>{})
    }, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
    <div style={{ fontFamily: 'sans-serif', padding: 16 }}>
      {showHero && (
        <div className="panel glow holo-grid" style={{ padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={(import.meta as any).env.BASE_URL + 'media/esqa/esqa-poster.png'} alt="EdgeSight QA" width={80} height={80} style={{ borderRadius: 12 }} />
              <div>
                <div className="neon logo-gradient" style={{ fontSize: 28, fontWeight: 800, letterSpacing: 1 }}>EDGESIGHT QA</div>
                <div style={{ opacity: 0.85 }}>Real-time, on-device vision QA — online or offline.</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button className="btn btn-primary" onClick={() => { setShowHero(false); startDemo() }}>Enter Live</button>
              <button className="btn btn-link" onClick={() => { setShowHero(false); setOffline(true); setDemoForce(true) }}>Enter Offline</button>
            </div>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
        <img src={(import.meta as any).env.BASE_URL + 'media/esqa/esqa-poster.png'} alt="EdgeSight QA" width={56} height={56} style={{ borderRadius: 8 }} />
        <h2 className="neon logo-gradient" style={{ margin: 0 }}>EDGESIGHT QA</h2>
      </div>
      {!sseConnected && (
        <div style={{ background: '#fff3cd', color: '#7f6519', padding: 8, border: '1px solid #ffe69c', marginBottom: 12 }}>
          Live feed disconnected. Retrying...
        </div>
      )}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
        <Status label="Capture" up={captureUp} />
        <Status label="Preprocess" up={preprocessUp} />
        <Status label="Inference" up={inferenceUp} />
        <Status label="Adapter" up={adapterUp} />
        <span style={{ marginLeft: 8 }}>FPS: {captureFps.toFixed(1)} | Drops: {captureDrops}</span>
      </div>
      <div className="panel glow" style={{ display: 'flex', gap: 16, padding: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <button className="btn btn-primary" onClick={() => startDemo()}>Start</button>
        <span>p95: {latencyP95.toFixed(1)} ms • Pre: {avgPreMs.toFixed(2)} ms • Infer: {avgInferMs.toFixed(2)} ms</span>
        <span>Results: {resultsCount} | MQTT: {mqttCount} | OPC UA: {opcuaCount}</span>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
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
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
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
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          Offline Mode (synthetic data)
          <input
            type="checkbox"
            checked={offlineForce}
            onChange={(e) => {
              setOffline(e.target.checked)
              setDemoForce(e.target.checked).catch(()=> setErrorMsg('Failed to update offline mode'))
            }}
          />
        </label>
        <label>
          Class filter
          <input
            type="text"
            placeholder="comma separated (e.g. 0,1,defect)"
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            style={{ marginLeft: 6 }}
          />
        </label>
      </div>
      <h3 className="neon">Recent Events</h3>
      <div className="panel" style={{ position: 'relative', width: 640, height: 360, overflow: 'hidden' }}>
        <img src={frameUrl} alt="last frame" width={640} height={360} style={{ position: 'absolute', top: 0, left: 0 }} />
        <canvas ref={canvasRef} width={640} height={360} style={{ position: 'absolute', top: 0, left: 0 }} />
        {/* HUD scanline sweep */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,255,200,0) 0%, rgba(0,255,200,0.08) 50%, rgba(0,255,200,0) 100%)', mixBlendMode: 'screen', transform: 'translateY(-100%)', animation: 'sweep 3s linear infinite' }} />
      </div>
      <style>{`@keyframes sweep { 0% { transform: translateY(-100%) } 100% { transform: translateY(100%) } }`}</style>
      {events[0] && (
        <DrawBoxes canvasRef={canvasRef} detections={filterDetections(events[0].detections, classFilter)} legend={legend} setLegend={setLegend} />
      )}
      <Legend legend={legend} />
      <ul className="panel" style={{ padding: 12 }}>
        {events.map((ev, idx) => (
          <li key={idx}>
            {ev.ts} - {ev.frame_id} - dets: {ev.detections?.length ?? 0} {ev.corr_id ? `(corr ${ev.corr_id})` : ''}
            {ev.trace_id && (
              <>
                {' '}<a
                  href={`http://localhost:3000/explore?schemaVersion=1&panes=%7B%22traces%22%3A%7B%22datasource%22%3A%22Tempo%22%2C%22queries%22%3A%5B%7B%22query%22%3A%22{traceId%3D%5C%22${ev.trace_id}%5C%22}%22%7D%5D%7D%7D&orgId=1`}
                  target="_blank" rel="noreferrer"
                  style={{ marginLeft: 8, padding: '2px 6px', border: '1px solid #ccc', borderRadius: 4 }}
                >View trace</a>
              </>
            )}
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
    ctx.lineWidth = 2
    ctx.font = '12px sans-serif'
    detections?.forEach((d: any) => {
      const [x, y, w, h] = d.bbox || [0, 0, 0, 0]
      const color = pickColor(String(d.class_id))
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.strokeRect(x, y, w, h)
      const label = `${d.class_id ?? 'cls'}:${(d.score ?? 0).toFixed(2)}`
      ctx.fillText(label, x + 2, Math.max(10, y - 4))
    })
  }, [canvasRef, detections])
  return null
}

function Legend({ legend }: { legend: Record<string, string> }) {
  const entries = Object.entries(legend)
  if (!entries.length) return null
  return (
    <div className="panel" style={{ marginTop: 12, padding: 8, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      {entries.map(([k, v]) => (
        <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 999, background: v, boxShadow: `0 0 8px ${v}` }} />
          <span>{k}</span>
        </span>
      ))}
    </div>
  )
}

function pickColor(key: string): string {
  const palette = ['#00ffc8', '#1e90ff', '#ff00a8', '#ffcc00', '#7fff00', '#ff6f61', '#00e5ff']
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0xffffffff
  const idx = Math.abs(hash) % palette.length
  return palette[idx]
}

function filterDetections(dets: any[], filter: string): any[] {
  if (!filter) return dets
  const tokens = filter.split(',').map(s => s.trim()).filter(Boolean)
  if (!tokens.length) return dets
  return dets.filter(d => tokens.includes(String(d.class_id)) || (d.label && tokens.includes(String(d.label))))
}

function Status({ label, up }: { label: string, up: boolean }) {
  return (
    <span className={`chip ${up ? 'up' : 'down'}`}>
      <span className={`dot ${up ? 'up' : 'down'}`} />
      {label}
    </span>
  )
}


