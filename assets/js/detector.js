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
    "myriad", "plethora", "foster", "fosters", "fostered", "fostering", "harness", "harnesses",
    "harnessing", "underscore", "underscores", "underscored", "underscoring", "embark",
    "embarking", "elevate", "elevates", "elevated", "elevating", "unlock", "unlocks",
    "unlocking", "reimagine", "revolutionize", "revolutionizing", "revolutionary",
    "game-changer", "cutting-edge", "holistic", "synergy", "synergies", "paradigm",
    "transformative", "empower", "empowers", "empowering", "curated", "bespoke", "vibrant",
    "profound", "meticulous", "meticulously", "comprehensive", "comprehensively",
    "crucial", "crucially", "vital", "notably", "moreover", "furthermore", "additionally",
    "consequently", "ultimately", "nonetheless", "thereby", "whilst", "invaluable",
    "unparalleled", "innovative", "streamline", "streamlining", "optimize", "optimizing",
    "facilitate", "facilitating", "utilize", "utilizing", "cornerstone", "interplay",
    "captivate", "captivating", "unwavering", "boasts", "boasting", "nestled", "showcases",
    "showcasing", "harmonize", "harmonious", "juxtaposition", "dichotomy", "cacophony",
    "transcend", "transcends", "traverse", "navigate", "navigating", "navigates",
    "endeavor", "endeavors", "resonate", "resonates", "resonating", "tangible",
    "actionable", "impactful", "learner", "dive", "endless", "boundless", "testament",
    // narrative register (story-style generations)
    "fascinating", "captivating", "enchanting", "ethereal", "serene", "majestic",
    "breathtaking", "bustling", "whimsical", "tranquil", "lush", "unforgettable",
    "remarkable", "extraordinary", "resilience", "resilient", "wisdom", "wonder",
    "magical", "shimmering", "cascading", "immense", "spellbinding", "mesmerizing",
    // italian register
    "affascinante", "affascinanti", "incantevole", "incantevoli", "maestoso",
    "maestosa", "maestosi", "etereo", "eterea", "vibrante", "vibranti", "olistico",
    "olistica", "sinergia", "paradigma", "trasformativo", "inestimabile",
    "inestimabili", "meticoloso", "meticolosa", "meticolosi", "senza precedenti",
    "di fondamentale importanza"
  ];

  // Soft tells: ordinary words that pile up in machine prose.
  const SOFT_WORDS = [
    "significant", "significantly", "important", "importantly", "various", "numerous",
    "ensure", "ensuring", "effective", "efficient", "efficiency", "essential",
    "fundamental", "fundamentally", "relevant", "relevance", "approach", "approaches",
    "framework", "perspective", "landscape", "environment", "context", "potential",
    "potentially", "insight", "insights", "explore", "exploring", "diverse", "diversity",
    "dynamic", "complex", "complexity", "align", "aligned", "alignment", "enhance",
    "enhancing", "enhancement", "implement", "implementing", "implementation",
    "sustainable", "accessible", "engagement", "solutions", "storytelling", "best",
    "growing", "ensure", "provide", "providing", "support", "supporting", "overall",
    "value", "quality", "strategic", "practical", "unique", "powerful", "creative",
    // generic narrative vocabulary
    "imagination", "passion", "adventure", "discovery", "mystery", "beauty", "magic",
    "dream", "soul", "spirit", "heart", "journey", "wonderful", "curious", "ancient",
    // italian formal vocabulary
    "inoltre", "tuttavia", "pertanto", "fondamentale", "cruciale", "significativo",
    "essenziale", "numerosi", "diverse", "garantire", "fornire", "migliorare",
    "ottimizzare", "sostenibile", "innovativo", "complesso", "dinamico", "contesto",
    "ambito", "prospettiva", "approccio", "processo", "potenziale", "soluzioni",
    "rilevante", "importante", "fondamentali", "curioso", "curiosa", "curiosi",
    "antica", "antico", "antiche", "magico", "magica", "splendido", "splendida",
    "meraviglioso", "meravigliosa", "straordinario", "straordinaria", "notevole",
    "significativi", "importanti", "numerose", "innumerevoli"
  ];

  // Stock phrases: the scaffolding of generated prose.
  const STOCK_PHRASES = [
    "it's important to note", "it is important to note", "it's worth noting",
    "it is worth noting", "in today's fast-paced world", "in today's world",
    "in the modern world", "in the ever-evolving", "ever-evolving landscape",
    "plays a crucial role", "plays a significant role", "plays a vital role",
    "plays an important role", "a double-edged sword", "the key takeaway",
    "in conclusion", "to sum up", "at the end of the day", "not only",
    "dive into", "delve into", "in the realm of", "a testament to",
    "navigating the landscape", "unlock the potential", "unlock the full potential",
    "seamlessly integrate", "when it comes to", "let's explore", "here are some",
    "if you're looking for", "whether you're a", "it depends on a variety of factors",
    "there are several key", "broaden your horizons", "shed light on", "pave the way",
    "a wide range of", "rich tapestry", "strike a balance", "push the boundaries",
    "a myriad of", "a plethora of", "cannot be overstated", "it goes without saying",
    "in this article", "in this guide", "this is where", "rest assured",
    "look no further", "the perfect blend", "a growing number of", "the importance of",
    "serves as a reminder", "serves as a", "this ensures that", "in other words",
    "that said", "having said that", "first and foremost", "last but not least",
    "the world of", "by leveraging", "a key aspect", "the ability to",
    "is essential for", "play a key role", "in order to", "as we can see",
    // narrative scaffolding
    "in the heart of", "a sense of", "couldn't help but", "little did", "from that day on",
    "never looked back", "in that moment", "at that moment", "the air was thick",
    "a world where", "in search of", "the secrets of", "a symbol of", "the essence of",
    "the beauty of", "the power of", "a reminder that", "more than just", "is more than",
    "a journey of", "the journey of", "filled with", "surrounded by", "bathed in",
    "unknown lands", "firmly believed", "always learning", "new things", "endless imagination",
    "true adventure", "plays of light", "the distant voice",
    // italian scaffolding
    "nel cuore di", "un mondo di", "è importante notare", "in conclusione",
    "un'ampia gamma di", "un viaggio attraverso", "la bellezza di", "il potere di",
    "senza dubbio", "in questo senso", "gioca un ruolo", "un ruolo cruciale",
    "la magia di", "terre sconosciute", "senza fine"
  ];

  const INFORMAL = [
    "lol", "lmao", "lmfao", "rofl", "tbh", "ngl", "imo", "imho", "idk", "idc",
    "bruh", "bro", "dude", "yeah", "yep", "nah", "nope", "kinda", "sorta", "gonna",
    "wanna", "gotta", "dunno", "wtf", "omg", "ugh", "meh", "haha", "heh", "yo",
    "sup", "chill", "rip", "fr", "ong", "sus", "cringe", "hell", "damn", "crap",
    "anyways", "welp", "hmm", "eh", "nvm", "btw", "tbf", "afaik", "smh", "irl",
    "just", "really", "actually", "maybe", "probably", "honestly", "literally",
    "basically", "totally", "super", "pretty", "stuff", "sorta", "dunno",
    // italian chat markers
    "tipo", "praticamente", "comunque", "boh", "cioè", "insomma", "vabbè",
    "schifo", "figo", "dai", "mah", "abbastanza", "piuttosto", "proprio",
    "magari", "almeno", "bella", "raga"
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

  function splitSentences(text) {
    return text
      .split(/(?<=[.!?…])["'”’)]*\s+|\n+/)
      .map((s) => s.trim())
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
  const ABSTRACT_RE = /\b[\p{L}]{4,}(?:tion|sion|ment|ity|ness|ance|ence|ization|isation|ism)\b/giu;
  const REPEAT_PUNCT_RE = /(\.{3,}|!{2,}|\?{2,}|!{1,}\?{1,})/g;
  const BULLET_RE = /^[ \t]*[-*•–][ \t]+/gm;
  const NUMBERED_RE = /^[ \t]*\d+[.)][ \t]+/gm;
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

    const tokens = (text.match(wordRe()) || []).map((w) => w.toLowerCase());
    const unique = new Set(tokens);
    const ttrWindow = Math.min(tokens.length, 120);
    const ttr = ttrWindow ? new Set(tokens.slice(0, ttrWindow)).size / ttrWindow : 0;
    const commonRatio = tokens.length
      ? tokens.filter((w) => COMMON_SET.has(w)).length / tokens.length
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
    const abstractWords = findAll(text, ABSTRACT_RE).length;
    const repeated = findAll(text, REPEAT_PUNCT_RE).length;
    const bullets = findAll(text, BULLET_RE).length;
    const numbered = findAll(text, NUMBERED_RE).length;
    const bold = findAll(text, BOLD_RE).length;
    const headers = findAll(text, HEADER_RE).length;
    const exclaim = (text.match(/!/g) || []).length;
    const question = (text.match(/\?/g) || []).length;
    const firstPerson = (text.match(/\b(I|I'm|I've|I'd|I'll|my|me|mine|we|our|io|mio|mia|miei|noi|nostro|nostra|mi)\b/g) || []).length;

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
      ttr, commonRatio, uniqueRatio: tokens.length ? unique.size / tokens.length : 0,
      aiHits, softHits, stockHits, informalHits, contractions,
      emDash, enDash, curly, ellipsis, emoji, abstractWords, repeated,
      bullets, numbered, bold, headers, exclaim, question, firstPerson,
      paragraphSymmetry: pAvg ? pSd / pAvg : 0,
      aiPer100: per100(aiHits.length),
      softPer100: per100(softHits.length),
      stockPer100: per100(stockHits.length),
      informalPer100: per100(informalHits.length + repeated + informalHits.length),
      contractionPer100: per100(contractions.length),
      abstractPer100: per100(abstractWords),
      emDashPer1k: per1k(emDash + enDash),
      firstPersonPer100: per100(firstPerson),
      commas, capsStartRatio: sents.length ? capsStart / sents.length : 0,
      terminalRatio: sents.length ? terminal / sents.length : 0,
      commaPerSentence: sents.length ? commas / sents.length : 0,
      anchors: proper + digits,
      anchorPer100: per100(proper + digits),
      tokens
    };
  }

  /* ── signal definitions ───────────────────────────────────────── */

  const WEIGHTS = {
    chat:   { lexicon: 18, stock: 14, rhythm: 18, anchor: 10, format: 8,  voice: 16, polish: 10, baseline: 8 },
    forum:  { lexicon: 22, stock: 16, rhythm: 16, anchor: 10, format: 10, voice: 10, polish: 8,  baseline: 8 },
    formal: { lexicon: 24, stock: 18, rhythm: 18, anchor: 8,  format: 12, voice: 4,  polish: 6,  baseline: 4 }
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
      const susp = m.words < 25
        ? 0.5 + (norm(m.stockPer100, 0, 2.2) - 0.5) * 0.5
        : norm(m.stockPer100, 0, 2.0);
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
      const detail = enough
        ? `${m.sentences} sentences, mean ${m.avgSent.toFixed(1)} words, spread ±${m.sdSent.toFixed(1)} (burstiness ${m.burstiness.toFixed(2)}). Humans are lumpy: fragments, then a long run-on. Generated text keeps an even tempo.`
        : `Only ${m.sentences} sentence${m.sentences === 1 ? "" : "s"} — rhythm cannot be measured. Treat this row as inconclusive.`;
      out.push({
        id: "rhythm",
        label: enough ? "SENTENCE RHYTHM" : "SENTENCE RHYTHM (LOW N)",
        value: round(susp * 100), weight: enough ? w.rhythm : w.rhythm * 0.5, susp,
        note: detail
      });
    }

    /* 4 — concrete anchors */
    {
      const susp = clamp(1 - norm(m.anchorPer100, 0.5, 4.0), 0, 1);
      out.push({
        id: "anchor", label: "CONCRETE ANCHORS",
        value: round(susp * 100), weight: w.anchor, susp,
        note: `${m.anchors} hard reference${m.anchors === 1 ? "" : "s"} in ${m.words} words (${m.anchorPer100.toFixed(1)} per 100): numbers, dates, names, checkable detail. Generated prose tends to stay general; lived accounts leak specifics you can verify.`
      });
    }

    /* 5 — formatting & typography */
    {
      const em = norm(m.emDashPer1k, 0.05, 1.7);
      const typographic = m.curly > 0 || m.ellipsis > 0 ? 0.65 : 0;
      const markdown = norm(m.bold * 2 + m.headers + m.bullets * 0.5 + m.numbered * 0.5, 0, 3);
      const symmetry = m.sentences >= 4 ? norm(0.85 - m.paragraphSymmetry, 0, 0.62) * 0.6 : 0;
      const susp = clamp(em * 0.42 + typographic * 0.18 + markdown * 0.28 + symmetry * 0.22, 0, 1);
      const bits = [];
      if (m.emDash + m.enDash) bits.push(`${m.emDash + m.enDash} em/en dash${m.emDash + m.enDash === 1 ? "" : "es"}`);
      if (m.curly) bits.push(`${m.curly} curly quote${m.curly === 1 ? "" : "s"}`);
      if (m.bullets + m.numbered) bits.push(`${m.bullets + m.numbered} list marker${m.bullets + m.numbered === 1 ? "" : "s"}`);
      if (m.bold + m.headers) bits.push(`${m.bold + m.headers} markdown emphasis`);
      if (m.emoji) bits.push(`${m.emoji} emoji`);
      out.push({
        id: "format", label: "FORMATTING TELLS",
        value: round(susp * 100), weight: w.format, susp,
        note: bits.length
          ? `Typographic residue: ${bits.join(", ")}. Keyboard layouts rarely emit em dashes or curly quotes; pasted generations carry them in. Balanced paragraph lengths add to this score.`
          : `Plain ASCII, no list scaffolding, no typographic residue. This row contributes nothing.`
      });
    }

    /* 6 — human voice */
    {
      const humanMarks =
        m.informalPer100 * 1.1 +
        m.contractionPer100 * 0.7 +
        m.firstPersonPer100 * 0.35 +
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

    /* 7 — mechanical polish */
    {
      let susp = clamp(
        norm(m.capsStartRatio, 0.5, 1) * 0.42 +
        norm(m.terminalRatio, 0.6, 1) * 0.28 +
        norm(m.commaPerSentence, 0.35, 2.3) * 0.3,
        0, 1
      );
      if (opts.context === "formal") susp = 0.5 + (susp - 0.5) * 0.35;
      out.push({
        id: "polish", label: "MECHANICAL POLISH",
        value: round(susp * 100), weight: w.polish, susp,
        note: `${Math.round(m.capsStartRatio * 100)}% of sentences open with a capital, ${Math.round(m.terminalRatio * 100)}% close with punctuation, ${m.commaPerSentence.toFixed(1)} commas per sentence. Live typing leaves ragged edges — lowercase starts, missing full stops, comma-light lines.`
      });
    }

    /* 8 — baseline divergence (optional) */
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

    const tally = [
      ["solid", "AI-typical", m.aiHits.length],
      ["dotted", "soft", m.softHits.length],
      ["dashed", "stock", m.stockHits.length],
      ["wavy", "typographic", m.emDash + m.enDash + m.curly + m.ellipsis]
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
    const verdict = verdictFor(score);

    const topContribution = signals
      .map((s) => ({ s, c: s.susp * s.weight / totalWeight * 100 }))
      .sort((a, b) => b.c - a.c);

    return {
      score,
      band: verdict.band,
      verdict,
      signals,
      topSignals: topContribution.slice(0, 3).map((x) => x.s),
      anomalies: collectRanges(text || "", m),
      metrics: m,
      words: m.words,
      lowConfidence: m.words < 60,
      insufficient: m.words < 22,
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
