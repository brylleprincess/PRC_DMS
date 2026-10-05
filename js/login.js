/*
 * PRC Document Management System - Log in page (index.html)
 *
 * Just a username and password. The account decides which page opens:
 * Super Admin -> SuperAdmin.html, Admin -> Admin.html, Guest -> GuestUser.html
 * New accounts are created by the Super Admin under "People & Access".
 */

const $ = (s) => document.querySelector(s);

// ---------- Draw the card ----------
function draw() {
  $("#card").innerHTML = `
    <img class="lgl" src="assets/prc-logo.png" alt="PRC">
    <h2>Document Management System</h2>
    <p class="mu">Sign in to continue</p>

    <label>Username</label>
    <input id="un" autocomplete="off">

    <label>Password</label>
    <input id="pw" type="password" autocomplete="new-password">

    <div id="msg"></div>
    <button class="btn" id="go" style="width:100%;margin-top:10px">Log in</button>`;

  $("#go").onclick = doLogin;
}

// Red notice inside the card
function notice(text) {
  const box = $("#msg");
  box.textContent = text;
  box.className = "err alert";
}

// ---------- Log in ----------
async function doLogin() {
  const username = $("#un").value.trim().toLowerCase();
  const password = $("#pw").value;
  const users = getUsers();

  const acct = users.find((u) => u.h && u.un === username);

  if (acct && (await hash(password, acct.salt)) === acct.h) {
    LS.set(SESSION_KEY, { id: acct.id, role: acct.r });
    location.href = ROLE_PAGE[acct.r];
    return;
  }

  // Only the creator account exists so far -> nobody else has been created yet
  const noOtherAccounts = !users.some((u) => u.h && !u.owner);
  if (noOtherAccounts && !(acct && acct.owner)) return notice("No Account Found");

  notice("Incorrect username or password.");
}

// Pressing Enter submits
document.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && $("#go")) $("#go").click();
});

// Opening the login page always signs you out first,
// so you can test logging in as different accounts
LS.set(SESSION_KEY, null);
draw();
