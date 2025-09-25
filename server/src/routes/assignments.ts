import { Router } from "express";
import path from "path";
import { ensureDataFile, readJson, writeJson } from "../lib/fileDb.js";
import {
  assignmentCreateSchema, assignmentSchema, type Assignment,
  posInt
} from "../types.js";

const router = Router();
const DATA_FILE = path.resolve(process.cwd(), "data", "assignments.json");
(async () => { await ensureDataFile(DATA_FILE, [] as Assignment[]); })();

async function getAll(): Promise<Assignment[]> {
  const items = await readJson<Assignment[]>(DATA_FILE);
  // order by staff then start date
  return items.sort((a, b) => (a.staffId - b.staffId) || (a.projectId - b.projectId) || a.start.localeCompare(b.start));
}
async function saveAll(items: Assignment[]) { await writeJson(DATA_FILE, items); }

router.get("/", async (_req, res) => {
  res.json(await getAll());
});

router.post("/", async (req, res) => {
  const parsed = assignmentCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const items = await getAll();

  let id: number;
  if (parsed.data.id !== undefined) {
    const ok = posInt.safeParse(parsed.data.id);
    if (!ok.success) return res.status(400).json({ error: "Invalid id" });
    if (items.some(a => a.id === parsed.data.id)) return res.status(409).json({ error: "id already exists" });
    id = parsed.data.id;
  } else {
    id = items.reduce((m, a) => Math.max(m, a.id), 0) + 1;
  }

  const next: Assignment = {
    id,
    staffId: parsed.data.staffId,
    projectId: parsed.data.projectId,
    start: parsed.data.start,
    end: parsed.data.end,
    notes: parsed.data.notes ?? ""
  };

  items.push(next);
  await saveAll(items);
  res.status(201).json(next);
});

router.put("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

  const items = await getAll();
  const idx = items.findIndex(a => a.id === id);
  if (idx === -1) return res.status(404).json({ error: "Not found" });

  const merged: Assignment = { ...items[idx], ...req.body, id };
  const val = assignmentSchema.safeParse(merged);
  if (!val.success) return res.status(400).json({ error: val.error.flatten() });

  items[idx] = val.data;
  await saveAll(items);
  res.json(items[idx]);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid id" });

  const items = await getAll();
  const next = items.filter(a => a.id !== id);
  if (next.length === items.length) return res.status(404).json({ error: "Not found" });
  await saveAll(next);
  res.status(204).send();
});

export default router;
