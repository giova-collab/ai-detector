# Benchmark

Labeled human/AI pairs for the detector, plus a separate typical-AI stress set.
The paired set isolates style: both documents in a pair report the same facts in
the same register, so a difference in score comes from prose, not content.

## Run

```bash
node benchmark/evaluate.js
```

The script prints the report and writes `benchmark/report.md`.

## Structure

| File | Contents |
| --- | --- |
| `data/cables.js` | 10 reporting cables (formal context) |
| `data/memos.js` | 10 internal memos (formal context) |
| `data/news.js` | 10 wire-style news stories (formal context) |
| `data/posts.js` | 10 forum posts (forum context) |
| `data/typical-ai.js` | 8 unpaired, cliché-heavy AI documents |
| `index.js` | joins the registers, assigns the deterministic split |
| `evaluate.js` | AUC, FPR/recall, threshold sweep, report |

40 pairs = 80 documents. Every third pair per register goes to the test split:
56 train documents, 24 held-out test documents.

## What is measured

- **AUC** of the combined score, overall and per register.
- **AUC per signal**, to show which signals carry information and which are at chance.
- **FPR and recall** across cut-offs from 30 to 80.
- **Pair consistency**: how often the AI twin outscores its human twin.
- **Stress recall**: how many typical-AI documents cross each band.

## Design notes

The paired AI side is deliberately **clean**: it avoids "delve", "leverage",
"it is important to note" and most em dashes. This makes the benchmark a
hard-case lower bound. The stress set is the opposite condition: typical
chat-model prose with visible scaffolding. Reporting them separately avoids
averaging a hard case and an easy case into a number that describes neither.

Cables, memos and news are scored in `formal`; posts in `forum`. Human wire copy
starts with a dateline ("BRUSSELS —"): that dash is a newsroom convention and is
excluded from the formatting signal.

## Reading the results

- Clean formal pairs are close to chance (AUC around 0.6). A fluent, specific,
  cliché-free AI text is the detector's blind spot.
- Posts separate much better, because casual human writing leaves contractions,
  slang and uneven rhythm that assistant prose tends to smooth out.
- Typical AI is usually caught at the MEDIUM band, not at HIGH. That is the
  intended use: MEDIUM means "read closely", HIGH means "verify in person".

## Calibration

The thresholds are kept at **LOW 0–29 / MEDIUM 30–59 / HIGH 60–100**.
The precision-first rule finds no cut between 50 and 80 that catches clean AI
without false positives, and lowering HIGH to 30 would relabel ordinary scores
while only reaching a quarter of clean AI at an 8% false-positive rate. The
remaining gap is signal power, not threshold placement.

## Limitations

- The corpus is authored for this project, not sampled from a public dataset.
- 40 pairs are enough to expose gross behavior, not to estimate real-world
  prevalence or produce tight confidence intervals.
- Scores are not probabilities. A false positive is an accusation; the HIGH
  band is intentionally conservative.
- AI texts were written to a brief, not sampled from a specific model. Results
  will differ across models, prompts and lengths.
