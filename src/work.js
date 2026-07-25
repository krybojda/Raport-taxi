const db = require("./database");

/*
 * ROZPOCZĘCIE PRACY
 */
async function startWork(userId) {
  /*
   * Sprawdzamy, czy kierowca
   * nie ma już aktywnej sesji.
   */
  const [activeSessions] = await db.execute(
    `
    SELECT
      id,
      start_time
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

  /*
   * Tworzymy nową sesję.
   */
  const [result] = await db.execute(
    `
    INSERT INTO work_sessions
      (
        user_id,
        start_time
      )
    VALUES
      (
        ?,
        NOW()
      )
    `,
    [userId],
  );

  /*
   * Pobieramy utworzoną sesję.
   */
  const [sessions] = await db.execute(
    `
    SELECT
      id,
      user_id,
      start_time,
      end_time,
      duration_seconds,
      duration_time
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
  /*
   * Szukamy aktywnej sesji.
   */
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

  /*
   * Kończymy aktywną sesję
   * i zapisujemy czas pracy w bazie.
   */
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

  /*
   * Pobieramy zakończoną sesję.
   */
  const [sessions] = await db.execute(
    `
    SELECT
      id,
      user_id,
      start_time,
      end_time,
      duration_seconds,
      duration_time
    FROM work_sessions
    WHERE id = ?
    LIMIT 1
    `,
    [session.id],
  );

  return sessions[0];
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
      duration_time
    FROM work_sessions
    WHERE user_id = ?
      AND end_time IS NULL
    ORDER BY start_time DESC
    LIMIT 1
    `,
    [userId],
  );

  if (sessions.length === 0) {
    return null;
  }

  return sessions[0];
}

/*
 * SESJE Z DZISIAJ
 */
async function getTodayWork(userId) {
  const [sessions] = await db.execute(
    `
    SELECT
      id,
      start_time,
      end_time,
      duration_seconds,
      duration_time,

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
      AND DATE(start_time) = CURDATE()
    ORDER BY start_time ASC
    `,
    [userId],
  );

  return sessions;
}

async function getRecentWork(userId) {
  const [sessions] = await db.execute(
    `
    SELECT
      id,
      start_time,
      end_time,
      duration_seconds,
      duration_time
    FROM work_sessions
    WHERE user_id = ?
      AND DATE(start_time) = CURDATE()
    ORDER BY start_time DESC
    LIMIT 5
    `,
    [userId],
  );

  return sessions;
}

module.exports = {
  startWork,
  stopWork,
  getCurrentWork,
  getTodayWork,
  getRecentWork,
};
