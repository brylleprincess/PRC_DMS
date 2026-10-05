/*
 * PRC Document Management System
 * App logic shared by SuperAdmin.html, Admin.html and GuestUser.html
 */

// ---------- Helpers & sample data ----------
const $ = (s) => document.querySelector(s);
const T = { pdf: ["PDF", "#e86a6a"], docx: ["DOCX", "#4a82cc"], xlsx: ["XLSX", "#3f9a6e"], pptx: ["PPTX", "#e07f45"] };

// Users (sample data lives in js/data.js)
let U = SEED_USERS;

// Documents (sample data)
// [id, title, category, type, size, owner id, date, views, downloads, access, sub-category]
let D = [
  [1, "00. Training Database 1st SEM 2023", "Reports", "xlsx", "4.8 MB", 3, "2023-07-17", 51, 12, "Internal", "Physical Annex A"],
  [2, "1 - Cover Page", "ISO", "pdf", "1.1 MB", 2, "2022-12-19", 204, 31, "Public", "Policy Manual"],
  [3, "QPM-BAG-ix Manual Revision", "ISO", "docx", "2.4 MB", 2, "2019-01-04", 129, 18, "Internal", "Policy Manual"],
  [4, "Regional Issuance No. 2024-07", "Regional Issuances", "pdf", "3.2 MB", 3, "2024-11-12", 318, 74, "Public", "Office Order"],
  [5, "Commission Resolution No. 1241", "Commission Issuances", "pdf", "2.0 MB", 1, "2024-12-10", 647, 138, "Restricted", "Resolutions"],
  [6, "PRB Guidelines v3", "PRB Issuances", "docx", "2.4 MB", 2, "2024-12-12", 892, 205, "Public", ""],
  [7, "RBAC Implementation Plan", "RBAC", "pptx", "14.6 MB", 3, "2024-12-16", 316, 74, "Restricted", ""],
  [8, "Q4 Financial Report", "Reports", "pdf", "8.2 MB", 2, "2024-12-18", 428, 92, "Internal", "OPCR Accomplishments"]
].map((a) => ({ id: a[0], t: a[1], c: a[2], ty: a[3], sz: a[4], o: a[5], dt: a[6], v: a[7], dl: a[8], ac: a[9], s: a[10] || "", del: 0 }));

// Category tree: parent category -> sub-categories
const CAT = {
  "ISO": ["Forms", "Quality Procedures", "Policy Manual", "Risk Management", "SWOT Analysis", "Interested Parties", "Masterlist of Rec/Docs", "Quality Objectives", "Management Review", "Charts"],
  "Regional Issuances": ["Office Order", "Memorandum Order", "Special Order", "Travel Order"],
  "Commission Issuances": ["Office Order", "Memorandum Order", "Travel Order", "Special Order", "Resolutions"],
  "PRB Issuances": [],
  "RBAC": [],
  "Reports": ["Client Feedback", "Physical Annex A", "Physical Annex B", "KPI ORD", "KPI LRD", "KPI FAD", "KPI REGU", "OPCR Targets", "OPCR Accomplishments", "Success Indicators"]
};
const MN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ---------- App state ----------
// ROLE is set by each page (SuperAdmin.html / Admin.html / GuestUser.html)
let R = window.ROLE || "sa", P = "overview", cat = "All", sub = "", df = "", dtt = "", mo = "", yr = "", op = {}, q = "", ft = "", fa = "", req = [], log = [], nid = 9;
const ACTOR = { sa: 1, admin: 2, guest: 4 }, RN = { sa: "Super Admin", admin: "Admin", guest: "Guest User" };

// ---------- Login / account setup (Super Admin only) ----------
const LOGO = "assets/prc-logo.png";

// ---------- Shared storage ----------
// Keeps documents, requests and activity in sync between the three role pages
function saveState() {
  LS.set(STORE_KEY, { D, req, log, nid, users: U, CAT, SETTINGS });
}
function loadState() {
  const s = LS.get(STORE_KEY);
  if (!s) return;
  if (s.D) D = s.D;
  if (s.req) req = s.req;
  if (s.log) log = s.log;
  if (s.nid) nid = s.nid;
  if (s.users) U = s.users;
  if (s.SETTINGS) SETTINGS = { ...DEFAULT_SETTINGS, ...s.SETTINGS };
  if (s.CAT) {
    Object.keys(CAT).forEach((k) => delete CAT[k]);
    Object.assign(CAT, s.CAT);
  }
}


// ---------- Lookups ----------
const user = (id) => U.find((u) => u.id == id) || { id, n: "Deleted user", e: "—", p: "—", r: "guest", d: "—", ip: "—" }, ini = (n) => n.split(" ").map((x) => x[0]).join("");
const doc = (id) => D.find((d) => d.id == id);

// ---------- UI helpers: toast + modal ----------
function toast(m) {
  const e = document.createElement("div");
  e.className = "toast";
  e.textContent = m;
  $("#toasts").append(e);
  setTimeout(() => e.remove(), 2800);
}
function modal(h) {
  $("#md").innerHTML = `<div class=mask onclick="if(event.target==this)closeM()"><div class=modal>${h}</div></div>`;
}
function closeM() {
  $("#md").innerHTML = "";
}

