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

// What each dessert is physically like, in the words the result card uses to explain "why this one".
const NATURE = {
  INFJ: ["看着安静，里面一层叠着一层", "quiet on the outside, layer upon layer inside"],
  ENTJ: ["每一层都摆得整整齐齐，没有一层是多余的", "every layer in line, and not one of them wasted"],
  INTJ: ["不靠甜讨好谁，苦得干净利落", "it never sweetens itself to please anyone; the bitterness is clean and exact"],
  ENFJ: ["最好的那颗草莓，永远放在最上面给别人", "the best strawberry always goes on top, for someone else"],
  ENTP: ["一层一层浸到底，甜的下面藏着苦和酒", "soaked through layer by layer, with bitter and boozy under the sweet"],
  INTP: ["冷冷的、透透的，一戳就晃，自己待着就很好", "cool and clear, wobbles when poked, perfectly fine on its own"],
  ESTP: ["故意烤焦、不守规矩，切开却是最软的", "burnt on purpose, breaks the rules, and softest of all once you cut in"],
  INFP: ["轻得像一口气，却是最难做成的那一个", "light as a breath, and the hardest one to get right"],
  ISTP: ["稳稳地立着，晃一下又回到原位", "it stands steady: give it a shake and it settles right back"],
  ENFP: ["把彩色全撒在外面，谁路过都想伸手", "all its colour is on the outside, and nobody walks past without reaching for one"],
  ESFP: ["堆得高高的，要趁热闹大家一起吃", "piled high, and meant to be shared right now while everyone's here"],
  ESTJ: ["方方正正、实打实，一口就知道分量", "square and solid: one bite and you know its weight"],
  ISFP: ["颜色挑得刚刚好，壳很薄，里面很软", "the colour is chosen exactly right; thin shell, soft centre"],
  ISTJ: ["底子打得厚，配方几十年不改，从不出错", "a thick base, a recipe unchanged for decades, and it never fails"],
  ESFJ: ["一掰开，里面满满的都是给别人的奶油", "break it open and it's full of cream, all of it for other people"],
  ISFJ: ["一圈酥皮把里面护得好好的，端上来永远是热的", "a ring of pastry guards the centre, and it always arrives warm"],
};

// "Goes best with": the popular opposite-pair lore (INTJ-ENFP, INFJ-ENTP, ...), shown as a second dessert.
const MATCH = {
  INTJ: ["ENFP", "浓度这么高的你，需要一个把彩色撒得到处都是的甜甜圈。", "Someone this concentrated needs a donut that scatters colour everywhere."],
  ENFP: ["INTJ", "你的点子满天飞，需要一块沉得住、苦得清醒的黑巧挞帮你落地。", "Your ideas fly everywhere. You need a dark chocolate tart, steady and clear-headed, to land them."],
  INFJ: ["ENTP", "你想得太深、说得太少，需要一块每一层都敢聊的提拉米苏。", "You think deep and say little. You need a tiramisu that will talk through every layer."],
  ENTP: ["INFJ", "你的话停不下来，需要一块安静、层数多到够你拆的法式千层。", "You never stop talking. You need a mille-feuille: quiet, with enough layers to keep you busy."],
  INTP: ["ENTJ", "你想明白了却懒得动，需要一块层层到位、说做就做的歌剧院蛋糕。", "You've worked it all out and not moved. You need an opera cake that gets every layer done."],
  ENTJ: ["INTP", "你一路往前冲，需要一杯冷静、总会问“为什么”的咖啡冻。", "You charge ahead. You need a coffee jelly, cool-headed and always asking why."],
  INFP: ["ENFJ", "你心里的话总说不出口，需要一块会把最好的草莓递给你的草莓蛋糕。", "You can't say what's in your heart. You need a shortcake that hands you its best strawberry."],
  ENFJ: ["INFP", "你一直在照顾别人，需要一个轻轻的舒芙蕾，让你也被小心对待一次。", "You're always looking after others. You need a soufflé, so someone handles you with care for once."],
  ISTJ: ["ESFP", "你什么都排得好好的，需要一碗说来就来、热热闹闹的芒果绵绵冰。", "Everything of yours is planned. You need a mango bingsu that just shows up, loud and fun."],
  ESFP: ["ISTJ", "你玩起来太疯，需要一块底子厚、从不出错的纽约芝士蛋糕托住你。", "You go all out. You need a New York cheesecake, thick-based and unfailing, to hold you up."],
  ISFJ: ["ESTP", "你总是小心翼翼，需要一块敢把自己烤焦的巴斯克带你出去闯。", "You're always careful. You need a Basque cheesecake, burnt on purpose, to drag you out."],
  ESTP: ["ISFJ", "你冲得太快，需要一个永远热着等你回来的蛋挞。", "You move too fast. You need an egg tart that's still warm when you come back."],
  ISTP: ["ESFJ", "你话少又爱独处，需要一个一掰开全是关心的奶油泡芙。", "You're quiet and like your own company. You need a cream puff that's all care once it opens."],
  ESFJ: ["ISTP", "你操心所有人，需要一个稳稳当当、话不多但靠得住的焦糖布丁。", "You worry about everyone. You need a crème caramel: steady, few words, dependable."],
  ISFP: ["ESTJ", "你跟着感觉走，需要一块方方正正、陪你把事办成的布朗尼。", "You follow your feelings. You need a brownie, square and solid, to get things done with you."],
  ESTJ: ["ISFP", "你把一切都安排好了，需要一颗提醒你“好看也很重要”的马卡龙。", "You've organised everything. You need a macaron to remind you that beauty matters too."],
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
    nature: { zh: NATURE[T][0], en: NATURE[T][1] },
    match: { type: MATCH[T][0], line: { zh: MATCH[T][1], en: MATCH[T][2] } },
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
for (const T in out.types) if (out.types[out.types[T].match.type].match.type !== T) die(`${T}: match must be mutual`);
fs.writeFileSync("quiz.json", JSON.stringify(out));
console.log("quiz.json:", Object.keys(out.types).length, "types,", fs.statSync("quiz.json").size, "bytes");
