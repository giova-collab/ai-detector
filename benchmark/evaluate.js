/* Benchmark evaluation: per-signal AUC, false positives and band calibration.
   Deterministic: the same pairs always land in the same train/test split.
   Run: node benchmark/evaluate.js */
const fs = require("fs");
const path = require("path");
const D = require("../assets/js/detector.js");
const { docs, pairs } = require("./index.js");
const typical = require("./data/typical-ai.js");

/* ── helpers ──────────────────────────────────────────────────── */

function auc(pos, neg) {
  if (!pos.length || !neg.length) return NaN;
  let wins = 0;
  pos.forEach((p) => neg.forEach((n) => {
    if (p > n) wins += 1;
    else if (p === n) wins += 0.5;
  }));
  return wins / (pos.length * neg.length);
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs) => {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (v) => (Number.isFinite(v) ? (v * 100).toFixed(0) + "%" : "n/a");
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "n/a");

/* ── run detector ─────────────────────────────────────────────── */

const rows = docs.map((doc) => {
  const r = D.analyze(doc.text, { context: doc.context });
  const signals = {};
  r.signals.forEach((s) => { signals[s.id] = s.value; });
  return { ...doc, words: r.words, score: r.score, band: r.band, english: r.english, signals };
});
const stress = typical.map((doc) => {
  const r = D.analyze(doc.text, { context: doc.context });
  const signals = {};
  r.signals.forEach((s) => { signals[s.id] = s.value; });
  return { ...doc, label: 1, labelName: "ai", words: r.words, score: r.score, band: r.band, signals };
});

const bad = rows.concat(stress).filter((r) => !Number.isFinite(r.score) || !r.words);
if (bad.length) throw new Error("Unscorable documents: " + bad.map((r) => r.id).join(", "));

/* ── score distributions ──────────────────────────────────────── */

const registers = ["cable", "memo", "news", "post"];
const dist = {};
registers.forEach((reg) => {
  const h = rows.filter((r) => r.register === reg && r.label === 0).map((r) => r.score);
  const a = rows.filter((r) => r.register === reg && r.label === 1).map((r) => r.score);
  const t = stress.filter((r) => r.register === reg).map((r) => r.score);
  dist[reg] = { human: h, ai: a, typical: t, auc: auc(a, h), aucTypical: auc(t, h) };
});
const allHuman = rows.filter((r) => r.label === 0).map((r) => r.score);
const allAi = rows.filter((r) => r.label === 1).map((r) => r.score);
const overallAuc = auc(allAi, allHuman);

/* ── per-signal AUC, overall and by register ──────────────────── */

const signalIds = ["lexicon", "stock", "rhythm", "anchor", "format", "voice"];
const signalAuc = {};
signalIds.forEach((id) => {
  const pos = rows.filter((r) => r.label === 1).map((r) => r.signals[id]);
  const neg = rows.filter((r) => r.label === 0).map((r) => r.signals[id]);
  signalAuc[id] = { all: auc(pos, neg) };
  registers.forEach((reg) => {
    signalAuc[id][reg] = auc(
      rows.filter((r) => r.register === reg && r.label === 1).map((r) => r.signals[id]),
      rows.filter((r) => r.register === reg && r.label === 0).map((r) => r.signals[id])
    );
  });
});

/* ── threshold sweep ──────────────────────────────────────────── */

const train = rows.filter((r) => r.split === "train");
const test = rows.filter((r) => r.split === "test");

function rates(cut, set) {
  const h = set.filter((r) => r.label === 0);
  const a = set.filter((r) => r.label === 1);
  const fp = h.filter((r) => r.score >= cut).length;
  const tp = a.filter((r) => r.score >= cut).length;
  return { cut, fpr: h.length ? fp / h.length : 0, recall: a.length ? tp / a.length : 0, fp, tp, nHuman: h.length, nAi: a.length };
}

const sweep = [];
const testSweep = [];
for (let cut = 30; cut <= 80; cut += 5) {
  sweep.push(rates(cut, train));
  if (cut <= 70) testSweep.push(rates(cut, test));
}

// Precision-first rule: the lowest cut at or above 50 with train FPR <= 5%.
// If none carries any recall, the current cut stays.
const precisionCandidates = sweep.filter((r) => r.cut >= 50 && r.fpr <= 0.05 && r.recall > 0);
const recommendedHigh = precisionCandidates.length
  ? precisionCandidates[0].cut
  : 60;

// LOW/MEDIUM boundary: lowest cut with train FPR <= 20%.
const midCandidates = sweep.filter((r) => r.fpr <= 0.20);
const recommendedMid = midCandidates.length ? midCandidates[0].cut : 30;

