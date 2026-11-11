// Builds quiz.json from the two question-bank documents and desserts.json.
// Run: node tools/build-quiz.mjs
import fs from "node:fs";

const zhDoc = fs.readFileSync("docs/questions-v2-draft.md", "utf8");
const enDoc = fs.readFileSync("docs/questions-v2-en.md", "utf8");
const desserts = JSON.parse(fs.readFileSync("desserts.json", "utf8")).desserts;

// bake.js shape id and short English title for each type's dessert
const DESSERT = {
  INFJ: ["mille-feuille", "Mille-feuille"], ENTJ: ["opera", "Opera Cake"], INTJ: ["dark-chocolate-tart", "Dark Chocolate Tart"],
  ENFJ: ["strawberry-shortcake", "Strawberry Shortcake"], ENTP: ["tiramisu", "Tiramisu"], INTP: ["coffee-jelly", "Coffee Jelly"],
  ESTP: ["basque-cheesecake", "Basque Cheesecake"], INFP: ["souffle", "Soufflé"], ISTP: ["creme-caramel", "Crème Caramel"],
  ENFP: ["donut", "Donut"], ESFP: ["mango-bingsu", "Mango Bingsu"], ESTJ: ["brownie", "Brownie"],
  ISFP: ["macaron", "Macaron"], ISTJ: ["new-york-cheesecake", "New York Cheesecake"], ESFJ: ["cream-puff", "Cream Puff"], ISFJ: ["egg-tart", "Egg Tart"],
};

// Branch colours, in the same order as the branches in the documents.
// Each array overrides bake.js's default palette slot by slot; null keeps the default.
const _ = null;
const PALETTES = {
  ENTP: [_, ["#9E2B45", "#F6B7C6", "#C97F84"], ["#7A4E2D", "#E9D3B4", "#A9744A"], ["#3A1410", "#F2DFC8", "#B03A1E"]],          // tiramisu: cocoa, cream, coffee
  INFJ: [_, [_, "#D3C4AB", "#4A3B5C"], [_, "#F2A7B5", "#A3123E"], [_, "#F0D29A", "#8A4A14"]],                                     // mille-feuille: pastry, cream, lines
  ISTJ: [_, [_, "#5B4E9E", _], ["#F3DDB0", "#B8732A", _], ["#C4D08A", "#8FA65A", _]],                                             // NY cheesecake: cream, golden, crumb
  ESFP: [_, [_, "#E8425A", _, "#FFF1E0"], [_, "#F0576B", "#5FA868", _], [_, "#F27CC0", _, "#7FD6E8"]],                            // bingsu: snow, cubes, bowl, drizzle
  INTJ: [_, [_, _, "#E08A2E"], [_, "#2A1810", "#8B5A3C"], [_, "#2A0F14", "#C2476B"]],                                             // tart: pastry, ganache, highlight
  ENTJ: [_, [_, "#8FA65A", _], [_, "#C2476B", _], [_, "#BFAA8E", _]],                                                             // opera: dark, sponge, gold
  INTP: [_, [_, "#FFF0C2", _], [_, "#F7F4EC", _], ["#4A2410", "#E8B56A", _]],                                                     // coffee jelly: coffee, cream, glass
  ENFJ: [_, ["#FBEDE4", _, "#F6A58A"], [_, _, "#4C5BAF"], [_, "#A9BF6A", _]],                                                     // shortcake: cream, sponge, berries
  ENFP: [_, [_, "#F7EFE2", _], [_, "#5A3220", _], [_, "#F6DC4A", _]],                                                             // donut: dough, glaze, light
  INFP: [_, [_, "#6B3F26", _], [_, "#9DB25C", _], [_, "#EFC94A", _]],                                                             // soufflé: ramekin, rise, sugar
  ISFJ: [_, [_, "#F9DC5C", "#EFC548"], [_, "#F3E9C8", "#D9A860"], [_, "#D9E09C", _]],                                             // egg tart: pastry, custard, spots
  ESTJ: [_, [_, "#A9794E", _], [_, "#9A6A4A", _], [_, "#C68E4A", _]],                                                             // brownie: chocolate, crust, cracks
  ESFJ: [_, [_, "#F7B9C8", _], [_, "#7A4A32", "#8A5A3A"], [_, "#B5C977", "#C9CF8A"]],                                             // cream puff: choux, cream, cookie
  ISTP: [_, ["#C9A27A", "#6B3A1C", "#3A1E0E"], ["#F6EFDD", _, _], ["#F0D58A", "#D9962E", _]],                                     // crème caramel: custard, caramel, dark
  ISFP: [["#F2A9BE", _, "#E58FA8"], _, ["#B9CF8A", _, "#A3BD72"], ["#F5DC6A", _, "#E9C94F"]],                                     // macaron: shell, filling, feet
  ESTP: [_, [_, "#F4E7AE", "#B98A3A"], [_, "#CDE27C", "#9C9A3C"], [_, "#5A3524", "#3A2015"]],                                                     // basque: burnt top, custard, caramel
};