// ---------- Actions: view / download / print / edit / delete ----------
function addLog(a, d) {
  log.unshift({ a, d: d.t, u: ACTOR[R], t: new Date().toISOString() });
}
const approved = (id, a) => req.some((r) => r.doc == id && r.act == a && r.st == "Approved" && r.by == ACTOR.guest);
function act(id, a) {
  const d = doc(id);
  if (R == "guest" && a != "view" && !approved(id, a)) return reqModal(id, a);
  if (a == "view") {
    d.v++;
    addLog("viewed", d);
    return modal(`<h3>${d.t}</h3><div class=prev><span>${icon("file", 28)}<br>${d.ty.toUpperCase()} preview · ${d.sz}</span></div><div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn g" onclick=closeM()>Close</button><button class=btn onclick="closeM();act(${id},'download')">${R == "guest" && !approved(id, "download") ? icon("lock", 14) + " Request download" : "Download"}</button></div>`), render();
  }
  if (a == "download") {
    d.dl++;
    addLog("downloaded", d);
    zipDl([d], d.t);
    toast("Downloading " + d.t + ".zip (inside its category folder)");
  }
  if (a == "print") {
    addLog("printed", d);
    toast("Sending to printer…");
    try {
      window.print();
    } catch (e) {
    }
  }
  if (a == "edit") {
    d.dt = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    addLog("updated", d);
    toast("Updated " + d.t);
  }
  if (a == "delete") {
    d.del = 1;
    d.delAt = new Date().toISOString();   // when it was deleted
    d.delBy = ACTOR[R];                   // who deleted it
    addLog("deleted", d);
    toast("Moved to Trash Bin");
  }
  render();
}

// ---------- Guest access-request workflow ----------
function reqModal(id, a) {
  const d = doc(id);
  modal(`<h3>Request access</h3><p>Guests need approval to <b>${a}</b> “${d.t}”.</p><label>Reason</label><input id=rs placeholder="Why do you need this?"><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button class="btn g" onclick=closeM()>Cancel</button><button class=btn onclick="sendReq(${id},'${a}')">Send request</button></div>`);
}
function sendReq(id, a) {
  req.unshift({ id: Date.now(), doc: id, act: a, by: ACTOR.guest, why: $("#rs").value.trim() || "—", st: "Pending", t: (/* @__PURE__ */ new Date()).toLocaleString() });
  closeM();
  toast("Request sent to admins");
  render();
}
function decide(i, s) {
  const r = req.find((x) => x.id == i);
  r.st = s;
  toast("Request " + s.toLowerCase());
  render();
}

// ---------- Trash bin ----------
function restoreDoc(id) {
  const d = doc(id);
  d.del = 0;
  delete d.delAt;
  delete d.delBy;
  addLog("restored", d);
  toast("Restored " + d.t);
  render();
}

// Permanent delete always asks first
function confirmPurge(id) {
  const d = doc(id);
  modal(`<h3>Delete permanently?</h3>
    <p>Are you sure you want to permanently delete <b>${esc(d.t)}</b>? This cannot be undone and the file cannot be restored.</p>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn g" onclick=closeM()>Cancel</button>
      <button class="btn r" onclick="purgeDoc(${id})">Yes, delete permanently</button>
    </div>`);
}

function purgeDoc(id) {
  const d = doc(id);
  addLog("permanently deleted", d);
  D = D.filter((x) => x.id != id);
  closeM();
  toast("Permanently deleted " + d.t);
  render();
}

// ---------- Owner profile popup (contact details: Super Admin only) ----------
function profile(id) {
  const u = user(id), sa = R == "sa";
  modal(`<h3><span class=av>${ini(u.n)}</span>${u.n}</h3><div class=kv><span>Role</span>${RN[u.r]}${u.r === "guest" ? "" : `<span>Office / Division</span>${u.d}`}${sa ? `<span>Email</span>${u.e}<span>Phone</span>${u.p}<span>Last IP</span>${u.ip}` : "<span>Contact</span>Visible to Super Admin only"}</div><div style="text-align:right;margin-top:14px"><button class=btn onclick=closeM()>Close</button></div>`);
}

