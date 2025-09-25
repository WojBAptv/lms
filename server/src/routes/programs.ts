import { Router } from "express";
import path from "path";
import { ensureDataFile, readJson, writeJson } from "../lib/fileDb.js";
import { programCreateSchema, programSchema, type Program, posInt } from "../types.js";

const router = Router();
const DATA_FILE = path.resolve(process.cwd(), "data", "programs.json");
(async () => { await ensureDataFile(DATA_FILE, [] as Program[]); })();

async function getAll(): Promise<Program[]> {
  const items = await readJson<Program[]>(DATA_FILE);
  return items.sort((a, b) => a.id - b.id);
}
async function saveAll(items: Program[]) { await writeJson(DATA_FILE, items); }

router.get("/", async (_req, res) => {
  res.json(await getAll());
});

router.post("/", async (req, res) => {
  const parsed = programCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const items = await getAll();
  let id: number;
  if (parsed.data.id !== undefined) {
    const ok = posInt.safeParse(parsed.data.id);
    if (!ok.success) return res.status(400).json({ error: "Invalid id" });
    if (items.some(p => p.id === parsed.data.id)) return res.status(409).json({ error: "id already exists" });
    id = parsed.data.id;
  } else {
    id = items.reduce((m, p) => Math.max(m, p.id), 0) + 1;
  }
  const next: Program = { id, name: parsed.data.name };
  items.push(next);
  await saveAll(items);
  res.status(201).json(next);
});

export default router;
