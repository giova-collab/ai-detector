# AI Detector — Dept. of State · Provenance Review

A retro-terminal screening console that estimates how much machine-generated text
is in a sample, and shows *why*. Everything runs in the browser: no server, no model
call, no uploads.

**English only.** Lexicons and baselines are tuned for English prose. A sample that
does not look English is flagged `NON-ENGLISH SAMPLE · UNRELIABLE` and its score
should not be trusted.

**Live scoring is heuristic stylometry. It is indicative, not proof, and false
positives are expected.** Read the signals, not just the number.

## Signals

| Signal | What it reads |
| --- | --- |
| AI lexicon | Density of over-represented LLM vocabulary (“delve”, “leverage”, “robust”, “tapestry”). |
| Stock phrases | Whole discourse templates: “it's important to note”, “in conclusion”, “a double-edged sword”. |
| Sentence rhythm | Burstiness — the spread of sentence lengths. Humans are lumpy; generated prose keeps tempo. List formatting with human voice caps this row, since bullets force uniform lines. |
| Concrete anchors | Numbers, dates, proper names, checkable detail. Capped at 45: an absence of specifics corroborates, it never decides alone. |
| Formatting tells | Em dashes, curly quotes, markdown, lists, paragraph symmetry, plus mechanical polish (capitals, terminal punctuation, comma rhythm). Dateline dashes ("BRUSSELS —") are treated as newsroom convention, not as a tell. |
| Human voice | Contractions, slang, fillers, first person, exclamation. Their absence is itself a signal. |
| Baseline divergence | Optional. Compares the sample against 10–20 messages you know are the same person's. |

The verdict bar maps to `LOW` (0–29), `READ CLOSELY` (30–59) and `VERIFY IN PERSON`
(60–100). Under ~60 words the score is deliberately pulled toward the middle and
labelled low confidence. The **context** selector matters: formal documents legitimately
have no contractions and even pacing, so voice and polish are weighted down there, while
chat samples are judged against how people actually type.

## Using it

1. Paste a sample into **SUBJECT SAMPLE**.
2. Optionally paste known-human messages into **BASELINE**.
3. Press **RUN SCREENING** (or <kbd>Ctrl</kbd>+<kbd>Enter</kbd>).
4. Read the signal breakdown, click `?` for each explanation, inspect the highlighted
   anomalies, then copy the briefing with **COPY REPORT**.

Dossiers persist in `localStorage` by default. The **AUTO-ERASE** dropdown controls
retention, and **SESSION ONLY** keeps them in memory. **CLEAR ARCHIVE** wipes them.

## Privacy

- **No external requests.** Fonts are self-hosted in `assets/fonts` (IBM Plex Mono under
the SIL OFL, Special Elite under Apache 2.0); there are no Google Fonts links, analytics
or telemetry.
- **No uploads.** Screening runs in the page; sample and baseline text never leave the
browser.
- **Session only** (header) clears the stored archive, disables further writes, and keeps
new dossiers in memory. A `sessionStorage` flag remembers the mode for the tab so a
reload cannot accidentally persist the next dossier; the reload empties the archive. No
dossier text is written while it is on.
- **Auto-erase**: 7, 30, 90 days or never. Expired dossiers are removed on load, when the
tab becomes visible and hourly, and the removal is persisted. `CLEAR ARCHIVE` wipes
everything.

## Validation

`node benchmark/evaluate.js` runs 40 labeled human/AI pairs — cables, memos, news and
forum posts, 80 documents — plus 8 typical-AI stress documents, and writes
`benchmark/report.md` with per-register AUC, AUC per signal, FPR/recall and a threshold
sweep.

Current result: on **clean** paired formal prose the score is close to chance (AUC 0.52).
Typical AI reaches the MEDIUM band (88% at 30) but rarely HIGH. The bands were not moved:
no cut-off between 50 and 80 catches clean AI without false positives and with any recall, and lowering HIGH
to 30 buys 25% recall at an 8% false-positive rate. The honest reading is that a fluent,
specific, cliché-free text is a blind spot, not that the threshold is set wrong. The
benchmark is synthetic and small: treat it as a regression harness, not a prevalence
estimate.

## Running locally

Any static server works:

```bash
npx serve .
# or
python -m http.server 5173
```

## Deploying (GitHub Pages)

The repo ships `.github/workflows/pages.yml`, which publishes the static site on
every push to `main`. For a URL shaped like `https://<user>.github.io/<repo>/`:

1. Create a public repository.
2. Push this project to `main`.
3. In **Settings → Pages**, set **Source** to **GitHub Actions** (the workflow also
   attempts to enable it automatically).
4. The site appears at `https://<user>.github.io/<repo>/` after the first run.

No build step, no dependencies, no secrets.

## Files

```
index.html                 markup / layout
assets/css/style.css       navy–brass terminal theme + parchment theme
assets/js/detector.js      measurement, signals, scoring, highlighting
assets/js/app.js           archive, rendering, report, lock, theme
assets/img/seal.webp       Department of State seal, spins on the Z axis
assets/fonts/              self-hosted woff2 files + font licenses
assets/css/fonts.css       local @font-face declarations
benchmark/                 labeled pairs, typical-AI stress set, AUC/FPR report
```

## License

MIT — do what you like. It is a demonstration interface, not a government product
and not affiliated with the U.S. Department of State.
