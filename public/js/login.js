const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

console.log("login.js loaded");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  console.log("Login form submitted");

  const name = document.getElementById("name").value.trim();

  const password = document.getElementById("password").value;

  console.log("Login name:", name);

  loginMessage.textContent = "Logowanie...";

  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      credentials: "include",

      body: JSON.stringify({
        name: name,
        password: password,
      }),
    });

    console.log("Login response status:", response.status);

    const data = await response.json();

    console.log("Login response:", data);

    if (!response.ok) {
      throw new Error(data.message || "Błąd logowania");
    }

    loginMessage.textContent = "Zalogowano. Przekierowanie...";

    window.location.href = "/dashboard.html";
  } catch (error) {
    console.error("Login error:", error);

    loginMessage.textContent = error.message;
  }
});
