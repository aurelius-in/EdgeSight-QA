import React, { useEffect, useRef, useState } from 'react'
import { apiBase, startDemo, setThreshold as updateThreshold, setOpcuaEnabled, setDemoForce } from './api'
import { mockStream } from './mock'
import { NeonCharts } from './visuals'
import OfflineStage, { OfflineStageHandle } from './components/OfflineStage'
import './styles/theme.css'
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
  const offlineRef = useRef<boolean>(true)
  const [opcuaCount, setOpcuaCount] = useState<number>(0)
  const [sseConnected, setSseConnected] = useState<boolean>(false)
  const [captureUp, setCaptureUp] = useState<boolean>(false)
  const [preprocessUp, setPreprocessUp] = useState<boolean>(false)
  const [inferenceUp, setInferenceUp] = useState<boolean>(false)
  const [captureFps, setCaptureFps] = useState<number>(0)
  const [captureDrops, setCaptureDrops] = useState<number>(0)
  const evtSourceRef = useRef<EventSource | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [frameUrl, setFrameUrl] = useState<string>('')
  const [classFilter, setClassFilter] = useState<string>('')
  const [legend, setLegend] = useState<Record<string, string>>({})
  const [avgPreMs, setAvgPreMs] = useState<number>(0)
  const [avgInferMs, setAvgInferMs] = useState<number>(0)
  const [showHero, setShowHero] = useState<boolean>(true)
  const [latSeries, setLatSeries] = useState<number[]>([])
  const [classCounts, setClassCounts] = useState<Record<string, number>>({})
  const [mqttRate, setMqttRate] = useState<number>(0)
  const prevMqttCountRef = useRef<number>(0)
  // State to drive animated red rectangle
  const animRef = useRef<number | null>(null)
  const animStateRef = useRef<{ x: number; y: number; w: number; h: number; t: number }>({
    x: 0, y: 0, w: 0, h: 0, t: 0
  })
  const extrasRef = useRef<Array<{ x: number; y: number; w: number; h: number; vx: number; vy: number; end: number; stepMs: number; lastStep: number }>>([])
  const offlineStageRef = useRef<OfflineStageHandle | null>(null)

  function restartOverlayAnimation() {
    // Reset main overlay animation state and transient boxes
    animStateRef.current.t = 0
    animStateRef.current.x = 0
    animStateRef.current.y = 0
    animStateRef.current.w = 0
    animStateRef.current.h = 0
    extrasRef.current = []
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key.toLowerCase() === 'l') { setShowHero(false); startDemo() }
      if (e.key.toLowerCase() === 'o') { setOffline(true); setDemoForce(true) }
      if (e.key.toLowerCase() === 'p') { document.body.classList.toggle('theme-alt') }
      if (e.key.toLowerCase() === 'c') { document.body.classList.toggle('compact') }
      if (e.key.toLowerCase() === 'd') {
        document.body.classList.remove('theme-alt')
        document.body.classList.toggle('theme-light')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Animated red rectangle overlay (scripted path per spec)
  useEffect(() => {
    const canvas = animCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const step = (ts: number) => {
      if (!canvas || !ctx) return
      const { width, height } = canvas
      if (width === 0 || height === 0) {
        animRef.current = requestAnimationFrame(step)
        return
      }
      const s = animStateRef.current
      // t in seconds
      s.t += 1 / 60

      // Inches to px conversion (approx)
      const inch = 96
      const t = s.t // seconds elapsed
      const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
      const lerp = (a: number, b: number, u: number) => a + (b - a) * u

      // Positions per spec (total 5s):
      // pos0 (0s): full video size
      const pos0 = {
        x: 0,
        y: 0,
        w: width,
        h: height,
      }
      // pos1 (1s): far left at 50% of original height, width same as video
      const pos1 = {
        x: 0,
        y: (height - height * 0.5) / 2,
        w: width,
        h: height * 0.5,
      }
      // pos2 (2.5s): dart across back and forth – we will oscillate x
      // keep size same as pos1, y centered as in pos1
      const osc = (u: number) => (Math.sin(u * Math.PI * 6) + 1) / 2 // 3 full back-forth cycles over phase
      const pos2X = osc(clamp((t - 1) / 1.5, 0, 1)) * (width - pos1.w)
      const pos2 = { x: pos2X, y: pos1.y, w: pos1.w, h: pos1.h }
      // pos3 (4s): 1/2" then 1/4" square, 0.5" from bottom, 3" from left
      const halfIn = 0.5 * inch
      const quarterIn = 0.25 * inch
      const pos3a = { x: 3 * inch, y: height - halfIn - halfIn, w: halfIn, h: halfIn }
      const pos3b = { x: 3 * inch, y: height - halfIn - quarterIn, w: quarterIn, h: quarterIn }
      // pos4 (5s): move to center then end near bottom-center slightly smaller and lower
      const targetSize = 0.65 * inch
      const centerX = (width - targetSize) / 2
      const centerY = (height - targetSize) / 2
      const endX = centerX - 0.25 * inch // slightly left of center
      const endY = height - 0.75 * inch - targetSize // a bit lower (closer to bottom)
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
        // darting across
        curX = pos2.x
        curY = pos2.y
        curW = pos2.w
        curH = pos2.h
      } else if (t <= 4) {
        // shrink from 1/2" to 1/4" at the specified bottom-left offset
        const u = (t - 2.5) / 1.5
        curX = lerp(pos3a.x, pos3b.x, u)
        curY = lerp(pos3a.y, pos3b.y, u)
        curW = lerp(pos3a.w, pos3b.w, u)
        curH = lerp(pos3a.h, pos3b.h, u)
      } else {
        // move to center and then back 2" left of center, size 0.75"
        const u = clamp((t - 4) / 1, 0, 1)
        curX = lerp(pos4a.x, pos4b.x, u)
        curY = lerp(pos4a.y, pos4b.y, u)
        curW = lerp(pos4a.w, pos4b.w, u)
        curH = lerp(pos4a.h, pos4b.h, u)
      }

      // Clear and draw
      ctx.clearRect(0, 0, width, height)
      ctx.lineWidth = 3
      ctx.strokeStyle = '#ff4d4f'
      ctx.shadowColor = 'rgba(255,77,79,0.6)'
      ctx.shadowBlur = 10
      ctx.strokeRect(curX, curY, curW, curH)
      ctx.shadowBlur = 0

      // Auxiliary detection boxes: choppy, erratic movement and iterative disappearance by 5s
      if (t < 0.2 && extrasRef.current.length === 0) {
        const count = 9
        const arr: Array<{ x: number; y: number; w: number; h: number; vx: number; vy: number; end: number; stepMs: number; lastStep: number }> = []
        for (let i = 0; i < count; i++) {
          const sz = (0.15 + Math.random() * 0.35) * inch
          arr.push({
            x: Math.random() * Math.max(1, width - sz),
            y: Math.random() * Math.max(1, height - sz),
            w: sz,
            h: sz * (0.7 + Math.random() * 0.6),
            vx: (Math.random() * 2 - 1) * (width * 0.01),
            vy: (Math.random() * 2 - 1) * (height * 0.01),
            end: 2.6 + Math.random() * 2.0, // all gone by ~4.6s
            stepMs: 60 + Math.random() * 80, // move in 60–140ms steps
            lastStep: 0,
          })
        }
        extrasRef.current = arr
      }

      const extras = extrasRef.current
      for (let i = 0; i < extras.length; i++) {
        const ex = extras[i]
        if (t > ex.end) continue // disappear abruptly after end time
        // only update on step interval for choppy motion
        const ms = t * 1000
        if (ms - ex.lastStep >= ex.stepMs) {
          ex.lastStep = ms
          // quantized step with erratic direction flips
          if (Math.random() < 0.15) ex.vx = -ex.vx
          if (Math.random() < 0.15) ex.vy = -ex.vy
          ex.x = Math.round(ex.x + ex.vx)
          ex.y = Math.round(ex.y + ex.vy)
          // occasional size jitter
          if (Math.random() < 0.1) {
            const dw = (Math.random() * 2 - 1) * 4
            const dh = (Math.random() * 2 - 1) * 4
            ex.w = Math.max(8, ex.w + dw)
            ex.h = Math.max(8, ex.h + dh)
          }
          // bounce on borders
          if (ex.x < 0) { ex.x = 0; ex.vx = Math.abs(ex.vx) }
          if (ex.y < 0) { ex.y = 0; ex.vy = Math.abs(ex.vy) }
          if (ex.x + ex.w > width) { ex.x = width - ex.w; ex.vx = -Math.abs(ex.vx) }
          if (ex.y + ex.h > height) { ex.y = height - ex.h; ex.vy = -Math.abs(ex.vy) }
        }
        ctx.save()
        ctx.lineWidth = 2
        ctx.strokeStyle = `rgba(255,77,79,1)`
        ctx.shadowColor = `rgba(255,77,79,0.6)`
        ctx.shadowBlur = 8
        ctx.strokeRect(ex.x, ex.y, ex.w, ex.h)
        ctx.restore()
      }

      animRef.current = requestAnimationFrame(step)
    }
    animRef.current = requestAnimationFrame(step)
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current) }
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
      if (typeof cfg?.offline_force === 'boolean') { setOffline(cfg.offline_force); offlineRef.current = cfg.offline_force }
    }).catch(()=>{})
    const id = setInterval(() => {
      setFrameUrl(`${apiBase}/last_frame?nocache=${Date.now()}`)

      if (offlineRef.current) {
        // Synthesize telemetry when offline
        setAdapterUp(true)
        setCaptureUp(true)
        setPreprocessUp(true)
        setInferenceUp(true)
        setOpcua(true)

        setLatencyP95(prev => {
          const base = 45 + Math.sin(Date.now() / 1400) * 12
          const jitter = (Math.random() - 0.5) * 3
          return Math.max(12, base + jitter)
        })

        setAvgPreMs(prev => {
          const base = 6 + Math.sin(Date.now() / 900) * 1.5
          const jitter = (Math.random() - 0.5) * 0.6
          return Math.max(2, base + jitter)
        })

        setAvgInferMs(prev => {
          const base = 22 + Math.cos(Date.now() / 1100) * 3.5
          const jitter = (Math.random() - 0.5) * 1.2
          return Math.max(8, base + jitter)
        })

        setCaptureFps(prev => {
          const base = 9 + Math.sin(Date.now() / 700) * 1.2
          const jitter = (Math.random() - 0.5) * 0.4
          return Math.max(7, base + jitter)
        })

        setCaptureDrops(prev => Math.max(0, prev + (Math.random() < 0.12 ? 1 : 0)))
        // Simulate active flow: bursts and lulls
        const burst = Math.random() < 0.3
        const resInc = burst ? 8 + Math.floor(Math.random() * 10) : 2 + Math.floor(Math.random() * 4)
        const mqttInc = burst ? 8 + Math.floor(Math.random() * 12) : 2 + Math.floor(Math.random() * 5)
        const opcInc = burst ? 2 + Math.floor(Math.random() * 4) : Math.floor(Math.random() * 2)
        setResultsCount(prev => prev + resInc)
        setMqttCount(prev => prev + mqttInc)
        setOpcuaCount(prev => prev + opcInc)

        // Update latency series for chart
        setLatSeries(prev => {
          const next = 45 + Math.sin(Date.now() / 1200) * 10 + (Math.random() - 0.5) * 3
          return [...prev.slice(-119), next]
        })
      } else {
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
          const e2sum = /e2e_latency_ms_sum\s+(\d+(?:\.\d+)?)/.exec(txt)
          const e2cnt = /e2e_latency_ms_count\s+(\d+(?:\.\d+)?)/.exec(txt)
          if (e2sum && e2cnt) setLatSeries(prev => [...prev.slice(-119), parseFloat(e2sum[1]) / Math.max(1, parseFloat(e2cnt[1]))])
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
      }
      // Update class mix and mqtt rate from last event snapshot
      const cur = events[0]
      if (cur) {
        const nextCounts = { ...classCounts }
        cur.detections?.forEach((d: any) => { const k = String(d.class_id || d.label || 'cls'); nextCounts[k] = (nextCounts[k] || 0) + 1 })
        setClassCounts(nextCounts)
      }
      // mqttRate calculated in effect on mqttCount changes
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // Update mqttRate whenever mqttCount changes (works offline and online)
  useEffect(() => {
    const delta = Math.max(0, mqttCount - prevMqttCountRef.current)
    setMqttRate(delta)
    prevMqttCountRef.current = mqttCount
  }, [mqttCount])

  // Keep offlineRef in sync when toggled by keyboard 'O'
  useEffect(() => { offlineRef.current = offlineForce }, [offlineForce])

  return (
    <>
    <div style={{ fontFamily: 'sans-serif' }}>
      <div className="app-header">
        <div className="brand">
          <img src={(import.meta as any).env.BASE_URL + 'media/esqa/esqa-banner.png'} alt="EdgeSight QA" style={{ width: 400, height: 120, objectFit: 'contain' }} />
          <div className="tagline neon" style={{ marginLeft: 28, fontFamily: 'Orbitron, system-ui, Segoe UI, Roboto, Inter, sans-serif', fontWeight: 700 }}>
            Real-time, on-device vision QA
          </div>
        </div>
        <div className="live-indicator"><span className="pulse-dot" /> Live feed connected</div>
      </div>

      <header className="topbar" style={{ background: 'linear-gradient(90deg, #000 0%, rgba(0,0,0,0.9) 8%, rgba(10,15,20,0.55) 40%, rgba(10,15,20,0.0) 100%)' }}>
        <div className="controls">
          <button className="btn-primary" style={{ marginTop: 0 }} onClick={() => {
            restartOverlayAnimation()
            if (offlineForce) {
              offlineStageRef.current?.play()
            } else {
              startDemo()
            }
          }}>Detect</button>
          <div className="control">p95: {latencyP95.toFixed(1)} ms</div>
          <div className="control">Pre: {avgPreMs.toFixed(2)} ms • Infer: {avgInferMs.toFixed(2)} ms</div>
          <div className="control">FPS: {captureFps.toFixed(1)} • Drops: {captureDrops}</div>
          <div className="control">Results: {resultsCount}</div>
          <div className="control">MQTT: {mqttCount}</div>
          <label className="control" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            Threshold
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
              style={{ width: 140 }}
            />
            <span>{threshold.toFixed(2)}</span>
          </label>
          <label className="control" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              checked={opcuaEnabled}
              onChange={(e) => {
                setOpcua(e.target.checked)
                setOpcuaEnabled(e.target.checked).catch(() => setErrorMsg('Failed to update OPC UA'))
              }}
            /> OPC UA
          </label>
          {/* Palette toggle removed */}
        </div>
      </header>
      {/* Live feed banner removed */}
      {offlineForce ? (
        <div className="stage">
          <div className="stage-row">
            <div className="stage-left">
              <OfflineStage ref={offlineStageRef} />
            </div>
            <div className="stage-right">
              <div className="panel" style={{ padding: 12, marginTop: 0 }}>
                <h3 className="neon" style={{ marginTop: 0 }}>Pipeline Telemetry</h3>
                <NeonCharts width={640} height={220} latencySeries={latSeries} classCounts={classCounts} mqttPerSec={mqttRate} />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="stage">
          <div className="stage-row">
            <div className="stage-left">
              <div className="video-wrap">
                <img
                  src={frameUrl}
                  alt="last frame"
                  className="stage-video"
                  onError={(e) => {
                    const base = (import.meta as any).env.BASE_URL || '/'
                    ;(e.currentTarget as HTMLImageElement).src = base + 'media/esqa/esqa-poster.png'
                  }}
                />
                <canvas ref={canvasRef} className="stage-overlay" />
                <canvas ref={animCanvasRef} className="stage-overlay" />
              </div>
            </div>
            <div className="stage-right">
              <div className="panel" style={{ padding: 12, marginTop: 0 }}>
                <h3 className="neon" style={{ marginTop: 0 }}>Pipeline Telemetry</h3>
                <NeonCharts width={640} height={220} latencySeries={latSeries} classCounts={classCounts} mqttPerSec={mqttRate} />
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Metrics grid below video removed */}
      <h3 className="neon" style={{ padding: '0 28px' }}>Recent Events</h3>
      <div className="panel" style={{ margin: '0 28px', overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px' }}>
          <span className={`tag ${classFilter ? 'active' : ''}`} onClick={() => setClassFilter('')}>All</span>
          <span className="tag" style={{ marginLeft: 8 }} onClick={() => setClassFilter('defect')}>Defect</span>
          <span className="tag" style={{ marginLeft: 8 }} onClick={() => setClassFilter('ok')}>OK</span>
        </div>
        <ul style={{ listStyle: 'none', padding: 12, margin: 0 }}>
          {events.map((ev, idx) => (
            <li key={idx} className="rise">
              {ev.ts} - {ev.frame_id} - dets: {ev.detections?.length ?? 0} {ev.corr_id ? `(corr ${ev.corr_id})` : ''}
            </li>
          ))}
        </ul>
      </div>
      <style>{`@keyframes sweep { 0% { transform: translateY(-100%) } 100% { transform: translateY(100%) } }`}</style>
      {events[0] && (
        <DrawBoxes canvasRef={canvasRef} detections={filterDetections(events[0].detections, classFilter)} legend={legend} setLegend={setLegend} />
      )}
      <Legend legend={legend} />
      {/* Pipeline Telemetry moved to the right of the video */}
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


