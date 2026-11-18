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
| Sentence rhythm | Burstiness — the spread of sentence lengths. Humans are lumpy; generated prose keeps tempo. |
| Concrete anchors | Numbers, dates, proper names, checkable detail. Capped at 60: an absence of specifics corroborates, it never decides alone. |
| Formatting tells | Em dashes, curly quotes, markdown, lists, paragraph symmetry, plus mechanical polish (capitals, terminal punctuation, comma rhythm). |
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

Dossiers persist in `localStorage` on your machine. **CLEAR ARCHIVE** wipes them.

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
```

## License

MIT — do what you like. It is a demonstration interface, not a government product
and not affiliated with the U.S. Department of State.
