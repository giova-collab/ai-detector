# Benchmark report

**40 clean pairs, 80 documents**, plus **8 typical-AI stress documents**.
Each pair shares the same facts in the same register; only the prose differs.
Cables, memos and news run in `formal`; forum posts in `forum`.
Split: **56 train / 24 test documents**, every third pair per register. Thresholds are chosen on train and checked on test.

**Limitation:** the corpus is authored for this project, not sampled from a public dataset.
The paired AI side is deliberately clean, so the AUC is a hard-case lower bound, not a prevalence estimate.

## Score separation

AUC is descriptive and uses all pairs; threshold selection below uses train only.

| Register | Human median | Human max | AI median | AI min | AUC |
| --- | --- | --- | --- | --- | --- |
| cable | 20 | 32 | 19.5 | 17 | 0.51 |
| memo | 19.5 | 21 | 20 | 16 | 0.60 |
| news | 13 | 20 | 11.5 | 8 | 0.46 |
| post | 24.5 | 31 | 34.5 | 21 | 0.87 |
| **all** | 19.5 | 32 | 20 | 8 | **0.59** |

Twin token overlap: median 0.72, max 0.89. High overlap is intentional: those are the hardest clean-AI pairs; the dataset rejects twins above 0.90.

## Typical-AI stress set (n=8)

| Document | Words | Score | Band |
| --- | --- | --- | --- |
| `typical_cable_port` | 95 | 56 | MEDIUM |
| `typical_cable_ceasefire` | 88 | 62 | HIGH |
| `typical_memo_insurance` | 86 | 19 | LOW |
| `typical_memo_licenses` | 87 | 50 | MEDIUM |
| `typical_news_mission` | 91 | 33 | MEDIUM |
| `typical_news_eurobond` | 83 | 43 | MEDIUM |
| `typical_post_lisbon` | 83 | 38 | MEDIUM |
| `typical_post_ramen` | 89 | 43 | MEDIUM |

Recall on typical AI: **88% at MEDIUM (30)**, 63% at 40, 38% at 50, 13% at 60.

## AUC per signal (train, n=56)

1.0 separates perfectly, 0.5 is chance; below 0.5 means the signal points the wrong way.

| Signal | AUC |
| --- | --- |
| lexicon | 0.63 |
| stock | 0.55 |
| rhythm | 0.51 |
| anchor | 0.51 |
| format | 0.66 |
| voice | 0.57 |

## Threshold sweep (train)

| Cut | FPR | Recall |
| --- | --- | --- |
| 30 | 4% | 21% |
| 35 | 0% | 18% |
| 40 | 0% | 7% |
| 45 | 0% | 4% |
| 50 | 0% | 0% |
| 55 | 0% | 0% |
| 60 | 0% | 0% |
| 65 | 0% | 0% |
| 70 | 0% | 0% |
| 75 | 0% | 0% |
| 80 | 0% | 0% |

## Held-out test (n=24)

| Setting | HIGH cut | FPR | Recall | MEDIUM cut | FPR | Recall |
| --- | --- | --- | --- | --- | --- | --- |
| Current | 60 | 0% | 0% | 30 | 8% | 25% |
| Recommended | 60 | 0% | 0% | 30 | 8% | 25% |

Pair consistency: AI twin outscored the human twin in **20/40** pairs (cable 5/10, memo 4/10, news 3/10, post 8/10).

## Per-register candidates

Lowest cut with train FPR at or below 5% and non-zero recall. Candidates are selected on train and checked on test.

| Register | Cut | Margin over max human | Train FPR | Train recall | Test FPR | Test recall |
| --- | --- | --- | --- | --- | --- | --- |
| cable | 30 | 4 | 0% | 29% | 33% | 0% |
| post | 32 | 1 | 0% | 57% | 0% | 100% |

- cable passes train but fails held-out (test FPR 33%).
- post survives at 32 with a 1-point margin.
- Not adopted: post rests on 10 pairs and a 1-point margin over the highest human train score; too thin to change global bands.

## Calibration decision

**Bands unchanged** (LOW 0–29, MEDIUM 30–59, HIGH 60–100).
The precision-first rule finds no cut between 50 and 80 that catches clean AI with train FPR at or below 5%.
Lowering HIGH to 30 would catch 25% of clean AI at 8% false positives on the held-out set.
The gap is signal power — formal-register AUC 0.52 — not threshold placement.

## Misclassified clean pairs

False positives (human at or above HIGH 60): none.

False negatives (AI below HIGH 60): 40 of 40.
- `news_asylum_ai` — 8 (50 words)
- `news_election_ai` — 8 (48 words)
- `news_eurobond_ai` — 9 (61 words)
- `news_talks_ai` — 9 (47 words)
- `news_ferry_ai` — 9 (45 words)
- `news_rates_ai` — 14 (55 words)
- `news_summit_ai` — 15 (53 words)
- `memo_airspace_ai` — 16 (63 words)
- `cable_corridor_ai` — 17 (68 words)
- `cable_exercise_ai` — 17 (53 words)
- … 30 more.