const die = (m) => { console.error("build-quiz: " + m); process.exit(1); };
const sections = (doc) => doc.split(/^## /m).slice(1).map((s) => { const [head, ...rest] = s.split("\n"); return { type: head.trim().slice(0, 4), head: head.trim(), lines: rest.map((l) => l.trim()).filter(Boolean) }; });

// Chinese document
const zh = {};
for (const s of sections(zhDoc)) {
  const t = { name: s.head.split("·")[1].trim(), branches: [], questions: [] };
  let q = null;
  for (const l of s.lines) {
    let m;
    if ((m = l.match(/^\*\*(\d)\. (.+?)\*\*(.*)$/))) { q = { q: m[2], twistFlag: /反转题/.test(m[3]), options: [], twist: null }; t.questions.push(q); }
    else if ((m = l.match(/^- 反转：(.+)$/))) q.twist = m[1];
    else if (q && (m = l.match(/^- [A-D] (.+)（(.+?)）$/))) q.options.push({ text: m[1], tag: m[2] });
    else if (!q && (m = l.match(/^- (.+?) · (.+?)：(.+)$/))) t.branches.push({ flavour: m[1], name: m[2], line: m[3] });
  }
  zh[s.type] = t;
}

// English document
const en = {};
for (const s of sections(enDoc)) {
  const t = { branches: [], questions: [] };
  let q = null;
  for (const l of s.lines) {
    if (l.startsWith("B ")) { const [flavour, name, line] = l.slice(2).split(" | "); t.branches.push({ flavour, name, line }); }
    else if (l.startsWith("Q ")) { const [text, tagEn, tagZh] = l.slice(2).split(" | "); q = { q: text, tagEn, tagZh, options: [], twist: null }; t.questions.push(q); }
    else if (l.startsWith("- ")) q.options.push(l.slice(2));
    else if (l.startsWith("T ")) q.twist = l.slice(2);
  }
  en[s.type] = t;
}

const out = { version: "v2", types: {} };
for (const d of desserts) {
  const T = d.mbti, z = zh[T], e = en[T];
  if (!z || !e) die(`missing ${T}`);
  if (z.branches.length !== 4 || e.branches.length !== 4) die(`${T}: need 4 branches`);
  if (z.questions.length !== 5 || e.questions.length !== 5) die(`${T}: need 5 questions`);
  const branchOf = (tag) => {
    let i = z.branches.findIndex((b) => b.flavour === tag);
    if (i < 0) { const hits = z.branches.map((b, k) => (b.flavour.startsWith(tag) || tag.startsWith(b.flavour) ? k : -1)).filter((k) => k >= 0); if (hits.length !== 1) die(`${T}: cannot place "${tag}"`); i = hits[0]; }
    return i;
  };
  out.types[T] = {
    dessert: DESSERT[T][0],
    name: { zh: d.name.zh, en: DESSERT[T][1] },
    rarity: d.rarity,
    rarity_line: d.rarity_line,
    branches: z.branches.map((b, i) => {
      const eb = e.branches[i];
      if (!eb.flavour || !eb.name || !eb.line) die(`${T}: bad English branch ${i}`);
      return { flavour: { zh: b.flavour, en: eb.flavour }, name: { zh: b.name, en: eb.name }, line: { zh: b.line, en: eb.line }, palette: PALETTES[T][i] };
    }),
    questions: z.questions.map((q, i) => {
      const eq = e.questions[i];
      if (q.options.length !== 4 || eq.options.length !== 4) die(`${T} Q${i + 1}: need 4 options`);
      if (!!q.twist !== !!eq.twist || !!q.twist !== q.twistFlag) die(`${T} Q${i + 1}: twist mismatch`);
      if (!eq.tagEn || !eq.tagZh) die(`${T} Q${i + 1}: missing tag`);
      const bs = q.options.map((o) => branchOf(o.tag));
      if (new Set(bs).size !== 4) die(`${T} Q${i + 1}: options must cover all 4 branches`);
      return {
        q: { zh: q.q, en: eq.q }, tag: { zh: eq.tagZh, en: eq.tagEn },
        twist: q.twist ? { zh: q.twist, en: eq.twist } : null,
        options: q.options.map((o, k) => ({ b: bs[k], zh: o.text, en: eq.options[k] })),
      };
    }),
  };
  if (out.types[T].questions.filter((q) => q.twist).length !== 1) die(`${T}: need exactly 1 twist`);
}
if (Object.keys(out.types).length !== 16) die("need 16 types");
fs.writeFileSync("quiz.json", JSON.stringify(out));
console.log("quiz.json:", Object.keys(out.types).length, "types,", fs.statSync("quiz.json").size, "bytes");