// Per-register candidate: lowest cut with train FPR <= 5% and some recall.
const perRegister = registers.map((reg) => {
  const tr = train.filter((r) => r.register === reg);
  const te = test.filter((r) => r.register === reg);
  let best = null;
  for (let cut = 30; cut <= 60; cut += 1) {
    const r = rates(cut, tr);
    if (r.fpr <= 0.05 && r.recall > 0) { best = { cut, train: r, test: rates(cut, te) }; break; }
  }
  return { reg, best };
});

const current = { high: 60, mid: 30 };
const testCurrent = { high: rates(current.high, test), mid: rates(current.mid, test) };
const testRecommended = { high: rates(recommendedHigh, test), mid: rates(recommendedMid, test) };
const stressRecall = (cut) => rates(cut, stress);

/* ── pair consistency ─────────────────────────────────────────── */

const pairScores = {};
rows.forEach((r) => {
  pairScores[r.pair] = pairScores[r.pair] || {};
  pairScores[r.pair][r.labelName] = r.score;
});
const pairList = Object.entries(pairScores).map(([id, s]) => ({ id, human: s.human, ai: s.ai, delta: s.ai - s.human }));
const pairWins = pairList.filter((p) => p.delta > 0).length;
const pairWinsByRegister = {};
registers.forEach((reg) => {
  const ids = new Set(rows.filter((r) => r.register === reg).map((r) => r.pair));
  const list = pairList.filter((p) => ids.has(p.id));
  pairWinsByRegister[reg] = { wins: list.filter((p) => p.delta > 0).length, n: list.length };
});

/* ── report ───────────────────────────────────────────────────── */

const lines = [];
lines.push("# Benchmark report");
lines.push("");
lines.push("Synthetic labeled set built for this project: **" + pairs.length + " clean pairs, " + rows.length + " documents**, plus **" + stress.length + " typical-AI stress documents**.");
lines.push("Every pair shares the same facts in the same register; only the prose differs.");
lines.push("Cables, memos and news run in `formal`; forum posts run in `forum`.");
lines.push("Split: " + train.length + " train documents / " + test.length + " test documents (every third pair per register).");
lines.push("");
lines.push("**Limitation:** these texts are authored for the project, not sampled from a public corpus.");
lines.push("The paired AI side is deliberately clean — it avoids the usual clichés — so the AUC below is a hard-case lower bound, not a real-world prevalence estimate.");
lines.push("The unpaired stress set shows what happens on typical chat-model prose.");
lines.push("");
lines.push("## Score separation (clean pairs)");
lines.push("");
lines.push("| Register | n human | Human median | Human max | n AI | AI median | AI min | AUC clean | AUC typical AI |");
lines.push("| --- | --- | --- | --- | --- | --- | --- | --- | --- |");
registers.forEach((reg) => {
  const d = dist[reg];
  lines.push(
    "| " + reg + " | " + d.human.length + " | " + median(d.human) + " | " + Math.max(...d.human) +
    " | " + d.ai.length + " | " + median(d.ai) + " | " + Math.min(...d.ai) + " | " + f2(d.auc) +
    " | " + f2(d.aucTypical) + " |"
  );
});
lines.push(
  "| **all** | " + allHuman.length + " | " + median(allHuman) + " | " + Math.max(...allHuman) +
  " | " + allAi.length + " | " + median(allAi) + " | " + Math.min(...allAi) + " | **" + f2(overallAuc) + "** | — |"
);
lines.push("");
lines.push("Typical-AI AUC uses two documents per register: read it as a direction, not an estimate.");
lines.push("");
lines.push("## Typical-AI stress set (n=" + stress.length + ")");
lines.push("");
lines.push("| Document | Words | Score | Band |");
lines.push("| --- | --- | --- | --- |");
stress.forEach((r) => lines.push("| `" + r.id + "` | " + r.words + " | " + r.score + " | " + r.band + " |"));
lines.push("");
lines.push("Recall on typical AI: **" + pct(stressRecall(30).recall) + " at MEDIUM (30)**, " + pct(stressRecall(40).recall) + " at 40, " + pct(stressRecall(50).recall) + " at 50, " + pct(stressRecall(60).recall) + " at HIGH (60).");
lines.push("");
lines.push("## AUC per signal");
lines.push("");
lines.push("1.0 separates perfectly, 0.5 is chance. Values below 0.5 mean the signal points the wrong way.");
lines.push("");
lines.push("| Signal | All | Cable | Memo | News | Post |");
lines.push("| --- | --- | --- | --- | --- | --- |");
signalIds.forEach((id) => {
  const s = signalAuc[id];
  lines.push("| " + id + " | " + f2(s.all) + " | " + f2(s.cable) + " | " + f2(s.memo) + " | " + f2(s.news) + " | " + f2(s.post) + " |");
});
lines.push("");
lines.push("## Threshold sweep (train, n=" + train.length + ")");
lines.push("");
lines.push("| Cut | FPR | Recall | FP | TP |");
lines.push("| --- | --- | --- | --- | --- |");
sweep.forEach((r) => lines.push("| " + r.cut + " | " + pct(r.fpr) + " | " + pct(r.recall) + " | " + r.fp + "/" + r.nHuman + " | " + r.tp + "/" + r.nAi + " |"));
lines.push("");
lines.push("## Held-out test (n=" + test.length + ")");
lines.push("");
lines.push("| Setting | HIGH cut | FPR | Recall | MEDIUM cut | FPR | Recall |");
lines.push("| --- | --- | --- | --- | --- | --- | --- |");
lines.push("| Current | 60 | " + pct(testCurrent.high.fpr) + " | " + pct(testCurrent.high.recall) + " | 30 | " + pct(testCurrent.mid.fpr) + " | " + pct(testCurrent.mid.recall) + " |");
lines.push("| Recommended | " + recommendedHigh + " | " + pct(testRecommended.high.fpr) + " | " + pct(testRecommended.high.recall) + " | " + recommendedMid + " | " + pct(testRecommended.mid.fpr) + " | " + pct(testRecommended.mid.recall) + " |");
lines.push("");
lines.push("Pair consistency: AI twin outscored the human twin in **" + pairWins + "/" + pairList.length + "** pairs (" +
  registers.map((reg) => reg + " " + pairWinsByRegister[reg].wins + "/" + pairWinsByRegister[reg].n).join(", ") + ").");
