/* ═══════════════════════════════════════════════════════════════════
   AI DETECTOR — interface wiring, archive, reporting
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STORE_KEY = "state.ai-detector.v1";
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
    parchment: false
  };

  let current = null;
  let scanTimer = null;
  let toastTimer = null;

  /* ── storage ─────────────────────────────────────────────────── */

  function load() {
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
    } catch (e) { /* corrupt store: start clean */ }
  }

  function save() {
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
        parchment: state.parchment
      }));
    } catch (e) { /* quota — keep working in memory */ }
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
    if (a.insufficient) return "LOW CONFIDENCE · SHORT SAMPLE";
    if (a.words < 60) return "LOW CONFIDENCE · " + a.words + " WORDS";
    if (a.words < 150) return "MODERATE CONFIDENCE";
    return "HIGH CONFIDENCE";
  }

  function renderFindings(a) {
    if (!a) { resetFindings(); return; }
    const lead = $("findingsLead");
    lead.innerHTML =
      '<span class="accent">' + a.verdict.sub + "</span> — " + a.score +
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

    $("lockBtn").addEventListener("click", () => {
      $("lockOverlay").hidden = false;
      $("unlockBtn").focus();
    });
    $("unlockBtn").addEventListener("click", () => {
      $("lockOverlay").hidden = true;
    });
    document.addEventListener("keydown", (e) => {
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

  function init() {
    load();
    $("analyst").value = state.analyst;
    $("sortSelect").value = state.sort;
    $("contextSel").value = state.context;
    applyTheme();
    bind();
    updateCounts();
    renderList();

    if (state.activeId && state.dossiers.some((d) => d.id === state.activeId)) {
      loadDossier(state.activeId, false);
    } else {
      resetFindings();
    }

    setInterval(() => { $("liveTime").textContent = clockLabel(new Date()); }, 30000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