// ---------- Dashboard widgets (stats, chart, top documents) ----------
function stats() {
  const a = ovDocs(), s = (k) => a.reduce((x, d) => x + d[k], 0);
  return `<div class="grid g4" style="margin-bottom:14px">${[["Total files", a.length, per()], ["Views", s("v"), per()], ["Downloads", s("dl"), per()], ["Updates", log.filter((l) => l.a == "updated").length, "this session"]].map((x) => `<div class="card stat"><small>${x[0]}</small><div>${x[1].toLocaleString()}</div><span>${x[2]}</span></div>`).join("")}</div>`;
}
function ovDocs() {
  return D.filter((d) => !d.del && (!yr || d.dt.slice(0, 4) == yr) && (!mo || d.dt.slice(5, 7) == mo) && d.t.toLowerCase().includes(q.toLowerCase()));
}
function per() {
  return (mo ? MN[+mo - 1] + " " : "") + (yr || (mo ? "(all years)" : "All time"));
}
function dbar() {
  const ys = [...new Set(D.map((d) => d.dt.slice(0, 4)))].sort().reverse(), z = (i) => String(i + 1).padStart(2, "0");
  return `<div class=filters><select onchange="mo=this.value;render()"><option value="">All months${MN.map((m, i) => `<option value="${z(i)}" ${mo == z(i) ? "selected" : ""}>${m}`).join("")}</select><select onchange="yr=this.value;render()"><option value="">All years${ys.map((y) => `<option ${yr == y ? "selected" : ""}>${y}`).join("")}</select>${mo || yr ? `<button class="btn g sm" onclick="mo='';yr='';render()">Reset</button>` : ""}</div>`;
}
function chart() {
  const a = ovDocs(), v = Array(12).fill(0);
  a.forEach((d) => v[+d.dt.slice(5, 7) - 1] += d.v);
  const m = Math.max(...v, 1);
  return `<div class=card><b>Activity</b><br><small style="color:var(--mu)">Views by month posted · ${per()}</small><svg viewBox="0 0 420 170" width="100%" style="margin-top:8px">${v.map((x, i) => `<rect x="${i * 35 + 6}" y="${140 - x / m * 130}" width="24" height="${Math.max(x / m * 130, 2)}" rx="4" fill="var(--ac)"/><text x="${i * 35 + 18}" y="160" font-size="9" text-anchor="middle" fill="var(--mu)">${MN[i].slice(0, 3)}</text>`).join("")}</svg></div>`;
}
function topDocs() {
  const t = [...ovDocs()].sort((a, b) => b.v - a.v).slice(0, 5);
  return `<div class=card><b>Top documents</b><ul class=top>${t.map((d) => `<li><span>${d.t}</span><b>${d.v}</b></li>`).join("")}</ul></div>`;
}

// ---------- Documents table ----------
function btns(d) {
  const g = R == "guest", l = (a, i, t) => `<button title="${t}${g && a != "view" && !approved(d.id, a) ? " (request)" : ""}" onclick="act(${d.id},'${a}')">${i}${g && a != "view" && !approved(d.id, a) ? icon("lock", 10) : ""}</button>`;
  return `<div class=act>${l("view", icon("eye"), "View")}${l("download", icon("download"), "Download")}${l("print", icon("printer"), "Print")}${R != "guest" ? "" : ""}${l("edit", icon("edit"), "Edit")}${l("delete", icon("trash"), "Delete")}</div>`;
}
function rows(list) {
  if (!list.length) return "<div class=empty>No documents found.</div>";
  return `<div class=tw><table><tr><th>DOCUMENT<th>OWNER<th>DATE POSTED<th>VIEWS<th>DOWNLOADS<th>ACCESS<th>ACTIONS</tr>${list.map((d) => {
    const u = user(d.o), t = T[d.ty];
    return `<tr><td><div class=fi><div class=ic style="background:${t[1]}">${t[0][0]}</div><div>${d.t}<small>${t[0]} · ${d.sz} · ${d.c}${d.s ? " › " + d.s : ""}</small></div></div><td><div class=own onclick=profile(${u.id})><span class=av>${ini(u.n)}</span>${u.n}</div><td>${d.dt}<td>${d.v}<td>${d.dl}<td><span class="tag ${d.ac}">${d.ac}</span><td>${btns(d)}</tr>`;
  }).join("")}</table></div>`;
}

