// client/src/components/StaffPlan.tsx
import { useEffect, useMemo, useState } from 'react';
import type { TimeScale } from '../lib/timeScale';
import { getStaff, getAssignments, updateAssignment, type Staff as StaffT, type Assignment as AssignmentT } from '../lib/api';

// small helpers
function parseISO(iso: string): Date { const [y,m,d] = iso.split('-').map(Number); return new Date(y, m-1, d); }
function toISO(d: Date): string { const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${yyyy}-${mm}-${dd}`; }
function addDays(iso: string, days: number): string { const dt = parseISO(iso); dt.setDate(dt.getDate()+days); return toISO(dt); }
function daysBetween(a: string, b: string): number { const ms = parseISO(b).getTime() - parseISO(a).getTime(); return Math.round(ms / 86400000); }

type Props = { scale: TimeScale };

export default function StaffPlan({ scale }: Props) {
  const [staff, setStaff] = useState<StaffT[]>([]);
  const [assignments, setAssignments] = useState<AssignmentT[]>([]);
  const [error, setError] = useState<string|undefined>();
  const [saving, setSaving] = useState<number|null>(null);
  const rowH = 40;

  useEffect(() => {
    Promise.all([getStaff(), getAssignments()])
      .then(([s, a]) => { setStaff(s); setAssignments(a); })
      .catch(e => setError(String(e)));
  }, []);

  const byStaff = useMemo(() => {
    const m = new Map<number, AssignmentT[]>();
    for (const a of assignments) {
      const arr = m.get(a.staffId) || [];
      arr.push(a);
      m.set(a.staffId, arr);
    }
    for (const arr of m.values()) arr.sort((a,b) => a.start.localeCompare(b.start));
    return m;
  }, [assignments]);

  async function change(id: number, patch: Partial<AssignmentT>) {
    setSaving(id);
    try {
      const updated = await updateAssignment(id, patch);
      setAssignments(prev => prev.map(x => x.id === id ? updated : x));
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(null);
    }
  }

  function AssignmentBar({ a, row }: { a: AssignmentT; row: number }) {
    const left = Math.round(scale.dateToX(a.start));
    const right = Math.round(scale.dateToX(addDays(a.end, 1))); // inclusive end
    const w = Math.max(Math.round(scale.unitPx), right - left);

    // drag state
    const [drag, setDrag] = useState<{ mode: 'move'|'left'|'right'; startX: number; origStart: string; origEnd: string }|null>(null);

    function onDown(e: React.PointerEvent, mode: 'move'|'left'|'right') {
      (e.target as Element).setPointerCapture(e.pointerId);
      setDrag({ mode, startX: e.clientX, origStart: a.start, origEnd: a.end });
    }
    function onMove(e: React.PointerEvent) {
      if (!drag) return;
      const dx = e.clientX - drag.startX;
      const deltaUnits = Math.round(dx / scale.unitPx);
      const deltaDays = Math.max(1, scale.mode === 'day' ? 1 : scale.mode === 'week' ? 7 : 30) * deltaUnits;
      if (deltaDays === 0) return;

      if (drag.mode === 'move') {
        const duration = daysBetween(drag.origStart, drag.origEnd);
        change(a.id, { start: addDays(drag.origStart, deltaDays), end: addDays(drag.origStart, deltaDays + duration) });
      } else if (drag.mode === 'left') {
        const nextStart = addDays(drag.origStart, deltaDays);
        const minEnd = addDays(nextStart, 1);
        if (parseISO(minEnd) <= parseISO(drag.origEnd)) {
          change(a.id, { start: nextStart });
        }
      } else {
        const nextEnd = addDays(drag.origEnd, deltaDays);
        const minEnd = addDays(drag.origStart, 1);
        if (parseISO(nextEnd) >= parseISO(minEnd)) {
          change(a.id, { end: nextEnd });
        }
      }
    }
    function onUp(e: React.PointerEvent) {
      if (drag) { try { (e.target as Element).releasePointerCapture((e as any).pointerId); } catch {} }
      setDrag(null);
    }

    return (
      <div
        style={{
          position: 'absolute',
          left, top: row * rowH + 6, width: w, height: 28,
          background: '#c7f9cc', border: '1px solid #10b981', borderRadius: 6,
          display: 'flex', alignItems: 'center', boxSizing: 'border-box'
        }}
        onPointerDown={(e) => onDown(e, 'move')}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        title={`Assignment #${a.id} (Project ${a.projectId}) ${a.start}→${a.end}`}
      >
        <div onPointerDown={(e) => { e.stopPropagation(); onDown(e, 'left'); }}
             style={{ width: 6, alignSelf: 'stretch', cursor: 'ew-resize', background: '#10b981', borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }} />
        <div style={{ flex: 1, padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'grab' }}>
          P{a.projectId} • #{a.id}
        </div>
        <div onPointerDown={(e) => { e.stopPropagation(); onDown(e, 'right'); }}
             style={{ width: 6, alignSelf: 'stretch', cursor: 'ew-resize', background: '#10b981', borderTopRightRadius: 6, borderBottomRightRadius: 6 }} />
      </div>
    );
  }

  const totalWidth = Math.round(scale.ticks.length * scale.unitPx);

  return (
    <div>
      {/* Header */}
      <div className="header" style={{ display: 'flex' }}>
        {scale.ticks.map((t, i) => (
          <div key={i} style={{ width: Math.round(scale.unitPx), borderRight: '1px solid #e5e7eb', textAlign: 'center', fontSize: 12 }}>
            {t.label}
          </div>
        ))}
      </div>

      {/* Grid + rows */}
      <div
        style={{
          position: 'relative',
          width: totalWidth,
          border: '1px solid #e5e7eb',
          minHeight: rowH * Math.max(1, staff.length),
          backgroundImage: `linear-gradient(to right, #f3f4f6 1px, transparent 1px)`,
          backgroundSize: `${Math.round(scale.unitPx)}px 100%`,
          overflowX: 'auto'
        }}
      >
        {staff.map((s, i) => (
          <div key={s.id}
            style={{
              position: 'absolute', left: 0, top: i*rowH, width: '100%', height: rowH,
              borderBottom: '1px dashed #e5e7eb', display: 'flex', alignItems: 'center'
            }}
            title={s.name}
          >
            <div style={{ position: 'sticky', left: 0, background: '#fff', padding: '0 8px', zIndex: 1 }}>
              <strong>{s.name}</strong>
            </div>
          </div>
        ))}

        {staff.map((s, row) => (byStaff.get(s.id) || []).map(a =>
          <AssignmentBar key={a.id} a={a} row={row} />
        ))}
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {saving && <p>Saving assignment {saving}…</p>}
      {!staff.length && <p>No staff yet.</p>}
    </div>
  );
}
