// client/src/components/l2/TimelineSurface.tsx
import { useMemo, useRef } from "react";
import type { TimeScale } from "@/lib/timeScale";
import { colorOf } from "@/lib/activityTypeColors";

// ---- ISO helpers (day granularity) ----
function parseISO(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDaysISO(iso: string, days: number): string {
  const dt = parseISO(iso);
  dt.setDate(dt.getDate() + days);
  return toISODate(dt);
}
function daysBetween(aISO: string, bISO: string): number {
  const a = parseISO(aISO);
  const b = parseISO(bISO);
  const MS = 24 * 60 * 60 * 1000;
  const au = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bu = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.floor((bu - au) / MS);
}

// Derive per-day px from scale
function perDayPxFor(scale: TimeScale): number {
  const unit = (scale as any).unitPx ?? 24;
  const mode = (scale as any).mode ?? "week";
  if (mode === "day") return unit;
  if (mode === "week") return unit / 7;
  if (mode === "month") return unit / 30;
  return unit;
}
function tickLabel(t: unknown): string {
  const anyT = t as any;
  return anyT?.labelShort ?? anyT?.labelFull ?? anyT?.label ?? anyT?.iso ?? "";
}

export type L2Bar = {
  uid: string;
  type?: string;       // used for color
  startISO: string;    // inclusive
  endISO: string;      // inclusive
  label?: string;      // tooltip + text
};

export function TimelineHeader({ scale }: { scale: TimeScale }) {
  const ticks: unknown[] = (scale as any).ticks ?? [];
  const unitPx: number = (scale as any).unitPx ?? 24;
  const width = Math.round(ticks.length * unitPx);

  return (
    <div className="h-8 relative" style={{ width }}>
      {ticks.map((t, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 border-r border-black/10 dark:border-white/10 text-[10px] flex items-center"
          style={{ left: i * unitPx, width: unitPx }}
          title={tickLabel(t)}
        >
          <span className="px-1 truncate">{tickLabel(t)}</span>
        </div>
      ))}
    </div>
  );
}

export function BarsRow({
  scale,
  bars,
  height = 32,
  draggable = true,
  resizable = false,            // ← NEW
  onDragDays,
  onResizeDays,
}: {
  scale: TimeScale;
  bars: L2Bar[];
  height?: number;
  draggable?: boolean;
  resizable?: boolean;          // ← NEW
  onDragDays?: (uid: string, deltaDays: number) => void;
  onResizeDays?: (uid: string, edge: "start" | "end", deltaDays: number) => void;
}) {
  const ticks: unknown[] = (scale as any).ticks ?? [];
  const unitPx: number = (scale as any).unitPx ?? 24;
  const width = Math.round(ticks.length * unitPx);
  const perDayPx = perDayPxFor(scale);
  const startISO: string =
    (scale as any).startISO ??
    (ticks[0] as any)?.iso ??
    (ticks[0] as any)?.date ??
    toISODate(new Date());

  const items = useMemo(() => {
    return bars.map((b) => {
      const x0 = daysBetween(startISO, b.startISO) * perDayPx;
      const x1 = (daysBetween(startISO, b.endISO) + 1) * perDayPx;
      const left = Math.max(0, Math.round(x0));
      const w = Math.max(6, Math.round(x1 - x0));
      return { ...b, left, width: w };
    });
  }, [bars, perDayPx, startISO]);

  // dragging and resizing state
  const dragRef = useRef<{ uid: string; startX: number } | null>(null);
  const resizeRef = useRef<{ uid: string; startX: number; edge: "start" | "end" } | null>(null);

  function onBarPointerDown(e: React.PointerEvent<HTMLDivElement>, uid: string) {
    if (!draggable || !onDragDays) return;
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    dragRef.current = { uid, startX: e.clientX };
  }
  function onBarPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggable || !onDragDays) return;
    const st = dragRef.current;
    if (!st) return;
    const dx = e.clientX - st.startX;
    const deltaDays = Math.round(dx / perDayPx);
    if (deltaDays !== 0) {
      dragRef.current = { uid: st.uid, startX: st.startX + deltaDays * perDayPx };
      onDragDays(st.uid, deltaDays);
    }
  }
  function endBarDrag() { dragRef.current = null; }

  function onHandlePointerDown(
    e: React.PointerEvent<HTMLDivElement>,
    uid: string,
    edge: "start" | "end"
  ) {
    if (!onResizeDays) return;
    e.stopPropagation();
    (e.currentTarget as any).setPointerCapture?.(e.pointerId);
    resizeRef.current = { uid, startX: e.clientX, edge };
  }
  function onHandlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const st = resizeRef.current;
    if (!st || !onResizeDays) return;
    const dx = e.clientX - st.startX;
    const deltaDays = Math.round(dx / perDayPx);
    if (deltaDays !== 0) {
      resizeRef.current = { ...st, startX: st.startX + deltaDays * perDayPx };
      onResizeDays(st.uid, st.edge, deltaDays);
    }
  }
  function endResize() { resizeRef.current = null; }

  return (
    <div className="relative" style={{ height, width }}>
      {ticks.map((_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 border-r border-black/5 dark:border-white/5"
          style={{ left: i * unitPx }}
        />
      ))}

      {items.map((it) => (
        <div
            key={it.uid}
            className={`absolute top-1 bottom-1 rounded-md text-[10px] flex items-center px-1 ${colorOf(it.type)} text-white select-none cursor-grab active:cursor-grabbing`}
            style={{ left: it.left, width: it.width, touchAction: "none" }}
            title={it.label}
            onPointerDown={(e) => onBarPointerDown(e, it.uid)}
            onPointerMove={onBarPointerMove}
            onPointerUp={endBarDrag}
            onPointerCancel={endBarDrag}
        >
            {/* label */}
            <span className="truncate mx-auto">{it.label}</span>

            {/* handles only when resizable */}
            {resizable && onResizeDays ? (
            <>
                <div
                className="absolute left-0 top-0 bottom-0 w-1.5 bg-white/70 hover:bg-white/90 cursor-ew-resize rounded-l"
                onPointerDown={(e) => onHandlePointerDown(e, it.uid, "start")}
                onPointerMove={onHandlePointerMove}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                />
                <div
                className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/70 hover:bg-white/90 cursor-ew-resize rounded-r"
                onPointerDown={(e) => onHandlePointerDown(e, it.uid, "end")}
                onPointerMove={onHandlePointerMove}
                onPointerUp={endResize}
                onPointerCancel={endResize}
                />
            </>
            ) : null}
        </div>
      ))}
    </div>
  );
}

// helper export if you need to shift an interval by N days elsewhere
export function shiftByDays(bar: L2Bar, deltaDays: number): L2Bar {
  return {
    ...bar,
    startISO: addDaysISO(bar.startISO, deltaDays),
    endISO: addDaysISO(bar.endISO, deltaDays),
  };
}
