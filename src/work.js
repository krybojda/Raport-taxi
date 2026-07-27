const db = require("./database");
const { getBusinessDate } = require("./businessDate");

/*
 * ROZPOCZĘCIE PRACY
 */
async function startWork(userId) {
  const [activeSessions] = await db.execute(
    `
    SELECT id, start_time
    FROM work_sessions
    WHERE user_id = ?
      AND end_time IS NULL
    LIMIT 1
    `,
    [userId],
  );

  if (activeSessions.length > 0) {
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

  const [sessions] = await db.execute(
    `
    SELECT
      id,
      user_id,
      start_time,
      end_time,
      duration_seconds,
      duration_time,
      app_amount,
       uber_app_amount,
       bolt_app_amount,
      business_date
    FROM work_sessions
    WHERE id = ?
    LIMIT 1
    `,
    [result.insertId],
  );

  return sessions[0];
}

/*
 * ZAKOŃCZENIE PRACY
 */
async function stopWork(userId) {
  const [activeSessions] = await db.execute(
    `
    SELECT
      id,
      start_time
    FROM work_sessions
    WHERE user_id = ?
      AND end_time IS NULL
    ORDER BY start_time DESC
    LIMIT 1
    `,
    [userId],
  );

  if (activeSessions.length === 0) {
    throw new Error("Nie masz aktywnej sesji pracy");
  }

  const session = activeSessions[0];

  await db.execute(
    `
    UPDATE work_sessions
    SET
      end_time = NOW(),
      duration_seconds = TIMESTAMPDIFF(SECOND, start_time, NOW()),
      duration_time = SEC_TO_TIME(TIMESTAMPDIFF(SECOND, start_time, NOW()))
    WHERE id = ?
    `,
    [session.id],
  );

  const [sessions] = await db.execute(
    `
    SELECT
      id,
      user_id,
      start_time,
      end_time,
      duration_seconds,
      duration_time,
      app_amount,
       uber_app_amount,
       bolt_app_amount,
      business_date
    FROM work_sessions
    WHERE id = ?
    LIMIT 1
    `,
    [session.id],
  );

  return sessions[0];
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

  const [activeSessions] = await db.execute(
    `
    SELECT
      id
    FROM work_sessions
    WHERE user_id = ?
      AND end_time IS NULL
    ORDER BY start_time DESC
    LIMIT 1
    `,
    [userId],
  );

  if (activeSessions.length === 0) {
    throw new Error("Nie masz aktywnej sesji pracy");
  }

  const session = activeSessions[0];

  await db.execute(
    `
    UPDATE work_sessions
    SET
      uber_app_amount = ?,
      bolt_app_amount = ?,
      app_amount = ?
    WHERE id = ?
    `,
    [numericUberAmount, numericBoltAmount, numericUberAmount + numericBoltAmount, session.id],
  );

  const [rows] = await db.execute(
    `
    SELECT
      id,
      user_id,
      start_time,
      end_time,
      duration_seconds,
      duration_time,
      app_amount,
       uber_app_amount,
       bolt_app_amount,
      business_date
    FROM work_sessions
    WHERE id = ?
    LIMIT 1
    `,
    [session.id],
  );

  return rows[0];
}

/*
 * AKTUALNA SESJA
 */
async function getCurrentWork(userId) {
  const [sessions] = await db.execute(
    `
    SELECT
      id,
      user_id,
      start_time,
      end_time,
      duration_seconds,
      duration_time,
      app_amount,
      uber_app_amount,
      bolt_app_amount,
      business_date
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
 * SESJE Z BIEŻĄCEGO DNIA BIZNESOWEGO
 */
async function getTodayWork(userId) {
  const businessDate = getBusinessDate();

  const [sessions] = await db.execute(
    `
    SELECT
      id,
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
        THEN TIMESTAMPDIFF(
          SECOND,
          start_time,
          end_time
        )
        ELSE TIMESTAMPDIFF(
          SECOND,
          start_time,
          NOW()
        )
      END AS duration_seconds_live
    FROM work_sessions
    WHERE user_id = ?
      AND business_date = ?
    ORDER BY start_time ASC
    `,
    [userId, businessDate],
  );

  return sessions;
}

module.exports = {
  startWork,
  stopWork,
  setCurrentWorkAppAmount,
  getCurrentWork,
  getTodayWork,
};
