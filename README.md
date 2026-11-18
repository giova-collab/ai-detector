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

The console opens on an **access gate**. The built-in public whitelist contains
`thisentirethingsucksbro@gmail.com` (approved, not admin). The owner sees **ADMIN** in the
header to approve or remove other email addresses; built-in entries are fixed. The list
is stored in `localStorage`, so it is per browser and client-side: anyone who can edit
this browser can bypass it. **SIGN OUT** in the LOCK panel clears the tab session.

The owner email is **not present in the page or the source**. Admin access is checked
against a salted PBKDF2 hash in `assets/js/app.js` and the owner never appears in the
UI or clipboard report. A hash keeps the address out of casual view, but it is not
confidentiality against a determined offline attacker, and this is still a client-side
gate with no server enforcement.

**Email one-time code.** After an approved email the gate generates a 6-digit code and
sends it through EmailJS. No code is shown in the page. The code expires after 5 minutes
and allows 5 attempts.

### Email OTP setup (EmailJS)

1. Create a free EmailJS account.
2. Add an email service. Choose any non-Google provider or SMTP if you prefer; EmailJS
   supports several providers.
3. Create an email template using these variables: `{{to_email}}`, `{{otp_code}}`,
   `{{expires_minutes}}`. Example body: `Your access code is {{otp_code}}. It expires
   in {{expires_minutes}} minutes.`
4. Copy the Public Key, Service ID and Template ID into the `EMAILJS_*` constants at the
top of `assets/js/app.js`.
5. In the EmailJS dashboard, restrict allowed origins to `http://127.0.0.1:5173` and
   your GitHub Pages origin.
6. Reload and test with an approved email.

If EmailJS is not configured, the gate shows `EMAILJS NOT CONFIGURED`.

If you cannot maintain a backend, EmailJS is the simplest no-backend option. A more
private alternative is a managed auth service (for example Supabase Auth) or a small
serverless function with a transactional email provider; both keep secrets off the client
but require more setup.

1. Paste a sample into **SUBJECT SAMPLE**.
2. Optionally paste known-human messages into **BASELINE**.
3. Press **RUN SCREENING** (or <kbd>Ctrl</kbd>+<kbd>Enter</kbd>).
4. Read the signal breakdown, click `?` for each explanation, inspect the highlighted
   anomalies, then copy the briefing with **COPY REPORT**.

Dossiers persist in `localStorage` by default. The **AUTO-ERASE** dropdown controls
retention, and **SESSION ONLY** keeps them in memory. **CLEAR ARCHIVE** wipes them.

## Privacy

- **Network use.** Fonts are self-hosted. EmailJS is contacted only when sending an
access code; there are no analytics or telemetry. Dossier text never leaves the browser.
- **No uploads.** Screening runs in the page; sample and baseline text never leave the
browser.
- **Admin identity.** The owner email is stored only as a salted PBKDF2 hash; it is not
written to the page, the archive or reports. The hash is public in the source, so it
hides the address from casual inspection, not from offline guessing.
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
