const db = require("./database");

function normalizeType(type) {
  if (["all", "sessions", "cash", "earnings"].includes(type)) {
    return type;
  }

  return "all";
}

function normalizeSource(source) {
  if (["all", "uber", "bolt"].includes(source)) {
    return source;
  }

  return "all";
}

function normalizeSort(sort) {
  if (
    [
      "date_desc",
      "date_asc",
      "amount_desc",
      "amount_asc",
      "duration_desc",
      "duration_asc",
    ].includes(sort)
  ) {
    return sort;
  }

  return "date_desc";
}

function formatSourceLabel(source) {
  if (source === "uber") return "Uber";
  if (source === "bolt") return "Bolt";
  return "-";
}

function safeNumber(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n : 0;
}

function sortEntries(entries, sort) {
  const getDateValue = (item) => new Date(item.date_time || 0).getTime();
  const getAmountValue = (item) => {
    if (item.amount === null || item.amount === undefined) return null;
    return safeNumber(item.amount);
  };
  const getDurationValue = (item) => {
    if (item.duration_seconds === null || item.duration_seconds === undefined) {
      return null;
    }
    return safeNumber(item.duration_seconds);
  };

  const compareNullable = (a, b, getter, desc = true) => {
    const va = getter(a);
    const vb = getter(b);

    const aNull = va === null;
    const bNull = vb === null;

    if (aNull && bNull) return 0;
    if (aNull) return 1;
    if (bNull) return -1;

    if (va === vb) return 0;
    return desc ? vb - va : va - vb;
  };

  const dir = sort.endsWith("_desc") ? "desc" : "asc";

  return entries.sort((a, b) => {
    if (sort.startsWith("date_")) {
      const diff = getDateValue(a) - getDateValue(b);
      return dir === "desc" ? -diff : diff;
    }

    if (sort.startsWith("amount_")) {
      const diff = compareNullable(a, b, getAmountValue, dir === "desc");
      if (diff !== 0) return diff;
      return getDateValue(b) - getDateValue(a);
    }

    if (sort.startsWith("duration_")) {
      const diff = compareNullable(a, b, getDurationValue, dir === "desc");
      if (diff !== 0) return diff;
      return getDateValue(b) - getDateValue(a);
    }

    return getDateValue(b) - getDateValue(a);
  });
}

async function getHistory(userId, options = {}) {
  const type = normalizeType(options.type);
  const source = normalizeSource(options.source);
  const sort = normalizeSort(options.sort);

  const from =
    typeof options.from === "string" && /^\d{4}-\d{2}-\d{2}$/.test(options.from)
      ? options.from
      : null;

  const to =
    typeof options.to === "string" && /^\d{4}-\d{2}-\d{2}$/.test(options.to) ? options.to : null;

  const sessionWhere = ["user_id = ?"];
  const sessionParams = [userId];

  const cashWhere = ["user_id = ?"];
  const cashParams = [userId];

  const earningsWhere = ["user_id = ?"];
  const earningsParams = [userId];

  if (from) {
    sessionWhere.push("DATE(start_time) >= ?");
    cashWhere.push("DATE(created_at) >= ?");
    earningsWhere.push("DATE(created_at) >= ?");

    sessionParams.push(from);
    cashParams.push(from);
    earningsParams.push(from);
  } else {
    sessionWhere.push("DATE(start_time) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
    cashWhere.push("DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
    earningsWhere.push("DATE(created_at) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)");
  }

  if (to) {
    sessionWhere.push("DATE(start_time) <= ?");
    cashWhere.push("DATE(created_at) <= ?");
    earningsWhere.push("DATE(created_at) <= ?");

    sessionParams.push(to);
    cashParams.push(to);
    earningsParams.push(to);
  } else {
    sessionWhere.push("DATE(start_time) <= CURDATE()");
    cashWhere.push("DATE(created_at) <= CURDATE()");
    earningsWhere.push("DATE(created_at) <= CURDATE()");
  }

  const entries = [];

  if (type === "all" || type === "sessions") {
    const [rows] = await db.execute(
      `
      SELECT
        id,
        user_id,
        start_time,
        end_time,
        duration_seconds,
        COALESCE(
          duration_seconds,
          TIMESTAMPDIFF(SECOND, start_time, NOW())
        ) AS effective_duration_seconds
      FROM work_sessions
      WHERE ${sessionWhere.join(" AND ")}
      ORDER BY start_time ASC
      `,
      sessionParams,
    );

    for (const row of rows) {
      entries.push({
        kind: "session",
        id: row.id,
        date_time: row.start_time,
        title: "Sesja pracy",
        source: null,
        source_label: "-",
        session_id: row.id,
        amount: null,
        duration_seconds: safeNumber(row.effective_duration_seconds),
        note: null,
        start_time: row.start_time,
        end_time: row.end_time,
      });
    }
  }

  if (type === "all" || type === "cash") {
    if (source === "uber" || source === "bolt") {
      cashWhere.push("source = ?");
      cashParams.push(source);
    }

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
      WHERE ${cashWhere.join(" AND ")}
      ORDER BY created_at ASC
      `,
      cashParams,
    );

    for (const row of rows) {
      entries.push({
        kind: "cash",
        id: row.id,
        date_time: row.created_at,
        title: "Gotówka",
        source: row.source,
        source_label: formatSourceLabel(row.source),
        session_id: row.work_session_id,
        amount: safeNumber(row.amount),
        duration_seconds: null,
        note: row.note || null,
        start_time: null,
        end_time: null,
      });
    }
  }

  if (type === "all" || type === "earnings") {
    if (source === "uber" || source === "bolt") {
      earningsWhere.push("source = ?");
      earningsParams.push(source);
    }

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
      FROM earnings_entries
      WHERE ${earningsWhere.join(" AND ")}
      ORDER BY created_at ASC
      `,
      earningsParams,
    );

    for (const row of rows) {
      entries.push({
        kind: "earning",
        id: row.id,
        date_time: row.created_at,
        title: "Zarobek",
        source: row.source,
        source_label: formatSourceLabel(row.source),
        session_id: row.work_session_id,
        amount: safeNumber(row.amount),
        duration_seconds: null,
        note: row.note || null,
        start_time: null,
        end_time: null,
      });
    }
  }

  sortEntries(entries, sort);

  const summary = entries.reduce(
    (acc, item) => {
      acc.count += 1;

      if (item.kind === "session") {
        acc.session_count += 1;
        acc.work_seconds += safeNumber(item.duration_seconds);
      }

      if (item.kind === "cash") {
        acc.cash_count += 1;
        acc.cash_total += safeNumber(item.amount);
      }

      if (item.kind === "earning") {
        acc.earning_count += 1;
        acc.earning_total += safeNumber(item.amount);
      }

      return acc;
    },
    {
      count: 0,
      session_count: 0,
      cash_count: 0,
      earning_count: 0,
      work_seconds: 0,
      cash_total: 0,
      earning_total: 0,
    },
  );

  summary.total_money = summary.cash_total + summary.earning_total;

  return {
    filters: {
      from,
      to,
      type,
      source,
      sort,
    },
    summary,
    entries,
  };
}

module.exports = {
  getHistory,
};