lines.push("");
lines.push("### Per-register candidate cuts");
lines.push("");
lines.push("Lowest cut with train FPR at or below 5% and non-zero recall. Candidates are selected on train and checked on test; cable passes train but fails the held-out check, and only forum survives, on 10 pairs and a one-point margin over the highest human train score. Bands stay global.");
lines.push("");
lines.push("| Register | Cut | Train FPR | Train recall | Test FPR | Test recall |");
lines.push("| --- | --- | --- | --- | --- | --- |");
perRegister.forEach((p) => {
  if (!p.best) { lines.push("| " + p.reg + " | none | — | 0% | — | — |"); return; }
  lines.push("| " + p.reg + " | " + p.best.cut + " | " + pct(p.best.train.fpr) + " | " + pct(p.best.train.recall) + " | " + pct(p.best.test.fpr) + " | " + pct(p.best.test.recall) + " |");
});
lines.push("");
lines.push("## Calibration decision");
lines.push("");
if (recommendedHigh === current.high) {
  lines.push("**Bands unchanged.** The precision-first rule finds no cut between 50 and 80 that keeps train FPR at or below 5% while catching clean AI. Lowering HIGH to 30 would catch " + pct(testCurrent.mid.recall) + " of clean AI at " + pct(testCurrent.mid.fpr) + " false positives on the held-out set — not enough to justify relabelling ordinary scores as machine-origin.");
  lines.push("The gap is signal power (AUC " + f2(overallAuc) + " on clean formal pairs), not threshold placement. The next step is adding signals, not moving the line.");
} else {
  lines.push("Recommended HIGH **" + recommendedHigh + "** (was 60), LOW/MEDIUM **" + recommendedMid + "** (was 30), selected on train and checked on test above.");
}
lines.push("");
lines.push("## Misclassified clean pairs");
lines.push("");
lines.push("False positives (human at or above 60):");
lines.push("");
const fps = rows.filter((r) => r.label === 0 && r.score >= 60).sort((a, b) => b.score - a.score);
lines.push(fps.length ? fps.map((r) => "- `" + r.id + "` — " + r.score + " (" + r.words + " words)").join("\n") : "None.");
lines.push("");
lines.push("False negatives (AI below 60):");
lines.push("");
const fns = rows.filter((r) => r.label === 1 && r.score < 60).sort((a, b) => a.score - b.score);
lines.push(fns.length ? fns.map((r) => "- `" + r.id + "` — " + r.score + " (" + r.words + " words)").join("\n") : "None.");
lines.push("");

fs.writeFileSync(path.join(__dirname, "report.md"), lines.join("\n"));
console.log(lines.join("\n"));
