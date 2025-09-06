type Detection = { bbox: [number, number, number, number]; score: number; class_id: string; label?: string }

export type MockEvent = { ts: string; frame_id: string; detections: Detection[]; latency_ms?: number; corr_id?: string; trace_id?: string }

class PRNG {
  private state: number
  constructor(seed = 123456789) { this.state = seed >>> 0 }
  next() { this.state = (1664525 * this.state + 1013904223) >>> 0; return this.state / 0xffffffff }
  range(min: number, max: number) { return min + (max - min) * this.next() }
  int(min: number, max: number) { return Math.floor(this.range(min, max + 1)) }
}

const classes = [
  { id: 'defect', label: 'Defect' },
  { id: 'ok', label: 'OK' },
  { id: 'warn', label: 'Warn' },
]

export function* mockStream(seed = 42): Generator<MockEvent> {
  const rnd = new PRNG(seed)
  let fid = 1
  while (true) {
    const now = new Date().toISOString()
    const detCount = rnd.next() < 0.2 ? 2 : rnd.next() < 0.6 ? 1 : 0
    const detections: Detection[] = []
    for (let i = 0; i < detCount; i++) {
      const cls = classes[rnd.int(0, classes.length - 1)]
      const w = rnd.range(40, 160)
      const h = rnd.range(30, 140)
      const x = rnd.range(20, 640 - 20 - w)
      const y = rnd.range(20, 360 - 20 - h)
      detections.push({ bbox: [x, y, w, h] as [number, number, number, number], score: rnd.range(0.55, 0.98), class_id: cls.id, label: cls.label })
    }
    const latency = rnd.range(45, 120)
    yield { ts: now, frame_id: String(fid++), detections, latency_ms: latency }
  }
}


