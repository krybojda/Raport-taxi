const BUSINESS_DAY_START_HOUR = 4;

function getWarsawParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Warsaw",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);

  const map = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = part.value;
    }
  }

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function formatUTCDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseDateString(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dateString, days) {
  const date = parseDateString(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return formatUTCDate(date);
}

function getBusinessDate(date = new Date()) {
  const parts = getWarsawParts(date);
  const utcDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));

  if (parts.hour < BUSINESS_DAY_START_HOUR) {
    utcDate.setUTCDate(utcDate.getUTCDate() - 1);
  }

  return formatUTCDate(utcDate);
}

function getWeekRange(anchorDate = getBusinessDate()) {
  const base = parseDateString(anchorDate);
  const dayOfWeek = base.getUTCDay(); // 0 = niedziela
  const mondayOffset = (dayOfWeek + 6) % 7;

  const start = new Date(base);
  start.setUTCDate(base.getUTCDate() - mondayOffset);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return {
    start: formatUTCDate(start),
    end: formatUTCDate(end),
  };
}

function getMonthRange(anchorDate = getBusinessDate()) {
  const [year, month] = anchorDate.split("-").map(Number);

  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = formatUTCDate(new Date(Date.UTC(year, month, 0)));

  return {
    start,
    end,
  };
}

module.exports = {
  getBusinessDate,
  getWeekRange,
  getMonthRange,
  addDays,
};
