import { Router } from "express";
import path from "path";
import { ensureDataFile, readJson, writeJson } from "../lib/fileDb.js";
import { staffSchema, type Staff, posInt } from "../types.js";
import { z } from "zod";  

const router = Router();
const DATA_FILE = path.resolve(process.cwd(), "data", "staff.json");
(async () => { await ensureDataFile(DATA_FILE, [] as Staff[]); })();

async function getAll(): Promise<Staff[]> {
  const items = await readJson<Staff[]>(DATA_FILE);
  return items.sort((a, b) => a.id - b.id);
}
async function saveAll(items: Staff[]) { await writeJson(DATA_FILE, items); }

const staffCreateSchema = z.object({ name: z.string().min(1), id: posInt.optional() });

router.get("/", async (_req, res) => {
  res.json(await getAll());
});

router.post("/", async (req, res) => {
  const parsed = staffCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const items = await getAll();
  let id: number;
  if (parsed.data.id !== undefined) {
    const ok = posInt.safeParse(parsed.data.id);
    if (!ok.success) return res.status(400).json({ error: "Invalid id" });
    if (items.some(s => s.id === parsed.data.id)) return res.status(409).json({ error: "id already exists" });
    id = parsed.data.id;
  } else {
    id = items.reduce((m, s) => Math.max(m, s.id), 0) + 1;
  }
  const next: Staff = { id, name: parsed.data.name };
  items.push(next);
  await saveAll(items);
  res.status(201).json(next);
});

export default router;
