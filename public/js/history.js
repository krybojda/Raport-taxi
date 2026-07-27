function formatMoney(value) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(Number(value || 0));
}

function formatDurationLong(seconds) {
  seconds = Number(seconds || 0);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(remainingSeconds).padStart(2, "0"),
  ].join(":");
}

function formatDateTime(dateString) {
  if (!dateString) return "-";

  return new Date(dateString).toLocaleString("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getParamsFromForm() {
  return {
    from: document.getElementById("fromDate").value || "",
    to: document.getElementById("toDate").value || "",
    type: document.getElementById("typeFilter").value || "all",
    source: document.getElementById("sourceFilter").value || "all",
    sort: document.getElementById("sortFilter").value || "date_desc",
  };
}

function setFormFromUrl() {
  const url = new URL(window.location.href);

  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const type = url.searchParams.get("type");
  const source = url.searchParams.get("source");
  const sort = url.searchParams.get("sort");

  if (from) document.getElementById("fromDate").value = from;
  if (to) document.getElementById("toDate").value = to;
  if (type) document.getElementById("typeFilter").value = type;
  if (source) document.getElementById("sourceFilter").value = source;
  if (sort) document.getElementById("sortFilter").value = sort;
}

function updateUrlFromForm() {
  const params = getParamsFromForm();
  const url = new URL(window.location.href);

  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    } else {
      url.searchParams.delete(key);
    }
  });

  window.history.replaceState({}, "", url.toString());
}

async function loadUser() {
  const response = await fetch("/api/auth/me", {
    credentials: "include",
  });

  if (!response.ok) {
    window.location.href = "/login.html";
    return false;
  }

  const data = await response.json();
  document.getElementById("userName").textContent = data.user.name;
  return true;
}

function renderSummary(summary) {
  document.getElementById("summarySessions").textContent = summary.session_count || 0;
  document.getElementById("summaryWorkTime").textContent = formatDurationLong(
    summary.work_seconds || 0,
  );
  document.getElementById("summaryCash").textContent = formatMoney(summary.cash_total || 0);
  document.getElementById("summaryEarnings").textContent = formatMoney(summary.earning_total || 0);
}

function renderEntries(entries) {
  const tbody = document.getElementById("historyTableBody");

  if (!entries || entries.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty">Brak wyników dla wybranych filtrów.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = entries
    .map((item) => {
      const typeBadgeClass =
        item.kind === "session" ? "session" : item.kind === "cash" ? "cash" : "earning";

      const sourceBadgeClass =
        item.source === "uber" ? "uber" : item.source === "bolt" ? "bolt" : "";

      const sessionLabel =
        item.kind === "session"
          ? `${formatDateTime(item.start_time)} → ${item.end_time ? formatDateTime(item.end_time) : "Trwa"}`
          : item.session_id
            ? `#${item.session_id}`
            : "-";

      const amountLabel =
        item.amount === null || item.amount === undefined ? "-" : formatMoney(item.amount);

      const durationLabel =
        item.kind === "session" ? formatDurationLong(item.duration_seconds) : "-";

      return `
      <tr>
        <td>${formatDateTime(item.date_time)}</td>
        <td><span class="badge ${typeBadgeClass}">${item.title}</span></td>
        <td>${item.source ? `<span class="badge ${sourceBadgeClass}">${item.source_label}</span>` : "-"}</td>
        <td>${sessionLabel}</td>
        <td>${amountLabel}</td>
        <td>${durationLabel}</td>
        <td>${item.note ? `<div class="note">${item.note}</div>` : "-"}</td>
      </tr>
    `;
    })
    .join("");
}

async function loadHistory() {
  const message = document.getElementById("historyMessage");
  const params = getParamsFromForm();

  message.textContent = "Ładowanie historii...";

  const url = new URL("/api/history", window.location.origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      url.searchParams.set(key, value);
    }
  });

  try {
    const response = await fetch(url.toString(), {
      credentials: "include",
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Błąd pobierania historii");
    }

    renderSummary(data.summary || {});
    renderEntries(data.entries || []);

    message.textContent = `Wyników: ${(data.summary && data.summary.count) || 0}`;
  } catch (error) {
    console.error(error);
    message.textContent = error.message;
  }
}

async function logout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error(error);
  }

  window.location.href = "/login.html";
}

document.getElementById("logoutButton").addEventListener("click", logout);
document.getElementById("applyFilters").addEventListener("click", async () => {
  updateUrlFromForm();
  await loadHistory();
});

document.getElementById("resetFilters").addEventListener("click", async () => {
  document.getElementById("fromDate").value = "";
  document.getElementById("toDate").value = "";
  document.getElementById("typeFilter").value = "all";
  document.getElementById("sourceFilter").value = "all";
  document.getElementById("sortFilter").value = "date_desc";
  updateUrlFromForm();
  await loadHistory();
});

async function init() {
  const authenticated = await loadUser();
  if (!authenticated) return;

  setFormFromUrl();
  await loadHistory();
}

init();
