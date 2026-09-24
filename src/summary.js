const db = require("./database");
const { getBusinessDate, getWeekRange, getMonthRange } = require("./businessDate");

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

async function loadPeriodSummary(userId, startDate, endDate) {
  const [sessionRows] = await db.execute(
    `
    SELECT
      business_date,
      COUNT(*) AS session_count,
      COALESCE(SUM(
        CASE
          WHEN end_time IS NOT NULL THEN duration_seconds
          ELSE TIMESTAMPDIFF(SECOND, start_time, NOW())
        END
      ), 0) AS work_seconds
    FROM work_sessions
    WHERE user_id = ?
      AND business_date BETWEEN ? AND ?
    GROUP BY business_date
    ORDER BY business_date ASC
    `,
    [userId, startDate, endDate],
  );

  const [cashRows] = await db.execute(
    `
    SELECT
      ws.business_date,
      COALESCE(SUM(ce.amount), 0) AS cash_total
    FROM cash_entries ce
    JOIN work_sessions ws ON ws.id = ce.work_session_id
    WHERE ce.user_id = ?
      AND ws.business_date BETWEEN ? AND ?
    GROUP BY ws.business_date
    ORDER BY ws.business_date ASC
    `,
    [userId, startDate, endDate],
  );

  const [appRows] = await db.execute(
    `
    WITH last_app_sessions AS (
      SELECT
        business_date,
        uber_app_amount,
        bolt_app_amount,
        app_amount,
        ROW_NUMBER() OVER (
          PARTITION BY business_date
          ORDER BY start_time DESC, id DESC
        ) AS rn
      FROM work_sessions
      WHERE user_id = ?
        AND business_date BETWEEN ? AND ?
        AND app_amount IS NOT NULL
    )
    SELECT
      business_date,
      uber_app_amount,
      bolt_app_amount,
      app_amount
    FROM last_app_sessions
    WHERE rn = 1
    ORDER BY business_date ASC
    `,
    [userId, startDate, endDate],
  );

  const days = new Map();

  function ensureDay(date) {
    if (!days.has(date)) {
      days.set(date, {
        session_count: 0,
        work_seconds: 0,
        cash_total: 0,
        app_uber_total: 0,
        app_bolt_total: 0,
        app_total: 0,
      });
    }

    return days.get(date);
  }

  for (const row of sessionRows) {
    const day = ensureDay(row.business_date);
    day.session_count = safeNumber(row.session_count);
    day.work_seconds = safeNumber(row.work_seconds);
  }

  for (const row of cashRows) {
    const day = ensureDay(row.business_date);
    day.cash_total = safeNumber(row.cash_total);
  }

  for (const row of appRows) {
    const day = ensureDay(row.business_date);
    const uberAmount = safeNumber(row.uber_app_amount);
    const boltAmount = safeNumber(row.bolt_app_amount);
    const fallbackAmount = safeNumber(row.app_amount);

    day.app_uber_total = uberAmount || (fallbackAmount > 0 ? fallbackAmount : 0);
    day.app_bolt_total = boltAmount;
    day.app_total = day.app_uber_total + day.app_bolt_total;
  }

  let session_count = 0;
  let work_seconds = 0;
  let cash_total = 0;
  let app_uber_total = 0;
  let app_bolt_total = 0;
  let app_total = 0;

  for (const day of days.values()) {
    session_count += day.session_count;
    work_seconds += day.work_seconds;
    cash_total += day.cash_total;
    app_uber_total += day.app_uber_total;
    app_bolt_total += day.app_bolt_total;
    app_total += day.app_total;
  }

  return {
    session_count,
    work_seconds,
    cash_total,
    app_uber_total,
    app_bolt_total,
    app_total,
    total_money: cash_total + app_total,
  };
}

async function getDashboardSummary(userId) {
  const today = getBusinessDate();
  const weekRange = getWeekRange(today);
  const monthRange = getMonthRange(today);

  const day = await loadPeriodSummary(userId, today, today);
  const week = await loadPeriodSummary(userId, weekRange.start, weekRange.end);
  const month = await loadPeriodSummary(userId, monthRange.start, monthRange.end);

  return {
    day,
    week,
    month,
  };
}

module.exports = {
  getDashboardSummary,
};
