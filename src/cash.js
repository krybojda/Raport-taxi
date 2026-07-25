const db = require("./database");
const { getCurrentWork } = require("./work");

async function addCashEntry(userId, amount, source, note = null) {
  const numericAmount = Number(amount);

  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error("Kwota musi być większa od zera");
  }

  if (!source || !["uber", "bolt"].includes(source)) {
    throw new Error("Źródło musi być ustawione na uber albo bolt");
  }

  const currentSession = await getCurrentWork(userId);

  if (!currentSession) {
    throw new Error("Nie masz aktywnej sesji pracy");
  }

  const [result] = await db.execute(
    `
    INSERT INTO cash_entries
      (
        user_id,
        work_session_id,
        source,
        amount,
        note
      )
    VALUES
      (
        ?,
        ?,
        ?,
        ?,
        NULLIF(?, '')
      )
    `,
    [userId, currentSession.id, source, numericAmount, note],
  );

  const [rows] = await db.execute(
    `
    SELECT
      id,
      user_id,
      work_session_id,
      source,
      amount,
      note,
      created_at
    FROM cash_entries
    WHERE id = ?
    LIMIT 1
    `,
    [result.insertId],
  );

  return rows[0];
}

async function getCurrentSessionCash(userId) {
  const currentSession = await getCurrentWork(userId);

  if (!currentSession) {
    return {
      working: false,
      session: null,
      entries: [],
      totals: {
        uber: 0,
        bolt: 0,
        total: 0,
      },
    };
  }

  const [entries] = await db.execute(
    `
    SELECT
      id,
      source,
      amount,
      note,
      created_at
    FROM cash_entries
    WHERE user_id = ?
      AND work_session_id = ?
    ORDER BY created_at ASC
    `,
    [userId, currentSession.id],
  );

  const totals = entries.reduce(
    (acc, entry) => {
      const amount = Number(entry.amount || 0);

      if (entry.source === "uber") {
        acc.uber += amount;
      } else if (entry.source === "bolt") {
        acc.bolt += amount;
      }

      acc.total += amount;
      return acc;
    },
    { uber: 0, bolt: 0, total: 0 },
  );

  return {
    working: true,
    session: currentSession,
    entries,
    totals,
  };
}

async function getTodayCash(userId) {
  const [entries] = await db.execute(
    `
    SELECT
      ce.id,
      ce.user_id,
      ce.work_session_id,
      ce.source,
      ce.amount,
      ce.note,
      ce.created_at,
      ws.start_time,
      ws.end_time
    FROM cash_entries ce
    LEFT JOIN work_sessions ws
      ON ws.id = ce.work_session_id
    WHERE ce.user_id = ?
      AND DATE(ce.created_at) = CURDATE()
    ORDER BY ce.created_at ASC
    `,
    [userId],
  );

  const totals = entries.reduce(
    (acc, entry) => {
      const amount = Number(entry.amount || 0);

      if (entry.source === "uber") {
        acc.uber += amount;
      } else if (entry.source === "bolt") {
        acc.bolt += amount;
      }

      acc.total += amount;
      return acc;
    },
    { uber: 0, bolt: 0, total: 0 },
  );

  return {
    entries,
    totals,
  };
}

module.exports = {
  addCashEntry,
  getCurrentSessionCash,
  getTodayCash,
};
