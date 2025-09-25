import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { getActivities, updateActivity } from "./lib/api";
import Timeline, { type Activity as UIActivity } from "./components/Timeline";
import ProgramOverview from "./components/ProgramOverview";
import StaffPlan from "./components/StaffPlan";
import CapacityForecast from "./components/CapacityForecast";
import { useTimeScale, startOfWeek, startOfMonth, addDays, type ZoomMode } from "./lib/timeScale";

import { LayoutShell } from "./components/layout/LayoutShell";

// 👇 shadcn/ui toast hook
import { useToast } from "@/components/ui/use-toast";

// If you created the Styleguide page in src/pages (Option A):
import Styleguide from "./pages/Styleguide";

// Small shared toolbar for zoom + window info
function ZoomToolbar({
  mode,
  setMode,
  startISO,
  endISO,
}: {
  mode: ZoomMode;
  setMode: (m: ZoomMode) => void;
  startISO: string;
  endISO: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button onClick={() => setMode("day")} disabled={mode === "day"}>
          Day
        </button>
        <button onClick={() => setMode("week")} disabled={mode === "week"}>
          Week
        </button>
        <button onClick={() => setMode("month")} disabled={mode === "month"}>
          Month
        </button>
      </div>
      <span style={{ marginLeft: 12, color: "#6b7280" }}>
        Window: {startISO} → {endISO} (mode: {mode})
      </span>
    </div>
  );
}

export default function App() {
  const [items, setItems] = useState<UIActivity[]>([]);
  const [error, setError] = useState<string | undefined>();
  const [saving, setSaving] = useState<string | null>(null);
  const [mode, setMode] = useState<ZoomMode>("day");

  // toast API
  const { toast } = useToast();

  // Load activities once (shared for L1 and L2)
  useEffect(() => {
    getActivities()
      .then(setItems)
      .catch((e) => {
        const msg = String(e);
        setError(msg);
        toast({
          variant: "destructive",
          title: "Failed to load activities",
          description: msg,
        });
      });
  }, [toast]);

  const todayISO = useMemo(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }, []);

  const { startISO, endISO } = useMemo(() => {
    if (mode === "day") {
      const start = startOfWeek(todayISO);
      const end = addDays(start, 41);
      return { startISO: start, endISO: end };
    }
    if (mode === "week") {
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
    return Array.from(m.entries()).sort(([a], [b]) => a - b);
  }, [items]);

  async function handleChange(uid: string, patch: Partial<UIActivity>) {
    setSaving(uid);
    try {
      const updated = await updateActivity(uid, patch);
      setItems((prev) => prev.map((x) => (x.uid === uid ? updated : x)));

      // Success toast
      toast({
        title: "Saved",
        description: `Activity ${uid} updated.`,
      });
    } catch (e: any) {
      const msg = String(e);
      setError(msg);

      // Error toast
      toast({
        variant: "destructive",
        title: "Save failed",
        description: msg,
      });
    } finally {
      setSaving(null);
    }
  }

  // Route elements
  const L1Page = (
    <div>
      <ZoomToolbar mode={mode} setMode={setMode} startISO={startISO} endISO={endISO} />
      {error && <p style={{ color: "red" }}>{error}</p>}

      {byProject.map(([projectId, arr]) => (
        <div key={projectId} style={{ marginBottom: 24 }}>
          <h3 style={{ margin: "8px 0" }}>Project #{projectId}</h3>
          <Timeline items={arr} scale={scale} onChange={handleChange} />
        </div>
      ))}

      {!items.length && <p>No activities yet.</p>}
      {saving && <p>Saving {saving}…</p>}
    </div>
  );

  const L2Page = (
    <div>
      <ZoomToolbar mode={mode} setMode={setMode} startISO={startISO} endISO={endISO} />
      {error && <p style={{ color: "red" }}>{error}</p>}
      <ProgramOverview activities={items} scale={scale} onChange={handleChange} />
    </div>
  );

  const StaffPage = (
    <div>
      <ZoomToolbar mode={mode} setMode={setMode} startISO={startISO} endISO={endISO} />
      <StaffPlan scale={scale} />
    </div>
  );

  const CapacityPage = (
    <div>
      {/* Capacity view doesn't need time scale right now, but we keep layout consistent */}
      <CapacityForecast />
    </div>
  );

  return (
    <BrowserRouter>
      <LayoutShell>
        <Routes>
          <Route path="/" element={<Navigate to="/l2" replace />} />
          <Route path="/l1" element={L1Page} />
          <Route path="/l2" element={L2Page} />
          <Route path="/staff" element={StaffPage} />
          <Route path="/capacity" element={CapacityPage} />
          {/* Dev-only styleguide page to demo components & toasts */}
          <Route path="/styleguide" element={<Styleguide />} />
        </Routes>
      </LayoutShell>
    </BrowserRouter>
  );
}
