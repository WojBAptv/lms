// server/src/routes/capacity.ts
import { Router } from "express";
import path from "path";
import { z } from "zod";
import { ensureDataFile, readJson, writeJson } from "../lib/fileDb.js";
import { posInt, isoDate } from "../types.js";

const router = Router();

const DATA_DIR = path.resolve(process.cwd(), "data");
const STAFF_FILE = path.join(DATA_DIR, "staff.json");
const ASSIGN_FILE = path.join(DATA_DIR, "assignments.json");
const RULES_FILE = path.join(DATA_DIR, "capacityRules.json");

type Staff = { id: number; name: string };
type Assignment = { id: number; staffId: number; projectId: number; start: string; end: string; notes?: string };

// Zod schemas for capacity rules
const weekday = z.number().int().min(1).max(7); // 1=Mon … 7=Sun
const capacityRulesSchema = z.object({
  defaultHoursPerDay: z.number().min(0).default(8),
  workdays: z.array(weekday).default([1,2,3,4,5]), // Mon–Fri
  staffOverrides: z.array(z.object({
    staffId: posInt,
    hoursPerDay: z.number().min(0),
    workdays: z.array(weekday).optional()
  })).default([]),
  exceptions: z.array(z.object({
    date: isoDate,
    hours: z.number().min(0).optional(), // if omitted → 0h
    staffId: posInt.optional(),
    reason: z.string().optional()
  })).default([]),
});
type CapacityRules = z.infer<typeof capacityRulesSchema>;

const defaultRules: CapacityRules = {
  defaultHoursPerDay: 8,
  workdays: [1,2,3,4,5],
  staffOverrides: [],
  exceptions: []
};

// Helpers
function parseISO(s: string) { const [y,m,d] = s.split("-").map(Number); return new Date(y, m-1, d); }
function toISO(d: Date) { const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,"0"), day=String(d.getDate()).padStart(2,"0"); return `${y}-${m}-${day}`; }
function addDaysISO(iso: string, n: number) { const d=parseISO(iso); d.setDate(d.getDate()+n); return toISO(d); }
function weekdayFromISO(iso: string): 1|2|3|4|5|6|7 { const w = parseISO(iso).getDay(); return ((w+6)%7 + 1) as any; } // JS 0=Sun → 7,1..6
function startOfISOWeek(iso: string) { // Monday
  const d = parseISO(iso);
  const day = (d.getDay()+6)%7; // 0..6 with Mon=0
  d.setDate(d.getDate()-day);
  return toISO(d);
}
function startOfMonthISO(iso: string) {
  const d=parseISO(iso); d.setDate(1); return toISO(d);
}

const forecastQuerySchema = z.object({
  from: isoDate,
  to: isoDate,
  bucket: z.enum(["day","week","month"]).default("week")
});

// Ensure files exist
(async () => {
  await ensureDataFile(STAFF_FILE, [] as Staff[]);
  await ensureDataFile(ASSIGN_FILE, [] as Assignment[]);
  await ensureDataFile(RULES_FILE, defaultRules);
})();

// ---- GET /api/capacity/rules
router.get("/rules", async (_req, res) => {
  const raw = await readJson<unknown>(RULES_FILE);
  const parsed = capacityRulesSchema.safeParse(raw);
  const rules = parsed.success ? parsed.data : defaultRules;
  res.json(rules);
});

// ---- PUT /api/capacity/rules  (replace)
router.put("/rules", async (req, res) => {
  const parsed = capacityRulesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await writeJson(RULES_FILE, parsed.data);
  res.json(parsed.data);
});

// ---- GET /api/capacity/forecast
router.get("/forecast", async (req, res) => {
  const parsed = forecastQuerySchema.safeParse({
    from: req.query.from,
    to: req.query.to,
    bucket: req.query.bucket ?? "week",
  });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { from, to, bucket } = parsed.data;
  if (from > to) return res.status(400).json({ error: "from must be <= to" });

  const staff = await readJson<Staff[]>(STAFF_FILE);
  const assignments = await readJson<Assignment[]>(ASSIGN_FILE);
  const rulesRaw = await readJson<unknown>(RULES_FILE);
  const rules = capacityRulesSchema.parse(rulesRaw);

  // Build quick lookup for overrides and exceptions
  const staffHours = new Map<number, number>(); // default per staff
  const staffWorkdays = new Map<number, Set<number>>();
  for (const s of staff) {
    staffHours.set(s.id, rules.defaultHoursPerDay);
    staffWorkdays.set(s.id, new Set(rules.workdays));
  }
  for (const o of rules.staffOverrides) {
    if (o.hoursPerDay !== undefined) staffHours.set(o.staffId, o.hoursPerDay);
    if (o.workdays) staffWorkdays.set(o.staffId, new Set(o.workdays));
  }
  // Exceptions by date: global and per-staff
  const globalExc = new Map<string, number>(); // date -> hours (0 if missing)
  const perStaffExc = new Map<string, Map<number, number>>(); // date -> (staffId -> hours)
  for (const e of rules.exceptions) {
    const hrs = e.hours ?? 0;
    if (e.staffId) {
      if (!perStaffExc.has(e.date)) perStaffExc.set(e.date, new Map());
      perStaffExc.get(e.date)!.set(e.staffId, hrs);
    } else {
      globalExc.set(e.date, hrs);
    }
  }

  // Per-day computations
  type DayRow = { date: string; available: number; needed: number; };
  const days: DayRow[] = [];
  for (let d = from; d <= to; d = addDaysISO(d, 1)) {
    const wd = weekdayFromISO(d);
    // Available: sum across staff if it's a working day for that staff; then apply exceptions
    let avail = 0;
    for (const s of staff) {
      const canWork = staffWorkdays.get(s.id)?.has(wd) ?? false;
      if (!canWork) continue;
      let h = staffHours.get(s.id) ?? rules.defaultHoursPerDay;
      // global exception?
      if (globalExc.has(d)) h = globalExc.get(d)!;
      // per-staff exception overrides global
      const perStaff = perStaffExc.get(d)?.get(s.id);
      if (typeof perStaff === "number") h = perStaff;
      avail += h;
    }

    // Needed: for each assignment touching this date, we add that staff's daily capacity.
    // (So 2 overlapping assignments for the same staff double-count → shows overload.)
    let need = 0;
    for (const a of assignments) {
      if (a.start <= d && d <= a.end) {
        // If staff doesn’t work on this weekday, we still count their nominal hours-per-day here,
        // because “needed work” is task demand; you can flip this logic if you prefer.
        let h = staffHours.get(a.staffId) ?? rules.defaultHoursPerDay;
        // If there’s a per-staff exception giving 0h (PTO), the *available* will drop but the *needed* stays (backlog).
        need += h;
      }
    }

    days.push({ date: d, available: avail, needed: need });
  }

  // Bucketize
  type Point = { bucketStart: string; available: number; needed: number };
  const points = new Map<string, Point>();

  function push(date: string, available: number, needed: number) {
    let key: string;
    if (bucket === "day") key = date;
    else if (bucket === "week") key = startOfISOWeek(date);
    else key = startOfMonthISO(date);

    const p = points.get(key) ?? { bucketStart: key, available: 0, needed: 0 };
    p.available += available;
    p.needed += needed;
    points.set(key, p);
  }

  for (const r of days) push(r.date, r.available, r.needed);

  const result = Array.from(points.values()).sort((a,b) => a.bucketStart.localeCompare(b.bucketStart));

  res.json({ bucket, points: result });
});

export default router;
