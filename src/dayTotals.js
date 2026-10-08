const db = require("./database");
const { getBusinessDate } = require("./businessDate");

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

async function getDayTotal(userId, workDate) {
  const [rows] = await db.execute(
    `
    SELECT
      id,
      user_id,
      work_date,
      cash_total,
      apps_total,
      day_total,
      note,
      created_at,
      updated_at
    FROM work_day_totals
    WHERE user_id = ?
      AND work_date = ?
    LIMIT 1
    `,
    [userId, workDate],
  );

  return rows[0] || null;
}

async function upsertDayTotal(userId, workDate, cashTotal, appsTotal, note = null) {
  const cash = safeNumber(cashTotal);
  const apps = safeNumber(appsTotal);
  const total = cash + apps;

  await db.execute(
    `
    INSERT INTO work_day_totals
      (
        user_id,
        work_date,
        cash_total,
        apps_total,
        day_total,
        note
      )
    VALUES
      (?, ?, ?, ?, ?, NULLIF(?, ''))
    ON DUPLICATE KEY UPDATE
      cash_total = VALUES(cash_total),
      apps_total = VALUES(apps_total),
      day_total = VALUES(day_total),
      note = VALUES(note),
      updated_at = CURRENT_TIMESTAMP
    `,
    [userId, workDate, cash, apps, total, note],
  );

  return getDayTotal(userId, workDate);
}

async function getTodayTotal(userId) {
  return getDayTotal(userId, getBusinessDate());
}

module.exports = {
  upsertDayTotal,
  getDayTotal,
  getTodayTotal,
};
