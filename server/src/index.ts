import express from "express";
import cors from "cors";
import activitiesRouter from "./routes/activities.js";
import programsRouter from "./routes/programs.js";
import projectsRouter from "./routes/projects.js";
import staffRouter from "./routes/staff.js";
import assignmentsRouter from "./routes/assignments.js";
import capacityRouter from "./routes/capacity.js";


const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/activities", activitiesRouter);

app.use("/api/programs", programsRouter);

app.use("/api/projects", projectsRouter);

app.use("/api/staff", staffRouter);

app.use("/api/assignments", assignmentsRouter);

app.use("/api/capacity", capacityRouter);


const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(PORT, () => {
  console.log(`✅ LMS server listening on http://localhost:${PORT}`);
});
