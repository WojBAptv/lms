import { Router } from "express";
import path from "path";
import { ensureDataFile, readJson, writeJson } from "../lib/fileDb.js";
import { timeEntryCreateSchema, timeEntrySchema, type TimeEntry } from "../types.js";

type Row = TimeEntry;

const router = Router();
const DATA_FILE = path.resolve(process.cwd(), "data", "timeEntries.json");
(async () => { await ensureDataFile(DATA_FILE, [] as Row[]); })();

async function getAll(): Promise<Row[]> { return readJson<Row[]>(DATA_FILE); }
async function saveAll(rows: Row[]): Promise<void> { await writeJson<Row[]>(DATA_FILE, rows); }

// GET /api/time-entries?activityUid=...&projectId=...
router.get("/", async (req, res) => {
  const items = await getAll();
  const { activityUid, projectId } = req.query as { activityUid?: string, projectId?: string };
  let out = items;
  if (activityUid) out = out.filter(r => r.activityUid === activityUid);
  if (projectId) out = out.filter(r => String(r.projectId ?? "") === String(projectId));
  res.json(out);
});

// POST /api/time-entries
router.post("/", async (req, res) => {
  const items = await getAll();
  const parse = timeEntryCreateSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const nextId = items.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  const row: Row = { id: nextId, ...parse.data };
  items.push(row);
  await saveAll(items);
  res.status(201).json(row);
});

// PUT /api/time-entries/:id
router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const items = await getAll();
  const idx = items.findIndex(r => r.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });
  const merged = { ...items[idx], ...req.body, id };
  const parse = timeEntrySchema.safeParse(merged);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  items[idx] = parse.data;
  await saveAll(items);
  res.json(items[idx]);
});

// DELETE /api/time-entries/:id
router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const items = await getAll();
  const next = items.filter(r => r.id !== id);
  if (next.length === items.length) return res.status(404).json({ error: "Not found" });
  await saveAll(next);
  res.status(204).send();
});

export default router;
