import { useEffect, useMemo, useState } from 'react'
import { getActivities, updateActivity } from './lib/api'
import Timeline, { type Activity as UIActivity } from './components/Timeline'
import { useTimeScale, startOfWeek, startOfMonth, addDays, type ZoomMode } from './lib/timeScale'

export default function App() {
  const [items, setItems] = useState<UIActivity[]>([])
  const [error, setError] = useState<string|undefined>()
  const [saving, setSaving] = useState<string|null>(null)
  const [mode, setMode] = useState<ZoomMode>('day')

  useEffect(() => {
    getActivities()
      .then(setItems)
      .catch(e => setError(String(e)))
  }, [])

  // pick a window for each mode
  const todayISO = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const { startISO, endISO } = useMemo(() => {
    if (mode === 'day') {
      const start = startOfWeek(todayISO);
      const end = addDays(start, 41); // ~6 weeks
      return { startISO: start, endISO: end };
    }
    if (mode === 'week') {
      const start = startOfWeek(todayISO);
      const end = addDays(start, 7 * 26); // ~half year
      return { startISO: start, endISO: end };
    }
    // month
    const start = startOfMonth(todayISO);
    const end = addDays(start, 365); // ~12 months; ticks are month-based
    return { startISO: start, endISO: end };
  }, [mode, todayISO]);

  const scale = useTimeScale({ mode, startISO, endISO });

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <h1 style={{ margin: 0 }}>Activities — Level 1</h1>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setMode('day')}   disabled={mode==='day'}>Day</button>
          <button onClick={() => setMode('week')}  disabled={mode==='week'}>Week</button>
          <button onClick={() => setMode('month')} disabled={mode==='month'}>Month</button>
        </div>
      </div>
      <p style={{ marginTop: 8, color: '#6b7280' }}>
        Window: {startISO} → {endISO} (mode: {mode})
      </p>

      {error && <p style={{color: 'red'}}>{error}</p>}

      {byProject.map(([projectId, arr]) => (
        <div key={projectId} style={{ marginBottom: 24 }}>
          <h3 style={{ margin: '8px 0' }}>Project #{projectId}</h3>
          <Timeline items={arr} scale={scale} onChange={handleChange} />
        </div>
      ))}

      {!items.length && <p>No activities yet.</p>}
      {saving && <p>Saving {saving}…</p>}
    </div>
  )
}
