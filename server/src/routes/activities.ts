import { Router } from "express";
import path from "path";
import { v4 as uuid } from "uuid";
import { ensureDataFile, readJson, writeJson } from "../lib/fileDb.js";
import { Activity, ActivityCreate, activityCreateSchema, activitySchema, posInt } from "../types.js";

type ActivityRow = Activity;

const router = Router();
const DATA_FILE = path.resolve(process.cwd(), "data", "activities.json");
(async () => {
  await ensureDataFile(DATA_FILE, [] as ActivityRow[]);
})();

async function getAll(): Promise<ActivityRow[]> {
  const items = await readJson<ActivityRow[]>(DATA_FILE);
  return items.sort((a, b) => (a.projectId - b.projectId) || (a.id - b.id));
}
async function saveAll(next: ActivityRow[]): Promise<void> {
  await writeJson<ActivityRow[]>(DATA_FILE, next);
}

function todayISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
function plusDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// GET /api/activities
router.get("/", async (_req, res) => {
  const items = await getAll();
  res.json(items);
});

// GET /api/activities/:uid
router.get("/:uid", async (req, res) => {
  const items = await getAll();
  const found = items.find((a) => a.uid === req.params.uid);
  if (!found) return res.status(404).json({ error: "Not found" });
  res.json(found);
});

// POST /api/activities
router.post("/", async (req, res) => {
  try {
    // validate incoming fields (lenient)
    const parsed = activityCreateSchema.parse(req.body);

    const items = await getAll();

    // next order number is within the project
    const projectItems = items.filter(a => a.projectId === parsed.projectId);
    const nextOrder = projectItems.reduce((m, r) => Math.max(m, r.id), 0) + 1;

    // default start/end to today if missing
    const today = new Date();
    const iso = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${dd}`;
    };
    const start = parsed.start ?? iso(today);
    const end = parsed.end ?? start;

    // build full row and validate strictly
    const row: Activity = activitySchema.parse({
      ...parsed,
      id: parsed.id ?? nextOrder,
      uid: uuid(),
      start,
      end,
    });

    items.push(row);
    await saveAll(items);
    res.status(201).json(row);
  } catch (err: any) {
    res.status(400).json({ error: err?.message ?? "Invalid payload" });
  }
});


// PUT /api/activities/:uid
router.put("/:uid", async (req, res) => {
  const uid = req.params.uid;
  const items = await getAll();
  const idx = items.findIndex((a) => a.uid === uid);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  const merged = { ...items[idx], ...req.body, uid } as Activity;

  // If id (order) changed, enforce uniqueness inside project
  if (req.body?.id !== undefined) {
    const idCheck = posInt.safeParse(req.body.id);
    if (!idCheck.success) return res.status(400).json({ error: "Invalid id (must be positive int > 0)" });
    const dup = items.some((a) => a.projectId === merged.projectId && a.id === merged.id && a.uid !== uid);
    if (dup) return res.status(409).json({ error: "id already used in this project" });
  }

  const val = activitySchema.safeParse(merged);
  if (!val.success) return res.status(400).json({ error: val.error.flatten() });

  items[idx] = val.data;
  await saveAll(items);
  res.json(items[idx]);
});

// DELETE /api/activities/:uid
router.delete("/:uid", async (req, res) => {
  const uid = req.params.uid;
  const items = await getAll();
  const next = items.filter((a) => a.uid !== uid);
  if (next.length === items.length) return res.status(404).json({ error: "Not found" });
  await saveAll(next);
  res.status(204).send();
});

/**
 * POST /api/activities/reseq
 * Body: { projectId: number, order: string[] }  // order is array of activity UIDs (desired order)
 * Returns: the resequenced activities within the project (id fields rewritten 1..N)
 */
router.post("/reseq", async (req, res) => {
  const { projectId, order } = req.body as { projectId?: number; order?: string[] };
  if (!projectId || !Array.isArray(order) || order.length === 0) {
    return res.status(400).json({ error: "Expected { projectId, order: string[] }" });
  }

  const items = await getAll();

  // All activities belonging to the project
  const within = items.filter((a) => a.projectId === Number(projectId));
  if (within.length === 0) return res.status(404).json({ error: `No activities for project ${projectId}` });

  const inProjectUids = new Set(within.map((a) => a.uid));

  // Validate: every uid in 'order' must be inside the project
  for (const uid of order) {
    if (!inProjectUids.has(uid)) {
      return res.status(400).json({ error: `uid ${uid} is not in project ${projectId}` });
    }
  }

  // Keep any missing uids (not listed) after the provided order, preserving their current relative order
  const missing = within.map((a) => a.uid).filter((uid) => !order.includes(uid));
  const finalOrder = order.concat(missing);

  // Build resequenced array with id = 1..N following finalOrder
  const byUid = new Map(within.map((a) => [a.uid, a]));
  const resequenced = finalOrder.map((uid, idx) => ({ ...byUid.get(uid)!, id: idx + 1 }));

  // Merge back into the full items list
  const next = items.map((a) => (a.projectId === Number(projectId) ? resequenced.find((b) => b.uid === a.uid)! : a));

  await saveAll(next);
  res.json(resequenced);
});

export default router;
