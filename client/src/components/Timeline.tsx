// client/src/components/Timeline.tsx
import React, { useMemo, useRef, useState } from 'react';
import type { TimeScale } from '../lib/timeScale';

export type Activity = {
  uid: string;
  id: number;              // order within project
  projectId: number;
  description: string;
  type: string;
  resource: string;
  sequence: string;
  legId?: number;
  start: string;           // YYYY-MM-DD
  end: string;             // YYYY-MM-DD (inclusive)
};

export type TimelineProps = {
  items: Activity[];
  scale: TimeScale;
  onChange: (uid: string, patch: Partial<Activity>) => void;
};

const MIN_BAR_DAYS = 1;

// date helpers (day granularity)
function parseISO(iso: string): Date { const [y,m,d] = iso.split('-').map(Number); return new Date(y, m-1, d); }
function toISO(d: Date): string { const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${yyyy}-${mm}-${dd}`; }
function addDays(iso: string, days: number): string { const dt = parseISO(iso); dt.setDate(dt.getDate()+days); return toISO(dt); }
function daysBetween(a: string, b: string): number { const ms = parseISO(b).getTime() - parseISO(a).getTime(); return Math.round(ms / 86400000); }
function clampDate(iso: string, min: string, max: string): string { const t = parseISO(iso).getTime(); const tmin = parseISO(min).getTime(); const tmax = parseISO(max).getTime(); if (t < tmin) return min; if (t > tmax) return max; return iso; }

export default function Timeline({ items, scale, onChange }: TimelineProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ uid: string; mode: 'move'|'left'|'right'; startX: number; origStart: string; origEnd: string }|null>(null);

  // total width in pixels based on ticks
  const width = useMemo(() => {
    if (scale.mode === 'day') return scale.ticks.length * scale.unitPx;
    if (scale.mode === 'week') return scale.ticks.length * scale.unitPx;
    return scale.ticks.length * scale.unitPx; // months
  }, [scale]);

  function xFromDate(iso: string): number { return scale.dateToX(iso); }

  // day-based drag: we still adjust by whole days; snapping refinements can come later
  function onPointerDown(e: React.PointerEvent, uid: string, mode: 'move'|'left'|'right', start: string, end: string) {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ uid, mode, startX: e.clientX, origStart: start, origEnd: end });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const deltaUnits = Math.round(dx / scale.unitPx); // move by units
    const deltaDays = Math.max(1, scale.mode === 'day' ? 1 : scale.mode === 'week' ? 7 : 30) * deltaUnits;

    if (deltaDays === 0) return;

    if (drag.mode === 'move') {
      const nextStart = clampDate(addDays(drag.origStart, deltaDays), scale.startISO, scale.endISO);
      const duration = daysBetween(drag.origStart, drag.origEnd);
      const nextEnd = clampDate(addDays(nextStart, duration), scale.startISO, scale.endISO);
      onChange(drag.uid, { start: nextStart, end: nextEnd } as any);
    } else if (drag.mode === 'left') {
      const next = clampDate(addDays(drag.origStart, deltaDays), scale.startISO, scale.endISO);
      const minStart = addDays(drag.origEnd, -MIN_BAR_DAYS);
      const safe = daysBetween(next, drag.origEnd) >= MIN_BAR_DAYS ? next : minStart;
      onChange(drag.uid, { start: safe } as any);
    } else if (drag.mode === 'right') {
      const next = clampDate(addDays(drag.origEnd, deltaDays), scale.startISO, scale.endISO);
      const minEnd = addDays(drag.origStart, MIN_BAR_DAYS);
      const safe = daysBetween(drag.origStart, next) >= MIN_BAR_DAYS ? next : minEnd;
      onChange(drag.uid, { end: safe } as any);
    }
  }
  function onPointerUp(e: React.PointerEvent) {
    if (drag) { try { (e.target as Element).releasePointerCapture((e as any).pointerId); } catch {} }
    setDrag(null);
  }

  return (
    <div className="timeline">
      <div className="header" style={{ display: 'flex' }}>
        {scale.ticks.map((t, i) => (
          <div key={i} className="cell head"
               style={{ width: scale.unitPx, borderRight: '1px solid #e5e7eb', textAlign: 'center', fontSize: 12 }}>
            {t.label}
          </div>
        ))}
      </div>

      <div
        className="grid"
        ref={gridRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          position: 'relative',
          width,
          border: '1px solid #e5e7eb',
          height: 40 * Math.max(1, items.length),
          backgroundImage: `linear-gradient(to right, #f3f4f6 1px, transparent 1px)`,
          backgroundSize: `${scale.unitPx}px 100%`,
          overflowX: 'auto'
        }}
      >
        {items.map((a, row) => {
          // inclusive end: add 1 day visually in day mode; for week/month, we rely on coarse snapping via deltaDays
          const left = xFromDate(a.start);
          const right = xFromDate(addDays(a.end, 1));
          const w = Math.max(scale.unitPx, right - left);
          return (
            <div key={a.uid}
              className="bar"
              style={{
                position: 'absolute', left, top: row * 40 + 6, width: w, height: 28,
                border: '1px solid #3b82f6', borderRadius: 6, background: '#bfdbfe',
                display: 'flex', alignItems: 'center', boxSizing: 'border-box'
              }}
              onPointerDown={(e) => onPointerDown(e, a.uid, 'move', a.start, a.end)}
            >
              <div className="handle left"
                   onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, a.uid, 'left', a.start, a.end); }}
                   style={{ width: 6, alignSelf: 'stretch', cursor: 'ew-resize', background: '#3b82f6', borderTopLeftRadius: 6, borderBottomLeftRadius: 6 }} />
              <div style={{ flex: 1, padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', cursor: 'grab' }}>
                {a.description}
              </div>
              <div className="handle right"
                   onPointerDown={(e) => { e.stopPropagation(); onPointerDown(e, a.uid, 'right', a.start, a.end); }}
                   style={{ width: 6, alignSelf: 'stretch', cursor: 'ew-resize', background: '#3b82f6', borderTopRightRadius: 6, borderBottomRightRadius: 6 }} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
