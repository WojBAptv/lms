// client/src/components/ProgramOverview.tsx
import { useEffect, useMemo, useState } from 'react';
import type { Activity } from './Timeline';
import Timeline from './Timeline';
import type { TimeScale } from '../lib/timeScale';
import { getPrograms, getProjects, type Program, type Project } from '../lib/api';

type Props = {
  activities: Activity[];
  scale: TimeScale;
  onChange: (uid: string, patch: Partial<Activity>) => void; // <-- NEW
};

export default function ProgramOverview({ activities, scale, onChange }: Props) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([getPrograms(), getProjects()])
      .then(([ps, prjs]) => {
        setPrograms(ps);
        setProjects(prjs);
        if (ps.length) setExpanded(new Set([ps[0].id])); // open first program by default
      })
      .finally(() => setLoading(false));
  }, []);

  const projectsByProgram = useMemo(() => {
    const map = new Map<number, Project[]>();
    for (const p of projects) {
      const arr = map.get(p.programId) || [];
      arr.push(p);
      map.set(p.programId, arr);
    }
    for (const arr of map.values()) arr.sort((a,b) => a.id - b.id);
    return map;
  }, [projects]);

  const activitiesByProject = useMemo(() => {
    const map = new Map<number, Activity[]>();
    for (const a of activities) {
      const arr = map.get(a.projectId) || [];
      arr.push(a);
      map.set(a.projectId, arr);
    }
    for (const arr of map.values()) arr.sort((a,b) => a.id - b.id);
    return map;
  }, [activities]);

  function toggle(programId: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(programId)) next.delete(programId); else next.add(programId);
      return next;
    });
  }

  if (loading) return <p>Loading programs & projects…</p>;

  return (
    <div>
      {programs.sort((a,b) => a.id - b.id).map(p => {
        const projs = projectsByProgram.get(p.id) || [];
        const totalActs = projs.reduce((sum, pr) => sum + (activitiesByProject.get(pr.id)?.length || 0), 0);
        const isOpen = expanded.has(p.id);

        return (
          <div key={p.id} style={{ marginBottom: 24 }}>
            <div
              onClick={() => toggle(p.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                userSelect: 'none', padding: '6px 8px', background: '#111827', border: '1px solid #374151', borderRadius: 8
              }}
            >
              <span style={{ fontWeight: 700 }}>{isOpen ? '▾' : '▸'} {p.name}</span>
              <span style={{ color: '#9ca3af' }}>({projs.length} project{projs.length!==1?'s':''}, {totalActs} activit{totalActs===1?'y':'ies'})</span>
            </div>

            {isOpen && (
              <div style={{ marginTop: 8, paddingLeft: 12 }}>
                {projs.length === 0 && <div style={{ color: '#9ca3af', padding: '8px 0' }}>No projects yet.</div>}
                {projs.map(pr => {
                  const acts = activitiesByProject.get(pr.id) || [];
                  return (
                    <div key={pr.id} style={{ marginBottom: 16 }}>
                      <div style={{ margin: '8px 0' }}><strong>Project #{pr.id}</strong> — {pr.name}</div>
                      {/* Level 2 now editable: same onChange as Level 1 */}
                      <Timeline items={acts} scale={scale} onChange={onChange} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      {!programs.length && <p>No programs found.</p>}
    </div>
  );
}
