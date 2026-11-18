/* ═══════════════════════════════════════════════════════════════════
   AI DETECTOR — heuristic stylometry engine
   Reads the traces machine-generated prose tends to leave behind.
   No network. No model. Deterministic scoring, fully inspectable.
   ═══════════════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";

  /* ── lexicons ─────────────────────────────────────────────────── */

  // Strong tells: vocabulary over-represented in LLM output.
  const AI_WORDS = [
    "delve", "delves", "delved", "delving", "tapestry", "testament", "realm", "realms",
    "leverage", "leverages", "leveraged", "leveraging", "seamless", "seamlessly", "seamlessness",
    "pivotal", "multifaceted", "nuanced", "nuance", "intricate", "intricacies", "intricately",
    "myriad", "plethora", "underscore", "underscores", "underscored", "underscoring",
    "embark", "embarking", "elevate", "elevates", "elevated", "elevating",
    "unlock", "unlocks", "unlocking", "reimagine", "revolutionize", "revolutionizing",
    "revolutionary", "game-changer", "cutting-edge", "holistic", "synergy", "synergies",
    "paradigm", "curated", "bespoke", "meticulous", "meticulously", "invaluable",
    "unparalleled", "streamline", "streamlining", "utilize", "utilizing", "cornerstone",
    "interplay", "captivate", "captivating", "unwavering", "boasts", "boasting", "nestled",
    "showcases", "showcasing", "harmonize", "harmonious", "juxtaposition", "dichotomy",
    "cacophony", "transcend", "transcends", "traverse", "resonate", "resonates", "resonating",
    "tangible", "actionable", "impactful", "enchanting", "ethereal", "mesmerizing",
    "spellbinding", "shimmering", "cascading", "whimsical", "breathtaking", "bustling",
    "tranquil", "lush", "unforgettable"
  ];

  // Soft tells: ordinary words that pile up in machine prose.
  const SOFT_WORDS = [
    "significant", "significantly", "important", "importantly", "various", "numerous",
    "ensure", "ensuring", "effective", "efficient", "efficiency", "essential",
    "fundamental", "fundamentally", "relevant", "relevance", "approach", "approaches",
    "framework", "perspective", "landscape", "environment", "context", "potential",
    "potentially", "insight", "insights", "explore", "exploring", "diversity",
    "dynamic", "complex", "complexity", "align", "aligned", "alignment", "enhance",
    "enhancing", "enhancement", "implement", "implementing", "implementation",
    "sustainable", "accessible", "engagement", "solutions", "storytelling", "growing",
    "provide", "providing", "support", "supporting", "overall", "value", "quality",
    "strategic", "practical", "unique", "powerful", "creative",
    // formal register that human policy writing also uses: low weight by design
    "moreover", "furthermore", "additionally", "consequently", "ultimately", "nonetheless",
    "thereby", "whilst", "notably", "thus", "comprehensive", "comprehensively", "crucial",
    "crucially", "vital", "foster", "fosters", "fostered", "fostering", "harness",
    "harnesses", "harnessing", "empower", "empowers", "empowering", "facilitate",
    "facilitating", "navigate", "navigating", "navigates", "endeavor", "endeavors",
    "transformative", "resilience", "resilient", "optimize", "optimizing", "innovative",
    "vibrant", "profound", "fascinating"
  ];

  // Stock phrases: the scaffolding of generated prose.
  const STOCK_PHRASES = [
    "it's important to note", "it is important to note", "it's worth noting", "it is worth noting",
    "in today's fast-paced world", "in today's world", "in the modern world",
    "in an increasingly interconnected world",
    "in the ever-evolving", "ever-evolving landscape",
    "plays a crucial role", "plays a significant role", "plays a vital role",
    "plays an important role", "a double-edged sword", "the key takeaway", "in conclusion",
    "to sum up", "at the end of the day", "delve into", "dive into", "in the realm of",
    "a testament to", "navigating the landscape", "unlock the potential",
    "unlock the full potential", "seamlessly integrate", "cannot be overstated",
    "it goes without saying", "a myriad of", "a plethora of", "rich tapestry",
    "strike a balance", "push the boundaries", "first and foremost", "last but not least",
    "rest assured", "look no further", "the perfect blend", "let's explore", "here are some",
    "if you're looking for", "whether you're a", "in this article", "in this guide",
    "it depends on a variety of factors", "by leveraging", "as we can see",
    "shed light on", "pave the way", "broaden your horizons", "serves as a reminder",
    "navigate the complexities", "underscores the importance",
    // narrative scaffolding
    "little did", "from that day on", "never looked back",
    // announcement / personal-brand register
    "thrilled to share", "excited to share", "humbled to announce", "humbled to share",
    "i've had the privilege", "lessons i've learned", "lessons i'll carry",
    "grateful for the journey", "here are three", "growth happens outside",
    // assistant register
    "let me know if you'd like", "let me know if you need", "would you like me to",
    "here's a quick breakdown", "here's a quick", "hope this helps", "happy to help",
    "it's never been easier", "let's break it down",
    "the air was thick", "a world where", "unknown lands", "firmly believed",
    "endless imagination", "true adventure", "plays of light", "the distant voice"
  ];

  // Assistant-register scaffolding: near-exclusive to chat-model output, unlike
  // "in conclusion" or "hope this helps", which humans also write.
  const ASSISTANT_RE = /^(here's a quick|let me know if you|would you like me to|let's break it down)/i;

  const INFORMAL = [
    "lol", "lmao", "lmfao", "rofl", "tbh", "ngl", "imo", "imho", "idk", "idc",
    "bruh", "bro", "dude", "yeah", "yep", "nah", "nope", "kinda", "sorta", "gonna",
    "wanna", "gotta", "dunno", "wtf", "omg", "ugh", "meh", "haha", "heh", "yo",
    "sup", "chill", "rip", "fr", "sus", "cringe", "damn", "crap",
    "anyways", "welp", "hmm", "eh", "nvm", "btw", "tbf", "afaik", "smh", "irl",
    "just", "really", "actually", "maybe", "probably", "honestly", "literally",
    "basically", "totally"
  ];

  const COMMON = ("the be to of and a in that have i it for not on with he as you do at this but his by from " +
    "they we say her she or an will my one all would there their what so up out if about who get which go me " +
    "when make can like time no just him know take people into year your good some could them see other than " +
    "then now look only come its over think also back after use two how our work first well way even new want " +
    "because any these give day most us is are was were been being has had do does did doing very much many " +
    "more really thing things something anything nothing every everything lot bit little big long small right " +
    "still never always again here where why while before through between both each few own same such own " +
    "been being might must shall should may need able going got get gets getting made making").split(" ");

  const COMMON_SET = new Set(COMMON);

  /* ── helpers ──────────────────────────────────────────────────── */

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const norm = (v, lo, hi) => clamp((v - lo) / (hi - lo), 0, 1);
  const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const round = (v) => Math.round(v);

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function wordRe() {
    return /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;
  }

  function countWords(text) {
    const m = text.match(wordRe());
    return m ? m.length : 0;
  }

  // Abbreviations are not sentence ends: without this, "U.S." and "U.K."
  // shatter cables into fragments and distort every rhythm/format metric.
  const ABBREV_RE = /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|St|Rev|Gen|Col|Lt|Sgt|Capt|Cmdr|Amb|Sec|Dept|Gov|Sen|Rep|No|Vol|vs|etc|Inc|Co|Corp|Ltd|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec|Art|Sect|Ave|Blvd|Rd)\./gi;
  const DOT = "\u0001";

  function protectAbbrev(text) {
    return text
      .replace(/\b(?:[A-Za-z]\.){2,}/g, (m) => m.split(".").join(DOT))
      .replace(ABBREV_RE, (m) => m.slice(0, -1) + DOT)
      .replace(/\b([A-Z])\.(?=\s)/g, "$1" + DOT);
  }

  function splitSentences(text) {
    return protectAbbrev(text)
      .split(/(?<=[.!?…])["'”’)]*\s+|\n+/)
      .map((s) => s.trim().split(DOT).join("."))
      .filter((s) => s && /[\p{L}\p{N}]/u.test(s));
  }

  function findAll(text, re) {
    const out = [];
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      out.push({ phrase: m[0].toLowerCase(), index: m.index, end: m.index + m[0].length });
      if (m.index === re.lastIndex) re.lastIndex++;
    }
    return out;
  }

  const buildWordRe = (words) =>
    new RegExp("\\b(?:" + Array.from(new Set(words)).sort((a, b) => b.length - a.length).map(escRe).join("|") + ")\\b", "gi");

  const buildPhraseRe = (phrases) =>
    new RegExp("\\b(?:" + Array.from(new Set(phrases)).sort((a, b) => b.length - a.length).map(escRe).join("|") + ")\\b", "gi");

  const AI_RE = buildWordRe(AI_WORDS);
  const SOFT_RE = buildWordRe(SOFT_WORDS);
  const STOCK_RE = buildPhraseRe(STOCK_PHRASES);
  const INFORMAL_RE = buildWordRe(INFORMAL);

  const CONTRACTION_RE = /['’](s|t|re|ve|ll|d|m)\b/gi;
  const EMDASH_RE = /[—]/g;
  const ENDASH_RE = /[–]/g;
  const CURLY_RE = /[“”‘’]/g;
  const ELLIPSIS_RE = /…/g;
  const EMOJI_RE = (() => {
    try { return /\p{Extended_Pictographic}/gu; } catch (e) { return /([\u{1F300}-\u{1FAFF}])/gu; }
  })();
  const REPEAT_PUNCT_RE = /(\.{3,}|!{2,}|\?{2,}|!{1,}\?{1,})/g;
  const BULLET_RE = /^[ \t]*[-*•–][ \t]+/gm;
  const NUMBERED_RE = /(?:^|\n)[ \t]*(?:\d+[.)]|\d\))[ \t]+/g;
  const BOLD_RE = /\*\*[^*\n]+\*\*/g;
  const HEADER_RE = /^[ \t]*#{1,6}[ \t]+/gm;

  /* ── measurement ──────────────────────────────────────────────── */

  function measure(text) {
    const chars = text.length;
    const words = countWords(text);
    const sents = splitSentences(text);
    const lens = sents.map(countWords).filter((n) => n > 0);
    const paragraphs = text.split(/\n\s*\n|\n/).filter((p) => /\p{L}/u.test(p));

    const avgSent = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
    const variance = lens.length
      ? lens.reduce((a, n) => a + Math.pow(n - avgSent, 2), 0) / lens.length
      : 0;
    const sdSent = Math.sqrt(variance);
    const burstiness = avgSent ? sdSent / avgSent : 0;

    const rawTokens = text.match(wordRe()) || [];
    const tokens = rawTokens.map((w) => w.toLowerCase());
    const ttrWindow = Math.min(tokens.length, 120);
    const ttr = ttrWindow ? new Set(tokens.slice(0, ttrWindow)).size / ttrWindow : 0;
    // share of high-frequency English function words — also a language sanity check.
    // Acronyms and numbers are excluded: a cable full of NATO, EU and FOB tokens
    // is still English, and counting them as words understates the ratio.
    const langTokens = rawTokens.filter((t) => !/^[A-Z]{2,}$/.test(t) && !/\d/.test(t));
    const englishRatio = langTokens.length
      ? langTokens.filter((w) => COMMON_SET.has(w.toLowerCase())).length / langTokens.length
      : 0;

    const aiHits = findAll(text, AI_RE);
    const softHits = findAll(text, SOFT_RE);
    const stockHits = findAll(text, STOCK_RE);
    const informalHits = findAll(text, INFORMAL_RE);
    const contractions = findAll(text, CONTRACTION_RE);
    const emDash = findAll(text, EMDASH_RE).length;
    const enDash = findAll(text, ENDASH_RE).length;
    const curly = findAll(text, CURLY_RE).length;
    const ellipsis = findAll(text, ELLIPSIS_RE).length;
    const emoji = findAll(text, EMOJI_RE).length;
    const repeated = findAll(text, REPEAT_PUNCT_RE).length;
    const bullets = findAll(text, BULLET_RE).length;
    const numbered = findAll(text, NUMBERED_RE).length;
    const bold = findAll(text, BOLD_RE).length;
    const headers = findAll(text, HEADER_RE).length;
    const exclaim = (text.match(/!/g) || []).length;
    const question = (text.match(/\?/g) || []).length;
    const firstPerson = (text.match(/\b(I|I'm|I've|I'd|I'll|my|me|mine|we|our)\b/g) || []).length;

    // mechanical polish: capitals, terminal punctuation, comma rhythm
    const commas = (text.match(/,/g) || []).length;
    const capsStart = sents.filter((s) => /^["“'('\-\s]*[\p{Lu}\p{N}]/u.test(s)).length;
    const terminal = sents.filter((s) => /[.!?…]["'”’)\]]*$/.test(s.trim())).length;

    // concrete anchors: numbers and proper nouns that could be checked
    let proper = 0;
    sents.forEach((s) => {
      s.split(/\s+/).slice(1).forEach((tok) => {
        const clean = tok.replace(/^["“'('\[]+/, "").replace(/[^\p{L}]/gu, "");
        if (/^\p{Lu}[\p{Ll}]{2,}$/u.test(clean) && !COMMON_SET.has(clean.toLowerCase())) proper++;
      });
    });
    const digits = (text.match(/\b\d[\d.,]*\b/g) || []).length;
    // acronyms are checkable specifics too (NATO, EU, U.S.); count distinct ones
    const acronyms = new Set();
    (text.match(/\b[A-Z]{2,6}\b/g) || []).forEach((a) => { if (a !== "AI") acronyms.add(a); });
    (text.match(/\b(?:[A-Z]\.){2,6}/g) || []).forEach((a) => acronyms.add(a.split(".").join("")));
    const anchors = proper + digits + Math.min(acronyms.size, 4);

    const paragraphLens = paragraphs.map(countWords).filter((n) => n > 0);
    const pAvg = paragraphLens.length ? paragraphLens.reduce((a, b) => a + b, 0) / paragraphLens.length : 0;
    const pSd = paragraphLens.length > 1
      ? Math.sqrt(paragraphLens.reduce((a, n) => a + Math.pow(n - pAvg, 2), 0) / paragraphLens.length)
      : 0;

    const per100 = (n) => (words ? (n / words) * 100 : 0);
    const per1k = (n) => (chars ? (n / chars) * 1000 : 0);

    return {
      chars, words, sentences: sents.length, paragraphs: paragraphs.length,
      avgSent, sdSent, burstiness, lens,
      ttr, englishRatio, english: englishRatio >= (words >= 40 ? 0.16 : 0.08),
      aiHits, softHits, stockHits, informalHits, contractions,
      emDash, enDash, curly, ellipsis, emoji, repeated,
      bullets, numbered, bold, headers, exclaim, question, firstPerson,
      paragraphSymmetry: pAvg ? pSd / pAvg : 0,
      aiPer100: per100(aiHits.length),
      softPer100: per100(softHits.length),
      stockPer100: per100(stockHits.length),
      informalPer100: per100(informalHits.length + repeated),
      contractionPer100: per100(contractions.length),
      emDashPer1k: per1k(emDash + enDash),
      firstPersonPer100: per100(firstPerson),
      commas, capsStartRatio: sents.length ? capsStart / sents.length : 0,
      terminalRatio: sents.length ? terminal / sents.length : 0,
      commaPerSentence: sents.length ? commas / sents.length : 0,
      anchors,
      anchorPer100: per100(anchors),
      tokens
    };
  }

  /* ── signal definitions ───────────────────────────────────────── */

  const WEIGHTS = {
    chat:   { lexicon: 20, stock: 18, rhythm: 22, anchor: 8, format: 12, voice: 18, baseline: 8 },
    forum:  { lexicon: 22, stock: 18, rhythm: 20, anchor: 8, format: 12, voice: 12, baseline: 8 },
    formal: { lexicon: 26, stock: 20, rhythm: 12, anchor: 18, format: 10, voice: 4,  baseline: 4 }
  };

  function topPhrases(hits, n) {
    const counts = new Map();
    hits.forEach((h) => counts.set(h.phrase, (counts.get(h.phrase) || 0) + 1));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, n).map(([p]) => p);
  }

  const q = (s) => "“" + s + "”";

  function buildSignals(m, opts) {
    const w = WEIGHTS[opts.context] || WEIGHTS.chat;
    const out = [];

    /* 1 — AI lexicon */
    {
      const dens = m.aiPer100 + m.softPer100 * 0.22;
      let susp = norm(dens, 0.15, 3.4);
      if (m.words < 30) susp = 0.5 + (susp - 0.5) * 0.5;
      const samples = topPhrases(m.aiHits.concat(m.softHits), 3);
      out.push({
        id: "lexicon", label: "AI LEXICON",
        value: round(susp * 100), weight: w.lexicon, susp,
        note: samples.length
          ? `${m.aiHits.length + m.softHits.length} flagged terms across ${m.words} words (${dens.toFixed(1)} per 100). Loaded words: ${samples.map(q).join(", ")}. Machine prose gravitates to this register; casual human writing usually does not.`
          : `No dictionary hits. Nothing like “delve”, “leverage” or “robust” appears in the sample.`
      });
    }

    /* 2 — stock phrases */
    {
      // saturation at ~4 templates per 100 words: two stock phrases in a
      // 90-word essay is ordinary student prose, not a machine signature
      const base = norm(m.stockPer100, 0.2, 4.0);
      let susp = m.words < 25 ? 0.5 + (base - 0.5) * 0.5 : base;
      if (m.stockHits.some((h) => ASSISTANT_RE.test(h.phrase))) susp = 1;
      const samples = topPhrases(m.stockHits, 3);
      out.push({
        id: "stock", label: "STOCK PHRASES",
        value: round(susp * 100), weight: w.stock, susp,
        note: m.stockHits.length
          ? `${m.stockHits.length} discourse template${m.stockHits.length === 1 ? "" : "s"} detected: ${samples.map(q).join(", ")}. These are whole phrases lifted from the instruction-tuned register, not just single words.`
          : `No stock scaffolding detected. The sample does not lean on “it's important to note”, “in conclusion” or similar hinges.`
      });
    }

    /* 3 — rhythm / burstiness */
    {
      const enough = m.sentences >= 4;
      let susp = enough ? norm(0.92 - m.burstiness, 0, 0.62) : 0.4;
      // list items force short, uniform lines: that is the format, not a machine.
      // Only grant the relief when the text also carries human texture, so an
      // AI list does not lose its rhythm evidence just because it has bullets.
      const humanTexture = m.informalHits.length + m.contractions.length + Math.min(m.firstPerson, 4) >= 3;
      const listed = m.bullets + m.numbered >= 3 && humanTexture;
      if (listed) susp = Math.min(susp, 0.6);
      const detail = enough
        ? `${m.sentences} sentences, mean ${m.avgSent.toFixed(1)} words, spread ±${m.sdSent.toFixed(1)} (burstiness ${m.burstiness.toFixed(2)}). Humans are lumpy: fragments, then a long run-on. Generated text keeps an even tempo.`
          + (listed ? ` List formatting with human voice caps this row at 60: bullets impose uniform line lengths.` : "")
        : `Only ${m.sentences} sentence${m.sentences === 1 ? "" : "s"} — rhythm cannot be measured. Treat this row as inconclusive.`;
      out.push({
        id: "rhythm",
        label: enough ? "SENTENCE RHYTHM" : "SENTENCE RHYTHM (LOW N)",
        value: round(susp * 100), weight: enough ? w.rhythm : w.rhythm * 0.5, susp,
        note: detail
      });
    }

    /* 4 — concrete anchors (corroborating only) */
    {
      // capped: a text with no numbers is not proof of anything on its own.
      // Keeping the weight but lowering the ceiling avoids shifting weight onto
      // documents that already carry plenty of anchors.
      const susp = clamp(1 - norm(m.anchorPer100, 0.5, 4.0), 0, 1) * 0.45;
      out.push({
        id: "anchor", label: "CONCRETE ANCHORS",
        value: round(susp * 100), weight: w.anchor, susp,
        note: `${m.anchors} hard reference${m.anchors === 1 ? "" : "s"} in ${m.words} words (${m.anchorPer100.toFixed(1)} per 100): numbers, dates, names, checkable detail. Capped at 45 — an absence of specifics corroborates, it never decides alone.`
      });
    }

    /* 5 — formatting: typography and mechanical polish */
    {
      const em = norm(m.emDashPer1k, 0.05, 1.7);
      const typographic = m.curly > 0 || m.ellipsis > 0 ? 0.65 : 0;
      const markdown = norm(m.bold * 2 + m.headers + m.bullets * 0.5 + m.numbered * 0.7, 0, 3);
      const symmetry = m.sentences >= 4 ? norm(0.85 - m.paragraphSymmetry, 0, 0.62) * 0.6 : 0;

      let polish = clamp(
        norm(m.capsStartRatio, 0.5, 1) * 0.42 +
        norm(m.terminalRatio, 0.6, 1) * 0.28 +
        norm(m.commaPerSentence, 0.35, 2.3) * 0.3,
        0, 1
      );
      if (opts.context === "formal") polish = 0.5 + (polish - 0.5) * 0.35;

      const susp = clamp(
        em * 0.26 + typographic * 0.1 + markdown * 0.2 + symmetry * 0.14 + polish * 0.38,
        0, 1
      );
      const bits = [];
      if (m.emDash + m.enDash) bits.push(`${m.emDash + m.enDash} em/en dash${m.emDash + m.enDash === 1 ? "" : "es"}`);
      if (m.curly) bits.push(`${m.curly} curly quote${m.curly === 1 ? "" : "s"}`);
      if (m.bold + m.headers) bits.push(`${m.bold + m.headers} markdown emphasis`);
      if (m.bullets + m.numbered) bits.push(`${m.bullets + m.numbered} list marker${m.bullets + m.numbered === 1 ? "" : "s"}`);
      if (m.emoji) bits.push(`${m.emoji} emoji`);
      if (m.sentences >= 3 && m.capsStartRatio >= 0.95 && m.terminalRatio >= 0.95) {
        bits.push("every sentence capitalised and closed");
      }
      out.push({
        id: "format", label: "FORMATTING TELLS",
        value: round(susp * 100), weight: w.format, susp,
        note: bits.length
          ? `Surface shape: ${bits.join(", ")}. ${Math.round(m.capsStartRatio * 100)}% of sentences open with a capital and ${m.commaPerSentence.toFixed(1)} commas per sentence — live typing leaves ragged edges.`
          : `Plain ASCII, no markdown, uneven mechanics. This row contributes nothing.`
      });
    }

    /* 6 — human voice */
    {
      // density plus absolute counts: long-form human writing dilutes per-100 rates
      const humanMarks =
        m.informalPer100 * 1.1 +
        m.contractionPer100 * 0.7 +
        m.firstPersonPer100 * 0.35 +
        Math.min(m.informalHits.length, 5) * 0.3 +
        Math.min(m.contractions.length, 4) * 0.35 +
        (m.exclaim ? Math.min(m.exclaim, 6) : 0) * 0.35;
      let susp = clamp(1 - norm(humanMarks, 0.4, 7), 0, 1);
      if (opts.context === "formal") susp = 0.5 + (susp - 0.5) * 0.4;
      const bits = [];
      if (m.informalHits.length) bits.push(`${m.informalHits.length} slang/casual markers`);
      if (m.contractions.length) bits.push(`${m.contractions.length} contractions`);
      if (m.firstPerson) bits.push(`${m.firstPerson} first-person references`);
      out.push({
        id: "voice", label: "HUMAN VOICE",
        value: round(susp * 100), weight: w.voice, susp,
        note: bits.length
          ? `Some lived-in texture: ${bits.join(", ")}. A sample with no contractions, no first person and no slang reads like output holding a neutral register.`
          : `Zero contractions, zero first person, zero slang. A human writing casually almost always leaves one of those behind — but check the context selector before weighting this heavily.`
      });
    }

    /* 6 — baseline divergence (optional) */
    if (m._baseline) {
      const b = m._baseline;
      const rows = [
        ["sentence length", Math.abs(m.avgSent - b.avgSent) / Math.max(7, b.avgSent), 1.0],
        ["rhythm", Math.abs(m.burstiness - b.burstiness) / Math.max(0.22, b.burstiness), 1.2],
        ["lexical range", Math.abs(m.ttr - b.ttr) / Math.max(0.16, b.ttr), 0.8],
        ["em dash rate", Math.abs(m.emDashPer1k - b.emDashPer1k) / Math.max(0.4, b.emDashPer1k + 0.4), 1.1],
        ["AI lexicon", Math.abs(m.aiPer100 - b.aiPer100) / Math.max(0.9, b.aiPer100 + 0.9), 1.5],
        ["contractions", Math.abs(m.contractionPer100 - b.contractionPer100) / Math.max(0.5, b.contractionPer100 + 0.5), 0.7],
        ["informality", Math.abs(m.informalPer100 - b.informalPer100) / Math.max(1, b.informalPer100 + 1), 0.7]
      ];
      const wsum = rows.reduce((a, r) => a + r[2], 0);
      const diverg = rows.reduce((a, r) => a + clamp(r[1], 0, 2) / 2 * r[2], 0) / wsum;
      const worst = rows.slice().sort((a, b2) => b2[1] - a[1]).slice(0, 2)
        .map((r) => r[0]).join(" and ");
      out.push({
        id: "baseline", label: "BASELINE DIVERGENCE",
        value: round(diverg * 100), weight: w.baseline, susp: clamp(diverg, 0, 1),
        note: `Voice match ${Math.round((1 - diverg) * 100)}% against the supplied human baseline. Widest drift: ${worst}. Small drift is normal between contexts; a wholesale register change deserves a second sample.`
      });
      m.voiceMatch = Math.round((1 - diverg) * 100);
    }

    return out;
  }

  /* ── follow-up script ─────────────────────────────────────────── */

  function buildFollowUps(m, signals, score) {
    const by = (id) => signals.find((s) => s.id === id);
    const list = [];
    const aiSample = topPhrases(m.aiHits, 2);
    const stockSample = topPhrases(m.stockHits, 1);

    if (stockSample.length) {
      list.push(`Ask them to restate ${q(stockSample[0])} in their own words, without the phrase. Lifted scaffolding collapses under paraphrase.`);
    } else if (aiSample.length) {
      list.push(`Ask what they meant by ${q(aiSample[0])} and for an example. Loaded vocabulary tends to thin out when someone has to explain it.`);
    }

    const rhythm = by("rhythm");
    if (rhythm && rhythm.susp > 0.5) {
      list.push("Ask what they were doing while writing. Even pacing usually means a composed draft, not live typing — people type in bursts and correct themselves.");
    }

    const format = by("format");
    if (format && format.susp > 0.45) {
      list.push("Have them retype the message live, plain text, no formatting. Em dashes and curly quotes rarely survive a phone keyboard.");
    }

    const anchor = by("anchor");
    if ((anchor && anchor.susp > 0.5) || (by("voice") && by("voice").susp > 0.55)) {
      list.push("Ask for one concrete detail — a name, a date, a price, an address. Machine prose stays general; lived accounts leak specifics.");
    }

    if (m._baselineSince && m.voiceMatch !== undefined) {
      list.push(`Run a second message in the same channel: their baseline averages ${m._baseline.avgSent.toFixed(1)} words per sentence against ${m.avgSent.toFixed(1)} here. A stable voice across both samples weakens the read.`);
    } else if (m.words > 40) {
      list.push("Request a fresh message on an unrelated topic. A single sample can be a lucky impersonation; a consistent register across two is the tell.");
    }

    if (score >= 60) {
      list.push("Before escalating: ask a follow-up that quotes their own last five words back. Human authors track the thread; pasted output rarely does.");
    } else if (score < 30) {
      list.push("No strong trace. Don't escalate on this sample alone — confirm the register matches what you already know about them.");
    } else {
      list.push("Inconclusive. Screen one more sample and compare the two before you act on this.");
    }

    return list.slice(0, 5);
  }

  /* ── highlighting ─────────────────────────────────────────────── */

  function collectRanges(text, m) {
    const ranges = [];
    m.aiHits.forEach((h) => ranges.push({ start: h.index, end: h.end, type: "solid" }));
    m.softHits.forEach((h) => ranges.push({ start: h.index, end: h.end, type: "dotted" }));
    m.stockHits.forEach((h) => ranges.push({ start: h.index, end: h.end, type: "dashed" }));
    findAll(text, EMDASH_RE).concat(findAll(text, ENDASH_RE), findAll(text, CURLY_RE), findAll(text, ELLIPSIS_RE))
      .forEach((h) => ranges.push({ start: h.index, end: h.end, type: "wavy" }));

    ranges.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const merged = [];
    let lastEnd = -1;
    ranges.forEach((r) => {
      if (r.start >= lastEnd) {
        merged.push(r);
        lastEnd = r.end;
      }
    });
    return merged;
  }

  function highlight(text, m) {
    if (!text.trim()) return '<p class="empty-note">Pick a dossier above to load the sample.</p>';
    const ranges = collectRanges(text, m);
    let html = "";
    let cursor = 0;
    ranges.forEach((r) => {
      if (r.start > cursor) html += escapeHtml(text.slice(cursor, r.start));
      html += '<mark class="' + r.type + '">' + escapeHtml(text.slice(r.start, r.end)) + "</mark>";
      cursor = r.end;
    });
    html += escapeHtml(text.slice(cursor));

    // count rendered marks, not raw hits: overlapping ranges merge into one mark
    const count = (type) => ranges.filter((r) => r.type === type).length;
    const tally = [
      ["solid", "AI-typical", count("solid")],
      ["dotted", "soft", count("dotted")],
      ["dashed", "stock", count("dashed")],
      ["wavy", "typographic", count("wavy")]
    ].filter((t) => t[2] > 0).map((t) => `${t[2]} ${t[1]}`);

    html += '<span class="anom-tally">' +
      (tally.length ? tally.join(" · ") : "no anomalies marked") + "</span>";
    return html;
  }

  /* ── verdict ──────────────────────────────────────────────────── */

  const BANDS = [
    { max: 29, key: "cool",  main: "NO MACHINE TRACE", sub: "HUMAN-ORIGIN LIKELY", band: "LOW",    state: "cool" },
    { max: 59, key: "mid",   main: "PARTIAL TRACE",     sub: "READ CLOSELY",      band: "MEDIUM", state: "mid" },
    { max: 100, key: "hot",  main: "MACHINE-ORIGIN",    sub: "VERIFY IN PERSON",  band: "HIGH",   state: "hot" }
  ];

  function verdictFor(score) {
    return BANDS.find((b) => score <= b.max) || BANDS[BANDS.length - 1];
  }

  /* ── analyse ──────────────────────────────────────────────────── */

  function analyze(text, opts) {
    opts = opts || {};
    const context = opts.context || "chat";
    const m = measure(text || "");

    // nothing to read: do not invent a score
    if (m.words === 0) {
      return {
        score: 0, english: false, band: "LOW", verdict: verdictFor(0),
        signals: [], topSignals: [], anomalies: [], metrics: m, words: 0,
        lowConfidence: true, insufficient: true, followUps: [],
        highlightHtml: '<p class="empty-note">No sample loaded.</p>',
        meta: { sentences: 0, avgSentence: 0, burstiness: 0, lexicalRange: 0 }
      };
    }

    if (opts.baseline && countWords(opts.baseline) >= 25) {
      m._baseline = measure(opts.baseline);
      m._baselineSince = true;
    }

    const signals = buildSignals(m, { context });
    const totalWeight = signals.reduce((a, s) => a + s.weight, 0);
    let raw = totalWeight
      ? signals.reduce((a, s) => a + s.susp * s.weight, 0) / totalWeight * 100
      : 0;

    const lowN = m.words < 45;
    if (lowN) raw = 50 + (raw - 50) * (m.words < 22 ? 0.28 : 0.55);

    const score = clamp(Math.round(raw), 0, 100);
    let verdict = verdictFor(score);
    // a handful of words cannot support a verdict, whatever the arithmetic says
    if (m.words < 25) {
      verdict = { key: "mid", main: "INSUFFICIENT SAMPLE", sub: "SEND MORE TEXT", band: verdict.band, state: "mid" };
    }

    const topContribution = signals
      .map((s) => ({ s, c: s.susp * s.weight / totalWeight * 100 }))
      .sort((a, b) => b.c - a.c);

    return {
      score,
      english: m.english,
      band: verdict.band,
      verdict,
      signals,
      topSignals: topContribution.slice(0, 3).map((x) => x.s),
      anomalies: collectRanges(text || "", m),
      metrics: m,
      words: m.words,
      lowConfidence: m.words < 60,
      insufficient: m.words < 25,
      followUps: buildFollowUps(m, signals, score),
      highlightHtml: highlight(text || "", m),
      meta: {
        sentences: m.sentences,
        avgSentence: Number(m.avgSent.toFixed(1)),
        burstiness: Number(m.burstiness.toFixed(2)),
        lexicalRange: Number((m.ttr * 100).toFixed(0)),
        voiceMatch: m.voiceMatch
      }
    };
  }

  function titleFor(text) {
    const clean = (text || "").replace(/\s+/g, " ").trim();
    if (!clean) return "Untitled dossier";
    const words = clean.split(" ").slice(0, 7).join(" ");
    return words.length > 52 ? words.slice(0, 52).trim() + "…" : words + (clean.split(" ").length > 7 ? "…" : "");
  }

  const API = { analyze, titleFor, escapeHtml, BANDS, _internals: { measure, buildSignals, WEIGHTS } };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  root.AIDetector = API;
})(typeof window !== "undefined" ? window : globalThis);
