/* Benchmark evaluation: per-signal AUC, false positives and band calibration.
   Thresholds are selected on train and checked on the held-out test split.
   Run: node benchmark/evaluate.js */
const fs = require("fs");
const path = require("path");
const D = require("../assets/js/detector.js");
const { docs, pairs } = require("./index.js");
const typical = require("./data/typical-ai.js");

const REGISTERS = ["cable", "memo", "news", "post"];
const SIGNALS = ["lexicon", "stock", "rhythm", "anchor", "format", "voice"];

/* ── metrics ──────────────────────────────────────────────────── */

function auc(pos, neg) {
  if (!pos.length || !neg.length) return NaN;
  let wins = 0;
  pos.forEach((p) => neg.forEach((n) => {
    if (p > n) wins += 1;
    else if (p === n) wins += 0.5;
  }));
  return wins / (pos.length * neg.length);
}

function median(xs) {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function rates(cut, set) {
  const h = set.filter((r) => r.label === 0);
  const a = set.filter((r) => r.label === 1);
  const fp = h.filter((r) => r.score >= cut).length;
  const tp = a.filter((r) => r.score >= cut).length;
  return { cut, fpr: h.length ? fp / h.length : 0, recall: a.length ? tp / a.length : 0 };
}

const pct = (v) => (Number.isFinite(v) ? (v * 100).toFixed(0) + "%" : "n/a");
const f2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : "n/a");

/* ── run detector ─────────────────────────────────────────────── */

function scoreDoc(doc) {
  const analysis = D.analyze(doc.text, { context: doc.context });
  const signals = {};
  analysis.signals.forEach((s) => { signals[s.id] = s.value; });
  return { ...doc, words: analysis.words, score: analysis.score, band: analysis.band, signals };
}

const rows = docs.map(scoreDoc);
const stress = typical.map((doc) => ({ ...scoreDoc(doc), label: 1, split: "stress" }));

const unscorable = rows.concat(stress).filter((r) => !Number.isFinite(r.score) || !r.words);
if (unscorable.length) throw new Error("Unscorable documents: " + unscorable.map((r) => r.id).join(", "));

const train = rows.filter((r) => r.split === "train");
const test = rows.filter((r) => r.split === "test");
if (!train.length || !test.length) throw new Error("Empty train or test split");

REGISTERS.forEach((reg) => {
  if (!test.some((r) => r.register === reg)) throw new Error("No test documents for " + reg);
});

/* ── score separation (all pairs, descriptive) ────────────────── */

const byRegister = REGISTERS.map((reg) => {
  const h = rows.filter((r) => r.register === reg && r.label === 0).map((r) => r.score);
  const a = rows.filter((r) => r.register === reg && r.label === 1).map((r) => r.score);
  return { reg, h, a, auc: auc(a, h) };
});
const allHuman = rows.filter((r) => r.label === 0).map((r) => r.score);
const allAi = rows.filter((r) => r.label === 1).map((r) => r.score);
const overallAuc = auc(allAi, allHuman);
const formalAuc = auc(
  rows.filter((r) => r.label === 1 && r.register !== "post").map((r) => r.score),
  rows.filter((r) => r.label === 0 && r.register !== "post").map((r) => r.score)
);

/* ── per-signal AUC on train only ─────────────────────────────── */

const signalAuc = SIGNALS.map((id) => ({
  id,
  auc: auc(
    train.filter((r) => r.label === 1).map((r) => r.signals[id]),
    train.filter((r) => r.label === 0).map((r) => r.signals[id])
  ),
}));

/* ── threshold sweep and calibration ──────────────────────────── */

// Current cuts come from the detector bands, so a band change cannot
// leave this report describing thresholds that no longer exist.
const current = { mid: D.BANDS[0].max + 1, high: D.BANDS[1].max + 1 };

const sweep = [];
for (let cut = current.mid; cut <= 80; cut += 5) sweep.push(rates(cut, train));

// HIGH must stay precision-first: at least 50, train FPR <= 5%, some recall.
const highCandidates = sweep.filter((r) => r.cut >= 50 && r.fpr <= 0.05 && r.recall > 0);
const recommendedHigh = highCandidates.length ? highCandidates[0].cut : current.high;

// LOW/MEDIUM boundary: lowest cut with train FPR <= 20%.
const midCandidates = sweep.filter((r) => r.fpr <= 0.20);
const recommendedMid = midCandidates.length ? midCandidates[0].cut : current.mid;

const testCurrent = { high: rates(current.high, test), mid: rates(current.mid, test) };
const testRecommended = { high: rates(recommendedHigh, test), mid: rates(recommendedMid, test) };

const stressRecall = (cut) => stress.filter((r) => r.score >= cut).length / stress.length;

