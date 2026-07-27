require("dotenv").config();

const express = require("express");
const cookieParser = require("cookie-parser");

const db = require("./database");
const { loginUser } = require("./auth");
const { authenticateToken } = require("./authMiddleware");

const { startWork, stopWork, getCurrentWork, getTodayWork, getRecentWork } = require("./work");

const { addCashEntry, getCurrentSessionCash, getTodayCash } = require("./cash");

const { getHistory } = require("./history");

const { upsertDayTotal, getTodayTotal } = require("./dayTotals");

const { setCurrentWorkAppAmount } = require("./work");
const { getDashboardSummary } = require("./summary");

function getRangeStart(period) {
  if (period === "day") {
    return "CURDATE()";
  }

  if (period === "week") {
    return "DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)";
  }

  if (period === "month") {
    return "DATE_FORMAT(CURDATE(), '%Y-%m-01')";
  }

  return "CURDATE()";
}

function getRangeEnd(period) {
  if (period === "day") {
    return "CURDATE()";
  }

  if (period === "week") {
    return "DATE_ADD(DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), INTERVAL 6 DAY)";
  }

  if (period === "month") {
    return "LAST_DAY(CURDATE())";
  }

  return "CURDATE()";
}

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
    const { name, password } = req.body;

    const result = await loginUser(name, password);

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
        username: user.name,
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
 * ROZPOCZĘCIE PRACY
 */

app.post("/api/work/start", authenticateToken, async (req, res) => {
  try {
    const session = await startWork(req.user.userId);

    res.status(201).json({
      status: "OK",
      message: "Praca została rozpoczęta",
      session,
    });
  } catch (error) {
    console.error("Start work error:", error);

    res.status(400).json({
      status: "ERROR",
      message: error.message,
    });
  }
});

/*
 * ZAKOŃCZENIE PRACY
 */

app.post("/api/work/stop", authenticateToken, async (req, res) => {
  try {
    const session = await stopWork(req.user.userId);

    res.json({
      status: "OK",
      message: "Praca została zakończona",
      session,
    });
  } catch (error) {
    console.error("Stop work error:", error);

    res.status(400).json({
      status: "ERROR",
      message: error.message,
    });
  }
});

/*
 * AKTUALNA SESJA PRACY
 */

app.get("/api/work/current", authenticateToken, async (req, res) => {
  try {
    const session = await getCurrentWork(req.user.userId);

    res.json({
      status: "OK",

      working: session !== null,

      session,
    });
  } catch (error) {
    console.error("Current work error:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Błąd pobierania statusu pracy",
    });
  }
});

/*
 * DZISIEJSZE SESJE PRACY
 */

app.get("/api/work/today", authenticateToken, async (req, res) => {
  try {
    const sessions = await getTodayWork(req.user.userId);

    const totalSeconds = sessions.reduce((total, session) => {
      return total + Number(session.duration_seconds || 0);
    }, 0);

    res.json({
      status: "OK",

      date: new Date().toISOString().split("T")[0],

      sessions,

      total_seconds: totalSeconds,
    });
  } catch (error) {
    console.error("Today work error:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Błąd pobierania sesji pracy",
    });
  }
});

app.get("/api/work/recent", authenticateToken, async (req, res) => {
  try {
    const sessions = await getRecentWork(req.user.userId);

    return res.json({ sessions });
  } catch (error) {
    console.error("Recent work error:", error);

    return res.status(500).json({
      message: "B??d pobierania ostatnich sesji pracy",
    });
  }
});

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
 * Dodawnie wpisu gotówkowego
 */

app.post("/api/cash/add", authenticateToken, async (req, res) => {
  try {
    const { amount, source, note } = req.body;

    const entry = await addCashEntry(req.user.userId, amount, source, note);

    res.status(201).json({
      status: "OK",
      message: "Gotówka została zapisana",
      entry,
    });
  } catch (error) {
    console.error("Cash add error:", error);

    res.status(400).json({
      status: "ERROR",
      message: error.message,
    });
  }
});

