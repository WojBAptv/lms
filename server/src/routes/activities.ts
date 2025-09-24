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
  const [y,m,d] = iso.split("-").map(Number);
  const dt = new Date(y, m-1, d + days);
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
  const found = items.find(a => a.uid === req.params.uid);
  if (!found) return res.status(404).json({ error: "Not found" });
  res.json(found);
});

// POST /api/activities
router.post("/", async (req, res) => {
  const parsed = activityCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const payload = parsed.data as ActivityCreate;
  const items = await getAll();

  // id (order) within project
  let id: number;
  if (payload.id !== undefined) {
    const idCheck = posInt.safeParse(payload.id);
    if (!idCheck.success) return res.status(400).json({ error: "Invalid id (must be positive int > 0)" });
    const dup = items.some(a => a.projectId === payload.projectId && a.id === payload.id);
    if (dup) return res.status(409).json({ error: "id already used in this project" });
    id = payload.id;
  } else {
    const maxId = items.filter(a => a.projectId === payload.projectId).reduce((n, a) => Math.max(n, a.id), 0);
    id = maxId + 1;
  }

  const start = payload.start ?? todayISO();
  const end = payload.end ?? plusDays(start, 4); // default duration 5 days

  const newItem: ActivityRow = {
    uid: uuid(),
    id,
    projectId: payload.projectId,
    description: payload.description,
    type: payload.type,
    resource: payload.resource ?? "",
    sequence: payload.sequence ?? "",
    legId: payload.legId,
    start,
    end
  };

  items.push(newItem);
  await saveAll(items);
  res.status(201).json(newItem);
});

// PUT /api/activities/:uid
router.put("/:uid", async (req, res) => {
  const uid = req.params.uid;
  const items = await getAll();
  const idx = items.findIndex(a => a.uid === uid);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  const merged = { ...items[idx], ...req.body, uid } as Activity;

  // If id (order) changed, enforce uniqueness inside project
  if (req.body?.id !== undefined) {
    const idCheck = posInt.safeParse(req.body.id);
    if (!idCheck.success) return res.status(400).json({ error: "Invalid id (must be positive int > 0)" });
    const dup = items.some(a => a.projectId === merged.projectId && a.id === merged.id && a.uid !== uid);
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
  const next = items.filter(a => a.uid !== uid);
  if (next.length === items.length) return res.status(404).json({ error: "Not found" });
  await saveAll(next);
  res.status(204).send();
});

export default router;
