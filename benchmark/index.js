const MIN_WORDS = 25;
const TEST_EVERY = 3;

const groups = [
  { register: "cable", context: "formal", items: require("./data/cables") },
  { register: "memo", context: "formal", items: require("./data/memos") },
  { register: "news", context: "formal", items: require("./data/news") },
  { register: "post", context: "forum", items: require("./data/posts") },
];

const words = (text) => text.trim().split(/\s+/).filter(Boolean).length;
const seenPairs = new Set();
const pairs = [];
const docs = [];

groups.forEach((group) => {
  group.items.forEach((pair, index) => {
    if (!pair.id || !pair.human || !pair.ai) {
      throw new Error("Malformed pair in " + group.register + " at index " + index);
    }
    if (seenPairs.has(pair.id)) throw new Error("Duplicate pair id: " + pair.id);
    seenPairs.add(pair.id);
    if (pair.human === pair.ai) throw new Error("Identical twins: " + pair.id);
    if (words(pair.human) < MIN_WORDS || words(pair.ai) < MIN_WORDS) {
      throw new Error("Pair below " + MIN_WORDS + " words: " + pair.id);
    }

    if (pair.split && pair.split !== "train" && pair.split !== "test") {
      throw new Error("Bad split for " + pair.id + ": " + pair.split);
    }
    const split = pair.split || (index % TEST_EVERY === TEST_EVERY - 1 ? "test" : "train");
    pairs.push({ id: pair.id, register: group.register });
    docs.push({ id: pair.id + "_human", pair: pair.id, register: group.register, context: group.context, split, label: 0, text: pair.human });
    docs.push({ id: pair.id + "_ai", pair: pair.id, register: group.register, context: group.context, split, label: 1, text: pair.ai });
  });
});

const ids = new Set();
docs.forEach((doc) => {
  if (ids.has(doc.id)) throw new Error("Duplicate document id: " + doc.id);
  ids.add(doc.id);
  if (words(doc.text) < MIN_WORDS) throw new Error("Document too short: " + doc.id);
});

const tokenSet = (text) => new Set(text.toLowerCase().match(/[a-z0-9']+/g) || []);

pairs.forEach((pair) => {
  const twins = docs.filter((doc) => doc.pair === pair.id);
  if (twins.length !== 2 || twins[0].split !== twins[1].split) {
    throw new Error("Pair split leaked across documents: " + pair.id);
  }
  if (twins.reduce((n, doc) => n + doc.label, 0) !== 1) {
    throw new Error("Pair does not have one human and one AI document: " + pair.id);
  }

  // Near-verbatim twins measure copying, not style. Keep the AI side independent.
  const a = tokenSet(twins[0].text);
  const b = tokenSet(twins[1].text);
  const overlap = [...a].filter((word) => b.has(word)).length / new Set([...a, ...b]).size;
  if (overlap > 0.9) throw new Error("Near-verbatim twins: " + pair.id + " (" + overlap.toFixed(2) + ")");
});

module.exports = { pairs, docs };