/*
 * Aktywna sesja gotówkowa
 */
app.get("/api/cash/current-session", authenticateToken, async (req, res) => {
  try {
    const data = await getCurrentSessionCash(req.user.userId);

    res.json({
      status: "OK",
      ...data,
    });
  } catch (error) {
    console.error("Cash current-session error:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Błąd pobierania gotówki z aktywnej sesji",
    });
  }
});

/*
 * Dzisiaj gotówka
 */
app.get("/api/cash/today", authenticateToken, async (req, res) => {
  try {
    const data = await getTodayCash(req.user.userId);

    res.json({
      status: "OK",
      ...data,
    });
  } catch (error) {
    console.error("Cash today error:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Błąd pobierania gotówki z dnia",
    });
  }
});

/*
 * Historia
 */
app.get("/api/history", authenticateToken, async (req, res) => {
  try {
    const data = await getHistory(req.user.userId, {
      from: req.query.from,
      to: req.query.to,
      type: req.query.type,
      source: req.query.source,
      sort: req.query.sort,
    });

    res.json({
      status: "OK",
      ...data,
    });
  } catch (error) {
    console.error("History error:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Błąd pobierania historii",
    });
  }
});

/*
 * Podsumowanie
 */
app.get("/api/dashboard/summary", authenticateToken, async (req, res) => {
  try {
    const summary = await getDashboardSummary(req.user.userId);

    res.json({
      status: "OK",
      summary,
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Błąd pobierania podsumowania",
    });
  }
});

/*
 * ZAPIS PODSUMOWANIA DNIA
 */
app.post("/api/day-total/save", authenticateToken, async (req, res) => {
  try {
    const { cash_total, apps_total, note } = req.body;

    const today = new Date().toISOString().slice(0, 10);

    const result = await upsertDayTotal(req.user.userId, today, cash_total, apps_total, note);

    res.json({
      status: "OK",
      message: "Rozliczenie dnia zostało zapisane",
      data: result,
    });
  } catch (error) {
    console.error("Day total save error:", error);

    res.status(400).json({
      status: "ERROR",
      message: error.message,
    });
  }
});

/*
 * PODSUMOWANIE DNIA
 */
app.get("/api/day-total/today", authenticateToken, async (req, res) => {
  try {
    const data = await getTodayTotal(req.user.userId);

    res.json({
      status: "OK",
      data,
    });
  } catch (error) {
    console.error("Day total today error:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Błąd pobierania rozliczenia dnia",
    });
  }
});

/*
 * ZAPIS KWOTY Z APLIKACJI
 */
app.post("/api/work/app-amount", authenticateToken, async (req, res) => {
  try {
    const { uber_app_amount, bolt_app_amount, app_amount } = req.body;

    const normalizedUberAmount = uber_app_amount ?? app_amount ?? 0;
    const normalizedBoltAmount = bolt_app_amount ?? 0;

    const session = await setCurrentWorkAppAmount(
      req.user.userId,
      normalizedUberAmount,
      normalizedBoltAmount,
    );

    res.json({
      status: "OK",
      message: "Kwoty z aplikacji zostały zapisane",
      session,
    });
  } catch (error) {
    console.error("App amount error:", error);

    res.status(400).json({
      status: "ERROR",
      message: error.message,
    });
  }
});

/*
 * PODSUMOWANIE DASHBOARDU
 */
app.get("/api/dashboard/summary", authenticateToken, async (req, res) => {
  try {
    const summary = await getDashboardSummary(req.user.userId);

    res.json({
      status: "OK",
      summary,
    });
  } catch (error) {
    console.error("Dashboard summary error:", error);

    res.status(500).json({
      status: "ERROR",
      message: "Błąd pobierania podsumowania",
    });
  }
});

/*
 * START SERWERA
 */

if (require.main === module) {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Taxi app running on port ${PORT}`);
  });
}

module.exports = app;
