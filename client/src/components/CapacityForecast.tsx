// client/src/components/CapacityForecast.tsx
import React, { useEffect, useMemo, useState } from "react";
import { getCapacityForecast, type CapacityPoint } from "../lib/capacity";
import { addDays, startOfWeek, startOfMonth } from "../lib/timeScale";

import { Input } from "@/components/ui/input";

type Bucket = "day" | "week" | "month";

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function CapacityForecast() {
  const [bucket, setBucket] = useState<Bucket>("week");
  const [start, setStart] = useState<string>(todayISO());
  const [periods, setPeriods] = useState<number>(12); // how many buckets forward
  const [data, setData] = useState<CapacityPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // normalize start to bucket boundary for nicer labeling
  useEffect(() => {
    if (bucket === "week") setStart(s => startOfWeek(s));
    if (bucket === "month") setStart(s => startOfMonth(s));
  }, [bucket]);

  const end = useMemo(() => {
    if (bucket === "day") return addDays(start, periods - 1);
    if (bucket === "week") return addDays(start, periods * 7 - 1);
    // month: rough add months via 30d steps is fine for forecast coverage
    return addDays(start, periods * 30 - 1);
  }, [start, periods, bucket]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        const res = await getCapacityForecast({ from: start, to: end, bucket });
        if (!ignore) setData(res.points);
      } catch (e: any) {
        if (!ignore) setError(e.message || String(e));
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => { ignore = true; };
  }, [start, end, bucket]);

  const maxY = useMemo(() => {
    const m = Math.max(8, ...data.map(p => Math.max(p.available, p.needed)));
    // round up to nearest 10
    return Math.ceil(m / 10) * 10;
  }, [data]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <h2 style={{ margin: 0 }}>Level 4 — Capacity Forecast</h2>

      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <label>Bucket:&nbsp;
          <select value={bucket} onChange={e => setBucket(e.target.value as Bucket)}>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
        </label>
        <label>Start:&nbsp;
          <Input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-48" />
        </label>
        <label>Periods:&nbsp;
          <Input
            type="number"
            min={1}
            max={52}
            value={periods}
            onChange={e => setPeriods(Math.max(1, Math.min(52, Number(e.target.value))))}
            className="w-28"
          />
        </label>
      </div>

      {loading && <div>Loading…</div>}
      {error && <div style={{ color: "crimson" }}>{error}</div>}

      {!loading && !error && (
        <>
          <BarChart data={data} maxY={maxY} />
          <MiniTable data={data} />
        </>
      )}
    </div>
  );
}

function BarChart({ data, maxY }: { data: CapacityPoint[]; maxY: number }) {
  const width = Math.max(600, data.length * 40 + 80);
  const height = 280;
  const pad = { left: 48, right: 24, top: 16, bottom: 48 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  const y = (v: number) => pad.top + chartH - (v / maxY) * chartH;
  const xBand = (i: number) => pad.left + i * (chartW / Math.max(1, data.length)) + 6;
  const barW = Math.max(6, (chartW / Math.max(1, data.length)) - 12);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={width} height={height} role="img" aria-label="Capacity bar chart">
        {/* Y axis */}
        <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + chartH} stroke="currentColor" />
        {/* X axis */}
        <line x1={pad.left} y1={pad.top + chartH} x2={pad.left + chartW} y2={pad.top + chartH} stroke="currentColor" />

        {/* Y ticks */}
        {Array.from({ length: 5 }).map((_, i) => {
          const v = (i * maxY) / 4;
          const yy = y(v);
          return (
            <g key={i}>
              <line x1={pad.left - 4} y1={yy} x2={pad.left} y2={yy} stroke="currentColor" />
              <text x={pad.left - 8} y={yy + 4} fontSize="10" textAnchor="end">{Math.round(v)}</text>
              <line x1={pad.left} y1={yy} x2={pad.left + chartW} y2={yy} stroke="currentColor" opacity="0.08" />
            </g>
          );
        })}

        {/* Bars */}
        {data.map((p, i) => {
          const x = xBand(i);
          const gap = Math.min(8, barW * 0.25);
          const wHalf = (barW - gap) / 2;
          const aY = y(p.available), nY = y(p.needed);
          const aH = Math.max(0, pad.top + chartH - aY);
          const nH = Math.max(0, pad.top + chartH - nY);
          const overload = p.needed > p.available;

          return (
            <g key={p.bucketStart}>
              {/* available */}
              <rect x={x} y={aY} width={wHalf} height={aH} fill="currentColor" opacity="0.5">
                <title>{`${p.bucketStart}\nAvailable: ${p.available}`}</title>
              </rect>
              {/* needed */}
              <rect x={x + wHalf + gap} y={nY} width={wHalf} height={nH} fill="currentColor" opacity={overload ? 1 : 0.25}>
                <title>{`${p.bucketStart}\nNeeded: ${p.needed}`}</title>
              </rect>
              {/* x label */}
              <text x={x + barW/2} y={pad.top + chartH + 14} fontSize="10" textAnchor="middle">{p.bucketStart}</text>
              {/* overload marker */}
              {overload && (
                <text x={x + barW/2} y={nY - 6} fontSize="10" textAnchor="middle" fill="crimson">▲ {p.needed - p.available}</text>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${pad.left + 8}, ${pad.top + 8})`}>
          <rect x={0} y={0} width={10} height={10} fill="currentColor" opacity="0.5" />
          <text x={16} y={10} fontSize="12">Available</text>
          <rect x={90} y={0} width={10} height={10} fill="currentColor" opacity="0.25" />
          <text x={106} y={10} fontSize="12">Needed</text>
          <text x={190} y={10} fontSize="12" fill="crimson">▲ Overload</text>
        </g>
      </svg>
    </div>
  );
}

function MiniTable({ data }: { data: CapacityPoint[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ borderCollapse: "collapse", width: "100%", minWidth: 480 }}>
        <thead>
          <tr>
            <th style={th}>Bucket</th>
            <th style={th}>Available (h)</th>
            <th style={th}>Needed (h)</th>
            <th style={th}>Net (h)</th>
          </tr>
        </thead>
        <tbody>
          {data.map(p => {
            const net = p.available - p.needed;
            return (
              <tr key={p.bucketStart} style={{ background: net < 0 ? "rgba(220,20,60,0.07)" : "transparent" }}>
                <td style={td}>{p.bucketStart}</td>
                <td style={td}>{p.available}</td>
                <td style={td}>{p.needed}</td>
                <td style={{ ...td, color: net < 0 ? "crimson" : "inherit" }}>{net}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { textAlign: "left", borderBottom: "1px solid rgba(0,0,0,0.15)", padding: "6px 8px" };
const td: React.CSSProperties = { borderBottom: "1px solid rgba(0,0,0,0.07)", padding: "6px 8px" };
