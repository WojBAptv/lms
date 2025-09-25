import express from "express";
import cors from "cors";
import activitiesRouter from "./routes/activities.js";
import programsRouter from "./routes/programs.js";
import projectsRouter from "./routes/projects.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/activities", activitiesRouter);

app.use("/api/programs", programsRouter);

app.use("/api/projects", projectsRouter);

const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`✅ LMS server listening on http://localhost:${PORT}`);
});
