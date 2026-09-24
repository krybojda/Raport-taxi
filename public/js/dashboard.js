let liveTimer = null;
let currentSessionStart = null;
let todayClosedSeconds = 0;

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

function formatDuration(seconds) {
  seconds = Number(seconds || 0);

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}h ${minutes}min`;
}

function formatMoney(value) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(Number(value || 0));
}

function formatDateTime(dateString) {
  if (!dateString) {
    return "-";
  }

  return new Date(dateString).toLocaleString("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function startLiveTimer(startTime) {
  stopLiveTimer();

  currentSessionStart = new Date(startTime).getTime();
  updateLiveTimers();

  liveTimer = setInterval(updateLiveTimers, 1000);
}

function stopLiveTimer() {
  if (liveTimer !== null) {
    clearInterval(liveTimer);
    liveTimer = null;
  }

  currentSessionStart = null;
}

function updateLiveTimers() {
  if (!currentSessionStart) {
    return;
  }

  const currentSessionSeconds = Math.max(0, Math.floor((Date.now() - currentSessionStart) / 1000));

  const currentSessionElement = document.getElementById("currentSessionTime");
  const totalElement = document.getElementById("totalWorkTime");

  if (currentSessionElement) {
    currentSessionElement.textContent = formatDurationLong(currentSessionSeconds);
  }

  if (totalElement) {
    totalElement.textContent = formatDurationLong(todayClosedSeconds + currentSessionSeconds);
  }
}

async function loadUser() {
  try {
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
  } catch (error) {
    console.error("Load user error:", error);
    window.location.href = "/login.html";
    return false;
  }
}

async function loadCurrentWork() {
  try {
    const response = await fetch("/api/work/current", {
      credentials: "include",
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    updateWorkStatus(data.working, data.session);
  } catch (error) {
    console.error("Load current work error:", error);
  }
}

function updateWorkStatus(working, session) {
  const statusElement = document.getElementById("workStatus");
  const sessionElement = document.getElementById("currentSession");
  const startButton = document.getElementById("startWorkButton");
  const stopButton = document.getElementById("stopWorkButton");
  const appButton = document.getElementById("addAppAmountButton");
  const currentAppAmount = document.getElementById("currentAppAmount");
  const uberCurrentAppAmount = document.getElementById("uberCurrentAppAmount");
  const boltCurrentAppAmount = document.getElementById("boltCurrentAppAmount");

  if (
    !statusElement ||
    !sessionElement ||
    !startButton ||
    !stopButton ||
    !appButton ||
    !currentAppAmount ||
    !uberCurrentAppAmount ||
    !boltCurrentAppAmount
  ) {
    return;
  }

  if (working && session) {
    statusElement.textContent = "Pracujesz";
    statusElement.className = "work-status working";
    appButton.hidden = false;
    currentAppAmount.textContent = formatMoney(session.app_amount || 0);
    uberCurrentAppAmount.textContent = formatMoney(
      session.uber_app_amount ?? session.app_amount ?? 0,
    );
    boltCurrentAppAmount.textContent = formatMoney(session.bolt_app_amount || 0);

    sessionElement.innerHTML = `
      <div>
        Rozpoczęto:
        <strong>${formatDateTime(session.start_time)}</strong>
      </div>

      <div class="live-session-time">
        Aktualna sesja:
        <strong id="currentSessionTime">00:00:00</strong>
      </div>
    `;

    startButton.hidden = true;
    stopButton.hidden = false;

    startLiveTimer(session.start_time);
  } else {
    statusElement.textContent = "Nie pracujesz";
    statusElement.className = "work-status not-working";
    appButton.hidden = true;
    currentAppAmount.textContent = formatMoney(0);
    uberCurrentAppAmount.textContent = formatMoney(0);
    boltCurrentAppAmount.textContent = formatMoney(0);
    sessionElement.innerHTML = "";

    startButton.hidden = false;
    stopButton.hidden = true;

    stopLiveTimer();
  }
}

async function startWork() {
  const message = document.getElementById("workMessage");
  const startButton = document.getElementById("startWorkButton");

  if (!message || !startButton) {
    return;
  }

  startButton.disabled = true;
  message.textContent = "Rozpoczynanie pracy...";

  try {
    const response = await fetch("/api/work/start", {
      method: "POST",
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Nie udało się rozpocząć pracy");
    }

    message.textContent = data.message;

    await loadCurrentWork();
    await loadTodayWork();
    await loadRecentWork();
    await loadCurrentCash();
    await loadTodayCash();
    await loadDashboardSummary();
  } catch (error) {
    console.error("Start work error:", error);
    message.textContent = error.message;
  } finally {
    startButton.disabled = false;
  }
}

async function stopWork() {
  const message = document.getElementById("workMessage");
  const stopButton = document.getElementById("stopWorkButton");

  if (!message || !stopButton) {
    return;
  }

  stopButton.disabled = true;
  message.textContent = "Kończenie pracy...";

  try {
    const response = await fetch("/api/work/stop", {
      method: "POST",
      credentials: "include",
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Nie udało się zakończyć pracy");
    }

    stopLiveTimer();
    message.textContent = data.message;

    await loadCurrentWork();
    await loadTodayWork();
    await loadRecentWork();
    await loadCurrentCash();
    await loadTodayCash();
    await loadDashboardSummary();
  } catch (error) {
    console.error("Stop work error:", error);
    message.textContent = error.message;
  } finally {
    stopButton.disabled = false;
  }
}

async function loadTodayWork() {
  try {
    const response = await fetch("/api/work/today", {
      credentials: "include",
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const sessions = data.sessions || [];

    document.getElementById("sessionCount").textContent = sessions.length;

    todayClosedSeconds = sessions.reduce((total, session) => {
      if (session.end_time) {
        return total + Number(session.duration_seconds || 0);
      }
      return total;
    }, 0);

    if (!currentSessionStart) {
      document.getElementById("totalWorkTime").textContent = formatDurationLong(todayClosedSeconds);
    }

    renderSessions(sessions);
  } catch (error) {
    console.error("Load today work error:", error);
  }
}

async function loadRecentWork() {
  try {
    const response = await fetch("/api/work/recent", {
      credentials: "include",
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    renderSessions(data.sessions || []);
  } catch (error) {
    console.error("Load recent work error:", error);
  }
}

function renderSessions(sessions) {
  const container = document.getElementById("sessionsList");

  if (!container) {
    return;
  }

  if (!sessions || sessions.length === 0) {
    container.innerHTML = `<p>Brak sesji pracy.</p>`;
    return;
  }

  container.innerHTML = sessions
    .map((session) => {
      const duration = session.end_time
        ? formatDuration(session.duration_seconds)
        : "Aktualnie trwa";
      const uberAppAmount = session.uber_app_amount ?? session.app_amount ?? 0;
      const boltAppAmount = session.bolt_app_amount || 0;
      const appAmount = session.app_amount ?? uberAppAmount + boltAppAmount;

      return `
        <div class="session-row">
          <div>
            <strong>${formatDateTime(session.start_time)}</strong>
            <span>→</span>
            <strong>${session.end_time ? formatDateTime(session.end_time) : "Trwa"}</strong>
          </div>

          <div class="session-duration">
            ${duration}
          </div>

          ${
            session.app_amount !== null && session.app_amount !== undefined
              ? `<div class="session-earnings">Aplikacja: Uber ${formatMoney(uberAppAmount)} • Bolt ${formatMoney(boltAppAmount)} • Razem ${formatMoney(appAmount)}</div>`
              : ""
          }
        </div>
      `;
    })
    .join("");
}

async function addCash(source) {
  const amountRaw = prompt(`Podaj kwotę dla ${source === "uber" ? "Uber" : "Bolt"} (np. 45.50):`);

  if (amountRaw === null) {
    return;
  }

  const amount = Number(String(amountRaw).replace(",", "."));

  if (!Number.isFinite(amount) || amount <= 0) {
    alert("Podaj poprawną kwotę większą od zera.");
    return;
  }

  const message = document.getElementById("cashMessage");

  if (message) {
    message.textContent = "Zapisywanie gotówki...";
  }

  try {
    const response = await fetch("/api/cash/add", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        amount,
        source,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Nie udało się zapisać gotówki");
    }

    if (message) {
      message.textContent = data.message;
    }

    await loadCurrentCash();
    await loadTodayCash();
    await loadDashboardSummary();
  } catch (error) {
    console.error("Add cash error:", error);

    if (message) {
      message.textContent = error.message;
    }
  }
}

async function loadCurrentCash() {
  try {
    const response = await fetch("/api/cash/current-session", {
      credentials: "include",
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const totals = data.totals || { uber: 0, bolt: 0, total: 0 };

    document.getElementById("uberToday").textContent = formatMoney(totals.uber);
    document.getElementById("boltToday").textContent = formatMoney(totals.bolt);
    document.getElementById("cashToday").textContent = formatMoney(totals.total);

    renderCashEntries(data.entries || []);
  } catch (error) {
    console.error("Load current cash error:", error);
  }
}

async function loadTodayCash() {
  try {
    const response = await fetch("/api/cash/today", {
      credentials: "include",
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const totals = data.totals || { uber: 0, bolt: 0, total: 0 };

    document.getElementById("uberToday").textContent = formatMoney(totals.uber);
    document.getElementById("boltToday").textContent = formatMoney(totals.bolt);
    document.getElementById("cashToday").textContent = formatMoney(totals.total);
  } catch (error) {
    console.error("Load today cash error:", error);
  }
}

function renderCashEntries(entries) {
  const container = document.getElementById("cashEntriesList");

  if (!container) {
    return;
  }

  if (!entries || entries.length === 0) {
    container.innerHTML = `<p>Brak wpisów.</p>`;
    return;
  }

  container.innerHTML = entries
    .map((entry) => {
      const sourceLabel = entry.source === "uber" ? "Uber" : "Bolt";

      return `
        <div class="session-row">
          <div>
            <strong>${sourceLabel}</strong>
            <span>•</span>
            <span>${formatDateTime(entry.created_at)}</span>
            ${entry.note ? `<div class="cash-note">${entry.note}</div>` : ""}
          </div>

          <div class="session-duration">
            ${formatMoney(entry.amount)}
          </div>
        </div>
      `;
    })
    .join("");
}

async function logout() {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout error:", error);
  }

  window.location.href = "/login.html";
}

async function loadDashboardSummary() {
  try {
    const response = await fetch("/api/dashboard/summary", {
      credentials: "include",
    });

    if (response.status === 401) {
      window.location.href = "/login.html";
      return;
    }

    if (!response.ok) {
      return;
    }

    const data = await response.json();
    const summary = data.summary || {};

    renderPeriodSummary("day", summary.day);
    renderPeriodSummary("week", summary.week);
    renderPeriodSummary("month", summary.month);
  } catch (error) {
    console.error("Load dashboard summary error:", error);
  }
}

function renderPeriodSummary(prefix, summary) {
  const safe = summary || {
    session_count: 0,
    work_seconds: 0,
    cash_total: 0,
    app_uber_total: 0,
    app_bolt_total: 0,
    app_total: 0,
    total_money: 0,
  };

  const cashTotal = safe.cash_total ?? safe.cash?.total ?? 0;
  const appUberTotal = safe.app_uber_total ?? safe.app?.uber ?? safe.earnings?.uber ?? 0;
  const appBoltTotal = safe.app_bolt_total ?? safe.app?.bolt ?? safe.earnings?.bolt ?? 0;
  const appTotal = safe.app_total ?? safe.app?.total ?? safe.earnings?.total ?? 0;

  const moneyElement = document.getElementById(`summary${capitalize(prefix)}Money`);
  const metaElement = document.getElementById(`summary${capitalize(prefix)}Meta`);
  const detailsElement = document.getElementById(`summary${capitalize(prefix)}Details`);

  if (moneyElement) {
    moneyElement.textContent = formatMoney(safe.total_money || 0);
  }

  if (metaElement) {
    metaElement.textContent = `${safe.session_count || 0} sesji • ${formatDurationLong(safe.work_seconds || 0)}`;
  }

  if (detailsElement) {
    detailsElement.textContent = `Gotówka: ${formatMoney(cashTotal)} • Uber: ${formatMoney(appUberTotal)} • Bolt: ${formatMoney(appBoltTotal)} • Razem: ${formatMoney(appTotal)}`;
  }
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

async function addAppAmount() {
  const message = document.getElementById("appMessage");
  const uberAmountRaw = prompt("Podaj kwotę z Ubera dla tej sesji:");

  if (uberAmountRaw === null) {
    return;
  }

  const boltAmountRaw = prompt("Podaj kwotę z Bolta dla tej sesji:");

  if (boltAmountRaw === null) {
    return;
  }

  const uberAppAmount = Number(String(uberAmountRaw).replace(",", "."));
  const boltAppAmount = Number(String(boltAmountRaw).replace(",", "."));

  if (
    !Number.isFinite(uberAppAmount) ||
    !Number.isFinite(boltAppAmount) ||
    uberAppAmount < 0 ||
    boltAppAmount < 0
  ) {
    alert("Podaj poprawne kwoty.");
    return;
  }

  if (message) {
    message.textContent = "Zapisywanie kwoty z aplikacji...";
  }

  try {
    const response = await fetch("/api/work/app-amount", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        uber_app_amount: uberAppAmount,
        bolt_app_amount: boltAppAmount,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Nie udało się zapisać kwoty");
    }

    if (message) {
      message.textContent = data.message;
    }

    await loadCurrentWork();
    await loadTodayWork();
    await loadDashboardSummary();
  } catch (error) {
    console.error("App amount error:", error);

    if (message) {
      message.textContent = error.message;
    }
  }
}

document.getElementById("startWorkButton")?.addEventListener("click", startWork);
document.getElementById("stopWorkButton")?.addEventListener("click", stopWork);
document.getElementById("logoutButton")?.addEventListener("click", logout);
document.getElementById("addUberButton")?.addEventListener("click", () => addCash("uber"));
document.getElementById("addBoltButton")?.addEventListener("click", () => addCash("bolt"));
document.getElementById("addAppAmountButton")?.addEventListener("click", addAppAmount);

async function initDashboard() {
  const authenticated = await loadUser();

  if (!authenticated) {
    return;
  }

  await loadCurrentWork();
  await loadTodayWork();
  await loadRecentWork();
  await loadCurrentCash();
  await loadTodayCash();
  await loadDashboardSummary();
}

initDashboard();
