let currentSession = null;

let liveTimer = null;

let currentSessionStart = null;

let todayClosedSeconds = 0;

/*
 * FORMATOWANIE CZASU
 *
 * Wynik:
 * 02:15:37
 */

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

/*
 * FORMATOWANIE CZASU
 *
 * Wynik:
 * 2h 15min
 */

function formatDuration(seconds) {
  seconds = Number(seconds || 0);

  const hours = Math.floor(seconds / 3600);

  const minutes = Math.floor((seconds % 3600) / 60);

  return `${hours}h ${minutes}min`;
}

/*
 * FORMATOWANIE DATY I CZASU
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
 * URUCHOMIENIE LICZNIKA
 *
 * Licznik aktualnej sesji
 * i łącznego czasu pracy
 * aktualizuje się co sekundę.
 */

function startLiveTimer(startTime) {
  stopLiveTimer();

  currentSessionStart = new Date(startTime).getTime();

  updateLiveTimers();

  liveTimer = setInterval(updateLiveTimers, 1000);
}

/*
 * ZATRZYMANIE LICZNIKA
 */

function stopLiveTimer() {
  if (liveTimer !== null) {
    clearInterval(liveTimer);

    liveTimer = null;
  }

  currentSessionStart = null;
}

/*
 * AKTUALIZACJA OBU LICZNIKÓW
 */

function updateLiveTimers() {
  /*
   * Jeżeli nie ma aktywnej sesji,
   * nic nie robimy.
   */

  if (!currentSessionStart) {
    return;
  }

  const now = Date.now();

  /*
   * Czas aktualnej sesji
   */

  const currentSessionSeconds = Math.max(0, Math.floor((now - currentSessionStart) / 1000));

  /*
   * Aktualna sesja
   */

  const currentSessionElement = document.getElementById("currentSessionTime");

  if (currentSessionElement) {
    currentSessionElement.textContent = formatDurationLong(currentSessionSeconds);
  }

  /*
   * Łączny czas dzisiaj
   *
   * todayClosedSeconds =
   * czas zakończonych sesji
   *
   * currentSessionSeconds =
   * aktualnie trwająca sesja
   */

  const totalTodaySeconds = todayClosedSeconds + currentSessionSeconds;

  const totalElement = document.getElementById("totalWorkTime");

  if (totalElement) {
    totalElement.textContent = formatDurationLong(totalTodaySeconds);
  }
}

/*
 * POBIERANIE DANYCH UŻYTKOWNIKA
 */

async function loadUser() {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "include",
    });

    /*
     * Brak logowania
     */

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

/*
 * SPRAWDZENIE AKTUALNEJ SESJI
 */

async function loadCurrentWork() {
  try {
    const response = await fetch("/api/work/current", {
      credentials: "include",
    });

    /*
     * Jeżeli token jest nieważny
     * lub użytkownik nie jest zalogowany.
     */

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

/*
 * AKTUALIZACJA STATUSU PRACY
 */

function updateWorkStatus(working, session) {
  const statusElement = document.getElementById("workStatus");

  const sessionElement = document.getElementById("currentSession");

  const startButton = document.getElementById("startWorkButton");

  const stopButton = document.getElementById("stopWorkButton");

  /*
   * KIEROWCA PRACUJE
   */

  if (working && session) {
    statusElement.textContent = "Pracujesz";

    statusElement.className = "work-status working";

    sessionElement.innerHTML = `

  <div>

    Rozpoczęto:

    <strong>

      ${formatDateTime(session.start_time)}

    </strong>

  </div>



  <div class="live-session-time">

    Aktualna sesja:

    <strong
      id="currentSessionTime"
    >
      00:00:00
    </strong>

  </div>

`;

    startButton.hidden = true;

    stopButton.hidden = false;

    /*
     * Uruchamiamy licznik.
     */

    startLiveTimer(session.start_time);
  }

  /*
   * KIEROWCA NIE PRACUJE
   */
  else {
    statusElement.textContent = "Nie pracujesz";

    statusElement.className = "work-status not-working";

    sessionElement.innerHTML = "";

    startButton.hidden = false;

    stopButton.hidden = true;

    /*
     * Zatrzymujemy licznik.
     */

    stopLiveTimer();
  }
}

/*
 * ROZPOCZĘCIE PRACY
 */

async function startWork() {
  const message = document.getElementById("workMessage");

  const startButton = document.getElementById("startWorkButton");

  /*
   * Blokujemy przycisk,
   * aby nie wysłać kilku żądań.
   */

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

    /*
     * Pobieramy aktualną sesję.
     */

    await loadCurrentWork();

    /*
     * Aktualizujemy dzisiejsze
     * podsumowanie.
     */

    await loadTodayWork();
  } catch (error) {
    console.error("Start work error:", error);

    message.textContent = error.message;
  } finally {
    startButton.disabled = false;
  }
}

/*
 * ZAKOŃCZENIE PRACY
 */

async function stopWork() {
  const message = document.getElementById("workMessage");

  const stopButton = document.getElementById("stopWorkButton");

  /*
   * Blokujemy przycisk,
   * aby nie wysłać kilku żądań.
   */

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

    /*
     * Zatrzymujemy licznik
     * natychmiast po zakończeniu.
     */

    stopLiveTimer();

    message.textContent = data.message;

    /*
     * Pobieramy aktualny status.
     */

    await loadCurrentWork();

    /*
     * Pobieramy aktualne
     * podsumowanie dnia.
     */

    await loadTodayWork();
  } catch (error) {
    console.error("Stop work error:", error);

    message.textContent = error.message;
  } finally {
    stopButton.disabled = false;
  }
}

