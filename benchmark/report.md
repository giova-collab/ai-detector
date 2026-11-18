# Benchmark report

Synthetic labeled set built for this project: **40 clean pairs, 80 documents**, plus **8 typical-AI stress documents**.
Every pair shares the same facts in the same register; only the prose differs.
Cables, memos and news run in `formal`; forum posts run in `forum`.
Split: 56 train documents / 24 test documents (every third pair per register).

**Limitation:** these texts are authored for the project, not sampled from a public corpus.
The paired AI side is deliberately clean — it avoids the usual clichés — so the AUC below is a hard-case lower bound, not a real-world prevalence estimate.
The unpaired stress set shows what happens on typical chat-model prose.

## Score separation (clean pairs)

| Register | n human | Human median | Human max | n AI | AI median | AI min | AUC clean | AUC typical AI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| cable | 10 | 20 | 32 | 10 | 19.5 | 17 | 0.51 | 1.00 |
| memo | 10 | 19.5 | 21 | 10 | 20 | 16 | 0.58 | 0.72 |
| news | 10 | 13 | 20 | 10 | 14.5 | 8 | 0.53 | 1.00 |
| post | 10 | 24.5 | 31 | 10 | 34.5 | 21 | 0.87 | 1.00 |
| **all** | 40 | 19.5 | 32 | 40 | 20 | 8 | **0.59** | — |

Typical-AI AUC uses two documents per register: read it as a direction, not an estimate.

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

Recall on typical AI: **88% at MEDIUM (30)**, 63% at 40, 38% at 50, 13% at HIGH (60).

## AUC per signal

1.0 separates perfectly, 0.5 is chance. Values below 0.5 mean the signal points the wrong way.

| Signal | All | Cable | Memo | News | Post |
| --- | --- | --- | --- | --- | --- |
| lexicon | 0.59 | 0.60 | 0.51 | 0.55 | 0.70 |
| stock | 0.54 | 0.60 | 0.50 | 0.50 | 0.55 |
| rhythm | 0.56 | 0.51 | 0.56 | 0.54 | 0.63 |
| anchor | 0.50 | 0.51 | 0.50 | 0.50 | 0.53 |
| format | 0.71 | 0.59 | 0.66 | 0.52 | 0.82 |
| voice | 0.59 | 0.50 | 0.48 | 0.51 | 0.80 |

## Threshold sweep (train, n=56)

| Cut | FPR | Recall | FP | TP |
| --- | --- | --- | --- | --- |
| 30 | 4% | 21% | 1/28 | 6/28 |
| 35 | 0% | 18% | 0/28 | 5/28 |
| 40 | 0% | 7% | 0/28 | 2/28 |
| 45 | 0% | 4% | 0/28 | 1/28 |
| 50 | 0% | 0% | 0/28 | 0/28 |
| 55 | 0% | 0% | 0/28 | 0/28 |
| 60 | 0% | 0% | 0/28 | 0/28 |
| 65 | 0% | 0% | 0/28 | 0/28 |
| 70 | 0% | 0% | 0/28 | 0/28 |
| 75 | 0% | 0% | 0/28 | 0/28 |
| 80 | 0% | 0% | 0/28 | 0/28 |

## Held-out test (n=24)

| Setting | HIGH cut | FPR | Recall | MEDIUM cut | FPR | Recall |
| --- | --- | --- | --- | --- | --- | --- |
| Current | 60 | 0% | 0% | 30 | 8% | 25% |
| Recommended | 60 | 0% | 0% | 30 | 8% | 25% |

Pair consistency: AI twin outscored the human twin in **19/40** pairs (cable 5/10, memo 3/10, news 3/10, post 8/10).

### Per-register candidate cuts

Lowest cut with train FPR at or below 5% and non-zero recall. Candidates are selected on train and checked on test; cable passes train but fails the held-out check, and only forum survives, on 10 pairs and a one-point margin over the highest human train score. Bands stay global.

| Register | Cut | Train FPR | Train recall | Test FPR | Test recall |
| --- | --- | --- | --- | --- | --- |
| cable | 30 | 0% | 29% | 33% | 0% |
| memo | none | — | 0% | — | — |
| news | none | — | 0% | — | — |
| post | 32 | 0% | 57% | 0% | 100% |

## Calibration decision

**Bands unchanged.** The precision-first rule finds no cut between 50 and 80 that keeps train FPR at or below 5% while catching clean AI. Lowering HIGH to 30 would catch 25% of clean AI at 8% false positives on the held-out set — not enough to justify relabelling ordinary scores as machine-origin.
The gap is signal power (AUC 0.59 on clean formal pairs), not threshold placement. The next step is adding signals, not moving the line.

## Misclassified clean pairs

False positives (human at or above 60):

None.

False negatives (AI below 60):

- `news_asylum_ai` — 8 (50 words)
- `news_eurobond_ai` — 9 (61 words)
- `news_rates_ai` — 9 (48 words)
- `news_talks_ai` — 9 (47 words)
- `news_election_ai` — 14 (56 words)
- `news_summit_ai` — 15 (53 words)
- `memo_airspace_ai` — 16 (63 words)
- `cable_corridor_ai` — 17 (68 words)
- `cable_exercise_ai` — 17 (53 words)
- `memo_visas_ai` — 17 (68 words)
- `news_port_ai` — 18 (54 words)
- `cable_consular_ai` — 19 (60 words)
- `cable_returns_ai` — 19 (53 words)
- `cable_convoy_ai` — 19 (64 words)
- `memo_cyber_ai` — 19 (67 words)
- `memo_crisis_ai` — 19 (61 words)
- `news_ferry_ai` — 19 (49 words)
- `cable_border_ai` — 20 (69 words)
- `cable_election_ai` — 20 (61 words)
- `cable_exemption_ai` — 20 (57 words)
- `memo_insurance_ai` — 20 (62 words)
- `memo_rotation_ai` — 20 (59 words)
- `memo_hostnation_ai` — 20 (64 words)
- `memo_cultural_ai` — 20 (65 words)
- `memo_training_ai` — 20 (59 words)
- `news_mission_ai` — 20 (64 words)
- `post_language_ai` — 21 (50 words)
- `news_border_ai` — 22 (54 words)
- `memo_licenses_ai` — 23 (61 words)
- `post_doctor_ai` — 26 (57 words)
- `post_remote_ai` — 27 (66 words)
- `post_visa_ai` — 34 (62 words)
- `post_train_ai` — 34 (59 words)
- `post_lisbon_ai` — 35 (62 words)
- `post_berlin_ai` — 35 (63 words)
- `post_shipping_ai` — 35 (53 words)
- `post_ramen_ai` — 38 (58 words)
- `cable_ceasefire_ai` — 39 (74 words)
- `post_app_ai` — 43 (52 words)
- `cable_dredging_ai` — 46 (80 words)
