// client/src/components/l2/TreeGrid.tsx
import { useMemo, useRef, useState, useEffect } from "react";
import type { ReactNode } from "react";              // ⬅ add this
import { useVirtualizer } from "@tanstack/react-virtual";
import { cn } from "@/lib/utils";

export type TreeRowKind = "program" | "project" | "activity";

export type TreeRow = {
  key: string;        // unique, e.g. "P:1", "PRJ:10", "ACT:uid"
  kind: TreeRowKind;
  level: number;      // 0 program, 1 project, 2 activity
  label: string;      // left column text
  isParent?: boolean; // if it has children (program/project)
  isExpanded?: boolean;
  toggle?(): void;    // for expand/collapse
  onSelect?(): void;  // optional row select handler
  height?: number;    // default 32
  renderRight?(): ReactNode; // right-pane render (bars, etc.)
};

type TreeGridProps = {
  rows: TreeRow[];
  rightHeader?: ReactNode;                            // ⬅ was JSX.Element
  onKeyUpDownEnter?: (ev: KeyboardEvent, currentKey: string) => void;
  stickyLeftWidth?: number;
  rightContentWidth?: number;
};

export function TreeGrid({
  rows,
  rightHeader,
  onKeyUpDownEnter,
  stickyLeftWidth = 320,
  rightContentWidth,
}: TreeGridProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const rowHeights = useMemo(() => rows.map(r => r.height ?? 32), [rows]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => listRef.current,
    estimateSize: (i) => rowHeights[i],
    overscan: 8,
  });

  // keyboard navigation
  const [selectedIndex, setSelectedIndex] = useState(0);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!containerRef.current?.contains(document.activeElement)) return;
      const currentKey = rows[selectedIndex]?.key;
      if (e.key === "ArrowDown") {
        setSelectedIndex(i => Math.min(rows.length - 1, i + 1));
        e.preventDefault();
      } else if (e.key === "ArrowUp") {
        setSelectedIndex(i => Math.max(0, i - 1));
        e.preventDefault();
      } else if (e.key === "Enter") {
        rows[selectedIndex]?.toggle?.();
        e.preventDefault();
      }
      onKeyUpDownEnter?.(e, currentKey);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [rows, selectedIndex, onKeyUpDownEnter]);

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();

  return (
    <div
      ref={containerRef}
      className="h-full w-full border rounded-2xl overflow-hidden grid"
      style={{ gridTemplateColumns: `${stickyLeftWidth}px 1fr` }}
      tabIndex={0}
    >
      {/* Left column: sticky names */}
      <div className="relative">
        <div className="sticky top-0 z-20 bg-background border-b" style={{ height: 32 }}>
          <div className="px-3 text-xs font-medium opacity-70 flex items-center h-full">
            Program / Project / Activity
          </div>
        </div>

        <div ref={listRef} className="overflow-auto h-[calc(100%-32px)]">
          <div style={{ height: totalSize, position: "relative" }}>
            {items.map(v => {
              const row = rows[v.index];
              const top = v.start;
              const isSelected = v.index === selectedIndex;
              return (
                <div
                  key={row.key}
                  className={cn(
                    "absolute left-0 right-0 px-2 flex items-center border-b",
                    isSelected ? "bg-black/5 dark:bg-white/5" : ""
                  )}
                  style={{ top, height: v.size }}
                  onClick={() => setSelectedIndex(v.index)}
                >
                  <div
                    className="flex items-center gap-2 w-full"
                    style={{ paddingLeft: row.level * 12 }}
                  >
                    {row.isParent ? (
                      <button
                        className="w-5 h-5 rounded hover:bg-black/5 dark:hover:bg:white/5 flex items-center justify-center text-xs"
                        onClick={(e) => { e.stopPropagation(); row.toggle?.(); }}
                        aria-label={row.isExpanded ? "Collapse" : "Expand"}
                        title={row.isExpanded ? "Collapse" : "Expand"}
                      >
                        {row.isExpanded ? "▾" : "▸"}
                      </button>
                    ) : (
                      <span className="w-5" />
                    )}
                    <span className="truncate">{row.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right timeline pane: single horizontal scroll */}
      <div className="relative overflow-auto">
        <div className="sticky top-0 z-10 bg-background border-b">
          {rightHeader ?? <div style={{ height: 32 }} />}
        </div>

        <div
            style={{
            height: totalSize,
            width: rightContentWidth ?? "100%",  // ⬅ enables horizontal scroll when wider than viewport
            position: "relative",
            }}
        >
          {items.map(v => {
            const row = rows[v.index];
            const top = v.start;
            return (
              <div
                key={row.key}
                className="absolute left-0 right-0 border-b"
                style={{ top, height: v.size }}
              >
                {row.renderRight?.() ?? null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
