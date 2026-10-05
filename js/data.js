/*
 * PRC Document Management System - shared data & helpers
 * Loaded first by every page (index.html, SuperAdmin.html, Admin.html, GuestUser.html)
 */

// Where everything is kept in the browser
const STORE_KEY = "prcdms_data_v2";     // documents, requests, activity, users
const SESSION_KEY = "prcdms_session";   // who is signed in

// Page each role lands on after signing in
const ROLE_PAGE = {
  sa: "SuperAdmin.html",
  admin: "Admin.html",
  guest: "GuestUser.html"
};

// Offices / divisions people can belong to (PRC uses "Office", "Service" and "Division")
const OFFICES = [
  "Office of the Chairperson",
  "Commission Secretariat",
  "Licensure Office",
  "Regulation Office",
  "Professional Registry Division",
  "Continuing Professional Development Division",
  "International Affairs Office",
  "Legal Service",
  "ICT Service",
  "Administrative Service",
  "Records Division",
  "Human Resource Development Division",
  "Planning Division",
  "Accounting Division",
  "Budget Division",
  "Cash Division",
  "General Services Division",
  "Procurement Division",
  "Regional Office"
];

// Users that exist from the old prc dms(just used as reference names)
const SEED_USERS = [
  { id: 1, n: "Princess Brylle", e: "princess.brylle@prc.gov.ph", p: "+63 917 555 0101", r: "sa", d: "ICT Service", ip: "10.0.4.21",
    un: "princess brylle", owner: true, salt: "prc-owner-salt", h: "7b9839ec03289de5da82a4ebaff932c04ec1995c8647c052e5abc217f4edc8d8" }, 
  { id: 2, n: "Maya Chen", e: "maya.chen@prc.gov.ph", p: "+63 917 555 0102", r: "admin", d: "Records Division", ip: "10.0.4.35" },
  { id: 3, n: "Jordan Lee", e: "jordan.lee@prc.gov.ph", p: "+63 917 555 0103", r: "admin", d: "Planning Division", ip: "10.0.5.12" },
  { id: 4, n: "Sarah Miller", e: "s.miller@prc.gov.ph", p: "+63 917 555 0104", r: "guest", d: "Regional Office", ip: "10.0.6.8" }
];

// Small wrapper around localStorage (never throws)
const LS = {
  get(key) {
    try {
      return JSON.parse(localStorage.getItem(key));
    } catch (e) {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      return false;
    }
  }
};

// Salted SHA-256
async function hash(password, salt) {
  const bytes = new TextEncoder().encode(salt + password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Users are saved inside the shared state so every page sees the same accounts
function getUsers() {
  const saved = LS.get(STORE_KEY);
  return saved && saved.users ? saved.users : JSON.parse(JSON.stringify(SEED_USERS));
}

// ---------- For super admin login ----------
(function () {
  const account = {
    id: 101, n: "Super Admin", e: "super@prc.gov.ph", p: "09170000000", r: "sa", d: "ICT Service", ip: "—",
    un: "super", owner: true, salt: "prc-super-salt",
    h: "e9c2d711a156b231042cafd356d242839a7105f2f5749fae702592797f9a5fe3"
  };
  const saved = LS.get(STORE_KEY) || {};
  const users = saved.users || JSON.parse(JSON.stringify(SEED_USERS));
  if (users.some((u) => u.un === account.un)) return;                 // already created
  if (users.some((u) => u.id === account.id)) account.id = Math.max(...users.map((u) => u.id)) + 1;
  users.push(account);
  saved.users = users;
  LS.set(STORE_KEY, saved);
})();