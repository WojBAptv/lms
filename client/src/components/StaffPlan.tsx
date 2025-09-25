import { useEffect, useMemo, useRef, useState } from 'react';
import type { TimeScale } from '../lib/timeScale';
import {
  getStaff, getAssignments, updateAssignment,
  type Staff as StaffT, type Assignment as AssignmentT
} from '../lib/api';

// ---- small date helpers (day granularity) ----
function parseISO(iso: string): Date { const [y,m,d] = iso.split('-').map(Number); return new Date(y, m-1, d); }
function toISO(d: Date): string { const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${yyyy}-${mm}-${dd}`; }
function addDays(iso: string, days: number): string { const dt = parseISO(iso); dt.setDate(dt.getDate()+days); return toISO(dt); }
function daysBetween(a: string, b: string): number { const ms = parseISO(b).getTime() - parseISO(a).getTime(); return Math.round(ms / 86400000); }

// ---- layout constants ----
const ROW_PAD_Y = 6;
const LANE_H = 28;
const LANE_GAP = 6;
const LABEL_W = 180;
const BORDER = '#e5e7eb';

// Compute non-overlapping lanes (interval partitioning)
function layoutLanes(items: AssignmentT[]): { laneIndex: Map<number, number>, laneCount: number } {
  const sorted = [...items].sort((a,b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end) || a.id - b.id);
  const lanes: AssignmentT[][] = [];
  const laneIndex = new Map<number, number>();

  for (const a of sorted) {
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      const last = lanes[i][lanes[i].length - 1];
      if (parseISO(last.end) < parseISO(a.start)) {
        lanes[i].push(a);
        laneIndex.set(a.id, i);
        placed = true; break;
      }
    }
    if (!placed) {
      lanes.push([a]);
      laneIndex.set(a.id, lanes.length - 1);
    }
  }
  return { laneIndex, laneCount: lanes.length || 1 };
}

type Props = { scale: TimeScale };

export default function StaffPlan({ scale }: Props) {
  const [staff, setStaff] = useState<StaffT[]>([]);
  const [assignments, setAssignments] = useState<AssignmentT[]>([]);
  const [error, setError] = useState<string|undefined>();
  const [saving, setSaving] = useState<number|null>(null);

  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([getStaff(), getAssignments()])
      .then(([s, a]) => { setStaff(s); setAssignments(a); })
      .catch(e => setError(String(e)));
  }, []);

  // Group assignments by staff and precompute lanes
  const layoutByStaff = useMemo(() => {
    const byStaff = new Map<number, AssignmentT[]>();
    for (const a of assignments) {
      const arr = byStaff.get(a.staffId) || [];
      arr.push(a);
      byStaff.set(a.staffId, arr);
    }
    const map = new Map<number, { items: AssignmentT[], laneIndex: Map<number, number>, laneCount: number }>();
    for (const [sid, arr] of byStaff) {
      const { laneIndex, laneCount } = layoutLanes(arr);
      map.set(sid, { items: arr, laneIndex, laneCount });
    }
    return map;
  }, [assignments]);

  const rowHeights = useMemo(() => {
    const m = new Map<number, number>();
    for (const s of staff) {
      const meta = layoutByStaff.get(s.id);
      const lanes = meta?.laneCount ?? 1;
      const h = ROW_PAD_Y*2 + lanes*LANE_H + (lanes-1)*LANE_GAP;
      m.set(s.id, h);
    }
    return m;
  }, [staff, layoutByStaff]);

  const unitDays = Math.max(1, scale.mode === 'day' ? 1 : scale.mode === 'week' ? 7 : 30);
  const unitPx = Math.round(scale.unitPx);
  const totalWidth = Math.round(scale.ticks.length * unitPx);

  // --- Drag state (managed globally while active) ---
  type DragState = {
    id: number;
    mode: 'move'|'left'|'right';
    startClientX: number;
    startClientY: number;
    origStart: string;
    origEnd: string;
    origStaffId: number;
    origLane: number;
    hoverStaffId: number;
    deltaDays: number;
  } | null;
  const [drag, setDrag] = useState<DragState>(null);

  // Map pointer Y to staff id inside scrollable grid
  const staffRowAtY = (clientY: number): number => {
    const el = gridRef.current;
    if (!el) return -1;
    const rect = el.getBoundingClientRect();
    const y = clientY - rect.top + el.scrollTop; // container coords
    let acc = 0;
    for (const s of staff) {
      const h = rowHeights.get(s.id) ?? (ROW_PAD_Y*2 + LANE_H);
      if (y >= acc && y < acc + h) return s.id;
      acc += h;
    }
    return staff.at(-1)?.id ?? -1;
  };

  // Global listeners so release is always caught
// Global listeners so release is always caught
useEffect(() => {
  if (!drag) return;

  // capture a non-null snapshot for the handlers
  const d: NonNullable<DragState> = drag;
  const px = unitPx;
  const uDays = unitDays;

  function onMove(ev: PointerEvent) {
    const dx = ev.clientX - d.startClientX;
    const deltaUnits = Math.round(dx / px);
    const deltaDays = deltaUnits * uDays;
    const hovered = staffRowAtY(ev.clientY) || d.origStaffId;
    setDrag(prev => (prev ? { ...prev, deltaDays, hoverStaffId: hovered } : prev));
  }

  async function onUp() {
    setDrag(null);

    const duration = daysBetween(d.origStart, d.origEnd);
    const newStart = addDays(d.origStart, d.deltaDays);
    const newEnd   = addDays(d.origStart, d.deltaDays + duration);
    const patch: Partial<AssignmentT> = { start: newStart, end: newEnd };
    if (d.hoverStaffId !== d.origStaffId) patch.staffId = d.hoverStaffId;

    if (patch.staffId === undefined && d.deltaDays === 0) return; // no-op

    setSaving(d.id);
    try {
      const updated = await updateAssignment(d.id, patch);
      setAssignments(prev => prev.map(x => (x.id === d.id ? updated : x)));
    } catch (e: any) {
      setError(String(e));
    } finally {
      setSaving(null);
    }
  }

  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  window.addEventListener('pointercancel', onUp);
  return () => {
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointercancel', onUp);
  };
// include deps that affect the captured values
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [drag, unitPx, unitDays, staff, rowHeights]);

  // precompute row tops (cumulative)
  const rowTopByStaff = useMemo(() => {
    const map = new Map<number, number>();
    let acc = 0;
    for (const s of staff) {
      map.set(s.id, acc);
      acc += rowHeights.get(s.id) ?? (ROW_PAD_Y*2 + LANE_H);
    }
    return map;
  }, [staff, rowHeights]);

  const totalHeight = useMemo(() => {
    let h = 0;
    for (const s of staff) h += rowHeights.get(s.id) ?? (ROW_PAD_Y*2 + LANE_H);
    return h;
  }, [staff, rowHeights]);

  // Render one assignment bar
  function AssignmentBar({ a, rowTop, laneIndex }: { a: AssignmentT; rowTop: number; laneIndex: number }) {
    const baseLeft = Math.round(scale.dateToX(a.start));
    const baseRight = Math.round(scale.dateToX(addDays(a.end, 1))); // inclusive end
    const baseW = Math.max(unitPx, baseRight - baseLeft);

    const dragging = drag && drag.id === a.id;

    // Preview X
    const previewLeft = dragging ? baseLeft + (drag.deltaDays / unitDays) * unitPx : baseLeft;
    // Use original lane while on same staff; lane 0 when hovering another staff
    const laneForPreview = dragging && drag!.hoverStaffId !== drag!.origStaffId ? 0 : laneIndex;
    const previewTop = (dragging
      ? (rowTopByStaff.get(drag!.hoverStaffId) ?? 0) + ROW_PAD_Y + laneForPreview * (LANE_H + LANE_GAP)
      : rowTop + ROW_PAD_Y + laneIndex * (LANE_H + LANE_GAP));

    function onPointerDown(e: React.PointerEvent, mode: 'move'|'left'|'right') {
      e.preventDefault(); // avoid text-selection / scroll quirks
      setDrag({
        id: a.id,
        mode,
        startClientX: e.clientX,
        startClientY: e.clientY,
        origStart: a.start,
        origEnd: a.end,
        origStaffId: a.staffId,
        origLane: laneIndex,
        hoverStaffId: a.staffId,
        deltaDays: 0
      });
    }

    return (
      <div
        style={{
          position: 'absolute',
          left: previewLeft, top: previewTop, width: baseW, height: LANE_H,
          background: '#c7f9cc', border: '1px solid #10b981', borderRadius: 6,
          display: 'flex', alignItems: 'center', boxSizing: 'border-box',
          zIndex: dragging ? 10 : 1, opacity: dragging ? 0.9 : 1, cursor: 'grab'
        }}
        onPointerDown={(e) => onPointerDown(e, 'move')}
        title={`Assignment #${a.id} (Staff ${a.staffId} • Project ${a.projectId}) ${a.start}→${a.end}`}
      >
        <div onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, 'left'); }}
             style={{ width: 6, alignSelf: 'stretch', cursor: 'ew-resize', background: '#10b981', borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }} />
        <div style={{ flex: 1, padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {`P${a.projectId} • #${a.id}`}
        </div>
        <div onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, 'right'); }}
             style={{ width: 6, alignSelf: 'stretch', cursor: 'ew-resize', background: '#10b981', borderTopRightRadius: 6, borderBottomRightRadius: 6 }} />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="header" style={{ display: 'flex', marginLeft: LABEL_W }}>
        {scale.ticks.map((t, i) => (
          <div key={i} style={{ width: unitPx, borderRight: `1px solid ${BORDER}`, textAlign: 'center', fontSize: 12 }}>
            {t.label}
          </div>
        ))}
      </div>

      {/* Grid + rows */}
      <div
        ref={gridRef}
        style={{
          position: 'relative',
          width: LABEL_W + Math.round(scale.ticks.length * unitPx),
          height: totalHeight,
          border: `1px solid ${BORDER}`,
          backgroundImage: `linear-gradient(to right, ${BORDER} 1px, transparent 1px)`,
          backgroundSize: `${unitPx}px 100%`,
          overflow: 'auto'
        }}
      >
        {/* Sticky staff labels & row backgrounds */}
        {staff.map((s) => {
          let top = 0;
          for (const x of staff) { if (x.id === s.id) break; top += rowHeights.get(x.id) ?? (ROW_PAD_Y*2 + LANE_H); }
          const h = rowHeights.get(s.id) ?? (ROW_PAD_Y*2 + LANE_H);
          return (
            <div key={s.id} style={{ position: 'absolute', left: 0, top, width: '100%', height: h, borderBottom: `1px dashed ${BORDER}` }}>
              <div style={{
                position: 'sticky', left: 0, width: LABEL_W, height: '100%',
                background: '#111827', color: '#fff', display: 'flex', alignItems: 'center',
                padding: '0 8px', zIndex: 2, borderRight: `1px solid ${BORDER}`
              }}>
                <strong>{s.name}</strong>
              </div>
            </div>
          );
        })}

        {/* Bars layer */}
        <div style={{ position: 'absolute', left: LABEL_W, top: 0, width: Math.round(scale.ticks.length * unitPx), height: '100%' }}>
          {staff.map((s) => {
            let rowTop = 0;
            for (const x of staff) { if (x.id === s.id) break; rowTop += rowHeights.get(x.id) ?? (ROW_PAD_Y*2 + LANE_H); }
            const meta = layoutByStaff.get(s.id);
            if (!meta) return null;
            return meta.items.map(a => {
              const lane = meta.laneIndex.get(a.id) ?? 0;
              return <AssignmentBar key={a.id} a={a} rowTop={rowTop} laneIndex={lane} />;
            });
          })}
        </div>
      </div>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {saving && <p>Saving assignment {saving}…</p>}
      {!staff.length && <p>No staff yet.</p>}
    </div>
  );
}
