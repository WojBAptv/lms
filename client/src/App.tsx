import { useEffect, useState } from 'react'
import { api } from './lib/api'

type Activity = {
  id: string; projectId: string; seq: number; description: string; type: string; resource?: string;
}

export default function App() {
  const [items, setItems] = useState<Activity[]>([])
  const [error, setError] = useState<string|undefined>()

  useEffect(() => {
    api<Activity[]>('/api/activities')
      .then(setItems)
      .catch(e => setError(String(e)))
  }, [])

  return (
    <div style={{ padding: 16 }}>
      <h1>Activities</h1>
      {error && <p style={{color: 'red'}}>{error}</p>}
      <ul>
        {items.map(a => (
          <li key={a.id}>
            <strong>{a.seq}.</strong> {a.description} — <em>{a.type}</em> [{a.projectId}]
          </li>
        ))}
      </ul>
      {!items.length && <p>No activities yet.</p>}
    </div>
  )
}
