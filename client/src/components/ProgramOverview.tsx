// client/src/components/ProgramOverview.tsx
import { useEffect, useMemo, useState } from "react";
import {
  getPrograms,
  getProjects,
  getActivities,
  updateActivity,
  type Program,
  type Project,
  type Activity,
} from "@/lib/api";
import { useTimeScale, startOfWeek, addDays } from "@/lib/timeScale";
import { TreeGrid, type TreeRow } from "./l2/TreeGrid";
import { TimelineHeader, BarsRow, type L2Bar } from "./l2/TimelineSurface";

type Mode = "day" | "week" | "month";
type Props = {
  /** Mode comes from the global toolbar in App.tsx */
  mode?: Mode;
  initialStartISO?: string;
  windowDays?: number;
};

const STORAGE_KEY = "l2-expanded-v1";

function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function ProgramOverview(props: Props) {
  // ---- window + mode (mode is parent-controlled) ----
  const mode: Mode = props.mode ?? "week";
  const startISO = useMemo(
    () => props.initialStartISO ?? startOfWeek(toISODate(new Date())),
    [props.initialStartISO]
  );
  const endISO = useMemo(
    () => addDays(startISO, (props.windowDays ?? 7 * 6) - 1),
    [startISO, props.windowDays]
  );
  const scale = useTimeScale({ mode, startISO, endISO });

  // How wide should the timeline content be? (ticks * unitPx)
  const ticks: unknown[] = (scale as any).ticks ?? [];
  const unitPx: number = (scale as any).unitPx ?? 24;
  const timelineWidth = Math.round(ticks.length * unitPx);

  // ---- data ----
  const [programs, setPrograms] = useState<Program[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activitiesRaw, setActivitiesRaw] = useState<Activity[]>([]);   // server truth
  const [activitiesView, setActivitiesView] = useState<Activity[]>([]); // local, draggable

  useEffect(() => {
    (async () => {
      const [pg, pj, ac] = await Promise.all([
        getPrograms(),
        getProjects(),
        getActivities(),
      ]);
      setPrograms(pg);
      setProjects(pj);
      setActivitiesRaw(ac);
      setActivitiesView(ac);
    })();
  }, []);

  // ---- expand/collapse state ----
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      return new Set(arr);
    } catch {
      return new Set();
    }
  });
  function persist(next: Set<string>) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
  }
  function toggleKey(k: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      persist(next);
      return next;
    });
  }

  // ---- groupings ----
  const projectsByProgram = useMemo(() => {
    const map = new Map<number, Project[]>();
    for (const p of projects) {
      const arr = map.get(p.programId) ?? [];
      arr.push(p);
      map.set(p.programId, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.id - b.id);
    return map;
  }, [projects]);

  const activitiesByProject = useMemo(() => {
    const map = new Map<number, Activity[]>();
    for (const a of activitiesView) {
      const arr = map.get(a.projectId) ?? [];
      arr.push(a);
      map.set(a.projectId, arr);
    }
    for (const arr of map.values()) arr.sort((a, b) => a.id - b.id);
    return map;
  }, [activitiesView]);

  // ---- drag handler: move an activity by N days ----
  async function handleDragDays(uid: string, deltaDays: number) {
    // optimistic local update
    setActivitiesView((prev) =>
      prev.map((a) =>
        a.uid === uid
          ? { ...a, start: addDays(a.start, deltaDays), end: addDays(a.end, deltaDays) }
          : a
      )
    );
    // server patch (best-effort)
    try {
      const a = activitiesRaw.find((x) => x.uid === uid);
      if (!a) return;
      const patch: Partial<Activity> = {
        start: addDays(a.start, deltaDays),
        end: addDays(a.end, deltaDays),
      };
      await updateActivity(uid, patch);
      // sync raw as well
      setActivitiesRaw((prev) => prev.map((x) => (x.uid === uid ? { ...x, ...patch } : x)));
    } catch {
      // rollback on failure
      setActivitiesView(activitiesRaw);
    }
  }

  async function handleResizeDays(uid: string, edge: "start" | "end", deltaDays: number) {
    // optimistic local update
    setActivitiesView(prev =>
      prev.map(a => {
        if (a.uid !== uid) return a;
        if (edge === "start") {
          return { ...a, start: addDays(a.start, deltaDays) };
        }
        return { ...a, end: addDays(a.end, deltaDays) };
      })
    );
    try {
      const a = activitiesRaw.find(x => x.uid === uid);
      if (!a) return;
      const patch: Partial<Activity> =
        edge === "start"
          ? { start: addDays(a.start, deltaDays) }
          : { end: addDays(a.end, deltaDays) };
      await updateActivity(uid, patch);
      setActivitiesRaw(prev => prev.map(x => (x.uid === uid ? { ...x, ...patch } : x)));
    } catch {
      setActivitiesView(activitiesRaw); // rollback
    }
  }

  // ---- flatten into TreeRows ----
  const rows: TreeRow[] = useMemo(() => {
    const out: TreeRow[] = [];
    for (const prog of programs) {
      const pKey = `P:${prog.id}`;
      const pExpanded = expanded.has(pKey);
      out.push({
        key: pKey,
        kind: "program",
        level: 0,
        label: prog.name,
        isParent: true,
        isExpanded: pExpanded,
        toggle: () => toggleKey(pKey),
        height: 32,
        renderRight: () => (
          <BarsRow
            scale={scale}
            bars={programSummaryBars(prog.id, projectsByProgram, activitiesByProject)}
            height={32}
            draggable={false}
          />
        ),
      });

      if (!pExpanded) continue;
      const projArr = projectsByProgram.get(prog.id) ?? [];
      for (const prj of projArr) {
        const jKey = `PRJ:${prj.id}`;
        const jExpanded = expanded.has(jKey);
        const acts = activitiesByProject.get(prj.id) ?? [];
        out.push({
          key: jKey,
          kind: "project",
          level: 1,
          label: prj.name,
          isParent: true,
          isExpanded: jExpanded,
          toggle: () => toggleKey(jKey),
          height: 32,
          renderRight: () => (
            <BarsRow scale={scale} bars={projectSummaryBars(acts)} height={32} draggable={false} />
          ),
        });

        if (!jExpanded) continue;

        for (const a of acts) {
          const aKey = `ACT:${a.uid}`;
          const bars: L2Bar[] = [
            {
              uid: a.uid,
              type: a.type,
              startISO: a.start,
              endISO: a.end,
              label: `${a.description} • ${a.type ?? ""}`,
            },
          ];
          out.push({
            key: aKey,
            kind: "activity",
            level: 2,
            label: `${a.description}`,
            isParent: false,
            height: 28,
            renderRight: () => (
              <BarsRow
                scale={scale}
                bars={bars}
                height={28}
                draggable
                resizable
                onDragDays={handleDragDays}
                onResizeDays={handleResizeDays}
              />
            ),
          });
        }
      }
    }
    return out;
  }, [programs, projectsByProgram, activitiesByProject, expanded, scale]);

  return (
    <div className="h-full flex flex-col">
      {/* Legend */}
      <div className="flex items-center gap-3 text-sm mb-2">
        <span className="opacity-70">Legend:</span>
        <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded bg-blue-500" /> manpower</span>
        <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded bg-amber-500" /> equipment</span>
        <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded bg-emerald-500" /> test</span>
        <span className="inline-flex items-center gap-1"><i className="w-3 h-3 rounded bg-slate-400" /> other</span>
      </div>

      <div className="flex-1 min-h-0">
        <TreeGrid
          rows={rows}
          rightHeader={<TimelineHeader scale={scale} />}
          rightContentWidth={timelineWidth}   // ⬅ tell TreeGrid how wide the right side is
        />
      </div>
    </div>
  );
}

