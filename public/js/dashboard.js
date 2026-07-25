let currentSession = null;
let liveTimer = null;
let currentSessionStart = null;
let todayClosedSeconds = 0;
let currentCashTotals = {
  uber: 0,
  bolt: 0,
  total: 0,
};

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

  const date = new Date(dateString);

  return date.toLocaleString("pl-PL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function startLiveTimer(startTime) {
  stopLiveTimer();

  currentSessionStart = new Date(startTime).getTime();

  updateLiveTimers();

  liveTimer = setInterval(() => {
    updateLiveTimers();
  }, 1000);
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

  const now = Date.now();

  const currentSessionSeconds = Math.max(0, Math.floor((now - currentSessionStart) / 1000));

  const currentSessionElement = document.getElementById("currentSessionTime");

  if (currentSessionElement) {
    currentSessionElement.textContent = formatDurationLong(currentSessionSeconds);
  }

  const totalTodaySeconds = todayClosedSeconds + currentSessionSeconds;

  const totalElement = document.getElementById("totalWorkTime");

  if (totalElement) {
    totalElement.textContent = formatDurationLong(totalTodaySeconds);
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

    currentSession = data.session;

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

  if (working && session) {
    statusElement.textContent = "Pracujesz";
    statusElement.className = "work-status working";

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

    sessionElement.innerHTML = "";

    startButton.hidden = false;
    stopButton.hidden = true;

    stopLiveTimer();
  }
}

async function startWork() {
  const message = document.getElementById("workMessage");
  const startButton = document.getElementById("startWorkButton");

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

  if (sessions.length === 0) {
    container.innerHTML = `<p>Brak sesji pracy.</p>`;
    return;
  }

  container.innerHTML = sessions
    .map((session) => {
      return `
        <div class="session-row">
          <div>
            <strong>${formatDateTime(session.start_time)}</strong>
            <span>→</span>
            <strong>
              ${session.end_time ? formatDateTime(session.end_time) : "Trwa"}
            </strong>
          </div>

          <div class="session-duration">
            ${session.end_time ? formatDuration(session.duration_seconds) : "Aktualnie trwa"}
          </div>
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

  const note = prompt("Notatka (opcjonalnie):") || "";

  const message = document.getElementById("cashMessage");
  message.textContent = "Zapisywanie gotówki...";

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
        note,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Nie udało się zapisać gotówki");
    }

    message.textContent = data.message;

    await loadCurrentCash();
    await loadTodayCash();
  } catch (error) {
    console.error("Add cash error:", error);
    message.textContent = error.message;
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

    currentCashTotals = data.totals || { uber: 0, bolt: 0, total: 0 };

    document.getElementById("uberToday").textContent = formatMoney(currentCashTotals.uber);
    document.getElementById("boltToday").textContent = formatMoney(currentCashTotals.bolt);
    document.getElementById("cashToday").textContent = formatMoney(currentCashTotals.total);

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

    document.getElementById("cashToday").textContent = formatMoney(totals.total);
    document.getElementById("uberToday").textContent = formatMoney(totals.uber);
    document.getElementById("boltToday").textContent = formatMoney(totals.bolt);
  } catch (error) {
    console.error("Load today cash error:", error);
  }
}

function renderCashEntries(entries) {
  const container = document.getElementById("cashEntriesList");

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

document.getElementById("startWorkButton").addEventListener("click", startWork);
document.getElementById("stopWorkButton").addEventListener("click", stopWork);
document.getElementById("logoutButton").addEventListener("click", logout);
document.getElementById("addUberButton").addEventListener("click", () => addCash("uber"));
document.getElementById("addBoltButton").addEventListener("click", () => addCash("bolt"));

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
}

initDashboard();