// ---------- Search, filters and zip download ----------
function filt() {
  return D.filter((d) => !d.del && (cat == "All" || d.c == cat) && (!sub || d.s == sub) && (!ft || d.ty == ft) && (!fa || d.ac == fa) && (!df || d.dt >= df) && (!dtt || d.dt <= dtt) && d.t.toLowerCase().includes(q.toLowerCase()));
}
function filters() {
  return `<div class=filters><select onchange="ft=this.value;render()"><option value="">All types${["pdf", "docx", "xlsx", "pptx"].map((x) => `<option ${ft == x ? "selected" : ""}>${x}`).join("")}</select><select onchange="fa=this.value;render()"><option value="">All access${["Public", "Internal", "Restricted"].map((x) => `<option ${fa == x ? "selected" : ""}>${x}`).join("")}</select><span style="color:var(--mu)">From</span><input type=date value="${df}" style="width:auto" onchange="df=this.value;render()"><span style="color:var(--mu)">To</span><input type=date value="${dtt}" style="width:auto" onchange="dtt=this.value;render()">${cat != "All" ? `<button class="btn g sm" onclick="cat='All';sub='';render()">${cat}${sub ? " › " + sub : ""} ${icon("x", 12)}</button>` : ""}${df || dtt || ft || fa ? `<button class="btn g sm" onclick="df='';dtt='';ft='';fa='';render()">Clear filters</button>` : ""}<button class="btn sm" style="margin-left:auto" onclick="bulk()">${icon("download", 14)} Download folder (.zip)</button></div>`;
}
async function zipDl(list, name) {
  if (!window.JSZip) return toast("ZIP library not loaded");
  const z = new JSZip();
  list.forEach((d) => {
    const f = [d.c, d.s].filter(Boolean).join("/");
    z.folder(f).file(d.t.replace(/[\\/:*?"<>|]/g, "_") + "." + d.ty, "Placeholder content for " + d.t);
  });
  const b = await z.generateAsync({ type: "blob" }), a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = name.replace(/[^\w.-]+/g, "_") + ".zip";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4e3);
}
function bulk() {
  if (R == "guest") return toast("Guests must request download access per file");
  const l = filt();
  if (!l.length) return toast("No files to download");
  l.forEach((d) => {
    d.dl++;
    addLog("downloaded", d);
  });
  zipDl(l, "PRC-DMS-" + (sub || cat));
  toast("Downloading " + l.length + " file(s) in category folders");
  render();
}
function tgl(i) {
  const c = Object.keys(CAT)[i];
  op[c] = !op[c];
  cat = c;
  sub = "";
  go("documents", 1);
}
function pick(i, j) {
  cat = Object.keys(CAT)[i];
  sub = CAT[cat][j];
  go("documents", 1);
}

// ---------- Pages ----------
const pages = {
  overview: () => `<h2>${R == "guest" ? "Welcome, Guest" : "Dashboard"}</h2>${dbar()}${R != "guest" ? stats() + `<div class="grid g2" style="margin-bottom:14px">${chart()}${topDocs()}</div>` : '<div class=card style="margin-bottom:14px">You have view-only access. Actions marked with a lock icon require approval: send a request to download, edit or delete.</div>'}<div class=card><b>Recent documents</b><br><small style="color:var(--mu)">Latest files added or updated</small>${rows(ovDocs().sort((a, b) => b.dt.localeCompare(a.dt)).slice(0, 5))}</div>`,
  documents: () => `<h2>${cat == "All" ? "All Documents" : cat + (sub ? " › " + sub : "")}</h2><div class=card>${filters()}${rows(filt())}</div>`,
  analytics: () => `<h2>Analytics</h2>${dbar()}${stats()}<div class="grid g2">${chart()}${topDocs()}</div>`,
  requests: () => `<h2>Access Requests</h2><div class="card tw">${!req.length ? "<div class=empty>No requests yet.</div>" : `<table><tr><th>DOCUMENT<th>ACTION<th>REQUESTER<th>DATE & TIME REQUESTED<th>REASON<th>STATUS<th></tr>${req.filter((r) => R != "guest" || r.by == ACTOR.guest).map((r) => `<tr><td>${doc(r.doc)?.t}<td>${r.act}<td>${esc(user(r.by).n)}<td class=nw>${when(r.t)}<td class=reason>${esc(r.why)}<td class=nw><span class="tag ${r.st == "Approved" ? "Public" : r.st == "Denied" ? "Restricted" : "Internal"}">${r.st}</span><td class=nw>${R != "guest" && r.st == "Pending" ? `<button class="btn sm" onclick="decide(${r.id},'Approved')">Approve</button> <button class="btn g sm" onclick="decide(${r.id},'Denied')">Deny</button>` : ""}</tr>`).join("")}</table>`}</div>`,
  trash: () => {
    const t = D.filter((d) => d.del);
    if (!t.length) return `<h2>Trash Bin</h2><div class="card tw"><div class=empty>Bin is empty.</div></div>`;
    return `<h2>Trash Bin</h2><div class="card tw"><table><tr><th>DOCUMENT<th>DELETED BY<th>DATE & TIME DELETED<th>ACTIONS</tr>${t.map((d) => {
      const u = user(d.delBy);
      return `<tr><td><div class=fi><div class=ic style="background:${T[d.ty][1]}">${T[d.ty][0][0]}</div><div>${esc(d.t)}<small>${T[d.ty][0]} · ${d.sz}</small></div></div>
        <td><div class=own onclick=profile(${u.id})><span class=av>${ini(u.n)}</span>${esc(u.n)}</div>
        <td class=nw>${d.delAt ? when(d.delAt) : "—"}
        <td class=nw><button class="btn sm" onclick="restoreDoc(${d.id})">Restore</button> ${R == "sa" ? `<button class="btn r sm" onclick="confirmPurge(${d.id})">Delete permanently</button>` : ""}</tr>`;
    }).join("")}</table></div>`;
  },
  activity: () => `<h2>Recent Activity</h2><div class="card tw">${!log.length ? "<div class=empty>No activity yet — view, download or edit a file.</div>" : `<table><tr><th>WHO<th>ACTION<th>DOCUMENT<th>EMAIL / IP<th>WHEN</tr>${log.map((l) => {
    const u = user(l.u);
    return `<tr><td><div class=own onclick=profile(${u.id})><span class=av>${ini(u.n)}</span>${u.n}</div><td>${l.a}<td>${l.d}<td>${u.e} · ${u.ip}<td>${l.t}</tr>`;
  }).join("")}</table>`}</div>`,
  people: () => `<h2>People & Access</h2><div class="grid g2"><div class="card tw"><table><tr><th>NAME<th>EMAIL<th>USERNAME<th>ROLE<th>OFFICE / DIVISION<th>ACTIONS</tr>${U.map((u) => `<tr><td><div class=own onclick=profile(${u.id})><span class=av>${ini(u.n)}</span>${u.n}</div><td>${u.e}<td>${u.un || "—"}<td>${RN[u.r]}<td>${u.d}<td>${userBtns(u)}</tr>`).join("")}</table></div><div class=card><b class="card-title">Create user</b><p class=note>All fields are required.</p>${field("un", "Full name", "", "e.g. Juan Dela Cruz")}${field("ue", "Email", "", "name@prc.gov.ph")}${field("uc", "Contact number", "", "09XXXXXXXXX or +639XXXXXXXXX")}${field("uu", "Username", "", "3-20 letters, numbers, . or _")}${field("up", "Password", "password", "8+ characters with a letter and a number")}<label>Role</label><select id=ur style="width:100%" onchange="toggleOffice()"><option value=admin>Admin<option value=guest>Guest User<option value=sa>Super Admin</select><div id=uo><label>Office / Division</label><select id=ud style="width:100%">${OFFICES.map((o) => `<option>${o}`).join("")}</select></div><br><br><button class=btn onclick=addU()>Create user</button></div></div>`,
  settings: () => `<h2>Customize UI</h2><div class=gcust>${appearanceCard()}${categoryManager()}</div>`
};

// ---------- User creation ----------
// Guest users don't belong to an office/division, so hide that field for them
function toggleOffice() {
  $("#uo").style.display = $("#ur").value === "guest" ? "none" : "";
}
async function addU() {
  const name = $("#un").value.replace(/\s+/g, " ").trim();
  const email = $("#ue").value.trim();
  const phone = $("#uc").value.replace(/[\s-]/g, "");
  const username = $("#uu").value.trim().toLowerCase();
  const password = $("#up").value;

  let ok = checkFields([
    ["un", "name", name],
    ["ue", "email", email],
    ["uc", "phone", phone],
    ["uu", "username", username],
    ["up", "password", password]
  ]);
  if (username && U.some((x) => x.un === username)) { setErr("uu", "That username is already taken."); ok = false; }
  if (email && U.some((x) => x.e.toLowerCase() === email.toLowerCase())) { setErr("ue", "This email is already used by another user."); ok = false; }
  if (!ok) return toast("Please fix the highlighted fields");

  const role = $("#ur").value;
  const salt = crypto.randomUUID();
  U.push({
    id: Math.max(...U.map((x) => x.id)) + 1,
    n: name, e: email, p: phone, r: role, d: role === "guest" ? "—" : $("#ud").value, ip: "—",
    un: username, salt, h: await hash(password, salt)
  });
  toast("User created: " + name + " (they can now sign in)");
  render();
}

// ---------- Edit / delete people (Super Admin) ----------
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// Buttons shown at the end of each row (the creator and your own account can't be deleted)
function userBtns(u) {
  const canDelete = !u.owner && u.id !== SESSION.id;
  return `<div class=act>
    <button title="Edit" onclick="editUser(${u.id})">${icon("edit")}</button>
    ${canDelete ? `<button title="Delete" onclick="confirmDelUser(${u.id})">${icon("trash")}</button>` : ""}
  </div>`;
}

function editUser(id) {
  const u = user(id);
  const lockRole = u.owner || u.id === SESSION.id;   // can't change your own role
  modal(`<h3>Edit user</h3>
    ${field("en", "Full name", "", "", u.n)}
    ${field("ee", "Email", "", "", u.e === "—" ? "" : u.e)}
    ${field("ec", "Contact number", "", "09XXXXXXXXX or +639XXXXXXXXX", u.p === "—" ? "" : u.p)}
    ${field("eu", "Username", "", "", u.un || "", !!u.un)}
    ${field("ep", "New password (leave blank to keep the current one)", "password", "", "", false)}
    <label>Role</label>
    <select id=er style="width:100%" onchange="toggleEditOffice()" ${lockRole ? "disabled" : ""}>
      ${Object.keys(RN).map((k) => `<option value=${k} ${u.r === k ? "selected" : ""}>${RN[k]}`).join("")}
    </select>
    <div id=eoff style="${u.r === "guest" ? "display:none" : ""}">
      <label>Office / Division</label>
      <select id=eo style="width:100%">${OFFICES.map((o) => `<option ${o === u.d ? "selected" : ""}>${o}`).join("")}</select>
    </div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn g" onclick=closeM()>Cancel</button>
      <button class=btn onclick="saveUser(${u.id})">Save changes</button>
    </div>`);
}

function toggleEditOffice() {
  $("#eoff").style.display = $("#er").value === "guest" ? "none" : "";
}

async function saveUser(id) {
  const u = U.find((x) => x.id === id);
  const name = $("#en").value.replace(/\s+/g, " ").trim();
  const email = $("#ee").value.trim();
  const phone = $("#ec").value.replace(/[\s-]/g, "");
  const username = $("#eu").value.trim().toLowerCase();
  const password = $("#ep").value;

  const list = [["en", "name", name], ["ee", "email", email], ["ec", "phone", phone]];
  if (username || u.un) list.push(["eu", "username", username]);
  let ok = checkFields(list);

  if (username && U.some((x) => x.id !== id && x.un === username)) { setErr("eu", "That username is already taken."); ok = false; }
  if (email && U.some((x) => x.id !== id && x.e.toLowerCase() === email.toLowerCase())) { setErr("ee", "This email is already used by another user."); ok = false; }
  if (password && !RULES.password.test(password)) { setErr("ep", RULES.password.msg); ok = false; }
  else if (!password && username && !u.h) { setErr("ep", "Set a password for this new login."); ok = false; }
  else setErr("ep", "");
  if (!ok) return toast("Please fix the highlighted fields");

  u.n = name;
  u.e = email;
  u.p = phone;
  if (username) u.un = username;
  if (password) {
    u.salt = crypto.randomUUID();
    u.h = await hash(password, u.salt);
  }
  if (!u.owner && u.id !== SESSION.id) u.r = $("#er").value;
  u.d = u.r === "guest" ? "—" : $("#eo").value;

  closeM();
  toast("Saved changes for " + u.n);
  render();
}

function confirmDelUser(id) {
  const u = user(id);
  modal(`<h3>Delete user</h3>
    <p>Delete <b>${esc(u.n)}</b>? They will no longer be able to sign in. This cannot be undone.</p>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn g" onclick=closeM()>Cancel</button>
      <button class="btn r" onclick="delUser(${u.id})">Delete</button>
    </div>`);
}

function delUser(id) {
  const u = user(id);
  U = U.filter((x) => x.id !== id);
  req = req.filter((r) => r.by !== id);   // their pending requests go too
  closeM();
  toast("Deleted " + u.n);
  render();
}

// ---------- Customize UI: appearance + categories (Super Admin) ----------
const DEFAULT_SETTINGS = { name: "Document Management System", accent: "#5b5bd6", sidebar: "#0f1428", theme: "auto" };
let SETTINGS = { ...DEFAULT_SETTINGS };

// Push the saved look (colors, theme) onto the page
function applySettings() {
  const root = document.documentElement;
  root.style.setProperty("--ac", SETTINGS.accent);
  root.style.setProperty("--sb", SETTINGS.sidebar);
  if (SETTINGS.theme === "auto") root.removeAttribute("data-theme");
  else root.dataset.theme = SETTINGS.theme;
}

function setSetting(key, value) {
  SETTINGS[key] = value;
  applySettings();
  if (key === "name") $("#bn").textContent = value.toUpperCase();
  // save shortly after the last change (dragging a color picker fires many events)
  clearTimeout(window.saveTimer);
  window.saveTimer = setTimeout(saveState, 300);
}

function resetSettings() {
  SETTINGS = { ...DEFAULT_SETTINGS };
  applySettings();
  toast("Appearance reset to default");
  render();
}

function appearanceCard() {
  const themes = [["auto", "Match device"], ["light", "Light"], ["dark", "Dark"]];
  return `<div class=card>
    <b class="card-title">Appearance</b>
    <label>System name</label>
    <input value="${esc(SETTINGS.name)}" oninput="setSetting('name', this.value)">
    <label>Accent color</label>
    <input type=color value="${SETTINGS.accent}" style="height:42px" oninput="setSetting('accent', this.value)">
    <label>Sidebar color</label>
    <input type=color value="${SETTINGS.sidebar}" style="height:42px" oninput="setSetting('sidebar', this.value)">
    <label>Theme</label>
    <select style="width:100%" onchange="setSetting('theme', this.value)">
      ${themes.map(([v, l]) => `<option value=${v} ${SETTINGS.theme === v ? "selected" : ""}>${l}`).join("")}
    </select>
    <div style="margin-top:14px"><button class="btn g sm" onclick="resetSettings()">Reset to default</button></div>
  </div>`;
}

// How many documents use a category (or one of its sub-categories)
const countDocs = (c, sc) => D.filter((d) => d.c === c && (sc === undefined || d.s === sc)).length;

function categoryManager() {
  const keys = Object.keys(CAT);
  return `<div class=card>
    <b class="card-title">Categories</b>
    <p class=note>Categories and sub-categories appear in the sidebar and in the New document form.</p>
    ${keys.map((c, i) => `
      <div class=catrow>
        <div class=cathead>
          <b>${esc(c)}</b><span class=docn>${countDocs(c)} document(s)</span>
          <div class=act>
            <button title="Rename" onclick="renameModal(${i})">${icon("edit")}</button>
            <button title="Delete" onclick="delCat(${i})">${icon("trash")}</button>
          </div>
        </div>
        <div class=chips>
          ${CAT[c].map((sc, j) => `<span class=chip>${esc(sc)}
            <button title="Rename" onclick="renameModal(${i}, ${j})">${icon("edit", 11)}</button>
            <button title="Remove" onclick="delCat(${i}, ${j})">${icon("x", 11)}</button></span>`).join("")}
        </div>
        <div class=addrow>
          <input id="sub${i}" placeholder="New sub-category">
          <button class="btn g sm" onclick="addSub(${i})">Add</button>
        </div>
      </div>`).join("")}
    <div class=addrow style="margin-top:14px">
      <input id=newcat placeholder="New category name">
      <button class=btn onclick="addCategory()">Add category</button>
    </div>
  </div>`;
}

function addCategory() {
  const n = $("#newcat").value.trim();
  if (!n) return toast("Enter a category name");
  if (n in CAT) return toast("That category already exists");
  CAT[n] = [];
  toast("Category added: " + n);
  render();
}

function addSub(i) {
  const c = Object.keys(CAT)[i];
  const n = $("#sub" + i).value.trim();
  if (!n) return toast("Enter a sub-category name");
  if (CAT[c].includes(n)) return toast("Already exists in " + c);
  CAT[c].push(n);
  op[c] = true;   // open it in the sidebar
  toast("Added " + n + " to " + c);
  render();
}

// j is undefined for a category, or the sub-category index
function renameModal(i, j) {
  const c = Object.keys(CAT)[i];
  const current = j === undefined ? c : CAT[c][j];
  modal(`<h3>Rename ${j === undefined ? "category" : "sub-category"}</h3>
    <label>Name</label><input id=rn value="${esc(current)}">
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn g" onclick=closeM()>Cancel</button>
      <button class=btn onclick="doRename(${i}, ${j === undefined ? "null" : j})">Save</button>
    </div>`);
}

function doRename(i, j) {
  const c = Object.keys(CAT)[i];
  const n = $("#rn").value.trim();
  if (!n) return toast("Enter a name");

  if (j === null) {
    if (n !== c && n in CAT) return toast("That category already exists");
    // rebuild the object so the order in the sidebar stays the same
    const entries = Object.entries(CAT);
    Object.keys(CAT).forEach((k) => delete CAT[k]);
    entries.forEach(([k, v]) => (CAT[k === c ? n : k] = v));
    D.forEach((d) => { if (d.c === c) d.c = n; });
    if (cat === c) cat = n;
    if (op[c]) { op[n] = op[c]; delete op[c]; }
  } else {
    const old = CAT[c][j];
    if (n !== old && CAT[c].includes(n)) return toast("Already exists in " + c);
    CAT[c][j] = n;
    D.forEach((d) => { if (d.c === c && d.s === old) d.s = n; });
    if (cat === c && sub === old) sub = n;
  }
  closeM();
  toast("Renamed to " + n);
  render();
}

// Categories that still have documents can't be deleted
function delCat(i, j) {
  const c = Object.keys(CAT)[i];
  const isSub = j !== undefined;
  const name = isSub ? CAT[c][j] : c;
  const used = isSub ? countDocs(c, name) : countDocs(c);
  if (used) return toast(`"${name}" still has ${used} document(s). Move or delete them first.`);
  modal(`<h3>Delete ${isSub ? "sub-category" : "category"}</h3>
    <p>Delete <b>${esc(name)}</b>${!isSub && CAT[c].length ? " and its sub-categories" : ""}?</p>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn g" onclick=closeM()>Cancel</button>
      <button class="btn r" onclick="doDelCat(${i}, ${isSub ? j : "null"})">Delete</button>
    </div>`);
}

function doDelCat(i, j) {
  const c = Object.keys(CAT)[i];
  if (j === null) {
    delete CAT[c];
    if (cat === c) { cat = "All"; sub = ""; }
  } else {
    const name = CAT[c][j];
    CAT[c].splice(j, 1);
    if (cat === c && sub === name) sub = "";
  }
  closeM();
  toast("Deleted");
  render();
}

// ---------- Form rules (create / edit user) ----------
const RULES = {
  name: {
    test: (v) => /^\p{L}[\p{L} .'-]*$/u.test(v) && v.replace(/[^\p{L}]/gu, "").length >= 2,
    msg: "Letters only: no numbers or symbols (at least 2 letters)."
  },
  email: {
    test: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v),
    msg: "Enter a valid email address, e.g. name@prc.gov.ph."
  },
  phone: {
    test: (v) => /^(09\d{9}|\+639\d{9})$/.test(v),
    msg: "Use a Philippine mobile number: 09XXXXXXXXX or +639XXXXXXXXX."
  },
  username: {
    test: (v) => /^[a-z0-9._]{3,20}$/i.test(v),
    msg: "3-20 characters: letters, numbers, dot or underscore."
  },
  password: {
    test: (v) => /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(v),
    msg: "At least 8 characters with at least one letter and one number."
  }
};

// One labelled input with an error line underneath
function field(id, label, type, placeholder, value = "", required = true) {
  return `<label>${label}${required ? ' <span class=req>*</span>' : ""}</label>
    <input id=${id} ${type ? "type=" + type : ""} ${type === "password" ? "autocomplete=new-password" : ""} placeholder="${esc(placeholder)}" value="${esc(value)}" oninput="setErr('${id}', '')">
    <div class=ferr id=${id}_e></div>`;
}

function setErr(id, msg) {
  const box = $("#" + id + "_e"), input = $("#" + id);
  if (box) box.textContent = msg;
  if (input) input.classList.toggle("bad", !!msg);
}

// list = [[inputId, ruleName, value], ...]. Shows a message under every wrong field.
function checkFields(list) {
  let allGood = true;
  for (const [id, rule, value] of list) {
    let msg = "";
    if (!value.trim()) msg = "This field is required.";
    else if (!RULES[rule].test(value)) msg = RULES[rule].msg;
    setErr(id, msg);
    if (msg && allGood) { $("#" + id).focus(); allGood = false; }
    else if (msg) allGood = false;
  }
  return allGood;
}


function when(value) {
  const d = new Date(value);
  return isNaN(d) ? String(value) : d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

// ---------- Sidebar, header and main render ----------
function nav() {
  const sa = R == "sa", ad = R != "guest", b = (p, i, l, c) => `<button class="${P == p && cat == "All" || P == p && p != "documents" ? "on" : ""}" onclick="go('${p}')">${i} ${l}${c != null ? `<b>${c}</b>` : ""}</button>`;
  return `<div class=brand><img class=seal src="${LOGO}" alt="PRC"><span id=bn>${esc(SETTINGS.name.toUpperCase())}</span></div><div class=nav>${b("overview", icon("grid"), "Overview")}${b("documents", icon("file"), "All Documents", D.filter((d) => !d.del).length)}<h6>CATEGORIES</h6><div class=cats>${Object.keys(CAT).map((c, i) => `<button class="${cat == c && P == "documents" && !sub ? "on" : ""}" onclick="tgl(${i})">${icon("folder")} ${esc(c)}${CAT[c].length ? `<b>${icon(op[c] ? "chevronDown" : "chevronRight", 12)}</b>` : ""}</button>${op[c] ? CAT[c].map((x, j) => `<button class="sub ${cat == c && sub == x && P == "documents" ? "on" : ""}" onclick="pick(${i},${j})">${icon("file", 13)} ${esc(x)}</button>`).join("") : ""}`).join("")}</div><h6>WORKSPACE</h6>${ad ? b("analytics", icon("chart"), "Analytics") : ""}${b("requests", icon("key"), "Requests", req.filter((r) => r.st == "Pending").length)}${ad ? b("trash", icon("trash"), "Trash Bin", D.filter((d) => d.del).length) : ""}${sa ? b("activity", icon("clock"), "Recent Activity") + b("people", icon("users"), "People & Access") + b("settings", icon("sliders"), "Customize UI") : ""}</div>`;
}
function go(p, k) {
  P = p;
  if (!k && p == "documents") {
    cat = "All";
    sub = "";
  }
  $("#sb").classList.remove("open");
  render();
}
function render() {
  if (!AUTH) return;
  saveState();
  $("#lg").innerHTML = "";
  $("#app").style.display = "flex";
  const u = user(ACTOR[R]);
  if (R == "guest" && ["analytics", "activity", "people", "settings", "trash"].includes(P) || R == "admin" && ["activity", "people", "settings"].includes(P)) P = "overview";
  $("#sb").innerHTML = nav();
  $("#hd").innerHTML = `<button class="btn g burger" onclick="$('#sb').classList.toggle('open')">${icon("menu", 18)}</button><input class=s placeholder="Search documents, people, or activity…" value="${q}" oninput="q=this.value;clearTimeout(window.tm);window.tm=setTimeout(()=>{if(!['overview','documents'].includes(P))P='documents';render();const i=$('.s');i.focus();i.setSelectionRange(99,99)},250)"><span class="tag Internal">${RN[R]}</span>${R != "guest" ? `<button class=btn onclick="upl()">${icon("plus", 14)} New document</button>` : ""}<span class=own onclick=profile(${u.id})><span class=av>${ini(u.n)}</span>${u.n}</span><button class="btn g sm" onclick=logout()>Log out</button>`;
  $("#pg").innerHTML = pages[P]();
}

// ---------- Posting a new document ----------
function upl() {
  if (!Object.keys(CAT).length) return toast("Add a category first (Customize UI)");
  modal(`<h3>New document</h3><label>Title</label><input id=nt><label>Category</label><select id=nc style="width:100%" onchange="subOpts()">${Object.keys(CAT).map((c) => `<option>${c}`).join("")}</select><div id=nsw><label>Sub-category</label><select id=ns style="width:100%"></select></div><label>Access level</label><select id=na style="width:100%"><option>Public<option>Internal<option>Restricted</select><label>File type</label><select id=nf style="width:100%"><option>pdf<option>docx<option>xlsx<option>pptx</select><div style="text-align:right;margin-top:14px"><button class=btn onclick="addD()">Upload</button></div>`);
  subOpts();
}
function subOpts() {
  const l = CAT[$("#nc").value];
  $("#nsw").style.display = l.length ? "" : "none";
  $("#ns").innerHTML = l.map((x) => `<option>${x}`).join("");
}
function addD() {
  const t = $("#nt").value.trim();
  if (!t) return toast("Enter a title");
  const c = $("#nc").value, d = { id: nid++, t, c, s: CAT[c].length ? $("#ns").value : "", ty: $("#nf").value, sz: "1.0 MB", o: ACTOR[R], dt: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), v: 0, dl: 0, ac: $("#na").value, del: 0 };
  D.unshift(d);
  addLog("posted", d);
  closeM();
  toast("Document posted in " + c + (d.s ? " › " + d.s : ""));
  render();
}

// ---------- Start ----------
loadState();
applySettings();
guardSession();
window.addEventListener("storage", (e) => {
  if (e.key == STORE_KEY) {
    // another tab changed something: refresh this page once things settle
    clearTimeout(window.syncTimer);
    window.syncTimer = setTimeout(() => {
      loadState();
      applySettings();
      if (AUTH && !U.some((x) => x.id === SESSION.id)) return logout();   // this account was deleted
      if (AUTH) render();
    }, 150);
  }
});
render();
