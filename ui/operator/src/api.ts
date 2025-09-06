export const apiBase = (import.meta as any).env.VITE_API_BASE || 'http://localhost:9004'
export const inferenceBase = (import.meta as any).env.VITE_INFER_BASE || 'http://localhost:9003'

export async function startDemo() {
  try {
    await fetch('http://localhost:9001/start', { method: 'POST' })
  } catch (e) {
    console.warn('Failed to start demo', e)
  }
}

export async function setThreshold(value: number) {
  try {
    const res = await fetch(`${inferenceBase}/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conf_threshold: value })
    })
    return await res.json()
  } catch (e) {
    console.warn('Failed to set threshold', e)
    return null
  }
}

export async function setOpcuaEnabled(enabled: boolean) {
  try {
    const res = await fetch(`${apiBase}/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opcua_enabled: enabled })
    })
    return await res.json()
  } catch (e) {
    console.warn('Failed to set OPC UA', e)
    return null
  }
}

export async function setDemoForce(enabled: boolean) {
  try {
    const res = await fetch(`${inferenceBase}/config`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demo_force: enabled })
    })
    return await res.json()
  } catch (e) {
    console.warn('Failed to set demo_force', e)
    return null
  }
}


