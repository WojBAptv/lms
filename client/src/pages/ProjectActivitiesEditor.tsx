import { useEffect, useMemo, useRef, useState } from "react";
import {
  getProjects,
  getActivities,
  updateActivity,
  resequenceActivities,
  getTimeEntriesByProject,
  createTimeEntry,
  createActivity,            // ← NEW
  type Project,
  type Activity,
  type TimeEntry,
} from "@/lib/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { toast } from "sonner";
import { ArrowUpDown, Plus, ArrowUp, ArrowDown } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";

type Row = Activity;

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function earliest(entries: TimeEntry[]): string | "" {
  if (!entries.length) return "";
  return entries.map((e) => e.date).sort()[0]!;
}
function sumHours(entries: TimeEntry[]): number {
  return Math.round(entries.reduce((s, e) => s + (e.hours ?? 0), 0) * 100) / 100;
}

// Single source of truth for column widths (header + rows)
const COLS =
  "90px minmax(280px,1fr) 160px 140px 130px 180px 160px minmax(160px,1fr)";

export default function ProjectActivitiesEditor() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => {
    const raw = localStorage.getItem("l1:selectedProjectId");
    return raw ? Number(raw) : null;
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [sortKey, setSortKey] = useState<"id" | "description">("id");
  const [sortAsc, setSortAsc] = useState(true);

  useEffect(() => {
    getProjects().then(setProjects).catch(() => toast.error("Failed to load projects"));
  }, []);

  useEffect(() => {
    if (selectedProjectId == null) return;
    localStorage.setItem("l1:selectedProjectId", String(selectedProjectId));

    getActivities()
      .then((all) =>
        setRows(all.filter((a) => a.projectId === selectedProjectId).sort((a, b) => a.id - b.id))
      )
      .catch(() => toast.error("Failed to load activities"));

    getTimeEntriesByProject(selectedProjectId).then(setTimeEntries).catch(() => {});
  }, [selectedProjectId]);

  const byActivity = useMemo(() => {
    const m = new Map<string, TimeEntry[]>();
    for (const te of timeEntries) {
      const arr = m.get(te.activityUid) ?? [];
      arr.push(te);
      m.set(te.activityUid, arr);
    }
    return m;
  }, [timeEntries]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    const dir = sortAsc ? 1 : -1;
    if (sortKey === "id") return arr; // preserve manual order for reseq
    arr.sort((a, b) => a.description.localeCompare(b.description) * dir);
    return arr;
  }, [rows, sortKey, sortAsc]);

  // Virtualization
  const parentRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44, // row height
    overscan: 10,
  });

  async function commit(uid: string, patch: Partial<Activity>) {
    try {
      const next = await updateActivity(uid, patch);
      setRows((prev) => prev.map((r) => (r.uid === uid ? { ...r, ...next } : r)));
      toast.success("Saved");
    } catch {
      toast.error("Save failed");
    }
  }

  async function move(uid: string, dir: -1 | 1) {
    const idx = rows.findIndex((r) => r.uid === uid);
    if (idx === -1) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= rows.length) return;

    // optimistic swap
    const optimistic = [...rows];
    [optimistic[idx], optimistic[swapIdx]] = [optimistic[swapIdx], optimistic[idx]];
    setRows(optimistic);

    try {
      const resequenced = await resequenceActivities(
        selectedProjectId!,
        optimistic.map((r) => r.uid)
      );
      setRows(resequenced); // apply ids from server
      toast.success("Order updated");
    } catch {
      toast.error("Reorder failed");
    }
  }

  function startedOnFor(r: Activity) {
    const entries = byActivity.get(r.uid) ?? [];
    return entries.length ? entries.map((e) => e.date).sort()[0]! : "";
  }
  function hoursFor(r: Activity) {
    const entries = byActivity.get(r.uid) ?? [];
    return Math.round(entries.reduce((s, e) => s + (e.hours ?? 0), 0) * 100) / 100;
  }

  async function addActivity() {
    if (!selectedProjectId) return;
    try {
        const created = await createActivity({
        projectId: selectedProjectId,
        description: "New activity",
        type: "manpower",
        resource: "",
        sequence: "",
        // start/end will default to today inside createActivity()
        } as any);
        setRows(prev => [...prev, created]);
        toast.success("Activity created");
        requestAnimationFrame(() => rowVirtualizer.scrollToIndex(rows.length, { align: "center" }));
    } catch {
        toast.error("Create failed");
    }
  }

  return (
    <div className="h-full min-h-0 flex flex-col">{/* ← min-h-0 fixes short viewport */}
      <header className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">Project Activities</h1>
          <Select
            value={selectedProjectId?.toString() ?? ""}
            onValueChange={(v: string) => setSelectedProjectId(Number(v))}
          >
            <SelectTrigger className="w-[280px]">
              <SelectValue placeholder="Select project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id.toString()}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Button
            variant="ghost"
            onClick={() => {
              setSortKey("id");
              setSortAsc(!sortAsc);
            }}
          >
            ID <ArrowUpDown className="w-4 h-4 ml-1" />
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setSortKey("description");
              setSortAsc(!sortAsc);
            }}
          >
            Description <ArrowUpDown className="w-4 h-4 ml-1" />
          </Button>

          {selectedProjectId && <Button onClick={addActivity}>+ Activity</Button>}
        </div>
      </header>

      {!selectedProjectId ? (
        <div className="text-muted-foreground">Pick a project to start editing.</div>
      ) : (
        // Scroll container
        <div
          ref={parentRef}
          className="flex-1 min-h-0 overflow-auto rounded-xl border"
        >
          {/* Header row (grid) */}
          <div
            className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b grid items-center px-3 h-11"
            style={{ gridTemplateColumns: COLS }}
          >
            <div className="text-sm text-muted-foreground">ID</div>
            <div className="text-sm text-muted-foreground">Description</div>
            <div className="text-sm text-muted-foreground">Type</div>
            <div className="text-sm text-muted-foreground">Duration (days)</div>
            <div className="text-sm text-muted-foreground">Started on</div>
            <div className="text-sm text-muted-foreground">Hours entered</div>
            <div className="text-sm text-muted-foreground">Finished on</div>
            <div className="text-sm text-muted-foreground">Assignment</div>
          </div>

          {/* Virtualized rows */}
          <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
            {rowVirtualizer.getVirtualItems().map((v) => {
              const r = sorted[v.index]!;
              const startedOn = startedOnFor(r);
              const hours = hoursFor(r);

              return (
                <div
                  key={r.uid}
                  className="grid items-center px-3 h-11 border-b"
                  style={{
                    position: "absolute",
                    top: v.start,
                    left: 0,
                    right: 0,
                    gridTemplateColumns: COLS,
                  }}
                >
                  {/* ID + up/down */}
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" onClick={() => move(r.uid, -1)}>
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <span className="w-8 text-right tabular-nums">{r.id}</span>
                    <Button size="icon" variant="ghost" onClick={() => move(r.uid, +1)}>
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Description */}
                  <Input
                    defaultValue={r.description}
                    onBlur={(e) => {
                      const v = e.currentTarget.value.trim();
                      if (v !== r.description) commit(r.uid, { description: v });
                    }}
                  />

                  {/* Type */}
                  <div className="pr-2">
                    <Select
                      defaultValue={r.type}
                      onValueChange={(v: string) => commit(r.uid, { type: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="manpower">manpower</SelectItem>
                        <SelectItem value="equipment">equipment</SelectItem>
                        <SelectItem value="test">test</SelectItem>
                        <SelectItem value="review">review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Duration */}
                  <Input
                    type="number"
                    min={1}
                    defaultValue={(r as any).durationDays ?? 1}
                    onBlur={(e) => {
                      const v = Number(e.currentTarget.value);
                      if (Number.isFinite(v) && v > 0 && v !== (r as any).durationDays)
                        commit(r.uid, { durationDays: v } as any);
                    }}
                  />

                  {/* Started on */}
                  <span className="tabular-nums">{startedOn || "—"}</span>

                  {/* Hours entered + popover */}
                  <div className="flex items-center gap-2">
                    <span className="tabular-nums">{hours.toFixed(2)}</span>
                    <AddHoursPopover
                      activity={r}
                      onAdded={(created) => setTimeEntries((prev) => [...prev, created])}
                    />
                  </div>

                  {/* Finished on */}
                  <Input
                    type="date"
                    defaultValue={(r as any).finishedOn ?? ""}
                    onBlur={(e) => {
                      const v = e.currentTarget.value;
                      if (v && v !== (r as any).finishedOn)
                        commit(r.uid, { finishedOn: v } as any);
                    }}
                  />

                  {/* Assignment */}
                  <Input
                    defaultValue={r.resource ?? ""}
                    placeholder="assignment"
                    onBlur={(e) => {
                      const v = e.currentTarget.value;
                      if (v !== (r.resource ?? "")) commit(r.uid, { resource: v });
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function AddHoursPopover({
  activity,
  onAdded,
}: {
  activity: Activity;
  onAdded: (e: TimeEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<string>(() => toISO(new Date()));
  const [hours, setHours] = useState<number>(1);
  const [note, setNote] = useState<string>("");

  async function save() {
    try {
      const created = await createTimeEntry({
        activityUid: activity.uid,
        projectId: activity.projectId,
        date,
        hours,
        note,
      } as any);
      onAdded(created);
      setOpen(false);
      setHours(1);
      setNote("");
      toast.success("+ Hours added");
    } catch {
      toast.error("Failed to add hours");
    }
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 px-2">
          <Plus className="w-4 h-4 mr-1" /> Hours
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm">Date</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.currentTarget.value)} />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-sm">Hours</label>
            <Input
              type="number"
              min={0.25}
              step={0.25}
              value={hours}
              onChange={(e) => setHours(Number(e.currentTarget.value))}
            />
          </div>
          <Input
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.currentTarget.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
