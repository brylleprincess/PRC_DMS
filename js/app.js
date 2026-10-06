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

// Keywords for the sample documents (new documents get theirs from the upload form)
const SEED_KW = {
  1: ["training", "database", "semester", "seminar"],
  2: ["cover page", "quality manual", "policy manual", "iso 9001"],
  3: ["qpm", "manual revision", "quality management"],
  4: ["regional issuance", "office order", "regional director"],
  5: ["commission", "resolution", "chairperson", "commissioner"],
  6: ["prb", "guidelines", "professional regulatory board"],
  7: ["rbac", "implementation plan", "roadmap", "access control"],
  8: ["financial", "budget", "q4", "opcr", "accomplishments"]
};
D.forEach((d) => { d.kw = SEED_KW[d.id] || []; });

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
  LS.set(STORE_KEY, { D, req, log, nid, users: U, CAT, SETTINGS, shares });
}
function loadState() {
  const s = LS.get(STORE_KEY);
  if (!s) return;
  if (s.D) D = s.D;
  if (s.req) req = s.req;
  if (s.log) log = s.log;
  if (s.nid) nid = s.nid;
  if (s.shares) shares = s.shares;
  if (s.users) U = typeof withBuiltIn === "function" ? withBuiltIn(s.users) : s.users;
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
function modal(h, wide) {
  $("#md").innerHTML = `<div class=mask onclick="if(event.target==this)closeM()"><div class="modal${wide ? " wide" : ""}">${h}</div></div>`;
}
let previewUrl = null;   // address of the file currently shown in the preview popup
function closeM() {
  $("#md").innerHTML = "";
  if (previewUrl) { URL.revokeObjectURL(previewUrl); previewUrl = null; }
}

// ---------- Actions: view / download / print / edit / delete ----------
function addLog(a, d) {
  log.unshift({ a, d: d.t, u: ACTOR[R], t: new Date().toISOString() });
}
const approved = (id, a) => req.some((r) => r.doc == id && r.act == a && r.st == "Approved" && r.by == ACTOR.guest);
async function act(id, a) {
  const d = doc(id);
  if (R == "guest" && a != "view" && !approved(id, a)) return reqModal(id, a);
  if (a == "view") {
    d.v++;
    addLog("viewed", d);
    render();
    return showPreview(d);
  }
  if (a == "download") {
    d.dl++;
    addLog("downloaded", d);
    zipDl([d], d.t);
    toast("Downloading " + d.t + ".zip (inside its category folder)");
  }
  if (a == "print") {
    addLog("printed", d);
    if (d.hasFile) {
      await printFile(d);
    } else {
      toast("Sending to printer…");
      try { window.print(); } catch (e) {}
    }
  }
  if (a == "edit") return editDoc(id);   // opens the Edit document form
  if (a == "delete") {
    d.del = 1;
    d.delAt = new Date().toISOString();   // when it was deleted
    d.delBy = ACTOR[R];                   // who deleted it
    addLog("deleted", d);
    toast("Moved to Recycle Bin");
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

// ---------- Recycle bin ----------
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
  fileDelete(id).catch(() => {});
  (d.history || []).forEach((e) => e.key && fileDelete(e.key).catch(() => {}));   // old revisions too
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
  return `<div class=tw>${selBar()}<table><tr><th class=cb><input type=checkbox title="Select all" ${list.every((d) => sel.has(d.id)) ? "checked" : ""} onclick="toggleAll(${JSON.stringify(list.map((d) => d.id))})"><th>DOCUMENT<th>OWNER<th>DATE POSTED<th>VIEWS<th>DOWNLOADS<th>ACCESS<th>ACTIONS</tr>${list.map((d) => {
    const u = user(d.o), t = T[d.ty];
    return `<tr><td class=cb><input type=checkbox ${sel.has(d.id) ? "checked" : ""} onclick="toggleSel(${d.id})"><td><div class=fi><div class=ic style="background:${t[1]}">${t[0][0]}</div><div>${esc(d.t)} <span class="tag Internal rev" title="Version history" onclick="showHistory(${d.id})">${rev2(d.rev)}</span><small>${t[0]} · ${d.sz} · ${d.c}${d.s ? " › " + d.s : ""}</small></div></div><td><div class=own onclick=profile(${u.id})><span class=av>${ini(u.n)}</span>${u.n}</div><td>${d.dt}<td>${d.v}<td>${d.dl}<td><span class="tag ${d.ac}">${d.ac}</span><td>${btns(d)}</tr>`;
  }).join("")}</table></div>`;
}

// ---------- Select files: download / share / delete several at once ----------
let sel = new Set();     // ids of the ticked documents
let shares = [];         // who shared which file with whom

const selDocs = () => D.filter((d) => sel.has(d.id) && !d.del);
function toggleSel(id) { sel.has(id) ? sel.delete(id) : sel.add(id); render(); }
function toggleAll(ids) {
  const all = ids.every((i) => sel.has(i));
  ids.forEach((i) => (all ? sel.delete(i) : sel.add(i)));
  render();
}
function clearSel() { sel.clear(); render(); }

// The bar that appears above the table when something is ticked
function selBar() {
  const list = selDocs();
  if (!list.length) return "";
  const lock = (a) => (R == "guest" && list.some((d) => !approved(d.id, a)) ? " " + icon("lock", 10) : "");
  return `<div class=selbar><b>${list.length} selected</b>
    <button class="btn sm" onclick="bulkDownload()">${icon("download", 14)} Download${lock("download")}</button>
    <button class="btn sm" onclick="bulkShare()">${icon("share", 14)} Share${lock("share")}</button>
    <button class="btn r sm" onclick="bulkDelete()">${icon("trash", 14)} Delete${lock("delete")}</button>
    <button class="btn g sm" onclick="clearSel()">Clear</button></div>`;
}

// Guests need an approved request for every file before they can do an action
function guestBlocked(list, action) {
  if (R != "guest") return false;
  const first = list.find((d) => !approved(d.id, action));
  if (!first) return false;
  const n = list.filter((d) => !approved(d.id, action)).length;
  toast(n + " selected file(s) need approval to " + action + ". Send a request first.");
  reqModal(first.id, action);
  return true;
}

function bulkDownload() {
  const list = selDocs();
  if (guestBlocked(list, "download")) return;
  list.forEach((d) => { d.dl++; addLog("downloaded", d); });
  zipDl(list, "PRC-DMS-selected");   // real files, kept in their category folders
  toast("Downloading " + list.length + " file(s) in category folders");
  sel.clear();
  render();
}

function bulkDelete() {
  const list = selDocs();
  if (guestBlocked(list, "delete")) return;
  modal(`<h3>Delete ${list.length} file(s)?</h3>
    <p>They will be moved to the Recycle Bin, where they can be restored.</p>
    <ul class=sharelist>${list.map((d) => `<li>${esc(d.t)}</li>`).join("")}</ul>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn g" onclick=closeM()>Cancel</button>
      <button class="btn r" onclick="doBulkDelete()">Move to Recycle Bin</button>
    </div>`);
}

function doBulkDelete() {
  const list = selDocs();
  list.forEach((d) => {
    d.del = 1;
    d.delAt = new Date().toISOString();
    d.delBy = ACTOR[R];
    addLog("deleted", d);
  });
  sel.clear();
  closeM();
  toast(list.length + " file(s) moved to the Recycle Bin");
  render();
}

// Share: copy a link, or send the files to someone in the system
function bulkShare() {
  const list = selDocs();
  if (guestBlocked(list, "share")) return;
  const base = location.href.split("#")[0].split("?")[0].replace(/[^/]*$/, "index.html");
  const links = list.map((d) => d.t + ": " + base + "?doc=" + d.id).join("\n");
  const people = U.filter((u) => u.id !== ACTOR[R]);
  modal(`<h3>Share ${list.length} file(s)</h3>
    <ul class=sharelist>${list.map((d) => `<li>${esc(d.t)} <span class="tag Internal">${rev2(d.rev)}</span></li>`).join("")}</ul>
    <label>Link (people open it after signing in)</label>
    <textarea id=shl readonly rows="${Math.min(list.length, 4)}">${esc(links)}</textarea>
    <button class="btn g sm" style="margin-top:6px" onclick="copyShareLink()">Copy link</button>
    <label>Share with</label>
    <select id=shu style="width:100%"><option value="">Choose a person</option>${people.map((u) => `<option value=${u.id}>${esc(u.n)} (${RN[u.r]})`).join("")}</select>
    <div class=ferr id=shu_e></div>
    <label>Message (optional)</label>
    <input id=shm placeholder="e.g. Please review before Friday">
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn g" onclick=closeM()>Close</button>
      <button class=btn onclick="doShare()">Share</button>
    </div>`);
}

function copyShareLink() {
  const box = $("#shl");
  box.select();
  try { document.execCommand("copy"); toast("Link copied"); } catch (e) { toast("Press Ctrl+C to copy the link"); }
}

function doShare() {
  const to = +$("#shu").value;
  if (!to) return setErr("shu", "Choose who to share with.");
  const list = selDocs(), msg = $("#shm").value.trim();
  list.forEach((d) => {
    shares.unshift({ doc: d.id, from: ACTOR[R], to, msg, t: new Date().toISOString() });
    addLog("shared with " + user(to).n, d);
  });
  sel.clear();
  closeM();
  toast("Shared " + list.length + " file(s) with " + user(to).n);
  render();
}

// "Shared with you" card on the Overview page
function sharedCard() {
  const mine = shares.filter((x) => x.to === ACTOR[R] && doc(x.doc) && !doc(x.doc).del).slice(0, 6);
  if (!mine.length) return "";
  return `<div class=card style="margin-bottom:14px"><b class="card-title">Shared with you</b>
    ${mine.map((x) => `<div class=hitrow style="padding:10px 0">
      <div><a href="#" class=doclink onclick="act(${x.doc}, 'view'); return false">${esc(doc(x.doc).t)}</a>
      <small>From ${esc(user(x.from).n)} · ${when(x.t)}${x.msg ? " · “" + esc(x.msg) + "”" : ""}</small></div></div>`).join("")}</div>`;
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
  for (const d of list) {
    const folder = [d.c, d.s].filter(Boolean).join("/");
    const fileName = d.fn || d.t.replace(/[\\/:*?"<>|]/g, "_") + "." + d.ty;
    const blob = d.hasFile ? await fileGet(d.id) : null;
    z.folder(folder).file(fileName, blob || "Placeholder content for " + d.t);   // real file if one was uploaded
  }
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
  overview: () => `<h2>${R == "guest" ? "Welcome, Guest" : "Dashboard"}</h2>${sharedCard()}${dbar()}${R != "guest" ? stats() + `<div class="grid g2" style="margin-bottom:14px">${chart()}${topDocs()}</div>` : '<div class=card style="margin-bottom:14px">You have view-only access. Actions marked with a lock icon require approval: send a request to download, edit or delete.</div>'}<div class=card><b>Recent documents</b><br><small style="color:var(--mu)">Latest files added or updated</small>${rows(ovDocs().sort((a, b) => b.dt.localeCompare(a.dt)).slice(0, 5))}</div>`,
  search: () => searchPage(),
  documents: () => `<h2>${cat == "All" ? "All Documents" : cat + (sub ? " › " + sub : "")}</h2><div class=card>${filters()}${rows(filt())}</div>`,
  analytics: () => `<h2>Analytics</h2>${dbar()}${stats()}<div class="grid g2">${chart()}${topDocs()}</div>`,
  requests: () => `<h2>Access Requests</h2><div class="card tw">${!req.length ? "<div class=empty>No requests yet.</div>" : `<table><tr><th>DOCUMENT<th>ACTION<th>REQUESTER<th>DATE & TIME REQUESTED<th>REASON<th>STATUS<th></tr>${req.filter((r) => R != "guest" || r.by == ACTOR.guest).map((r) => `<tr><td>${doc(r.doc)?.t}<td>${r.act}<td>${esc(user(r.by).n)}<td class=nw>${when(r.t)}<td class=reason>${esc(r.why)}<td class=nw><span class="tag ${r.st == "Approved" ? "Public" : r.st == "Denied" ? "Restricted" : "Internal"}">${r.st}</span><td class=nw>${R != "guest" && r.st == "Pending" ? `<button class="btn sm" onclick="decide(${r.id},'Approved')">Approve</button> <button class="btn g sm" onclick="decide(${r.id},'Denied')">Deny</button>` : ""}</tr>`).join("")}</table>`}</div>`,
  trash: () => {
    const t = D.filter((d) => d.del);
    if (!t.length) return `<h2>Recycle Bin</h2><div class="card tw"><div class=empty>Bin is empty.</div></div>`;
    return `<h2>Recycle Bin</h2><div class="card tw"><table><tr><th>DOCUMENT<th>DELETED BY<th>DATE & TIME DELETED<th>ACTIONS</tr>${t.map((d) => {
      const u = user(d.delBy);
      return `<tr><td><div class=fi><div class=ic style="background:${T[d.ty][1]}">${T[d.ty][0][0]}</div><div>${esc(d.t)}<small>${T[d.ty][0]} · ${d.sz}</small></div></div>
        <td><div class=own onclick=profile(${u.id})><span class=av>${ini(u.n)}</span>${esc(u.n)}</div>
        <td class=nw>${d.delAt ? when(d.delAt) : "—"}
        <td class=nw><button class="btn sm" onclick="restoreDoc(${d.id})">Restore</button> ${R == "sa" ? `<button class="btn r sm" onclick="confirmPurge(${d.id})">Delete permanently</button>` : ""}</tr>`;
    }).join("")}</table></div>`;
  },
  activity: () => `<h2>Recent Activity</h2><div class="card tw">${!log.length ? "<div class=empty>No activity yet — view, download or edit a file.</div>" : `<table><tr><th>WHO<th>ACTION<th>DOCUMENT<th>EMAIL / IP<th>WHEN</tr>${log.map((l) => {
    const u = user(l.u);
    return `<tr><td><div class=own onclick=profile(${u.id})><span class=av>${ini(u.n)}</span>${u.n}</div><td class=nw>${l.a}<td>${esc(l.d)}<td>${u.e} · ${u.ip}<td class=nw>${when(l.t, true)}</tr>`;
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

// "Oct 2, 2026, 4:10 PM"
// withSeconds = true gives "Oct 6, 2026, 8:41:10 AM" (used by the activity log)
function when(value, withSeconds) {
  const d = new Date(value);
  return isNaN(d) ? String(value) : d.toLocaleString([], { dateStyle: "medium", timeStyle: withSeconds ? "medium" : "short" });
}

// ---------- Uploaded files (kept in the browser's IndexedDB) ----------
const FILE_TYPES = { pdf: "pdf", doc: "docx", docx: "docx", xls: "xlsx", xlsx: "xlsx", ppt: "pptx", pptx: "pptx" };
const MAX_FILE = 25 * 1024 * 1024;   // 25 MB

const fmtSize = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB");

function fileDB() {
  return new Promise((ok, fail) => {
    const req = indexedDB.open("prcdms_files", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("files");
    req.onsuccess = () => ok(req.result);
    req.onerror = () => fail(req.error);
  });
}
async function fileSave(id, blob) {
  const db = await fileDB();
  return new Promise((ok, fail) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").put(blob, id);
    tx.oncomplete = () => ok();
    tx.onerror = () => fail(tx.error);
  });
}
async function fileGet(id) {
  const db = await fileDB();
  return new Promise((ok, fail) => {
    const req = db.transaction("files").objectStore("files").get(id);
    req.onsuccess = () => ok(req.result || null);
    req.onerror = () => fail(req.error);
  });
}
async function fileDelete(id) {
  const db = await fileDB();
  return new Promise((ok, fail) => {
    const tx = db.transaction("files", "readwrite");
    tx.objectStore("files").delete(id);
    tx.oncomplete = () => ok();
    tx.onerror = () => fail(tx.error);
  });
}

// Preview popup: PDFs are shown inside the page, other files can be downloaded
async function showPreview(d) {
  const ext = (d.fn || "").split(".").pop().toLowerCase();
  const blob = d.hasFile ? await fileGet(d.id) : null;
  let body;
  if (blob && ext === "pdf") {
    previewUrl = URL.createObjectURL(blob);
    body = `<iframe class=pdfview src="${previewUrl}"></iframe>`;
  } else {
    const note = blob ? "No preview for ." + ext + " files. Download it to open." : d.ty.toUpperCase() + " preview · " + d.sz;
    body = `<div class=prev><span>${icon("file", 28)}<br>${note}</span></div>`;
  }
  const askFirst = R == "guest" && !approved(d.id, "download");
  modal(`<h3>${esc(d.t)} <span class="tag Internal">${rev2(d.rev)}</span></h3>${body}
    <div style="display:flex;gap:8px;justify-content:flex-end">
      <button class="btn g" onclick=closeM()>Close</button>
      <button class="btn g" onclick="showHistory(${d.id})">${icon("history", 14)} Version history</button>
      <button class=btn onclick="closeM();act(${d.id}, 'download')">${askFirst ? icon("lock", 14) + " Request download" : "Download"}</button>
    </div>`, !!(blob && ext === "pdf"));
}

// Print: PDFs print straight from the stored file
async function printFile(d) {
  const blob = await fileGet(d.id);
  if (!blob || !(d.fn || "").toLowerCase().endsWith(".pdf")) return toast("Printing works for PDF files. Download this file to print it.");
  const url = URL.createObjectURL(blob);
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.src = url;
  frame.onload = () => { frame.contentWindow.focus(); frame.contentWindow.print(); };
  document.body.append(frame);
  setTimeout(() => { frame.remove(); URL.revokeObjectURL(url); }, 60000);
  toast("Sending to printer…");
}

// ---------- Document control: revisions (ISO-style Ver. 00, 01, 02 ...) ----------
const rev2 = (n) => "Ver. " + String(n || 0).padStart(2, "0");

// Document code, e.g. PRC-ISO-003 / PRC-CI-005
function docCode(d) {
  const words = d.c.split(/\s+/);
  const abbr = words.length > 1 ? words.map((w) => w[0]).join("") : d.c.length <= 4 ? d.c : d.c.slice(0, 3);
  return "PRC-" + abbr.toUpperCase() + "-" + String(d.id).padStart(3, "0");
}

// Every document keeps its revisions, oldest first. The last one is the current revision.
function history(d) {
  if (!d.history) d.history = [{ rev: d.rev || 0, dt: d.dt, by: d.o, fn: d.fn || "", sz: d.sz, note: "Initial release", key: null }];
  return d.history;
}

// An existing document with the same title or the same file name?
function findSameName(title, fileName) {
  const clean = (t) => t.toLowerCase().replace(/\.[^.]+$/, "").replace(/[\s_-]+/g, " ").trim();
  const t = title.toLowerCase().replace(/[\s_-]+/g, " ").trim(), f = clean(fileName);
  return D.filter((x) => !x.del && (x.t.toLowerCase().replace(/[\s_-]+/g, " ").trim() === t || (x.fn && clean(x.fn) === f)))
    .sort((a, b) => b.dt.localeCompare(a.dt))[0];
}

function sameNameModal(d) {
  const next = rev2((d.rev || 0) + 1);
  modal(`<h3>This document already exists</h3>
    <p><b>${esc(d.t)}</b> is already filed in <b>${esc(d.c)}${d.s ? " › " + esc(d.s) : ""}</b> as ${rev2(d.rev)}.</p>
    <p>Upload your file as <b>${next}</b> of the same document? The earlier version stays in its version history.</p>
    <label>What changed in this version <span class=req>*</span></label>
    <input id=rvn placeholder="e.g. Updated section 4.2 per audit findings" oninput="setErr('rvn', '')">
    <div class=ferr id=rvn_e></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap;margin-top:14px">
      <button class="btn g" onclick=closeM()>Cancel</button>
      <button class="btn g" onclick="commitNew()">Keep as a separate document</button>
      <button class=btn onclick="commitRevision(${d.id})">Upload as ${next}</button>
    </div>`);
}

async function commitRevision(id) {
  const note = $("#rvn").value.trim();
  if (!note) return setErr("rvn", "Describe what changed in this version.");
  const d = doc(id);
  try {
    await applyRevision(d, pending.file, note);
  } catch (e) {
    return setErr("rvn", "Could not save this file in the browser. Try a smaller file.");
  }
  d.kw = [...new Set([...(d.kw || []), ...pending.kw])];
  pending = null;
  closeM();
  toast(d.t + " is now " + rev2(d.rev));
  render();
}

// Keeps the current file as the previous revision, then stores the new file as the current one
async function applyRevision(d, file, note) {
  const list = history(d), current = d.rev || 0;
  if (d.hasFile) {
    const old = await fileGet(d.id);
    if (old) {
      const key = d.id + "@" + current;
      await fileSave(key, old);
      list[list.length - 1].key = key;
    }
  }
  await fileSave(d.id, file);
  d.rev = current + 1;
  d.ty = FILE_TYPES[file.name.split(".").pop().toLowerCase()];
  d.sz = fmtSize(file.size);
  d.fn = file.name;
  d.hasFile = true;
  d.dt = new Date().toISOString().slice(0, 10);
  list.push({ rev: d.rev, dt: new Date().toISOString(), by: ACTOR[R], fn: file.name, sz: d.sz, note, key: null });
  addLog("updated to " + rev2(d.rev), d);
}

function showHistory(id) {
  const d = doc(id), list = history(d);
  modal(`<h3>${esc(d.t)}: version history</h3>
    <p class=note>Document code <b>${docCode(d)}</b> · current ${rev2(d.rev)}</p>
    <div class=tw><table><tr><th>VER.<th>DATE & TIME<th>UPDATED BY<th>FILE<th>WHAT CHANGED<th></tr>
    ${list.map((e, i) => i).reverse().map((i) => {
      const e = list[i], current = i == list.length - 1;
      return `<tr><td class=nw><b>${rev2(e.rev)}</b>${current ? ' <span class="tag Public">Current</span>' : ""}
        <td class=nw>${when(e.dt)}<td class=nw>${esc(user(e.by).n)}
        <td>${e.fn ? esc(e.fn) : "(sample document)"}<td class=reason>${esc(e.note)}
        <td class=nw><button class="btn g sm" title="Download this version" onclick="dlRev(${id}, ${i})">${icon("download", 14)}</button></tr>`;
    }).join("")}</table></div>
    <div style="text-align:right;margin-top:14px"><button class=btn onclick=closeM()>Close</button></div>`, true);
}

// Download one revision (inside its category folder). Guests still need approval.
async function dlRev(id, i) {
  if (R == "guest" && !approved(id, "download")) return reqModal(id, "download");
  const d = doc(id), list = history(d), e = list[i];
  const blob = e.key ? await fileGet(e.key) : i == list.length - 1 && d.hasFile ? await fileGet(d.id) : null;
  if (!blob) return toast("This version has no stored file (sample document).");
  if (!window.JSZip) return toast("ZIP library not loaded");
  const z = new JSZip(), dot = e.fn.lastIndexOf(".");
  z.folder([d.c, d.s].filter(Boolean).join("/")).file(e.fn.slice(0, dot) + " (" + rev2(e.rev) + ")" + e.fn.slice(dot), blob);
  const out = await z.generateAsync({ type: "blob" }), a = document.createElement("a");
  a.href = URL.createObjectURL(out);
  a.download = (d.t + "_" + rev2(e.rev)).replace(/[^\w.-]+/g, "_") + ".zip";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4e3);
  addLog("downloaded " + rev2(e.rev) + " of", d);
  toast("Downloading " + rev2(e.rev));
}

// ---------- Keyword search ----------
const STOP = new Set(["the", "and", "for", "with", "from", "this", "that"]);
const words = (t) => t.toLowerCase().match(/[a-z0-9]+/g) || [];
const parseKw = (t) => [...new Set(t.split(/[,;\n]/).map((x) => x.trim().toLowerCase()).filter(Boolean))];

// All keywords of a document: the ones typed in + the words of its title
function kwOf(d) {
  return [...new Set([...(d.kw || []), ...words(d.t).filter((w) => w.length > 2 && !STOP.has(w))])];
}

// Files that match every word typed, best matches first
function searchDocs(text) {
  const tokens = words(text);
  if (!tokens.length) return [];
  return D.filter((d) => !d.del).map((d) => {
    const kws = kwOf(d), where = (d.c + " " + d.s).toLowerCase();
    const hay = [d.t, d.c, d.s, d.fn || "", kws.join(" "), docCode(d)].join(" ").toLowerCase();
    if (!tokens.every((t) => hay.includes(t))) return null;
    let score = 0;
    tokens.forEach((t) => {
      if (kws.includes(t)) score += 5; else if (kws.some((k) => k.includes(t))) score += 3;
      if (d.t.toLowerCase().includes(t)) score += 4;
      if (where.includes(t)) score += 2;
    });
    return { d, score, hits: kws.filter((k) => tokens.some((t) => k.includes(t))) };
  }).filter(Boolean).sort((a, b) => b.score - a.score || b.d.dt.localeCompare(a.d.dt));
}

function setQ(text) {
  if (!text.trim()) {
    q = "";
    return leaveSearch();
  }
  if (P != "search") beforeSearch = { P, cat, sub };
  q = text;
  P = "search";
  render();
}

// Typing in the top search box shows the matching files.
// Clearing the box takes you back to the page you were on before.
let beforeSearch = null;

function leaveSearch() {
  const back = beforeSearch || { P: "overview", cat: "All", sub: "" };
  P = back.P;
  cat = back.cat;
  sub = back.sub;
  beforeSearch = null;
  render();
}

function onSearch(value) {
  q = value;
  clearTimeout(window.tm);
  window.tm = setTimeout(() => {
    if (q.trim()) {
      if (P != "search") beforeSearch = { P, cat, sub };
      P = "search";
      render();
    } else if (P == "search") {
      leaveSearch();
    } else {
      render();
    }
    const box = $(".s");
    box.focus();
    box.setSelectionRange(99, 99);
  }, 250);
}

function searchPage() {
  const kwChip = (k, hit) => `<button class="kw${hit ? " match" : ""}" data-k="${esc(k)}" onclick="setQ(this.dataset.k)">${esc(k)}</button>`;
  if (!q.trim()) {
    const count = {};
    D.filter((d) => !d.del).forEach((d) => kwOf(d).forEach((k) => (count[k] = (count[k] || 0) + 1)));
    const all = Object.entries(count).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 60);
    return `<h2>Keyword search</h2><div class=card>
      <p>Type a keyword in the search box above, or pick one below to see the files connected to it.</p>
      <div class=chips>${all.map(([k, n]) => `<button class=kw data-k="${esc(k)}" onclick="setQ(this.dataset.k)">${esc(k)} <small>${n}</small></button>`).join("")}</div></div>`;
  }
  const found = searchDocs(q);
  return `<h2>Keyword search</h2><div class=card>
    <p class=note style="font-size:13px">${found.length} file(s) found for <b>“${esc(q)}”</b></p>
    ${found.length ? found.map(({ d, hits }) => `<div class=hitrow>
      <div class=ic style="background:${T[d.ty][1]}">${T[d.ty][0][0]}</div>
      <div class=hitbody>
        <a href="#" class=doclink onclick="act(${d.id}, 'view'); return false">${esc(d.t)}</a>
        <span class="tag Internal rev" title="Version history" onclick="showHistory(${d.id})">${rev2(d.rev)}</span>
        <small>${T[d.ty][0]} · ${d.sz} · ${esc(d.c)}${d.s ? " › " + esc(d.s) : ""} · ${docCode(d)}</small>
        <div class=chips>${kwOf(d).slice(0, 10).map((k) => kwChip(k, hits.includes(k))).join("")}</div>
      </div></div>`).join("") : "<div class=empty>No files match this keyword. Try a shorter word, or pick a keyword from the list.</div>"}
    ${found.length ? "" : `<div style="text-align:center"><button class="btn g sm" onclick="setQ('')">Browse all keywords</button></div>`}
  </div>`;
}

// ---------- Sidebar, header and main render ----------
function nav() {
  const sa = R == "sa", ad = R != "guest", b = (p, i, l, c) => `<button class="${P == p && cat == "All" || P == p && p != "documents" ? "on" : ""}" onclick="go('${p}')">${i} ${l}${c != null ? `<b>${c}</b>` : ""}</button>`;
  return `<div class=brand><img class=seal src="${LOGO}" alt="PRC"><span id=bn>${esc(SETTINGS.name.toUpperCase())}</span></div><div class=nav>${b("overview", icon("grid"), "Overview")}${b("documents", icon("file"), "All Documents", D.filter((d) => !d.del).length)}<h6>CATEGORIES</h6><div class=cats>${Object.keys(CAT).map((c, i) => `<button class="${cat == c && P == "documents" && !sub ? "on" : ""}" onclick="tgl(${i})">${icon("folder")} ${esc(c)}${CAT[c].length ? `<b>${icon(op[c] ? "chevronDown" : "chevronRight", 12)}</b>` : ""}</button>${op[c] ? CAT[c].map((x, j) => `<button class="sub ${cat == c && sub == x && P == "documents" ? "on" : ""}" onclick="pick(${i},${j})">${icon("file", 13)} ${esc(x)}</button>`).join("") : ""}`).join("")}</div><h6>WORKSPACE</h6>${ad ? b("analytics", icon("chart"), "Analytics") : ""}${b("requests", icon("key"), "Requests", req.filter((r) => r.st == "Pending").length)}${ad ? b("trash", icon("trash"), "Recycle Bin", D.filter((d) => d.del).length) : ""}${sa ? b("activity", icon("clock"), "Recent Activity") + b("people", icon("users"), "People & Access") + b("settings", icon("sliders"), "Customize UI") : ""}</div>`;
}
function go(p, k) {
  P = p;
  sel.clear();
  beforeSearch = null;
  if (p != "search") q = "";   // leaving the search page clears the search
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
  $("#hd").innerHTML = `<button class="btn g burger" onclick="$('#sb').classList.toggle('open')">${icon("menu", 18)}</button><input class=s placeholder="Search by keyword or file name…" value="${q}" oninput="onSearch(this.value)"><span class="tag Internal">${RN[R]}</span>${R != "guest" ? `<button class=btn onclick="upl()">${icon("plus", 14)} New document</button>` : ""}<span class=own onclick=profile(${u.id})><span class=av>${ini(u.n)}</span>${u.n}</span><button class="btn g sm" onclick=logout()>Log out</button>`;
  $("#pg").innerHTML = pages[P]();
}

// ---------- Editing a document ----------
function editDoc(id) {
  const d = doc(id);
  const cats = Object.keys(CAT);
  modal(`<h3>Edit document</h3>
    <label>Title <span class=req>*</span></label>
    <input id=edt value="${esc(d.t)}" oninput="setErr('edt', '')">
    <div class=ferr id=edt_e></div>
    <label>Keywords (optional, separated by commas)</label>
    <input id=edk value="${esc((d.kw || []).join(", "))}">
    <label>Category</label>
    <select id=edc style="width:100%" onchange="editSubOpts()">${cats.map((c) => `<option ${c === d.c ? "selected" : ""}>${esc(c)}`).join("")}</select>
    <div id=edsw><label>Sub-category</label><select id=eds style="width:100%"></select></div>
    <label>Access level</label>
    <select id=eda style="width:100%">${["Public", "Internal", "Restricted"].map((a) => `<option ${a === d.ac ? "selected" : ""}>${a}`).join("")}</select>
    <label>Replace file (optional)</label>
    <input id=edf type=file accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx">
    <div class=ferr id=edf_e></div>
    <p class=note style="margin:4px 0 0">Current file: ${d.fn ? esc(d.fn) : "none (sample document)"} (${rev2(d.rev)}). Leave empty to keep it.</p>
    <label>What changed in this version <span class=note style="display:inline">(required when you replace the file)</span></label>
    <input id=edn placeholder="e.g. Updated section 4.2 per audit findings" oninput="setErr('edn', '')">
    <div class=ferr id=edn_e></div>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn g" onclick=closeM()>Cancel</button>
      <button class=btn id=edbtn onclick="saveDoc(${d.id})">Save changes</button>
    </div>`);
  editSubOpts(d.s);
}

function editSubOpts(keep) {
  const l = CAT[$("#edc").value] || [];
  $("#edsw").style.display = l.length ? "" : "none";
  $("#eds").innerHTML = l.map((x) => `<option ${x === keep ? "selected" : ""}>${esc(x)}`).join("");
}

async function saveDoc(id) {
  const d = doc(id);
  const title = $("#edt").value.trim();
  const file = $("#edf").files[0];
  const ext = file ? file.name.split(".").pop().toLowerCase() : "";

  setErr("edt", "");
  setErr("edf", "");
  if (!title) return setErr("edt", "Enter a title.");
  if (file && !FILE_TYPES[ext]) return setErr("edf", "Allowed files: PDF, Word, Excel or PowerPoint.");
  if (file && file.size > MAX_FILE) return setErr("edf", "This file is too large (25 MB maximum).");

  const note = $("#edn").value.trim();
  if (file && !note) return setErr("edn", "Describe what changed in this version.");
  if (file) {
    $("#edbtn").disabled = true;
    try {
      await applyRevision(d, file, note);   // keeps the old file as the previous revision
    } catch (e) {
      $("#edbtn").disabled = false;
      return setErr("edf", "Could not save this file in the browser. Try a smaller file.");
    }
  }
  d.kw = parseKw($("#edk").value);

  d.t = title;
  d.c = $("#edc").value;
  d.s = CAT[d.c].length ? $("#eds").value : "";
  d.ac = $("#eda").value;
  d.dt = new Date().toISOString().slice(0, 10);   // "date posted" shows the last update
  if (!file) addLog("updated", d);
  closeM();
  toast(file ? "Saved " + rev2(d.rev) + " of " + d.t : "Updated " + d.t);
  render();
}

// ---------- Posting a new document ----------
function upl() {
  if (!Object.keys(CAT).length) return toast("Add a category first (Customize UI)");
  modal(`<h3>New document</h3>
    <label>File <span class=req>*</span></label>
    <input id=nfile type=file accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onchange="pickFile()">
    <div class=ferr id=nfile_e></div>
    <p class=note style="margin:4px 0 0">PDF, Word, Excel or PowerPoint, up to 25 MB.</p>
    <label>Title <span class=req>*</span></label>
    <input id=nt oninput="setErr('nt', '')">
    <div class=ferr id=nt_e></div>
    <label>Keywords (optional)</label>
    <input id=nk placeholder="e.g. audit, quality, 2026">
    <p class=note style="margin:4px 0 0">Separate with commas. Words from the title are added automatically.</p>
    <label>Category</label>
    <select id=nc style="width:100%" onchange="subOpts()">${Object.keys(CAT).map((c) => `<option>${c}`).join("")}</select>
    <div id=nsw><label>Sub-category</label><select id=ns style="width:100%"></select></div>
    <label>Access level</label>
    <select id=na style="width:100%"><option>Public<option>Internal<option>Restricted</select>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px">
      <button class="btn g" onclick=closeM()>Cancel</button>
      <button class=btn id=upbtn onclick="addD()">Upload</button>
    </div>`);
  subOpts();
}

// Choosing a file fills in the title (you can still change it)
function pickFile() {
  const f = $("#nfile").files[0];
  setErr("nfile", "");
  // fill the title from the file name, unless you typed your own title
  const title = $("#nt");
  if (f && (!title.value.trim() || title.value === title.dataset.auto)) {
    title.value = f.name.replace(/\.[^.]+$/, "");
    title.dataset.auto = title.value;
  }
}
function subOpts() {
  const l = CAT[$("#nc").value];
  $("#nsw").style.display = l.length ? "" : "none";
  $("#ns").innerHTML = l.map((x) => `<option>${x}`).join("");
}
let pending = null;   // the upload waiting for "new version or separate document?"

async function addD() {
  const file = $("#nfile").files[0];
  const title = $("#nt").value.trim();
  const ext = file ? file.name.split(".").pop().toLowerCase() : "";

  setErr("nfile", "");
  setErr("nt", "");
  if (!file) return setErr("nfile", "Choose a file to upload.");
  if (!FILE_TYPES[ext]) return setErr("nfile", "Allowed files: PDF, Word, Excel or PowerPoint.");
  if (file.size > MAX_FILE) return setErr("nfile", "This file is too large (25 MB maximum).");
  if (!title) return setErr("nt", "Enter a title.");

  const c = $("#nc").value;
  pending = { file, ext, title, c, s: CAT[c].length ? $("#ns").value : "", ac: $("#na").value, kw: parseKw($("#nk").value) };

  const same = findSameName(title, file.name);
  if (same) return sameNameModal(same);   // ISO-style: ask about a new version
  await commitNew();
}

async function commitNew() {
  const p = pending;
  const d = {
    id: nid++, t: p.title, c: p.c, s: p.s, ty: FILE_TYPES[p.ext], sz: fmtSize(p.file.size), fn: p.file.name, hasFile: true,
    kw: p.kw, rev: 0, o: ACTOR[R], dt: new Date().toISOString().slice(0, 10), v: 0, dl: 0, ac: p.ac, del: 0
  };
  const btn = $("#upbtn");
  if (btn) btn.disabled = true;
  try {
    await fileSave(d.id, p.file);   // the file itself is kept in the browser (IndexedDB)
  } catch (e) {
    if (btn) btn.disabled = false;
    return toast("Could not save this file in the browser. Try a smaller file.");
  }
  history(d);   // creates "Rev. 00 - Initial release"
  D.unshift(d);
  addLog("posted", d);
  pending = null;
  closeM();
  toast("Document posted in " + d.c + (d.s ? " › " + d.s : ""));
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


const sharedId = new URLSearchParams(location.search).get("doc");
if (AUTH && sharedId && doc(+sharedId) && !doc(+sharedId).del) act(+sharedId, "view");