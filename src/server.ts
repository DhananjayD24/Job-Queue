import express from "express";
import dotenv from "dotenv";
import pool from "./db/pool.js";

import jobRoutes from "./jobs/job.routes.js";

dotenv.config();

const app = express();

app.use(express.json());

app.get("/", (_req, res) => {
  res.json({
    message: "Reliable Job Queue API is running",
  });
});

app.get("/health", async (_req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");

    res.json({
      status: "ok",
      database: "connected",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database connection failed:", error);

    res.status(500).json({
      status: "error",
      database: "disconnected",
    });
  }
});

app.use("/jobs", jobRoutes);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});