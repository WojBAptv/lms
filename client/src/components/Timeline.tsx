import React, { useMemo, useRef, useState } from 'react';

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
  onChange: (uid: string, patch: Partial<Activity>) => void;
};

const DAY_PX = 40;

// date helpers
function parseISO(iso: string): Date { const [y,m,d] = iso.split('-').map(Number); return new Date(y, m-1, d); }
function toISO(d: Date): string { const yyyy = d.getFullYear(); const mm = String(d.getMonth()+1).padStart(2,'0'); const dd = String(d.getDate()).padStart(2,'0'); return `${yyyy}-${mm}-${dd}`; }
function addDays(iso: string, days: number): string { const dt = parseISO(iso); dt.setDate(dt.getDate()+days); return toISO(dt); }
function clampDate(iso: string, min: string, max: string): string { const t = parseISO(iso).getTime(); const tmin = parseISO(min).getTime(); const tmax = parseISO(max).getTime(); if (t < tmin) return min; if (t > tmax) return max; return iso; }
function daysBetween(a: string, b: string): number { const ms = parseISO(b).getTime() - parseISO(a).getTime(); return Math.round(ms / 86400000); }

export default function Timeline({ items, onChange }: TimelineProps) {
  // window covers 6 weeks starting Monday of current week
  const today = useMemo(() => { const d = new Date(); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate()-dow); return d; }, []);
  const startISO = toISO(today);
  const endISO = useMemo(() => toISO(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 41)), [today]); // ~6 weeks

  const days = daysBetween(startISO, endISO) + 1;
  const width = days * DAY_PX;

  const [drag, setDrag] = useState<{ uid: string; mode: 'move'|'left'|'right'; startX: number; origStart: string; origEnd: string }|null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  function xFromDate(iso: string): number { return daysBetween(startISO, iso) * DAY_PX; }
  function dateFromX(px: number): string { const day = Math.round(px / DAY_PX); return addDays(startISO, day); }

  function onPointerDown(e: React.PointerEvent, uid: string, mode: 'move'|'left'|'right', start: string, end: string) {
    (e.target as Element).setPointerCapture(e.pointerId);
    setDrag({ uid, mode, startX: e.clientX, origStart: start, origEnd: end });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const deltaDays = Math.round(dx / DAY_PX);
    if (deltaDays === 0) return;
    if (drag.mode === 'move') {
      const nextStart = clampDate(addDays(drag.origStart, deltaDays), startISO, endISO);
      const duration = daysBetween(drag.origStart, drag.origEnd);
      const nextEnd = clampDate(addDays(nextStart, duration), startISO, endISO);
      onChange(drag.uid, { start: nextStart, end: nextEnd } as any);
    } else if (drag.mode === 'left') {
      const next = clampDate(addDays(drag.origStart, deltaDays), startISO, endISO);
      const minStart = addDays(drag.origEnd, -1);
      const safe = daysBetween(next, drag.origEnd) >= 1 ? next : minStart;
      onChange(drag.uid, { start: safe } as any);
    } else if (drag.mode === 'right') {
      const next = clampDate(addDays(drag.origEnd, deltaDays), startISO, endISO);
      const minEnd = addDays(drag.origStart, 1);
      const safe = daysBetween(drag.origStart, next) >= 1 ? next : minEnd;
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
        {Array.from({ length: days }).map((_, i) => {
          const date = addDays(startISO, i);
          return (
            <div key={i} className="cell head" style={{ width: DAY_PX, borderRight: '1px solid #e5e7eb', textAlign: 'center', fontSize: 12 }}>
              {date.slice(5)}
            </div>
          );
        })}
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
          backgroundSize: `${DAY_PX}px 100%`,
          overflowX: 'auto'
        }}
      >
        {items.map((a, row) => {
          const left = xFromDate(a.start);
          const right = xFromDate(a.end) + DAY_PX; // inclusive end cell
          const w = Math.max(DAY_PX, right - left);
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
