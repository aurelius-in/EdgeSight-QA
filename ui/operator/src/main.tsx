import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

function Splash({ onDone }: { onDone: () => void }) {
  React.useEffect(() => {
    const id = setTimeout(onDone, 5000)
    return () => clearTimeout(id)
  }, [onDone])
  const base = (import.meta as any).env.BASE_URL || '/'
  const srcWeb = `${base}media/esqa/esqa.web.mp4`
  const srcMp4 = `${base}media/esqa/esqa.mp4`
  const poster = `${base}media/esqa/esqa-poster.png`
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'black', display: 'grid', placeItems: 'center' }}>
      <video
        key="esqa-splash"
        poster={poster}
        autoPlay
        muted
        playsInline
        preload="metadata"
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
      >
        <source src={srcWeb} type="video/mp4" />
        <source src={srcMp4} type="video/mp4" />
      </video>
    </div>
  )
}

function Root() {
  const [ready, setReady] = React.useState(false)
  return ready ? (
    <App />
  ) : (
    <Splash onDone={() => setReady(true)} />
  )
}

const root = createRoot(document.getElementById('root')!)
root.render(<React.StrictMode><Root /></React.StrictMode>)


