const db = require("./database");
const { getBusinessDate, addDays } = require("./businessDate");

const ALLOWED_TYPES = ["all", "sessions", "cash", "earnings"];
const ALLOWED_SOURCES = ["all", "uber", "bolt"];
const ALLOWED_SORTS = [
  "date_desc",
  "date_asc",
  "amount_desc",
  "amount_asc",
  "duration_desc",
  "duration_asc",
];

function normalizeType(type) {
  return ALLOWED_TYPES.includes(type) ? type : "all";
}

function normalizeSource(source) {
  return ALLOWED_SOURCES.includes(source) ? source : "all";
}

function normalizeSort(sort) {
  return ALLOWED_SORTS.includes(sort) ? sort : "date_desc";
}

function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
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

function buildDateFilter(dateColumn, userId, from, to, source = "all") {
  const today = getBusinessDate();
  const defaultFrom = addDays(today, -30);

  const where = ["user_id = ?", `DATE(${dateColumn}) >= ?`, `DATE(${dateColumn}) <= ?`];
  const params = [userId, from || defaultFrom, to || today];

  if (source === "uber" || source === "bolt") {
    where.push("source = ?");
    params.push(source);
  }

  return {
    whereClause: where.join(" AND "),
    params,
  };
}

async function loadSessionEntries(userId, from, to) {
  const { whereClause, params } = buildDateFilter("start_time", userId, from, to);

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
    WHERE ${whereClause}
    ORDER BY start_time ASC
    `,
    params,
  );

  return rows.map((row) => ({
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
  }));
}

async function loadFinancialEntries(tableName, kind, title, userId, from, to, source) {
  const { whereClause, params } = buildDateFilter("created_at", userId, from, to, source);

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
    FROM ${tableName}
    WHERE ${whereClause}
    ORDER BY created_at ASC
    `,
    params,
  );

  return rows.map((row) => ({
    kind,
    id: row.id,
    date_time: row.created_at,
    title,
    source: row.source,
    source_label: formatSourceLabel(row.source),
    session_id: row.work_session_id,
    amount: safeNumber(row.amount),
    duration_seconds: null,
    note: row.note || null,
    start_time: null,
    end_time: null,
  }));
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

  const from = isValidDateString(options.from) ? options.from : null;
  const to = isValidDateString(options.to) ? options.to : null;

  const entries = [];

  if (type === "all" || type === "sessions") {
    const sessionEntries = await loadSessionEntries(userId, from, to);
    entries.push(...sessionEntries);
  }

  if (type === "all" || type === "cash") {
    const cashEntries = await loadFinancialEntries(
      "cash_entries",
      "cash",
      "Gotówka",
      userId,
      from,
      to,
      source,
    );
    entries.push(...cashEntries);
  }

  if (type === "all" || type === "earnings") {
    const earningEntries = await loadFinancialEntries(
      "earnings_entries",
      "earning",
      "Zarobek",
      userId,
      from,
      to,
      source,
    );
    entries.push(...earningEntries);
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
  normalizeType,
  normalizeSource,
  normalizeSort,
};
