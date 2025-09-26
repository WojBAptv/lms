// client/src/components/Timeline.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { TimeScale } from "../lib/timeScale";

export type Activity = {
  uid: string;
  id: number; // order within project
  projectId: number;
  description: string;
  type: string;
  resource: string;
  sequence: string;
  legId?: number;
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD (inclusive)
};

export type TimelineProps = {
  items: Activity[];
  scale: TimeScale;
  onChange: (uid: string, patch: Partial<Activity>) => void;
};

const MIN_BAR_DAYS = 1;

// date helpers (day granularity)
function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toISO(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function addDays(iso: string, days: number): string {
  const dt = parseISO(iso);
  dt.setDate(dt.getDate() + days);
  return toISO(dt);
}
function daysBetween(a: string, b: string): number {
  const ms = parseISO(b).getTime() - parseISO(a).getTime();
  return Math.round(ms / 86400000);
}
function clampDate(iso: string, min: string, max: string): string {
  const t = parseISO(iso).getTime();
  const tmin = parseISO(min).getTime();
  const tmax = parseISO(max).getTime();
  if (t < tmin) return min;
  if (t > tmax) return max;
  return iso;
}

export default function Timeline({ items, scale, onChange }: TimelineProps) {
  const gridRef = useRef<HTMLDivElement>(null);

  // width of the grid area
  const width = useMemo(() => Math.round(scale.ticks.length * scale.unitPx), [scale]);

  // snapping: convert pixels → units → days like StaffPlan
  const unitPx = Math.round(scale.unitPx);
  const unitDays = useMemo(
    () => Math.max(1, scale.mode === "day" ? 1 : scale.mode === "week" ? 7 : 30),
    [scale.mode]
  );

  function xFromDate(iso: string): number {
    return Math.round(scale.dateToX(iso));
  }

  // ---- Drag state
  type DragState =
    | {
        uid: string;
        mode: "move" | "left" | "right";
        startClientX: number;
        origStart: string;
        origEnd: string;
        // dynamic while dragging
        deltaDays: number;
      }
    | null;

  const [drag, setDrag] = useState<DragState>(null);

  // local “draft” preview while dragging (no server calls)
  // key: uid → partial (start/end)
  const [drafts, setDrafts] = useState<Map<string, Partial<Activity>>>(new Map());

  // global listeners = more robust drag (like StaffPlan)
  useEffect(() => {
    if (!drag) return;

    const d = drag; // stable snapshot for handlers

    function onMove(ev: PointerEvent) {
      const dx = ev.clientX - d.startClientX;
      const deltaUnits = Math.round(dx / unitPx);
      const deltaDays = deltaUnits * unitDays;
      if (deltaDays === d.deltaDays) return;

      // compute preview patch
      if (d.mode === "move") {
        const duration = daysBetween(d.origStart, d.origEnd);
        const nextStart = clampDate(addDays(d.origStart, deltaDays), scale.startISO, scale.endISO);
        const nextEnd = clampDate(addDays(nextStart, duration), scale.startISO, scale.endISO);
        setDrafts((prev) => {
          const m = new Map(prev);
          m.set(d.uid, { start: nextStart, end: nextEnd });
          return m;
        });
      } else if (d.mode === "left") {
        const next = clampDate(addDays(d.origStart, deltaDays), scale.startISO, scale.endISO);
        const minStart = addDays(d.origEnd, -MIN_BAR_DAYS);
        const safe = daysBetween(next, d.origEnd) >= MIN_BAR_DAYS ? next : minStart;
        setDrafts((prev) => {
          const m = new Map(prev);
          m.set(d.uid, { start: safe });
          return m;
        });
      } else if (d.mode === "right") {
        const next = clampDate(addDays(d.origEnd, deltaDays), scale.startISO, scale.endISO);
        const minEnd = addDays(d.origStart, MIN_BAR_DAYS);
        const safe = daysBetween(d.origStart, next) >= MIN_BAR_DAYS ? next : minEnd;
        setDrafts((prev) => {
          const m = new Map(prev);
          m.set(d.uid, { end: safe });
          return m;
        });
      }

      setDrag((prev) => (prev ? { ...prev, deltaDays } : prev));
    }

    function onUp() {
      // Commit once on drop
      const patch = drafts.get(d.uid);
      setDrag(null);
      setDrafts((prev) => {
        const m = new Map(prev);
        m.delete(d.uid);
        return m;
      });
      if (patch && (patch.start || patch.end)) {
        onChange(d.uid, patch);
      }
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, unitPx, unitDays, scale.startISO, scale.endISO]);

  function onPointerDown(
    e: React.PointerEvent,
    uid: string,
    mode: "move" | "left" | "right",
    start: string,
    end: string
  ) {
    e.preventDefault(); // avoid text selection/scroll quirks
    setDrag({
      uid,
      mode,
      startClientX: e.clientX,
      origStart: start,
      origEnd: end,
      deltaDays: 0,
    });
    // start with a clean draft for this uid
    setDrafts((prev) => {
      const m = new Map(prev);
      m.delete(uid);
      return m;
    });
  }

  // pick shown value = draft (if exists) else real value
  function currentStart(uid: string, real: string): string {
    const d = drafts.get(uid);
    return (d?.start as string) || real;
  }
  function currentEnd(uid: string, real: string): string {
    const d = drafts.get(uid);
    return (d?.end as string) || real;
  }

  return (
    <div className="timeline">
      <div className="header" style={{ display: "flex" }}>
        {scale.ticks.map((t, i) => (
          <div
            key={i}
            className="cell head"
            style={{
              width: scale.unitPx,
              borderRight: "1px solid #e5e7eb",
              textAlign: "center",
              fontSize: 12,
            }}
          >
            {t.label}
          </div>
        ))}
      </div>

      <div
        className="grid"
        ref={gridRef}
        style={{
          position: "relative",
          width,
          border: "1px solid #e5e7eb",
          height: 40 * Math.max(1, items.length),
          backgroundImage: `linear-gradient(to right, #f3f4f6 1px, transparent 1px)`,
          backgroundSize: `${scale.unitPx}px 100%`,
          overflowX: "auto",
          userSelect: "none",
        }}
      >
        {items.map((a, row) => {
          const s = currentStart(a.uid, a.start);
          const e = currentEnd(a.uid, a.end);

          // inclusive end: +1 day visually
          const left = xFromDate(s);
          const right = xFromDate(addDays(e, 1));
          const w = Math.max(scale.unitPx, right - left);

          const dragging = drag?.uid === a.uid;

          return (
            <div
              key={a.uid}
              className="bar"
              style={{
                position: "absolute",
                left,
                top: row * 40 + 6,
                width: w,
                height: 28,
                border: "1px solid #3b82f6",
                borderRadius: 6,
                background: dragging ? "#93c5fd" : "#bfdbfe",
                display: "flex",
                alignItems: "center",
                boxSizing: "border-box",
                cursor: "grab",
                zIndex: dragging ? 10 : 1,
              }}
              onPointerDown={(e) => onPointerDown(e, a.uid, "move", a.start, a.end)}
              title={`${a.description} ${s}→${e}`}
            >
              <div
                className="handle left"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPointerDown(e, a.uid, "left", a.start, a.end);
                }}
                style={{
                  width: 6,
                  alignSelf: "stretch",
                  cursor: "ew-resize",
                  background: "#3b82f6",
                  borderTopLeftRadius: 6,
                  borderBottomLeftRadius: 6,
                }}
              />
              <div
                style={{
                  flex: 1,
                  padding: "0 6px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {a.description}
              </div>
              <div
                className="handle right"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onPointerDown(e, a.uid, "right", a.start, a.end);
                }}
                style={{
                  width: 6,
                  alignSelf: "stretch",
                  cursor: "ew-resize",
                  background: "#3b82f6",
                  borderTopRightRadius: 6,
                  borderBottomRightRadius: 6,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
