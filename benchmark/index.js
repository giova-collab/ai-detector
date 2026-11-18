const groups = [
  { register: "cable", context: "formal", items: require("./data/cables") },
  { register: "memo", context: "formal", items: require("./data/memos") },
  { register: "news", context: "formal", items: require("./data/news") },
  { register: "post", context: "forum", items: require("./data/posts") },
];

const pairs = [];
const docs = [];

groups.forEach((group) => {
  group.items.forEach((pair, index) => {
    if (!pair.id || !pair.human || !pair.ai) {
      throw new Error("Malformed pair in " + group.register + " at index " + index);
    }
    const base = {
      pair: pair.id,
      register: group.register,
      context: group.context,
      split: index % 3 === 2 ? "test" : "train",
    };
    pairs.push({ id: pair.id, register: group.register });
    docs.push({ ...base, id: pair.id + "_human", label: 0, labelName: "human", text: pair.human });
    docs.push({ ...base, id: pair.id + "_ai", label: 1, labelName: "ai", text: pair.ai });
  });
});

const ids = new Set();
docs.forEach((doc) => {
  if (ids.has(doc.id)) throw new Error("Duplicate document id: " + doc.id);
  ids.add(doc.id);
  const words = doc.text.trim().split(/\s+/).filter(Boolean).length;
  if (words < 25) throw new Error("Document too short: " + doc.id + " (" + words + " words)");
});

module.exports = { groups, pairs, docs };
