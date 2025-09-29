// client/src/App.tsx
import { useEffect, useMemo, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { getActivities, updateActivity, type Activity as ApiActivity } from "./lib/api";
import Timeline, { type Activity as UIActivity } from "./components/Timeline";
import ProgramOverview from "./components/ProgramOverview";
import StaffPlan from "./components/StaffPlan";
import CapacityForecast from "./components/CapacityForecast";
import { useTimeScale, startOfWeek, startOfMonth, addDays, type ZoomMode } from "./lib/timeScale";

import { LayoutShell } from "./components/layout/LayoutShell";
import { useToast } from "@/components/ui/use-toast";
import Styleguide from "./pages/Styleguide";
import { Button } from "@/components/ui/button";

import ProjectActivitiesEditor from "@/pages/ProjectActivitiesEditor";

// ---- Mapper: API Activity -> UI Activity (fill required strings) ----
const toUIActivity = (a: ApiActivity): UIActivity => ({
  ...a,
  resource: a.resource ?? "",
  start: a.start ?? "",
  end: a.end ?? "",
  sequence: a.sequence ?? "",   // <-- add this line
});

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
        <Button
          variant={mode === "day" ? "default" : "outline"}
          onClick={() => setMode("day")}
          disabled={mode === "day"}
        >
          Day
        </Button>
        <Button
          variant={mode === "week" ? "default" : "outline"}
          onClick={() => setMode("week")}
          disabled={mode === "week"}
        >
          Week
        </Button>
        <Button
          variant={mode === "month" ? "default" : "outline"}
          onClick={() => setMode("month")}
          disabled={mode === "month"}
        >
          Month
        </Button>
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

  const { toast } = useToast();

  // Load activities once (shared for L1 and L2)
  useEffect(() => {
    getActivities()
      .then((acts) => setItems(acts.map(toUIActivity)))
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
      // Send patch to API; map the returned activity back to UI shape
      const updatedApi = await updateActivity(uid, patch as Partial<ApiActivity>);
      const updated = toUIActivity(updatedApi);

      setItems((prev) => prev.map((x) => (x.uid === uid ? updated : x)));

      toast({
        title: "Saved",
        description: `Activity ${uid} updated.`,
      });
    } catch (e: any) {
      const msg = String(e);
      setError(msg);
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
          <Timeline
            items={arr}
            scale={scale}
            onChange={handleChange}
            // If Timeline also expects a setter typed as (value: UIActivity[]) => void,
            // uncomment the next line to avoid Dispatch<SetStateAction<...>> mismatch:
            // setItems={(value) => setItems(value)}
          />
        </div>
      ))}

      {!items.length && <p>No activities yet.</p>}
      {saving && <p>Saving {saving}…</p>}
    </div>
  );

  const L2Page = (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      <div className="mb-2">
        <ZoomToolbar mode={mode} setMode={setMode} startISO={startISO} endISO={endISO} />
      </div>
      <div className="flex-1 min-h-0">
        <ProgramOverview mode={mode} />
      </div>
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
          <Route path="/l1" element={<ProjectActivitiesEditor />} />
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
