require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");

const db = require("./database");
const { loginUser } = require("./auth");
const { authenticateToken } = require("./authMiddleware");

const app = express();

const PORT = process.env.PORT || 3000;

/*
 * MIDDLEWARE
 */

app.use(express.json());

app.use(cookieParser());

/*
 * LOGOWANIE REQUESTÓW
 */

app.use((req, res, next) => {
  console.log("REQUEST:", req.method, req.url);

  if (req.body && Object.keys(req.body).length > 0) {
    console.log("BODY:", req.body);
  }

  next();
});

/*
 * FRONTEND
 */

app.use(express.static("public"));

/*
 * STATUS NODE.JS
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
    const [rows] = await db.execute("SELECT NOW() AS mysql_time");

    res.json({
      status: "OK",
      database: "connected",
      data: rows,
    });
  } catch (error) {
    console.error("Database error:", error);

    res.status(500).json({
      status: "ERROR",
      database: "disconnected",
      message: error.message,
    });
  }
});

/*
 * LOGOWANIE
 */

app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await loginUser(email, password);

    res.cookie("auth_token", result.token, {
      httpOnly: true,

      secure: process.env.NODE_ENV === "production",

      sameSite: "lax",

      maxAge: 7 * 24 * 60 * 60 * 1000,

      path: "/",
    });

    res.status(200).json({
      status: "OK",
      message: "Zalogowano pomyślnie",

      user: result.user,
    });
  } catch (error) {
    console.error("Login error:", error);

    res.status(401).json({
      status: "ERROR",
      message: error.message,
    });
  }
});

/*
 * WYLOGOWANIE
 */

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  res.json({
    status: "OK",
    message: "Wylogowano pomyślnie",
  });
});

/*
 * AKTUALNIE ZALOGOWANY UŻYTKOWNIK
 */

app.get("/api/auth/me", authenticateToken, async (req, res) => {
  try {
    const [users] = await db.execute(
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
    console.error("Auth me error:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Błąd serwera",
    });
  }
});

/*
 * START SERWERA
 */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Taxi app running on port ${PORT}`);
});
