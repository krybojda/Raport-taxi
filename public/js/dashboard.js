async function loadUser() {
  try {
    const response = await fetch("/api/auth/me", {
      credentials: "include",
    });

    if (response.status === 401) {
      window.location.href = "/login.html";

      return;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Błąd pobierania użytkownika");
    }

    const user = data.user || {};
    const displayName = user.username || user.name || "Użytkownik";

    document.getElementById("userInfo").textContent =
      `Zalogowany: ${user.name || displayName} (${displayName})`;
  } catch (error) {
    console.error(error);

    window.location.href = "/login.html";
  }
}

async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });

  window.location.href = "/login.html";
}

document.getElementById("logoutButton").addEventListener("click", logout);

loadUser();
