import express from "express";
import cors from "cors";
import activitiesRouter from "./routes/activities";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/activities", activitiesRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`✅ LMS server listening on http://localhost:${PORT}`);
});
