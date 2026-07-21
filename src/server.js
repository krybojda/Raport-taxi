const express = require("express");
const mysql = require("mysql2/promise");

const app = express();

const PORT = process.env.PORT || 3000;

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ssl: {
    rejectUnauthorized: false,
  },
});

app.use(express.static("public"));

app.get("/api/status", (req, res) => {
  res.json({
    status: "OK",
    node: "running",
  });
});

app.get("/api/database", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT NOW() AS mysql_time");

    res.json({
      status: "OK",
      database: "connected",
      data: rows,
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: "ERROR",
      message: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Taxi app running on port ${PORT}`);
});
