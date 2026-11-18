// Stress set: unpaired documents in the register chat models actually produce
// when asked to "write a cable / memo / news story / forum answer". These are
// deliberately separated from the clean paired set so recall can be reported
// for both conditions instead of averaging them into one misleading number.
module.exports = [
  {
    id: "typical_cable_port",
    register: "cable",
    context: "formal",
    text: `The embassy reports that the port authority has delayed the dredging contract once again, underscoring the importance of sustained engagement on maritime infrastructure. It is important to note that this is the third postponement this year, a pattern that raises significant concerns about the efficiency of local procurement. Two of the three bidders have signalled that they may withdraw, which could have a lasting impact on competition. A comprehensive and coordinated approach is essential. The embassy recommends a demarche at the assistant-secretary level before 15 May, ensuring that our concerns are conveyed clearly and consistently.`,
  },
  {
    id: "typical_cable_ceasefire",
    register: "cable",
    context: "formal",
    text: `The ceasefire monitoring mission continues to navigate a complex and evolving operating environment. It is worth noting that two of the five verification posts remain unstaffed, while the joint commission has convened only once since October. This gap is significant and underscores the need for a more robust verification framework. The defense ministry has delayed nominations for three months, which the embassy assesses as a deliberate strategy. Ultimately, a comprehensive approach that combines diplomatic pressure with technical support will be essential to preserving the credibility of the mission.`,
  },
  {
    id: "typical_memo_insurance",
    register: "memo",
    context: "formal",
    text: `The underwriting group has increased premiums on Kestria-flagged tankers by 18 percent since March, reflecting a broader reassessment of risk in the region. Two brokers now decline cover for port calls in Dunmar, and six charters booked through July would be exposed. Legal advises that the contracts permit renegotiation only on safety grounds. This is a significant constraint. I recommend requesting a written risk note from the brokers before the 20 May renewal and developing a comprehensive contingency plan that aligns with our broader insurance strategy.`,
  },
  {
    id: "typical_memo_licenses",
    register: "memo",
    context: "formal",
    text: `The licensing backlog has reached 214 applications, up from 87 in January, which underscores the importance of process optimization. Most concern routine dual-use items, while 19 require interagency review. Average processing time is 46 days against a 30-day target. Two staff members are on detail until June. A holistic triage approach is essential: clear the 195 routine files now, assign the 19 complex cases to a single reviewer, and leverage existing automation to prevent future backlogs. This will ensure a more efficient and transparent process going forward.`,
  },
  {
    id: "typical_news_mission",
    register: "news",
    context: "formal",
    text: `BRUSSELS — European ministers agreed on Tuesday to extend the monitoring mission for another year, a decision that underscores the bloc's commitment to stability in the region. The extension follows weeks of quiet negotiation and comes despite objections from two member states, which argued that the mandate was too broad. "We have a deal," one diplomat said, "but it is a fragile one." The decision reflects a broader willingness to compromise — and a recognition that the mission remains essential. The extension takes effect in January and runs through the end of 2027.`,
  },
  {
    id: "typical_news_eurobond",
    register: "news",
    context: "formal",
    text: `NAIROBI — Kenya's treasury announced on Tuesday that it will postpone the issuance of a $1.2 billion Eurobond until at least June, citing volatile global rates. The postponement — the second this fiscal year — underscores the pressure facing emerging economies as borrowing costs remain elevated. Finance Minister John Mbadi told parliament that the government would rely on domestic borrowing for the next quarter, a move analysts warned could crowd out private credit. The decision highlights the delicate balance between fiscal needs and market confidence.`,
  },
  {
    id: "typical_post_lisbon",
    register: "post",
    context: "forum",
    text: `Here are three key lessons I learned from moving to Lisbon:\n\n1. Administrative processes take longer than expected, so it is important to plan accordingly.\n2. Landlords typically require a guarantor, and foreign income may not be accepted.\n3. The city is surprisingly walkable, even in the hilly neighborhoods.\n\nOverall, the experience was positive, and I would do it again with better preparation and local legal support. Moving abroad is a transformative experience that challenges you to grow in ways you never expected.`,
  },
  {
    id: "typical_post_ramen",
    register: "post",
    context: "forum",
    text: `I recently tried the new ramen restaurant on 5th Street, and it was a mixed experience. The broth was good, but the ginger was overpowering and masked the other flavors. At $24, the price felt high for a bowl of noodles. My brother ordered the spicy version and found it acceptable. We ended up going to a diner afterward because we were still hungry. Overall, it is worth trying once — but I would recommend asking for less ginger and going with a group so you can share several dishes.`,
  },
];
