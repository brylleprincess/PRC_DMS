/*
 * PRC Document Management System - session check
 * Loaded on SuperAdmin.html, Admin.html and GuestUser.html (after data.js, before app.js).
 * The sign-in itself happens on index.html (see js/login.js).
 */

let AUTH = false;     // is somebody signed in on this page?
let SESSION = null;   // { id, role } of the signed-in person

// Called once by app.js after the shared data has been loaded
function guardSession() {
  const saved = LS.get(SESSION_KEY);
  const acct = saved && U.find((u) => u.id === saved.id);

  // Not signed in -> back to the login page
  if (!acct) {
    location.replace("index.html" + location.search);
    return;
  }

  // Admin and Guest can only open their own page. Super Admin can open all three.
  if (acct.r !== "sa" && acct.r !== window.ROLE) {
    location.replace(ROLE_PAGE[acct.r]);
    return;
  }

  SESSION = { id: acct.id, role: acct.r };
  ACTOR[window.ROLE] = acct.id;   // who is acting on this page
  AUTH = true;
  R = window.ROLE;
}

function logout() {
  LS.set(SESSION_KEY, null);
  location.href = "index.html";
}

// If you log out in another tab, this tab goes back to the login page too
window.addEventListener("storage", (e) => {
  if (e.key === SESSION_KEY && !e.newValue) location.replace("index.html");
});