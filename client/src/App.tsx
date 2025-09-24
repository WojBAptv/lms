import { useEffect, useMemo, useState } from 'react'
import { getActivities, updateActivity } from './lib/api'
import Timeline, { type Activity as UIActivity } from './components/Timeline'

export default function App() {
  const [items, setItems] = useState<UIActivity[]>([])
  const [error, setError] = useState<string|undefined>()
  const [saving, setSaving] = useState<string|null>(null)

  useEffect(() => {
    getActivities()
      .then(setItems)
      .catch(e => setError(String(e)))
  }, [])

  const byProject = useMemo(() => {
    const m = new Map<number, UIActivity[]>();
    for (const a of items) {
      const arr = m.get(a.projectId) || [];
      arr.push(a);
      m.set(a.projectId, arr);
    }
    return Array.from(m.entries()).sort(([a],[b]) => a-b);
  }, [items]);

  async function handleChange(uid: string, patch: Partial<UIActivity>) {
    setSaving(uid);
    try {
      const updated = await updateActivity(uid, patch);
      setItems(prev => prev.map(x => x.uid === uid ? updated : x));
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div style={{ padding: 16 }}>
      <h1 style={{ marginBottom: 8 }}>Activities — Level 1</h1>
      {error && <p style={{color: 'red'}}>{error}</p>}

      {byProject.map(([projectId, arr]) => (
        <div key={projectId} style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '8px 0' }}>Project #{projectId}</h3>
          <Timeline items={arr} onChange={handleChange} />
        </div>
      ))}

      {!items.length && <p>No activities yet.</p>}
      {saving && <p>Saving {saving}…</p>}
    </div>
  )
}