/* ── per-register candidates ──────────────────────────────────── */

const perRegister = REGISTERS.map((reg) => {
  const tr = train.filter((r) => r.register === reg);
  const te = test.filter((r) => r.register === reg);
  const highestHuman = Math.max(...tr.filter((r) => r.label === 0).map((r) => r.score));
  for (let cut = current.mid; cut <= 60; cut += 1) {
    const r = rates(cut, tr);
    if (r.fpr <= 0.05 && r.recall > 0) {
      return { reg, cut, train: r, test: rates(cut, te), margin: cut - highestHuman };
    }
  }
  return { reg, cut: null, highestHuman };
});
const candidates = perRegister.filter((p) => p.cut !== null);
const survivors = candidates.filter((p) => p.test.fpr <= 0.05 && p.test.recall > 0);

/* ── pair consistency and twin overlap ────────────────────────── */

const pairScores = {};
rows.forEach((r) => {
  const slot = pairScores[r.pair] || (pairScores[r.pair] = {});
  slot[r.label] = r.score;
});
const pairList = pairs.map((p) => ({ id: p.id, register: p.register, delta: pairScores[p.id][1] - pairScores[p.id][0] }));
const pairWins = pairList.filter((p) => p.delta > 0).length;
const winsByRegister = {};
REGISTERS.forEach((reg) => {
  const list = pairList.filter((p) => p.register === reg);
  winsByRegister[reg] = list.filter((p) => p.delta > 0).length + "/" + list.length;
});

const tokens = (text) => new Set(text.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean));
const overlaps = pairs.map((p) => {
  const twins = docs.filter((doc) => doc.pair === p.id);
  const a = tokens(twins[0].text);
  const b = tokens(twins[1].text);
  const shared = [...a].filter((w) => b.has(w)).length;
  return shared / new Set([...a, ...b]).size;
});

/* ── report ───────────────────────────────────────────────────── */

const L = [];
L.push("# Benchmark report");
L.push("");
L.push("**" + pairs.length + " clean pairs, " + rows.length + " documents**, plus **" + stress.length + " typical-AI stress documents**.");
L.push("Each pair shares the same facts in the same register; only the prose differs.");
L.push("Cables, memos and news run in `formal`; forum posts in `forum`.");
L.push("Split: **" + train.length + " train / " + test.length + " test documents**, every third pair per register. Thresholds are chosen on train and checked on test.");
L.push("");
L.push("**Limitation:** the corpus is authored for this project, not sampled from a public dataset.");
L.push("The paired AI side is deliberately clean, so the AUC is a hard-case lower bound, not a prevalence estimate.");
L.push("");
L.push("## Score separation");
L.push("");
L.push("AUC is descriptive and uses all pairs; threshold selection below uses train only.");
L.push("");
L.push("| Register | Human median | Human max | AI median | AI min | AUC |");
L.push("| --- | --- | --- | --- | --- | --- |");
byRegister.forEach((d) => {
  L.push("| " + d.reg + " | " + median(d.h) + " | " + Math.max(...d.h) + " | " + median(d.a) + " | " + Math.min(...d.a) + " | " + f2(d.auc) + " |");
});
L.push("| **all** | " + median(allHuman) + " | " + Math.max(...allHuman) + " | " + median(allAi) + " | " + Math.min(...allAi) + " | **" + f2(overallAuc) + "** |");
L.push("");
L.push("Twin token overlap: median " + f2(median(overlaps)) + ", max " + f2(Math.max(...overlaps)) + ". High overlap is intentional: those are the hardest clean-AI pairs; the dataset rejects twins above 0.90.");
L.push("");
L.push("## Typical-AI stress set (n=" + stress.length + ")");
L.push("");
L.push("| Document | Words | Score | Band |");
L.push("| --- | --- | --- | --- |");
stress.forEach((r) => L.push("| `" + r.id + "` | " + r.words + " | " + r.score + " | " + r.band + " |"));
L.push("");
L.push("Recall on typical AI: **" + pct(stressRecall(current.mid)) + " at MEDIUM (" + current.mid + ")**" +
  [40, 50, current.high].filter((cut) => cut !== current.mid).map((cut) => ", " + pct(stressRecall(cut)) + " at " + cut).join("") + ".");
