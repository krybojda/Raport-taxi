require("dotenv").config();

const express = require("express");

const db = require("./database");

const { loginUser } = require("./auth");

const { authenticateToken } = require("./authMiddleware");

const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use(express.static("public"));

/*
 * STATUS APLIKACJI
 */
app.get("/api/status", (req, res) => {
  res.json({
    status: "OK",
    node: "running",
  });
});

/*
 * STATUS BAZY DANYCH
 */
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
      database: "disconnected",
      message: error.message,
    });
  }
});

/*
 * LOGI ŻĄDAŃ
 */
app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.url);
  console.log("BODY:", req.body);

  next();
});

/*
 * LOGOWANIE
 */
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "ERROR",
        message: "Email i hasło są wymagane",
      });
    }

    const result = await loginUser(email, password);

    res.json({
      status: "OK",
      message: "Zalogowano pomyślnie",

      data: result,
    });
  } catch (error) {
    console.error(error);

    res.status(401).json({
      status: "ERROR",
      message: error.message,
    });
  }
});

/*
 * AKTUALNIE ZALOGOWANY UŻYTKOWNIK
 */
app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const [users] = await db.query(
      `
        SELECT
          id,
          email,
          name,
          role,
          status
        FROM users
        WHERE id = ?
        LIMIT 1
        `,
      [req.user.userId],
    );

    if (users.length === 0) {
      return res.status(404).json({
        status: "ERROR",
        message: "Użytkownik nie istnieje",
      });
    }

    const user = users[0];

    if (user.status !== "active") {
      return res.status(403).json({
        status: "ERROR",
        message: "Konto jest nieaktywne",
      });
    }

    res.json({
      status: "OK",

      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      status: "ERROR",
      message: "Błąd serwera",
    });
  }
});

/*
 * START SERWERA
 */
app.listen(PORT, () => {
  console.log(`Taxi app running on port ${PORT}`);
});
