/* ═══════════════════════════════════════════════════════════════════
   AI DETECTOR — interface wiring, archive, reporting
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STORE_KEY = "state.ai-detector.v1";
  const SESSION_KEY = "pref.ai-detector.session";
  const AUTH_KEY = "auth.ai-detector.v1";
  const ROLE_KEY = "role.ai-detector.v1";
  const OWNER_SALT = "dos-ai-1953-owner";
  // The owner email is intentionally not in this file. Only this salted
  // PBKDF2 hash is stored; it is a privacy measure, not a server secret.
  const OWNER_HASH = "c5214ba27a937b34e6da01392a04c676382d0f8b279ec9d53eb72d646c55380f";
  const APPROVED_KEY = "access.ai-detector.approved.v1";
  const DEFAULT_APPROVED = ["thisentirethingsucksbro@gmail.com"];
  const OTP_TTL = 5 * 60 * 1000;
  const OTP_MAX_ATTEMPTS = 5;
  // EmailJS (https://www.emailjs.com). Fill these after creating a service,
  // template and public key. Leave empty to keep the gate in setup mode.
  const EMAILJS_PUBLIC_KEY = "";
  const EMAILJS_SERVICE_ID = "";
  const EMAILJS_TEMPLATE_ID = "";
  const RETENTION_DAYS = [0, 7, 30, 90];
  const MAX_DOSSIERS = 40;

  const SAMPLE_AI = `In today's fast-paced digital landscape, effective communication plays a crucial role in fostering meaningful connections. It's important to note that AI-generated text often carries a distinct set of stylistic markers — subtle signals that, when examined closely, reveal the underlying mechanisms at work. Moreover, researchers have increasingly leveraged large language models to streamline workflows, enhance productivity, and unlock new possibilities across a wide range of domains. This is not merely a technical shift; it is a testament to the transformative power of modern computing. However, it is worth noting that these tools are a double-edged sword. While they can elevate efficiency, they may also introduce a pervasive sameness into public discourse. Ultimately, navigating this ever-evolving landscape requires a nuanced, multifaceted approach — one that balances innovation with accountability.`;

  const SAMPLE_HUMAN = `ok so i finally tried that new ramen place on 5th and honestly?? underwhelming. broth was fine but they put WAY too much ginger in it, like i could taste nothing else for the rest of the day lol. also it was 24 bucks which is insane for noodles. my brother got the spicy one and said it was alright. anyway we ended up at the diner after because none of us were full, and the waitress remembered him from like two years ago which was kind of wild. gonna stick to the place near my apartment tbh, the one with the weird cat painting.`;

  const state = {
    dossiers: [],
    activeId: null,
    sort: "newest",
    query: "",
    context: "chat",
    analyst: "UNASSIGNED",
    parchment: false,
    sessionOnly: false,
    retentionDays: 30
  };

  let current = null;
  let scanTimer = null;
  let toastTimer = null;
  let approvedEmails = [];
  let otpStage = "email";
  let pendingEmail = "";
  let pendingCode = "";
  let otpExpires = 0;
  let otpAttempts = 0;

  /* ── storage ─────────────────────────────────────────────────── */

  function sessionRequested() {
    try { return sessionStorage.getItem(SESSION_KEY) === "1"; } catch (e) { return false; }
  }

  function normalizeEmail(value) {
    return String(value || "").trim().toLowerCase();
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  function emailConfigured() {
    return !!(EMAILJS_PUBLIC_KEY && EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && window.emailjs);
  }

  function isBuiltIn(email) {
    return DEFAULT_APPROVED.includes(email);
  }

  function loadApproved() {
    let stored = [];
    try {
      const raw = JSON.parse(localStorage.getItem(APPROVED_KEY) || "[]");
      if (Array.isArray(raw)) stored = raw;
    } catch (e) { /* corrupt or blocked: use the built-in list */ }
    return [...new Set([...DEFAULT_APPROVED, ...stored].map(normalizeEmail).filter(validEmail))];
  }

  function saveApproved() {
    try { localStorage.setItem(APPROVED_KEY, JSON.stringify(approvedEmails)); } catch (e) { /* quota/blocked */ }
  }

  async function ownerHash(email) {
    if (!window.crypto || !window.crypto.subtle) throw new Error("Web Crypto unavailable");
    const bytes = new TextEncoder().encode(email);
    const key = await crypto.subtle.importKey("raw", bytes, "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({
      name: "PBKDF2",
      salt: new TextEncoder().encode(OWNER_SALT),
      iterations: 120000,
      hash: "SHA-256"
    }, key, 256);
    return [...new Uint8Array(bits)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function isOwnerEmail(email) {
    if (!email) return false;
    try { return (await ownerHash(email)) === OWNER_HASH; } catch (e) { return false; }
  }

  function isOwnerSession() {
    try { return sessionStorage.getItem(ROLE_KEY) === "owner"; } catch (e) { return false; }
  }

  function signedInEmail() {
    try {
      const value = sessionStorage.getItem(AUTH_KEY);
      return value && value.includes("@") ? normalizeEmail(value) : null;
    } catch (e) { return null; }
  }

  function authError(message) {
    $("authError").textContent = message;
    const box = $("authForm");
    box.classList.remove("shake");
    void box.offsetWidth;
    box.classList.add("shake");
  }

  function setAuthLocked(locked) {
    const overlay = $("authOverlay");
    if (!overlay) return;
    overlay.hidden = !locked;
    document.body.classList.toggle("auth-locked", locked);
    document.querySelectorAll(".topbar, main, .page-foot").forEach((el) => {
      if (locked) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    });
    if (!locked) return;
    $("authError").textContent = "";
    requestAnimationFrame(() => $("authEmail").focus());
  }

  function updateAccessUi() {
    const owner = isOwnerSession();
    const btn = $("accessBtn");
    if (btn) btn.hidden = !owner;
    if (!owner && !$("accessOverlay").hidden) setAccessOpen(false);
  }

  function setAccessOpen(open) {
    const overlay = $("accessOverlay");
    if (!overlay) return;
    overlay.hidden = !open;
    document.body.classList.toggle("access-open", open);
    document.querySelectorAll(".topbar, main, .page-foot").forEach((el) => {
      if (open) el.setAttribute("inert", "");
      else el.removeAttribute("inert");
    });
    if (!open) return;
    renderApproved();
    $("approveEmail").value = "";
    $("approveError").textContent = "";
    requestAnimationFrame(() => $("approveEmail").focus());
  }

  function renderApproved() {
    $("approvedList").innerHTML = approvedEmails.length
      ? approvedEmails.map((email, index) => {
          const builtIn = isBuiltIn(email);
          return '<li class="access-item"><span>' + AIDetector.escapeHtml(email) +
            (builtIn ? ' <em class="access-tag">BUILT-IN</em>' : '') + '</span>' +
            (builtIn ? '' : '<button type="button" data-remove="' + index + '" aria-label="Remove ' + AIDetector.escapeHtml(email) + '">✕</button>') +
            '</li>';
        }).join("")
      : '<li class="access-empty">No approved emails yet.</li>';
  }

  async function addApproved(e) {
    e.preventDefault();
    const email = normalizeEmail($("approveEmail").value);
    let error = "";
    if (!validEmail(email)) error = "ENTER A VALID EMAIL ADDRESS";
    else if (isBuiltIn(email)) error = "BUILT-IN EMAIL ALREADY APPROVED";
    else if (approvedEmails.includes(email)) error = "EMAIL ALREADY APPROVED";
    else if (await isOwnerEmail(email)) error = "OWNER ALREADY HAS ACCESS";
    $("approveError").textContent = error;
    if (error) return;
    approvedEmails.push(email);
    approvedEmails.sort();
    saveApproved();
    renderApproved();
    $("approveEmail").value = "";
    toast("Email approved");
  }

  function removeApproved(index) {
    if (!Number.isInteger(index) || index < 0 || index >= approvedEmails.length) return;
    const email = approvedEmails[index];
    if (isBuiltIn(email)) { toast("Built-in email cannot be removed"); return; }
    approvedEmails.splice(index, 1);
    saveApproved();
    renderApproved();
    toast("Email removed");
  }

  function resetOtp() {
    otpStage = "email";
    pendingEmail = "";
    pendingCode = "";
    otpExpires = 0;
    otpAttempts = 0;
    $("emailStep").hidden = false;
    $("codeStep").hidden = true;
    $("codeActions").hidden = true;
    $("authSubmit").disabled = false;
    $("authSubmit").textContent = "SEND CODE";
    $("authCode").value = "";
    $("otpEmail").textContent = "";
    $("authError").textContent = "";
  }

  function maskEmail(email) {
    const at = email.lastIndexOf("@");
    return at < 1 ? email : email[0] + "***" + email.slice(at);
  }

  function makeCode() {
    const buffer = new Uint32Array(1);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(buffer);
    else buffer[0] = Math.floor(Math.random() * 0xffffffff);
    return String(buffer[0] % 1000000).padStart(6, "0");
  }

  async function requestCode() {
    const email = normalizeEmail($("authEmail").value);
    if (!validEmail(email)) { authError("ENTER A VALID EMAIL ADDRESS"); return; }
    const owner = await isOwnerEmail(email);
    if (!owner && !approvedEmails.includes(email)) {
      authError("EMAIL NOT ON THE APPROVED LIST");
      return;
    }
    if (!emailConfigured()) {
      authError("EMAILJS NOT CONFIGURED - SEE README");
      return;
    }
    const nextCode = makeCode();
    const nextExpires = Date.now() + OTP_TTL;
    pendingEmail = email;
    $("authEmail").value = "";
    $("authSubmit").disabled = true;
    $("authSubmit").textContent = "SENDING...";
    try {
      await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        { to_email: email, otp_code: nextCode, expires_minutes: 5 },
        EMAILJS_PUBLIC_KEY
      );
    } catch (e) {
      resetOtp();
      $("authSubmit").disabled = false;
      authError("EMAIL SEND FAILED - CHECK EMAILJS CONFIG");
      return;
    }
    pendingCode = nextCode;
    otpExpires = nextExpires;
    otpAttempts = 0;
    otpStage = "code";
    $("authSubmit").disabled = false;
    $("emailStep").hidden = true;
    $("codeStep").hidden = false;
    $("codeActions").hidden = false;
    $("authSubmit").textContent = "VERIFY CODE";
    $("otpEmail").textContent = maskEmail(email);
    $("otpMeta").textContent = "EXPIRES IN 5 MIN · " + OTP_MAX_ATTEMPTS + " ATTEMPTS";
    $("authError").textContent = "";
    $("authCode").value = "";
    $("authCode").focus();
  }

  async function resendCode() {
    if (!pendingEmail) { resetOtp(); return; }
    if (!emailConfigured()) { authError("EMAILJS NOT CONFIGURED - SEE README"); return; }
    const email = pendingEmail;
    const nextCode = makeCode();
    const nextExpires = Date.now() + OTP_TTL;
    $("authSubmit").disabled = true;
    $("authSubmit").textContent = "SENDING...";
    try {
      await window.emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        { to_email: email, otp_code: nextCode, expires_minutes: 5 },
        EMAILJS_PUBLIC_KEY
      );
    } catch (e) {
      $("authSubmit").disabled = false;
      $("authSubmit").textContent = "VERIFY CODE";
      authError("EMAIL SEND FAILED - OLD CODE STILL VALID");
      return;
    }
    pendingCode = nextCode;
    otpExpires = nextExpires;
    otpAttempts = 0;
    $("authSubmit").disabled = false;
    $("authSubmit").textContent = "VERIFY CODE";
    $("otpMeta").textContent = "EXPIRES IN 5 MIN · " + OTP_MAX_ATTEMPTS + " ATTEMPTS";
    $("authCode").value = "";
    $("authError").textContent = "";
    $("authCode").focus();
  }

  async function verifyCode() {
    if (Date.now() > otpExpires) { authError("CODE EXPIRED · RESEND"); return; }
    if (otpAttempts >= OTP_MAX_ATTEMPTS) { authError("TOO MANY ATTEMPTS · RESEND"); return; }
    const code = $("authCode").value.replace(/\D/g, "");
    if (code.length !== 6) { authError("ENTER THE 6-DIGIT CODE"); return; }
    if (code !== pendingCode) {
      otpAttempts += 1;
      authError("CODE REJECTED · " + (OTP_MAX_ATTEMPTS - otpAttempts) + " ATTEMPTS LEFT");
      $("authCode").value = "";
      $("authCode").focus();
      return;
    }
    const email = pendingEmail;
    resetOtp();
    await signInWithEmail(email);
  }

  function changeEmail() {
    const previous = pendingEmail;
    resetOtp();
    $("authEmail").value = previous;
    $("authEmail").focus();
  }

  async function signInWithEmail(raw) {
    const email = normalizeEmail(raw);
    if (!validEmail(email)) { authError("ENTER A VALID EMAIL ADDRESS"); return false; }
    const owner = await isOwnerEmail(email);
    if (!owner && !approvedEmails.includes(email)) {
      authError("EMAIL NOT ON THE APPROVED LIST");
      return false;
    }
    try {
      sessionStorage.setItem(AUTH_KEY, email);
      sessionStorage.setItem(ROLE_KEY, owner ? "owner" : "user");
    } catch (e) { /* storage blocked */ }
    if (state.analyst === "UNASSIGNED") {
      state.analyst = owner ? "OWNER" : email.split("@")[0].slice(0, 16).toUpperCase();
      $("analyst").value = state.analyst;
      save();
    }
    $("authEmail").value = "";
    $("authForm").classList.remove("shake");
    setAuthLocked(false);
    updateAccessUi();
    toast(owner ? "Owner access granted" : "Email verified");
    $("subjectText").focus();
    return true;
  }

  async function authenticate(e) {
    e.preventDefault();
    if (otpStage === "email") await requestCode();
    else await verifyCode();
  }

  function signOut() {
    try {
      sessionStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(ROLE_KEY);
    } catch (e) { /* storage blocked */ }
    setAccessOpen(false);
    $("lockOverlay").hidden = true;
    $("authEmail").value = "";
    resetOtp();
    setAuthLocked(true);
    updateAccessUi();
  }

  function load() {
    // A session-only tab keeps nothing on disk, even if a previous run wrote it.
    if (sessionRequested()) {
      state.sessionOnly = true;
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* storage blocked */ }
      return;
    }
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.dossiers)) {
        state.dossiers = data.dossiers.filter((d) => d && typeof d.text === "string");
      }
      state.activeId = data.activeId || null;
      state.sort = data.sort || "newest";
      state.context = data.context || "chat";
      state.analyst = data.analyst || "UNASSIGNED";
      state.parchment = !!data.parchment;
      const days = Number(data.retentionDays);
      state.retentionDays = RETENTION_DAYS.includes(days) ? days : 30;
    } catch (e) { /* corrupt store: start clean */ }
  }

  function save() {
    if (state.sessionOnly) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({
        dossiers: state.dossiers.slice(0, MAX_DOSSIERS).map((d) => ({
          id: d.id,
          title: d.title,
          text: d.text.slice(0, 24000),
          baseline: (d.baseline || "").slice(0, 24000),
          context: d.context,
          createdAt: d.createdAt,
          score: d.score,
          band: d.band,
          words: d.words
        })),
        activeId: state.activeId,
        sort: state.sort,
        context: state.context,
        analyst: state.analyst,
        parchment: state.parchment,
        retentionDays: state.retentionDays
      }));
    } catch (e) { /* quota — keep working in memory */ }
  }

  function purgeExpired(announce) {
    if (!state.retentionDays) return 0;
    const cutoff = Date.now() - state.retentionDays * 86400000;
    const before = state.dossiers.length;
    state.dossiers = state.dossiers.filter((d) => Number.isFinite(d.createdAt) && d.createdAt >= cutoff);
    const removed = before - state.dossiers.length;
    if (!removed) return 0;
    if (state.activeId && !state.dossiers.some((d) => d.id === state.activeId)) {
      state.activeId = null;
      current = null;
      $("subjectText").value = "";
      $("baselineText").value = "";
      updateCounts();
      resetFindings();
    }
    if (announce) toast(removed + " expired dossier" + (removed === 1 ? "" : "s") + " erased");
    return removed;
  }

  function updatePrivacyUi() {
    const btn = $("sessionBtn");
    if (!btn) return;
    btn.setAttribute("aria-pressed", String(state.sessionOnly));
    document.body.classList.toggle("session", state.sessionOnly);
    $("privacyMode").textContent = state.sessionOnly ? "SESSION ONLY" : "PERSISTENT";
    const sel = $("retentionSel");
    sel.value = String(state.retentionDays);
    sel.disabled = state.sessionOnly;
    const retention = state.retentionDays ? "auto-erase after " + state.retentionDays + " days" : "kept until cleared";
    $("privacyStatus").textContent = state.sessionOnly
      ? "Session only · dossiers not saved · reload clears the archive."
      : "Self-hosted fonts · email OTP via EmailJS · dossiers stay here, " + retention + ".";
  }

  function toggleSession() {
    if (!state.sessionOnly) {
      const msg = state.dossiers.length
        ? "Enable session-only? The " + state.dossiers.length + " stored dossiers will be erased from this browser; this tab keeps them until reload."
        : "Enable session-only? Nothing will be written to this browser.";
      if (!window.confirm(msg)) return;
      try {
        localStorage.removeItem(STORE_KEY);
        sessionStorage.setItem(SESSION_KEY, "1");
      } catch (e) { /* storage blocked */ }
      state.sessionOnly = true;
      toast("Session only: dossiers stay in memory");
    } else {
      try { sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* storage blocked */ }
      state.sessionOnly = false;
      save();
      toast("Persistent mode: dossiers stored in this browser");
    }
    updatePrivacyUi();
    renderList();
  }

  /* ── tiny ui helpers ─────────────────────────────────────────── */

  function toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("show"), 2400);
  }

  function clockLabel(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function stampLabel(ts) {
    return new Date(ts).toLocaleString("en-GB", {
      day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
    }).toUpperCase();
  }

  function chipClass(score) {
    if (score >= 60) return "hot";
    if (score >= 30) return "mid";
    return "";
  }

  /* ── archive list ────────────────────────────────────────────── */

  function visibleDossiers() {
    const q = state.query.trim().toLowerCase();
    let list = state.dossiers.slice();
    if (q) {
      list = list.filter((d) =>
        d.title.toLowerCase().includes(q) || d.text.toLowerCase().includes(q)
      );
    }
    if (state.sort === "highest") list.sort((a, b) => b.score - a.score || b.createdAt - a.createdAt);
    else if (state.sort === "lowest") list.sort((a, b) => a.score - b.score || b.createdAt - a.createdAt);
    else list.sort((a, b) => b.createdAt - a.createdAt);
    return list;
  }

  function renderList() {
    const box = $("caseList");
    const list = visibleDossiers();

    box.innerHTML = list.map((d) => {
      const active = d.id === state.activeId ? " active" : "";
      const meta = `${stampLabel(d.createdAt)} · ${d.words} words · ${d.band || "—"}`;
      return (
        '<div class="case' + active + '" role="listitem" tabindex="0" data-id="' + d.id + '">' +
          '<div class="case-body">' +
            '<div class="case-title">' + AIDetector.escapeHtml(d.title) + "</div>" +
            '<div class="case-meta">' + AIDetector.escapeHtml(meta) + "</div>" +
          "</div>" +
          '<span class="case-chip ' + chipClass(d.score) + '">' + d.score + "</span>" +
          '<button class="case-del" type="button" data-del="' + d.id + '" aria-label="Delete dossier">✕</button>' +
        "</div>"
      );
    }).join("");

    $("liveCount").textContent = "Bureau of Linguistic Assessment · " +
      state.dossiers.length + (state.dossiers.length === 1 ? " dossier" : " dossiers");
    $("liveTime").textContent = clockLabel(new Date());

    const name = state.dossiers.find((d) => d.id === state.activeId);
    $("currentName").textContent = name ? name.title : "None selected";
  }

  /* ── findings ────────────────────────────────────────────────── */

  function resetFindings() {
    $("findingsLead").textContent = "Pick a dossier to begin.";
    $("gaugeMarker").style.left = "0%";
    $("scoreNum").textContent = "--";
    $("confidenceLine").textContent = "AWAITING SAMPLE";
    $("stamp").dataset.state = "empty";
    $("stampMain").textContent = "NO DOSSIER";
    $("stampSub").textContent = "PICK ONE TO BEGIN";
    $("anomCount").textContent = "";
    $("signalCount").textContent = "";
    $("highlight").innerHTML = '<p class="empty-note">Pick a dossier above to load the sample.</p>';
    $("followupList").innerHTML = '<li class="empty-note">No script yet. Screen a sample first.</li>';
    $("reportSub").textContent = "Screen a sample to generate the briefing.";
    renderSignals(null);
  }

  function confidenceText(a) {
    if (!a.english) return "NON-ENGLISH SAMPLE · UNRELIABLE";
    if (a.insufficient) return "LOW CONFIDENCE · SHORT SAMPLE";
    if (a.words < 60) return "LOW CONFIDENCE · " + a.words + " WORDS";
    if (a.words < 150) return "MODERATE CONFIDENCE";
    return "HIGH CONFIDENCE";
  }

  function renderFindings(a) {
    if (!a) { resetFindings(); return; }
    const lead = $("findingsLead");
    lead.innerHTML = a.insufficient
      ? "Not enough text for a verdict — only " + a.words + " words screened."
      : '<span class="accent">' + a.verdict.sub + "</span> — " + a.score +
        "/100 machine trace over " + a.words + " words, " + a.signals.length + " signals read.";

    $("gaugeMarker").style.left = Math.max(0, Math.min(100, a.score)) + "%";
    $("scoreNum").textContent = a.score;
    $("confidenceLine").textContent = confidenceText(a);

    const stamp = $("stamp");
    stamp.dataset.state = a.verdict.state;
    $("stampMain").textContent = a.verdict.main;
    $("stampSub").textContent = a.verdict.sub;
    stamp.classList.remove("pop");
    void stamp.offsetWidth;
    stamp.classList.add("pop");

    renderSignals(a);
    $("highlight").innerHTML = a.highlightHtml;
    const marked = a.anomalies.length;
    $("anomCount").textContent = marked ? "// " + marked + " MARKED" : "// CLEAN";

    $("followupList").innerHTML = a.followUps
      .map((f) => "<li>" + escapeFollowUp(f) + "</li>").join("");

    $("reportSub").textContent = "Briefing generated · copy as Discord markdown.";
  }

  function escapeFollowUp(text) {
    return AIDetector.escapeHtml(text).replace(/“([^”]+)”/g, "<q>$1</q>");
  }

  function renderSignals(a) {
    const box = $("signalList");
    if (!a) {
      box.innerHTML = '<p class="empty-note">No sample screened. The signals are waiting.</p>';
      $("signalCount").textContent = "";
      return;
    }
    $("signalCount").textContent = "// " + a.signals.length + " SIGNALS";
    const head =
      '<div class="signal-head"><span></span><span>SIGNAL</span><span>WEIGHTED RISK</span><span>RISK</span></div>';
    const rows = a.signals.map((s) =>
      '<div class="signal" data-signal="' + s.id + '">' +
        '<button class="sig-q" type="button" aria-expanded="false" aria-label="Explain ' + s.label + '">?</button>' +
        '<span class="sig-name">' + s.label + "</span>" +
        '<span class="sig-bar"><i class="' + (s.value >= 67 ? "hot" : s.value >= 34 ? "mid" : "low") + '" data-w="' + s.value + '"></i></span>' +
        '<span class="sig-val">' + s.value + "</span>" +
        '<p class="signal-note">' + s.note + "</p>" +
      "</div>"
    ).join("");
    box.innerHTML = head + rows;
    const fills = box.querySelectorAll(".sig-bar i");
    fills.forEach((el) => { el.style.width = "0%"; });
    void box.offsetWidth; // force a reflow so the fill transition runs
    fills.forEach((el) => { el.style.width = el.dataset.w + "%"; });
  }

  /* ── report ──────────────────────────────────────────────────── */

  function buildReport(a, dossier) {
    if (!a || !dossier) return "";
    const m = a.metrics;
    const bar = "─".repeat(46);
    const signalLines = a.signals
      .map((s) => "▸ " + s.label.padEnd(22, " ") + " " + String(s.value).padStart(3, " ") + " /100")
      .join("\n");

    const flagged = [];
    if (m.aiHits.length) flagged.push("AI lexicon: " + topList(m.aiHits, 4));
    if (m.softHits.length) flagged.push("Soft register words: " + topList(m.softHits, 4));
    if (m.stockHits.length) flagged.push("Stock phrases: " + topList(m.stockHits, 4));
    const typo = m.emDash + m.enDash + m.curly + m.ellipsis;
    if (typo) flagged.push("Typographic residue: " + [
      m.emDash ? m.emDash + " em dash" : "",
      m.enDash ? m.enDash + " en dash" : "",
      m.curly ? m.curly + " curly quote" : "",
      m.ellipsis ? m.ellipsis + " ellipsis" : ""
    ].filter(Boolean).join(", "));

    const script = a.followUps.map((f, i) => (i + 1) + ". " + f).join("\n");

    return [
      "**AI DETECTOR · PROVENANCE REVIEW**",
      "Dossier: " + dossier.title,
      "Screened: " + stampLabel(Date.now()) + " · " + a.words + " words · context: " + dossier.context,
      "Analyst: " + state.analyst,
      bar,
      "VERDICT: " + a.verdict.main + " — " + a.score + "/100",
      "BAND: " + a.verdict.sub + " (confidence: " + confidenceText(a).toLowerCase() + ")",
      bar,
      "SIGNALS",
      signalLines,
      "",
      "FLAGGED",
      flagged.length ? flagged.map((f) => "• " + f).join("\n") : "• nothing flagged",
      "",
      "FOLLOW-UP SCRIPT",
      script,
      "",
      "_Heuristic stylometry. Indicative only — not proof. False positives occur._"
    ].join("\n");
  }

  function topList(hits, n) {
    const counts = new Map();
    hits.forEach((h) => counts.set(h.phrase, (counts.get(h.phrase) || 0) + 1));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([p, c]) => (c > 1 ? p + " ×" + c : p))
      .join(", ");
  }

  async function copyReport() {
    const dossier = state.dossiers.find((d) => d.id === state.activeId);
    if (!current || !dossier) { toast("Nothing to copy — screen a sample first"); return; }
    const text = buildReport(current, dossier);
    try {
      await navigator.clipboard.writeText(text);
      toast("Report copied to clipboard");
    } catch (e) {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); toast("Report copied to clipboard"); }
      catch (err) { toast("Copy blocked by the browser"); }
      document.body.removeChild(ta);
    }
  }

  /* ── actions ─────────────────────────────────────────────────── */

  function screen() {
    const text = $("subjectText").value.trim();
    if (text.length < 12) {
      toast("Paste a longer sample first");
      $("subjectText").focus();
      return;
    }

    const baseline = $("baselineText").value;
    const context = $("contextSel").value;
    state.context = context;

    const panel = document.querySelector(".findings");
    panel.classList.add("scanning");
    $("analyzeBtn").disabled = true;
    $("analyzeBtn").textContent = "SCREENING…";

    clearTimeout(scanTimer);
    scanTimer = setTimeout(() => {
      const analysis = AIDetector.analyze(text, { context, baseline });

      let dossier = state.dossiers.find((d) => d.text === text && (d.baseline || "") === baseline);
      if (!dossier) {
        dossier = {
          id: "d" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
          title: AIDetector.titleFor(text),
          text,
          baseline,
          context,
          createdAt: Date.now(),
          score: analysis.score,
          band: analysis.verdict.sub,
          words: analysis.words
        };
        state.dossiers.unshift(dossier);
        if (state.dossiers.length > MAX_DOSSIERS) state.dossiers.length = MAX_DOSSIERS;
      } else {
        dossier.score = analysis.score;
        dossier.band = analysis.verdict.sub;
        dossier.words = analysis.words;
        dossier.context = context;
        dossier.createdAt = Date.now();
      }

      state.activeId = dossier.id;
      current = analysis;
      save();
      renderList();
      renderFindings(analysis);
      panel.classList.remove("scanning");
      $("analyzeBtn").disabled = false;
      $("analyzeBtn").textContent = "RUN SCREENING";
    }, 420);
  }

  function loadDossier(id, announce) {
    const dossier = state.dossiers.find((d) => d.id === id);
    if (!dossier) return;
    state.activeId = id;
    $("subjectText").value = dossier.text;
    $("baselineText").value = dossier.baseline || "";
    $("contextSel").value = dossier.context || "chat";
    state.context = dossier.context || "chat";
    current = AIDetector.analyze(dossier.text, {
      context: state.context,
      baseline: dossier.baseline || ""
    });
    dossier.score = current.score;
    dossier.band = current.verdict.sub;
    dossier.words = current.words;
    save();
    renderList();
    renderFindings(current);
    updateCounts();
    if (announce) toast("Dossier loaded");
    document.querySelector(".findings").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function newDossier() {
    state.activeId = null;
    current = null;
    $("subjectText").value = "";
    $("baselineText").value = "";
    updateCounts();
    renderList();
    resetFindings();
    save();
    $("subjectText").focus();
    toast("Clean dossier opened");
  }

  function clearCase() {
    state.activeId = null;
    current = null;
    $("subjectText").value = "";
    $("baselineText").value = "";
    updateCounts();
    renderList();
    resetFindings();
    save();
    toast("Case cleared");
  }

  function archive() {
    if (!state.dossiers.length) { toast("Archive already empty"); return; }
    if (!window.confirm("Clear all " + state.dossiers.length + " dossiers? This cannot be undone.")) return;
    state.dossiers = [];
    state.activeId = null;
    current = null;
    $("subjectText").value = "";
    $("baselineText").value = "";
    updateCounts();
    renderList();
    resetFindings();
    save();
    toast("Archive cleared");
  }

  function updateCounts() {
    const text = $("subjectText").value;
    const bText = $("baselineText").value;
    $("charCount").textContent = text.length;
    $("wordCount").textContent = (text.match(/[\p{L}\p{N}]+/gu) || []).length;
    const bWords = (bText.match(/[\p{L}\p{N}]+/gu) || []).length;
    $("baselineCount").textContent = bWords;
    $("baselineState").textContent = bWords >= 25 ? "BASELINE READY" : (bWords ? "TOO SHORT" : "NO BASELINE");
  }

  function applyTheme() {
    document.body.classList.toggle("parchment", state.parchment);
    $("parchmentBtn").setAttribute("aria-pressed", String(state.parchment));
    $("parchmentBtn").lastChild.textContent = state.parchment ? " FIELD MODE" : " PARCHMENT MODE";
    document.querySelector('meta[name="color-scheme"]').setAttribute("content", state.parchment ? "light" : "dark");
  }

  /* ── bindings ────────────────────────────────────────────────── */

  function bind() {
    $("analyzeBtn").addEventListener("click", screen);
    $("copyBtn").addEventListener("click", copyReport);
    $("newBtn").addEventListener("click", newDossier);
    $("clearBtn").addEventListener("click", clearCase);
    $("archiveBtn").addEventListener("click", archive);
    $("sampleBtn") && $("sampleBtn").addEventListener("click", () => {
      $("subjectText").value = SAMPLE_AI;
      $("baselineText").value = SAMPLE_HUMAN;
      $("contextSel").value = "chat";
      updateCounts();
      screen();
    });

    ["subjectText", "baselineText"].forEach((id) => {
      $(id).addEventListener("input", updateCounts);
      $(id).addEventListener("keydown", (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); screen(); }
      });
    });

    $("searchInput").addEventListener("input", (e) => {
      state.query = e.target.value;
      renderList();
    });

    $("sortSelect").addEventListener("change", (e) => {
      state.sort = e.target.value;
      save();
      renderList();
    });

    $("contextSel").addEventListener("change", (e) => {
      state.context = e.target.value;
      save();
      if (current && $("subjectText").value.trim()) screen();
    });

    $("caseList").addEventListener("click", (e) => {
      const del = e.target.closest("[data-del]");
      if (del) {
        e.stopPropagation();
        const id = del.dataset.del;
        state.dossiers = state.dossiers.filter((d) => d.id !== id);
        if (state.activeId === id) {
          state.activeId = null;
          current = null;
          $("subjectText").value = "";
          $("baselineText").value = "";
          updateCounts();
          resetFindings();
        }
        save();
        renderList();
        toast("Dossier removed");
        return;
      }
      const row = e.target.closest(".case");
      if (row) loadDossier(row.dataset.id, true);
    });

    $("caseList").addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const row = e.target.closest(".case");
      if (!row) return;
      e.preventDefault();
      loadDossier(row.dataset.id, true);
    });

    $("signalList").addEventListener("click", (e) => {
      const btn = e.target.closest(".sig-q");
      if (!btn) return;
      const sig = btn.closest(".signal");
      const open = sig.classList.toggle("open");
      btn.setAttribute("aria-expanded", String(open));
    });

    $("analyst").addEventListener("input", (e) => {
      state.analyst = e.target.value.trim().toUpperCase() || "UNASSIGNED";
      save();
    });
    $("analyst").addEventListener("blur", (e) => {
      e.target.value = state.analyst;
    });

    $("parchmentBtn").addEventListener("click", () => {
      state.parchment = !state.parchment;
      applyTheme();
      save();
    });

    $("sessionBtn").addEventListener("click", toggleSession);
    $("retentionSel").addEventListener("change", (e) => {
      const days = Number(e.target.value);
      state.retentionDays = RETENTION_DAYS.includes(days) ? days : 30;
      const removed = purgeExpired(false);
      save();
      renderList();
      updatePrivacyUi();
      toast(removed ? removed + " expired dossier" + (removed === 1 ? "" : "s") + " erased" : "Auto-erase updated");
    });
    window.addEventListener("pagehide", () => {
      if (!state.sessionOnly) return;
      try { localStorage.removeItem(STORE_KEY); } catch (e) { /* storage blocked */ }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState !== "visible" || state.sessionOnly) return;
      const removed = purgeExpired(false);
      if (!removed) return;
      save();
      renderList();
      updatePrivacyUi();
      toast(removed + " expired dossier" + (removed === 1 ? "" : "s") + " erased");
    });

    $("authForm").addEventListener("submit", authenticate);
    $("resendBtn").addEventListener("click", resendCode);
    $("changeEmailBtn").addEventListener("click", changeEmail);
    $("signOutBtn").addEventListener("click", signOut);

    $("accessBtn").addEventListener("click", () => setAccessOpen(true));
    $("accessClose").addEventListener("click", () => setAccessOpen(false));
    $("accessOverlay").addEventListener("click", (e) => {
      if (e.target === $("accessOverlay")) setAccessOpen(false);
    });
    $("approveForm").addEventListener("submit", addApproved);
    $("approvedList").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-remove]");
      if (btn) removeApproved(Number(btn.dataset.remove));
    });

    $("lockBtn").addEventListener("click", () => {
      $("lockOverlay").hidden = false;
      $("unlockBtn").focus();
    });
    $("unlockBtn").addEventListener("click", () => {
      $("lockOverlay").hidden = true;
    });
    document.addEventListener("keydown", (e) => {
      if (!$("accessOverlay").hidden && e.key === "Escape") {
        setAccessOpen(false);
        e.preventDefault();
        return;
      }
      if (!$("lockOverlay").hidden && (e.key === "Escape" || e.key === "Enter")) {
        $("lockOverlay").hidden = true;
        e.preventDefault();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        $("searchInput").focus();
      }
    });
  }

  /* ── boot ────────────────────────────────────────────────────── */

  async function init() {
    approvedEmails = loadApproved();
    const stored = signedInEmail();
    if (stored) {
      let owner = isOwnerSession();
      if (!owner && !approvedEmails.includes(stored)) owner = await isOwnerEmail(stored);
      if (!owner && !approvedEmails.includes(stored)) {
        try {
          sessionStorage.removeItem(AUTH_KEY);
          sessionStorage.removeItem(ROLE_KEY);
        } catch (e) { /* storage blocked */ }
      } else {
        try { sessionStorage.setItem(ROLE_KEY, owner ? "owner" : "user"); } catch (e) { /* storage blocked */ }
      }
    }
    load();
    const expired = purgeExpired(false);
    if (expired && !state.sessionOnly) save();
    $("analyst").value = state.analyst;
    $("sortSelect").value = state.sort;
    $("contextSel").value = state.context;
    $("retentionSel").value = String(state.retentionDays);
    applyTheme();
    bind();
    updateCounts();
    updatePrivacyUi();
    renderList();

    if (state.activeId && state.dossiers.some((d) => d.id === state.activeId)) {
      loadDossier(state.activeId, false);
    } else {
      resetFindings();
    }
    if (expired) toast(expired + " expired dossier" + (expired === 1 ? "" : "s") + " erased");

    setAuthLocked(!signedInEmail());
    if (!signedInEmail()) resetOtp();
    updateAccessUi();

    setInterval(() => {
      $("liveTime").textContent = clockLabel(new Date());
      if (state.sessionOnly) return;
      const removed = purgeExpired(false);
      if (!removed) return;
      save();
      renderList();
      updatePrivacyUi();
      toast(removed + " expired dossier" + (removed === 1 ? "" : "s") + " erased");
    }, 3600000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