/*
 * POBIERANIE DZISIEJSZYCH SESJI
 */

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

    /*
     * Liczba sesji
     */

    document.getElementById("sessionCount").textContent = sessions.length;

    /*
     * Obliczamy czas wszystkich
     * zakończonych sesji.
     *
     * Aktywna sesja nie jest tutaj
     * dodawana, ponieważ jej czas
     * jest liczony na żywo.
     */

    todayClosedSeconds = sessions.reduce((total, session) => {
      /*
       * Sesja zakończona
       */

      if (session.end_time) {
        return total + Number(session.duration_seconds || 0);
      }

      /*
       * Sesja aktywna
       *
       * Jej czas obsługuje
       * live timer.
       */

      return total;
    }, 0);

    /*
     * Jeżeli nie ma aktywnej sesji,
     * wyświetlamy całkowity czas
     * zakończonych sesji.
     */

    if (!currentSessionStart) {
      document.getElementById("totalWorkTime").textContent = formatDurationLong(todayClosedSeconds);
    }

    /*
     * Wyświetlamy listę sesji.
     */

    renderSessions(sessions);
  } catch (error) {
    console.error("Load today work error:", error);
  }
}

/*
 * WYŚWIETLENIE SESJI
 */

function renderSessions(sessions) {
  const container = document.getElementById("sessionsList");

  /*
   * Brak sesji
   */

  if (sessions.length === 0) {
    container.innerHTML = `

  <p>
    Brak sesji pracy.
  </p>

`;

    return;
  }

  /*
   * Tworzymy HTML
   * dla każdej sesji.
   */

  container.innerHTML = sessions
    .map((session) => {
      return `

        <div
          class="session-row"
        >

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


          <div
            class="session-duration"
          >

            ${session.end_time ? formatDuration(session.duration_seconds) : "Aktualnie trwa"}

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
  try {
    await fetch("/api/auth/logout", {
      method: "POST",

      credentials: "include",
    });
  } catch (error) {
    console.error("Logout error:", error);
  }

  /*
   * Niezależnie od odpowiedzi
   * przekierowujemy na login.
   */

  window.location.href = "/login.html";
}

/*
 * EVENT:
 * ROZPOCZĘCIE PRACY
 */

document.getElementById("startWorkButton").addEventListener("click", startWork);

/*
 * EVENT:
 * ZAKOŃCZENIE PRACY
 */

document.getElementById("stopWorkButton").addEventListener("click", stopWork);

/*
 * EVENT:
 * WYLOGOWANIE
 */

document.getElementById("logoutButton").addEventListener("click", logout);

/*
 * START DASHBOARDU
 */

async function initDashboard() {
  /*
   * Najpierw sprawdzamy,
   * czy użytkownik jest zalogowany.
   */

  const authenticated = await loadUser();

  if (!authenticated) {
    return;
  }

  /*
   * Pobieramy aktualną sesję.
   */

  await loadCurrentWork();

  /*
   * Pobieramy dzisiejsze sesje.
   */

  await loadTodayWork();
}

/*
 * URUCHOMIENIE
 */

initDashboard();