L.push("");
L.push("## AUC per signal (train, n=" + train.length + ")");
L.push("");
L.push("1.0 separates perfectly, 0.5 is chance; below 0.5 means the signal points the wrong way.");
L.push("");
L.push("| Signal | AUC |");
L.push("| --- | --- |");
signalAuc.forEach((s) => L.push("| " + s.id + " | " + f2(s.auc) + " |"));
L.push("");
L.push("## Threshold sweep (train)");
L.push("");
L.push("| Cut | FPR | Recall |");
L.push("| --- | --- | --- |");
sweep.forEach((r) => L.push("| " + r.cut + " | " + pct(r.fpr) + " | " + pct(r.recall) + " |"));
L.push("");
L.push("## Held-out test (n=" + test.length + ")");
L.push("");
L.push("| Setting | HIGH cut | FPR | Recall | MEDIUM cut | FPR | Recall |");
L.push("| --- | --- | --- | --- | --- | --- | --- |");
L.push("| Current | " + current.high + " | " + pct(testCurrent.high.fpr) + " | " + pct(testCurrent.high.recall) + " | " + current.mid + " | " + pct(testCurrent.mid.fpr) + " | " + pct(testCurrent.mid.recall) + " |");
L.push("| Recommended | " + recommendedHigh + " | " + pct(testRecommended.high.fpr) + " | " + pct(testRecommended.high.recall) + " | " + recommendedMid + " | " + pct(testRecommended.mid.fpr) + " | " + pct(testRecommended.mid.recall) + " |");
L.push("");
L.push("Pair consistency: AI twin outscored the human twin in **" + pairWins + "/" + pairList.length + "** pairs (" +
  REGISTERS.map((reg) => reg + " " + winsByRegister[reg]).join(", ") + ").");
L.push("");
L.push("## Per-register candidates");
L.push("");
L.push("Lowest cut with train FPR at or below 5% and non-zero recall. Candidates are selected on train and checked on test.");
L.push("");
if (candidates.length) {
  L.push("| Register | Cut | Margin over max human | Train FPR | Train recall | Test FPR | Test recall |");
  L.push("| --- | --- | --- | --- | --- | --- | --- |");
  candidates.forEach((p) => {
    L.push("| " + p.reg + " | " + p.cut + " | " + p.margin + " | " + pct(p.train.fpr) + " | " + pct(p.train.recall) + " | " + pct(p.test.fpr) + " | " + pct(p.test.recall) + " |");
  });
  const failed = candidates.filter((p) => p.test.fpr > 0.05 || p.test.recall === 0);
  if (failed.length) L.push("");
  failed.forEach((p) => L.push("- " + p.reg + " passes train but fails held-out (test FPR " + pct(p.test.fpr) + ")."));
  if (survivors.length) {
    const best = survivors[0];
    const pairCount = pairs.filter((p) => p.register === best.reg).length;
    L.push("- " + survivors.map((p) => p.reg + " survives at " + p.cut + " with a " + p.margin + "-point margin").join("; ") + ".");
    L.push("- Not adopted: " + best.reg + " rests on " + pairCount + " pairs and a " + best.margin + "-point margin over the highest human train score; too thin to change global bands.");
  }
} else {
  L.push("No register produced a candidate that passes the train precision filter.");
}
L.push("");
L.push("## Calibration decision");
L.push("");
if (recommendedHigh === current.high) {
  L.push("**Bands unchanged** (LOW 0–" + D.BANDS[0].max + ", MEDIUM " + current.mid + "–" + D.BANDS[1].max + ", HIGH " + current.high + "–100).");
  L.push("The precision-first rule finds no cut between 50 and 80 that catches clean AI with train FPR at or below 5%.");
  L.push("Lowering HIGH to " + current.mid + " would catch " + pct(testCurrent.mid.recall) + " of clean AI at " + pct(testCurrent.mid.fpr) + " false positives on the held-out set.");
  L.push("The gap is signal power — formal-register AUC " + f2(formalAuc) + " — not threshold placement.");
} else {
  L.push("Recommended HIGH **" + recommendedHigh + "** (was " + current.high + "), LOW/MEDIUM **" + recommendedMid + "** (was " + current.mid + ").");
}
L.push("");
L.push("## Misclassified clean pairs");
L.push("");
const fps = rows.filter((r) => r.label === 0 && r.score >= current.high).sort((a, b) => b.score - a.score);
L.push("False positives (human at or above HIGH " + current.high + "): " + (fps.length ? fps.map((r) => "`" + r.id + "` " + r.score).join(", ") : "none."));
L.push("");
const fns = rows.filter((r) => r.label === 1 && r.score < current.high).sort((a, b) => a.score - b.score);
L.push("False negatives (AI below HIGH " + current.high + "): " + fns.length + " of " + allAi.length + ".");
if (fns.length) {
  fns.slice(0, 10).forEach((r) => L.push("- `" + r.id + "` — " + r.score + " (" + r.words + " words)"));
  if (fns.length > 10) L.push("- … " + (fns.length - 10) + " more.");
}
L.push("");

fs.writeFileSync(path.join(__dirname, "report.md"), L.join("\n"));
console.log(L.join("\n"));
