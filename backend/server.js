import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import pkg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ---------------------------
// PostgreSQL Pool
// ---------------------------
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // используется переменная окружения Railway
  ssl: { rejectUnauthorized: false } // обязательно для удалённых PostgreSQL
});

// ------------------------------------------------------
// ОТДАЁМ ФРОНТ
// ------------------------------------------------------
app.use(express.static(path.join(__dirname, "frontend"))); // путь внутри backend

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend/index.html"));
});

// ------------------------------------------------------
// ЭНДПОИНТ: УСТРОЙСТВО
// ------------------------------------------------------
app.get("/device/:id", async (req, res) => {
  const id = req.params.id.trim();
  try {
    const result = await pool.query(
      "SELECT * FROM devices WHERE device_id = $1",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Device not found" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Ошибка /device:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------------------------
// ЭНДПОИНТ: ДОБАВИТЬ В ИСТОРИЮ
// ------------------------------------------------------
app.post("/history/:id", async (req, res) => {
  const id = req.params.id.trim();
  try {
    await pool.query(
      "INSERT INTO history (device_id) VALUES ($1)",
      [id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Ошибка /history (POST):", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------------------------
// ЭНДПОИНТ: ПОЛУЧИТЬ ИСТОРИЮ
// ------------------------------------------------------
app.get("/history", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, h.scanned_at
      FROM history h
      JOIN devices d ON d.device_id = h.device_id
      ORDER BY h.scanned_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка /history (GET):", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------------------------
// ЭНДПОИНТ: ДОБАВИТЬ В ИЗБРАННОЕ
// ------------------------------------------------------
app.post("/favorite/:id", async (req, res) => {
  const id = req.params.id.trim();
  try {
    await pool.query(
      `INSERT INTO favorites (device_id)
       VALUES ($1)
       ON CONFLICT (device_id) DO NOTHING`,
      [id]
    );
    res.json({ success: true, status: "added" });
  } catch (err) {
    console.error("Ошибка /favorite (POST):", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------------------------
// ЭНДПОИНТ: УДАЛИТЬ ИЗ ИЗБРАННОГО
// ------------------------------------------------------
app.delete("/favorite/:id", async (req, res) => {
  const id = req.params.id.trim();
  try {
    await pool.query(
      "DELETE FROM favorites WHERE device_id = $1",
      [id]
    );
    res.json({ success: true, status: "removed" });
  } catch (err) {
    console.error("Ошибка /favorite (DELETE):", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------------------------
// ЭНДПОИНТ: ПОЛУЧИТЬ ИЗБРАННОЕ
// ------------------------------------------------------
app.get("/favorites", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*
      FROM favorites f
      JOIN devices d ON d.device_id = f.device_id
      ORDER BY f.created_at DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Ошибка /favorites:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ------------------------------------------------------
// СТАРТ СЕРВЕРА
// ------------------------------------------------------
const PORT = process.env.PORT || 3000; // Render/Railway назначает порт через переменную окружения
app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