function projectSummaryBars(acts: Activity[]): L2Bar[] {
  if (!acts.length) return [];
  const startISO = acts.reduce((m, a) => (a.start < m ? a.start : m), acts[0].start);
  const endISO = acts.reduce((m, a) => (a.end > m ? a.end : m), acts[0].end);
  return [
    {
      uid: `summary:${acts[0].projectId}`,
      type: "review",
      startISO,
      endISO,
      label: `Project span (${acts.length} activities)`,
    },
  ];
}

function programSummaryBars(
  progId: number,
  projectsByProgram: Map<number, Project[]>,
  activitiesByProject: Map<number, Activity[]>
): L2Bar[] {
  const projs = projectsByProgram.get(progId) ?? [];
  const acts: Activity[] = [];
  for (const p of projs) {
    const arr = activitiesByProject.get(p.id) ?? [];
    acts.push(...arr);
  }
  if (!acts.length) return [];
  const startISO = acts.reduce((m, a) => (a.start < m ? a.start : m), acts[0].start);
  const endISO   = acts.reduce((m, a) => (a.end   > m ? a.end   : m), acts[0].end);
  return [{
    uid: `program-summary:${progId}`,
    type: "review",                    // purple in your legend
    startISO,
    endISO,
    label: `Program span (${projs.length} projects)`,
  }];
}

