// core/auth.js
export const Auth = (() => {
  const validUsers = [
    { username: "admin", password: "esx@admin" },
    { username: "sisay", password: "pass1" },
    { username: "Tade", password: "pass2" }
  ];

  function showDashboard(show) {
    const loginPage = document.getElementById("login-page");
    const dashboardPage = document.getElementById("dashboard-page");
    if (show) {
      loginPage.classList.remove("active");
      dashboardPage.classList.add("active");
    } else {
      loginPage.classList.add("active");
      dashboardPage.classList.remove("active");
    }
  }

  function init() {
    const loginForm = document.getElementById("login-form");
    const logoutBtn = document.getElementById("logout-btn");
    const welcomeStrong = document.querySelector(".welcome strong");
    const passwordInput = document.getElementById("password");
    const togglePassword = document.getElementById("toggle-password");

    // password toggle
    if (togglePassword && passwordInput) {
      togglePassword.addEventListener("click", () => {
        if (passwordInput.type === "password") {
          passwordInput.type = "text";
          togglePassword.textContent = "🙈";
        } else {
          passwordInput.type = "password";
          togglePassword.textContent = "👁️";
        }
      });
    }

    // login
    loginForm.addEventListener("submit", e => {
      e.preventDefault();
      const username = document.getElementById("username").value.trim();
      const password = passwordInput.value.trim();

      const matchedUser = validUsers.find(
        u => u.username === username && u.password === password
      );

      if (matchedUser) {
        welcomeStrong.textContent = username;
        showDashboard(true);
        document.dispatchEvent(new Event("auth:login"));
        passwordInput.value = "";
      } else {
        alert("Invalid username or password!");
        passwordInput.value = "";
        showDashboard(false);
      }
    });

    // logout
    logoutBtn.addEventListener("click", () => {
      showDashboard(false);
      document.getElementById("username").value = "";
      passwordInput.value = "";
      document.dispatchEvent(new Event("auth:logout"));
    });

    // show login first
    showDashboard(false);
  }

  return { init };
})();
