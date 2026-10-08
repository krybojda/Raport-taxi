const db = require("./database");
const { getBusinessDate } = require("./businessDate");

const WORK_SESSION_COLUMNS = `
  id,
  user_id,
  start_time,
  end_time,
  duration_seconds,
  duration_time,
  app_amount,
  uber_app_amount,
  bolt_app_amount,
  business_date,
  CASE
    WHEN end_time IS NOT NULL
    THEN COALESCE(duration_seconds, TIMESTAMPDIFF(SECOND, start_time, end_time))
    ELSE TIMESTAMPDIFF(SECOND, start_time, NOW())
  END AS duration_seconds_live
`;

async function getWorkSessionById(sessionId) {
  const [sessions] = await db.execute(
    `
    SELECT
      ${WORK_SESSION_COLUMNS}
    FROM work_sessions
    WHERE id = ?
    LIMIT 1
    `,
    [sessionId],
  );

  return sessions[0] || null;
}

/*
 * AKTUALNA SESJA
 */
async function getCurrentWork(userId) {
  const [sessions] = await db.execute(
    `
    SELECT
      ${WORK_SESSION_COLUMNS}
    FROM work_sessions
    WHERE user_id = ?
      AND end_time IS NULL
    ORDER BY start_time DESC
    LIMIT 1
    `,
    [userId],
  );

  return sessions[0] || null;
}

/*
 * ROZPOCZĘCIE PRACY
 */
async function startWork(userId) {
  const activeSession = await getCurrentWork(userId);

  if (activeSession) {
    throw new Error("Masz już aktywną sesję pracy");
  }

  const businessDate = getBusinessDate();

  const [result] = await db.execute(
    `
    INSERT INTO work_sessions
      (
        user_id,
        start_time,
        business_date
      )
    VALUES
      (
        ?,
        NOW(),
        ?
      )
    `,
    [userId, businessDate],
  );

  return getWorkSessionById(result.insertId);
}

/*
 * ZAKOŃCZENIE PRACY
 */
async function stopWork(userId) {
  const activeSession = await getCurrentWork(userId);

  if (!activeSession) {
    throw new Error("Nie masz aktywnej sesji pracy");
  }

  await db.execute(
    `
    UPDATE work_sessions
    SET
      end_time = NOW(),
      duration_seconds = TIMESTAMPDIFF(SECOND, start_time, NOW()),
      duration_time = SEC_TO_TIME(TIMESTAMPDIFF(SECOND, start_time, NOW()))
    WHERE id = ?
    `,
    [activeSession.id],
  );

  return getWorkSessionById(activeSession.id);
}

/*
 * USTAWIENIE KWOTY Z APLIKACJI DLA AKTYWNEJ SESJI
 */
async function setCurrentWorkAppAmount(userId, uberAppAmount, boltAppAmount = 0) {
  const numericUberAmount = Number(uberAppAmount);
  const numericBoltAmount = Number(boltAppAmount);

  if (
    !Number.isFinite(numericUberAmount) ||
    !Number.isFinite(numericBoltAmount) ||
    numericUberAmount < 0 ||
    numericBoltAmount < 0
  ) {
    throw new Error("Podaj poprawne kwoty z aplikacji");
  }

  const activeSession = await getCurrentWork(userId);

  if (!activeSession) {
    throw new Error("Nie masz aktywnej sesji pracy");
  }

  const totalAppAmount = numericUberAmount + numericBoltAmount;

  await db.execute(
    `
    UPDATE work_sessions
    SET
      uber_app_amount = ?,
      bolt_app_amount = ?,
      app_amount = ?
    WHERE id = ?
    `,
    [numericUberAmount, numericBoltAmount, totalAppAmount, activeSession.id],
  );

  return getWorkSessionById(activeSession.id);
}

/*
 * SESJE Z BIEŻĄCEGO DNIA BIZNESOWEGO
 */
async function getTodayWork(userId) {
  const businessDate = getBusinessDate();

  const [sessions] = await db.execute(
    `
    SELECT
      ${WORK_SESSION_COLUMNS}
    FROM work_sessions
    WHERE user_id = ?
      AND business_date = ?
    ORDER BY start_time ASC
    `,
    [userId, businessDate],
  );

  return sessions;
}

/*
 * OSTATNIE SESJE PRACY
 */
async function getRecentWork(userId, limit = 10) {
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 10));

  const [sessions] = await db.execute(
    `
    SELECT
      ${WORK_SESSION_COLUMNS}
    FROM work_sessions
    WHERE user_id = ?
    ORDER BY start_time DESC
    LIMIT ${safeLimit}
    `,
    [userId],
  );

  return sessions;
}

module.exports = {
  startWork,
  stopWork,
  setCurrentWorkAppAmount,
  getCurrentWork,
  getTodayWork,
  getRecentWork,
  getWorkSessionById,
};
