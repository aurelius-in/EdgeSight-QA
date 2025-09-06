import React from 'react'

export function NeonCharts({
  width,
  height,
  latencySeries,
  classCounts,
  mqttPerSec,
}: {
  width: number
  height: number
  latencySeries: number[]
  classCounts: Record<string, number>
  mqttPerSec: number
}) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null)

  React.useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    c.width = width
    c.height = height
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, width, height)

    // Background glow
    const bgGrad = ctx.createLinearGradient(0, 0, width, height)
    bgGrad.addColorStop(0, 'rgba(255,0,168,0.08)')
    bgGrad.addColorStop(1, 'rgba(0,216,255,0.08)')
    ctx.fillStyle = bgGrad
    ctx.fillRect(0, 0, width, height)

    // Latency line (top half)
    const pad = 12
    const chartW = width - pad * 2
    const chartH = height * 0.5 - pad * 2
    const series = latencySeries.slice(-120)
    const maxY = Math.max(100, ...series)
    ctx.strokeStyle = '#00ffc8'
    ctx.lineWidth = 2
    ctx.beginPath()
    series.forEach((v, i) => {
      const x = pad + (i / Math.max(1, series.length - 1)) * chartW
      const y = pad + (1 - Math.min(1, v / maxY)) * chartH
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()
    ctx.fillStyle = 'rgba(0,216,255,0.18)'
    ctx.fillRect(pad, pad + chartH + 6, chartW, 1)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = '12px sans-serif'
    ctx.fillText(`Latency (ms) • p95~${percentile(series, 0.95).toFixed(0)}`, pad, pad + 12)

    // Class bars (bottom-left)
    const keys = Object.keys(classCounts)
    const total = keys.reduce((a, k) => a + (classCounts[k] || 0), 0) || 1
    const barW = (chartW / Math.max(3, keys.length)) * 0.7
    keys.forEach((k, idx) => {
      const v = classCounts[k] || 0
      const h = (v / total) * (height * 0.35)
      const x = pad + idx * (chartW / Math.max(3, keys.length))
      const y = height - pad - h
      ctx.fillStyle = pickColor(k)
      ctx.shadowColor = pickColor(k)
      ctx.shadowBlur = 8
      ctx.fillRect(x, y, barW, h)
      ctx.shadowBlur = 0
      ctx.fillStyle = 'rgba(255,255,255,0.75)'
      ctx.fillText(k, x, height - pad + 12)
    })

    // MQTT per sec gauge (bottom-right)
    const gaugeCX = width - 80
    const gaugeCY = height - 60
    const r = 40
    const pct = Math.max(0, Math.min(1, mqttPerSec / 20))
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.arc(gaugeCX, gaugeCY, r, Math.PI, 2 * Math.PI)
    ctx.stroke()
    ctx.strokeStyle = '#1e90ff'
    ctx.shadowColor = '#1e90ff'
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.arc(gaugeCX, gaugeCY, r, Math.PI, Math.PI + Math.PI * pct)
    ctx.stroke()
    ctx.shadowBlur = 0
    ctx.fillStyle = 'rgba(255,255,255,0.85)'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(`${mqttPerSec.toFixed(1)} msg/s`, gaugeCX, gaugeCY + 6)
    ctx.textAlign = 'left'
  }, [width, height, latencySeries, classCounts, mqttPerSec])

  return <canvas ref={canvasRef} style={{ width, height }} />
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)))
  return sorted[idx]
}

function pickColor(key: string): string {
  const palette = ['#00ffc8', '#1e90ff', '#ff00a8', '#ffcc00', '#7fff00', '#ff6f61', '#00e5ff']
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0xffffffff
  const idx = Math.abs(hash) % palette.length
  return palette[idx]
}


