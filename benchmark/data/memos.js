// Internal memo pairs: human staff analysis vs model-style policy prose.
module.exports = [
  {
    id: "memo_insurance",
    human: `The underwriting group has raised premiums on Kestria-flagged tankers by 18 percent since March. Two brokers now refuse cover for port calls in Dunmar. We have six charters booked through July; three would be exposed. Legal says the contracts allow renegotiation only on safety grounds. I recommend we ask the brokers for a written risk note before the 20 May renewal.`,
    ai: `The underwriting group has increased premiums on Kestria-flagged tankers by 18 percent since March. Two brokers now decline cover for port calls in Dunmar. Six charters are booked through July, of which three would be exposed. Legal advises that the contracts permit renegotiation only on safety grounds. I recommend requesting a written risk note from the brokers before the 20 May renewal.`,
  },
  {
    id: "memo_licenses",
    human: `The licensing backlog stands at 214 applications, up from 87 in January. Most are routine dual-use items; 19 need interagency review. Average processing time is 46 days against a 30-day target. Two staff are on detail until June. Recommend triage: clear the 195 routine files now and assign the 19 complex ones to a single reviewer.`,
    ai: `The licensing backlog has reached 214 applications, up from 87 in January. Most concern routine dual-use items, while 19 require interagency review. Average processing time is 46 days against a 30-day target. Two staff members are on detail until June. A triage approach is recommended: clear the 195 routine files now and assign the 19 complex cases to a single reviewer.`,
  },
  {
    id: "memo_rotation",
    human: `Three officers rotate out of the political section in July. We have no replacements listed for two of the three positions. The front office wants coverage through the August recess. I can cover the desk temporarily, but not the reporting trips. Recommend we request one temporary assignment from the regional bureau and delay the third rotation to September.`,
    ai: `Three officers will rotate out of the political section in July. No replacements have been identified for two of the three positions. The front office requires coverage through the August recess. I can cover the desk temporarily, but not the reporting trips. I recommend requesting one temporary assignment from the regional bureau and delaying the third rotation until September.`,
  },
  {
    id: "memo_hostnation",
    human: `The host nation agreement expires 31 December. Talks have not started. The other side wants to link renewal to the transit fee, which we have refused for two years. Without an agreement our customs exemption lapses and vehicle registration stops. Recommend opening technical talks in June, separating the fee from the renewal, and keeping the current text as the baseline.`,
    ai: `The host nation agreement expires on 31 December, and talks have not yet begun. The counterpart wants to link renewal to the transit fee, which we have refused for two years. Without an agreement, our customs exemption will lapse and vehicle registration will stop. I recommend opening technical talks in June, separating the fee from renewal, and using the current text as the baseline.`,
  },
  {
    id: "memo_cyber",
    human: `The intrusion detected on 4 April reached the mail server but not the case management system. Forensics attributes it to a credential phishing campaign; no indication of a state actor. We reset 62 accounts and enabled hardware tokens for the executive floor. The vendor's report is due 15 May. Recommend we notify the host government only after the report, and prepare a short press line.`,
    ai: `The intrusion detected on 4 April reached the mail server but not the case management system. Forensics attributes it to a credential phishing campaign, with no indication of a state actor. We reset 62 accounts and enabled hardware tokens for the executive floor. The vendor's report is due on 15 May. I recommend notifying the host government only after the report and preparing a short press line.`,
  },
  {
    id: "memo_cultural",
    human: `Customs intercepted 14 objects at the northern border on 22 March, including three coins and a stone relief. The dealer claims provenance from a 1974 private collection but has provided only a photocopy. The museum in Velsa has offered to store the pieces. Legal says the case turns on the export permit. Recommend we ask the dealer for the original documents within 30 days.`,
    ai: `Customs intercepted 14 objects at the northern border on 22 March, including three coins and a stone relief. The dealer claims provenance from a 1974 private collection but has provided only a photocopy. The museum in Velsa has offered to store the pieces. Legal advises that the case turns on the export permit. I recommend requesting the original documents from the dealer within 30 days.`,
  },
  {
    id: "memo_visas",
    human: `Kestria now charges our citizens $160 for a tourist visa, up from $80. Their applicants pay $185 here. The new fee took effect 1 April without notice. Two universities report cancelled exchanges. Options: match the fee, suspend the visa facilitation talks, or raise it at the consular commission. I recommend matching and raising it at the commission in June.`,
    ai: `Kestria now charges our citizens $160 for a tourist visa, up from $80, while their applicants pay $185 here. The new fee took effect on 1 April without prior notice. Two universities report cancelled exchanges. The options are to match the fee, suspend the visa facilitation talks, or raise the matter at the consular commission. I recommend matching the fee and raising it at the commission in June.`,
  },
  {
    id: "memo_airspace",
    human: `The closure of Kestria's eastern airspace adds 47 minutes and about $8,400 per flight on the Velsa-Dunmar route. We have 12 flights a week. The carrier says it will absorb the cost until June, then surcharge. Cargo is unaffected so far. Recommend we ask the civil aviation authority for a written estimate and revisit the route in May.`,
    ai: `The closure of Kestria's eastern airspace adds 47 minutes and approximately $8,400 per flight on the Velsa-Dunmar route. We operate 12 flights per week. The carrier states that it will absorb the cost until June and then apply a surcharge. Cargo remains unaffected so far. I recommend requesting a written estimate from the civil aviation authority and revisiting the route in May.`,
  },
  {
    id: "memo_training",
    human: `Only 38 of 120 staff have completed the revised sanctions module. The deadline was 30 April. Compliance says the module takes 90 minutes and the portal times out on older laptops. Two sections have asked for an in-person session. Recommend extending the deadline to 31 May, fixing the portal, and running two sessions in the annex.`,
    ai: `Only 38 of 120 staff have completed the revised sanctions module, against a deadline of 30 April. Compliance notes that the module takes 90 minutes and that the portal times out on older laptops. Two sections have requested an in-person session. I recommend extending the deadline to 31 May, fixing the portal, and running two sessions in the annex.`,
  },
  {
    id: "memo_crisis",
    human: `The draft crisis plan assumes a single spokesperson and a 24-hour approval chain. Neither held during the February exercise: approvals took 31 hours and three people spoke to the press. The plan also has no line for social media. Recommend naming two spokespeople, cutting approval to four hours, and adding a social media annex before the next exercise in September.`,
    ai: `The draft crisis plan assumes a single spokesperson and a 24-hour approval chain. Neither assumption held during the February exercise: approvals took 31 hours, and three people spoke to the press. The plan also lacks a social media line. I recommend naming two spokespeople, reducing approval to four hours, and adding a social media annex before the next exercise in September.`,
  },
];
