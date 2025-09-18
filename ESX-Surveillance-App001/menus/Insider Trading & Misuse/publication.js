// menus/Insider Trading & Misuse/publication.js

export function initPublication() {
  const msgBox = document.getElementById("publication-message");
  if (!msgBox) return;

  // Replace this with your real role-check logic
  const currentUserRole = "User"; // or "Admin"

  function showAccessMessage() {
    if (currentUserRole !== "Admin") {
      msgBox.innerHTML = `
        <p style="color:#990000; font-weight:bold; text-align:center;">
          ⚠️ Dears, This See Sensitive Trade. You Should be Logged as an Admin!<br>
          Your Current Role is not Permitted to see this Report!
        </p>
      `;
    } else {
      msgBox.innerHTML = `
        <p style="color:green; font-weight:bold; text-align:center;">
          ✅ Welcome Admin! You can view sensitive publications here.
        </p>
      `;
    }
  }

  showAccessMessage();
}
