export const apiBase = (import.meta as any).env.VITE_API_BASE || 'http://localhost:9004'

export async function startDemo() {
  try {
    await fetch('http://localhost:9001/start', { method: 'POST' })
  } catch (e) {
    console.warn('Failed to start demo', e)
  }
}


