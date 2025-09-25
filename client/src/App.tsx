import { useEffect, useMemo, useState } from 'react'
import { getActivities, updateActivity } from './lib/api'
import Timeline, { type Activity as UIActivity } from './components/Timeline'
import ProgramOverview from './components/ProgramOverview'
import StaffPlan from './components/StaffPlan'
import CapacityForecast from './components/CapacityForecast'
import { useTimeScale, startOfWeek, startOfMonth, addDays, type ZoomMode } from './lib/timeScale'

type Level = 'L1' | 'L2' | 'L3' | 'L4';


export default function App() {
  const [items, setItems] = useState<UIActivity[]>([])
  const [error, setError] = useState<string|undefined>()
  const [saving, setSaving] = useState<string|null>(null)
  const [mode, setMode] = useState<ZoomMode>('day')
  const [level, setLevel] = useState<Level>('L1')

  useEffect(() => {
    getActivities()
      .then(setItems)
      .catch(e => setError(String(e)))
  }, [])

  const todayISO = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0');
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const { startISO, endISO } = useMemo(() => {
    if (mode === 'day') {
      const start = startOfWeek(todayISO);
      const end = addDays(start, 41);
      return { startISO: start, endISO: end };
    }
    if (mode === 'week') {
      const start = startOfWeek(todayISO);
      const end = addDays(start, 7 * 26);
      return { startISO: start, endISO: end };
    }
    const start = startOfMonth(todayISO);
    const end = addDays(start, 365);
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
        <h1 style={{ margin: 0 }}>Lab Management System</h1>
        <div style={{ marginLeft: 16, display: 'flex', gap: 8 }}>
          <button onClick={() => setLevel('L1')} disabled={level==='L1'}>Level 1: Activities</button>
          <button onClick={() => setLevel('L2')} disabled={level==='L2'}>Level 2: Program Overview</button>
          <button onClick={() => setLevel('L3')} disabled={level==='L3'}>Level 3: Staff Plan</button>
          <button onClick={() => setLevel('L4')} disabled={level==='L4'}>Level 4: Capacity</button>
        </div>
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

      {level === 'L1' && (
        <>
          {byProject.map(([projectId, arr]) => (
            <div key={projectId} style={{ marginBottom: 24 }}>
              <h3 style={{ margin: '8px 0' }}>Project #{projectId}</h3>
              <Timeline items={arr} scale={scale} onChange={handleChange} />
            </div>
          ))}
          {!items.length && <p>No activities yet.</p>}
          {saving && <p>Saving {saving}…</p>}
        </>
      )}

      {level === 'L2' && (
        <ProgramOverview activities={items} scale={scale} onChange={handleChange} />
      )}

      {level === 'L3' && (
        <StaffPlan scale={scale} />
      )}

      {level === 'L4' && (
        <CapacityForecast />
      )}
    </div>
  )
}
