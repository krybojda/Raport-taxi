let currentSession = null;

/*
 * FORMATOWANIE CZASU
 */

function formatDuration(seconds) {
  seconds = Number(seconds || 0);

  const hours = Math.floor(seconds / 3600);

  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}h ${minutes}min`;
}

/*
 * FORMATOWANIE DATY
 */

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

/*
 * POBIERANIE DANYCH UŻYTKOWNIKA
 */

async function loadUser() {
  const response = await fetch("/api/auth/me", {
    credentials: "include",
  });

  if (!response.ok) {
    window.location.href = "/login.html";

    return;
  }

  const data = await response.json();

  document.getElementById("userName").textContent = data.user.name;
}

/*
 * SPRAWDZENIE AKTUALNEJ SESJI
 */

async function loadCurrentWork() {
  const response = await fetch("/api/work/current", {
    credentials: "include",
  });

  if (!response.ok) {
    return;
  }

  const data = await response.json();

  currentSession = data.session;

  updateWorkStatus(data.working, data.session);
}

/*
 * AKTUALIZACJA STATUSU PRACY
 */

function updateWorkStatus(working, session) {
  const statusElement = document.getElementById("workStatus");

  const sessionElement = document.getElementById("currentSession");

  const startButton = document.getElementById("startWorkButton");

  const stopButton = document.getElementById("stopWorkButton");

  if (working) {
    statusElement.textContent = "Pracujesz";

    statusElement.className = "work-status working";

    sessionElement.innerHTML = `
      Rozpoczęto:
      <strong>
        ${formatDateTime(session.start_time)}
      </strong>
    `;

    startButton.hidden = true;

    stopButton.hidden = false;
  } else {
    statusElement.textContent = "Nie pracujesz";

    statusElement.className = "work-status not-working";

    sessionElement.textContent = "";

    startButton.hidden = false;

    stopButton.hidden = true;
  }
}

/*
 * ROZPOCZĘCIE PRACY
 */

async function startWork() {
  const message = document.getElementById("workMessage");

  message.textContent = "Rozpoczynanie pracy...";

  const response = await fetch("/api/work/start", {
    method: "POST",

    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    message.textContent = data.message || "Nie udało się rozpocząć pracy";

    return;
  }

  message.textContent = data.message;

  await loadCurrentWork();

  await loadTodayWork();
}

/*
 * ZAKOŃCZENIE PRACY
 */

async function stopWork() {
  const message = document.getElementById("workMessage");

  message.textContent = "Kończenie pracy...";

  const response = await fetch("/api/work/stop", {
    method: "POST",

    credentials: "include",
  });

  const data = await response.json();

  if (!response.ok) {
    message.textContent = data.message || "Nie udało się zakończyć pracy";

    return;
  }

  message.textContent = data.message;

  await loadCurrentWork();

  await loadTodayWork();
}

/*
 * POBIERANIE DZISIEJSZYCH SESJI
 */

async function loadTodayWork() {
  const response = await fetch("/api/work/today", {
    credentials: "include",
  });

  if (!response.ok) {
    return;
  }

  const data = await response.json();

  const sessions = data.sessions || [];

  document.getElementById("sessionCount").textContent = sessions.length;

  document.getElementById("totalWorkTime").textContent = formatDuration(data.total_seconds);

  renderSessions(sessions);
}

/*
 * WYŚWIETLENIE SESJI
 */

function renderSessions(sessions) {
  const container = document.getElementById("sessionsList");

  if (sessions.length === 0) {
    container.innerHTML = `
      <p>
        Brak sesji pracy.
      </p>
    `;

    return;
  }

  container.innerHTML = sessions
    .map((session) => {
      return `
            <div class="session-row">

              <div>

                <strong>
                  ${formatDateTime(session.start_time)}
                </strong>

                <span>
                  →
                </span>

                <strong>
                  ${session.end_time ? formatDateTime(session.end_time) : "Trwa"}
                </strong>

              </div>


              <div class="session-duration">

                ${formatDuration(session.duration_seconds)}

              </div>

            </div>
          `;
    })
    .join("");
}

/*
 * WYLOGOWANIE
 */

async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",

    credentials: "include",
  });

  window.location.href = "/login.html";
}

/*
 * EVENTY
 */

document.getElementById("startWorkButton").addEventListener("click", startWork);

document.getElementById("stopWorkButton").addEventListener("click", stopWork);

document.getElementById("logoutButton").addEventListener("click", logout);

/*
 * START DASHBOARDU
 */

async function initDashboard() {
  await loadUser();

  await loadCurrentWork();

  await loadTodayWork();
}

initDashboard();
