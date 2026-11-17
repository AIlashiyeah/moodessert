// Serverless function: /api/tg (Netlify wraps this in netlify/functions/tg.js)
// Everything the Telegram Mini App needs from the server, in one function:
//   GET  /api/tg                    public config for the page (app link, Stars price, ad block id)
//   POST /api/tg {op:"invoice"}     a Telegram Stars invoice link for one unlock
//   POST /api/tg {op:"setup"}       points the bot's webhook and menu button at this site (needs the webhook secret)
//   POST /api/tg  <Telegram update> the bot webhook (must carry the webhook secret header)
// Secrets live only in environment variables:
//   TELEGRAM_BOT_TOKEN        from @BotFather
//   TELEGRAM_WEBHOOK_SECRET   any long random string you choose (A-Z a-z 0-9 _ -)
// Optional:
//   TG_APP_LINK       the Mini App's t.me link, e.g. https://t.me/your_bot (used for share links)
//   TG_WEBAPP_URL     the site's public URL; defaults to the host the request came in on
//   UNLOCK_STARS      price of one unlock in Stars (default 50)
//   ADSGRAM_BLOCK_ID  rewarded block id from AdsGram; leave empty to hide the ad option

const crypto = require("crypto");

const STARS = Math.min(2500, Math.max(1, parseInt(process.env.UNLOCK_STARS || "50", 10) || 50));
const MAX_AGE = 24 * 3600; // launch data older than a day is refused
const hits = new Map();   // best-effort per-user limit on invoice creation (per serverless instance)

const COPY = {
  en: {
    title: "Your full reading", desc: "What drives you, your contradiction, and the line written from your five answers.", label: "Full reading",
    start: "Which dessert are you? Five odd questions, then your answers bake into a dessert.", open: "Open Moodessert",
    paid: "Unlocked. Your full reading is on the card.",
    support: "Payment problem? Reply here with what happened and when. Stars are refunded if the reading did not unlock.",
    terms: "Moodessert is made for fun: a reading of five answers, not a psychological assessment. One payment unlocks the full reading for your current session. Stars are refunded if the reading fails to unlock: send /paysupport.",
    bad: "This order has expired. Please try again from the app.",
  },
  zh: {
    title: "你的专属解读", desc: "你在乎什么、你的反差在哪，以及只根据你五个回答写的那句话。", label: "专属解读",
    start: "你是哪块甜点？答五道有点怪的小题，把你的回答烤成一块甜点。", open: "打开 Moodessert",
    paid: "已解锁，完整解读在结果卡上。",
    support: "支付有问题？直接在这里回复发生了什么、大概什么时间。如果付了星星却没解锁，会退还给你。",
    terms: "Moodessert 图个开心：这是对五个回答的解读，不是心理测评。付费一次，本次会话内的完整解读全部解锁。如果付了星星却没解锁，发送 /paysupport，会退还给你。",
    bad: "这笔订单已失效，请回到小程序里重试。",
  },
};
const copyFor = (code) => COPY[String(code || "").toLowerCase().startsWith("zh") ? "zh" : "en"];

// Validates Telegram.WebApp.initData against the bot token (HMAC, per the Mini Apps docs). Returns the user or null.
function checkInitData(initData, token) {
  try {
    const p = new URLSearchParams(String(initData || ""));
    const hash = p.get("hash"); if (!hash) return null;
    p.delete("hash");
    const dcs = [...p.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
    const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
    const calc = crypto.createHmac("sha256", secret).update(dcs).digest();
    const given = Buffer.from(hash, "hex");
    if (given.length !== calc.length || !crypto.timingSafeEqual(given, calc)) return null;
    const age = Date.now() / 1000 - Number(p.get("auth_date") || 0);
    if (!(age >= -300 && age < MAX_AGE)) return null;
    const user = JSON.parse(p.get("user") || "null");
    return user && user.id ? user : null;
  } catch (e) { return null; }
}

async function bot(token, method, body) {
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 6000);
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl.signal,
    });
    return await r.json();
  } catch (e) { return { ok: false, description: e && e.name }; }
  finally { clearTimeout(tm); }
}

const sameSecret = (a, b) => { const x = Buffer.from(String(a || "")), y = Buffer.from(String(b || "")); return x.length > 0 && x.length === y.length && crypto.timingSafeEqual(x, y); };
const siteUrl = (req) => (process.env.TG_WEBAPP_URL || `https://${req.headers["x-forwarded-host"] || req.headers.host || ""}`).replace(/\/+$/, "") + "/";

// A deep-link parameter (f12 = one friend's code, d12ab = a finished pair) becomes the page's own query string.
function startQuery(param) {
  const s = String(param || "");
  let m = /^f([0-9a-z]{2})$/i.exec(s); if (m) return `?f=${m[1]}`;
  m = /^d([0-9a-z]{2})([0-9a-z]{2})$/i.exec(s); if (m) return `?a=${m[1]}&b=${m[2]}`;
  return "";
}

async function onUpdate(u, token, req) {
  if (u.pre_checkout_query) {
    const q = u.pre_checkout_query;
    const ok = q.currency === "XTR" && q.total_amount === STARS && /^unlock:\d+:\d+$/.test(q.invoice_payload || "") && q.invoice_payload.split(":")[1] === String(q.from && q.from.id);
    await bot(token, "answerPreCheckoutQuery", ok ? { pre_checkout_query_id: q.id, ok: true } : { pre_checkout_query_id: q.id, ok: false, error_message: copyFor(q.from && q.from.language_code).bad });
    return;
  }
  const m = u.message; if (!m || !m.chat) return;
  const c = copyFor(m.from && m.from.language_code);
  if (m.successful_payment) {
    // The charge id is the only thing needed for a refund (refundStarPayment); keep it in the function log.
    console.log("stars paid", m.from && m.from.id, m.successful_payment.total_amount, m.successful_payment.telegram_payment_charge_id);
    await bot(token, "sendMessage", { chat_id: m.chat.id, text: c.paid });
    return;
  }
  const text = String(m.text || "");
  if (/^\/paysupport\b/.test(text)) return void (await bot(token, "sendMessage", { chat_id: m.chat.id, text: c.support }));
  if (/^\/terms\b/.test(text)) return void (await bot(token, "sendMessage", { chat_id: m.chat.id, text: c.terms }));
  if (/^\/start\b/.test(text) && m.chat.type === "private") {
    const url = siteUrl(req) + startQuery(text.split(/\s+/)[1]);
    await bot(token, "sendMessage", { chat_id: m.chat.id, text: c.start, reply_markup: { inline_keyboard: [[{ text: c.open, web_app: { url } }]] } });
  }
}

module.exports = async function handler(req, res) {
  const token = process.env.TELEGRAM_BOT_TOKEN, hook = process.env.TELEGRAM_WEBHOOK_SECRET;
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "GET") {
    return res.status(200).json({ link: process.env.TG_APP_LINK || null, stars: STARS, pay: !!(token && hook), ad: process.env.ADSGRAM_BLOCK_ID || null });
  }
  if (req.method !== "POST") return res.status(405).json({ error: "GET or POST only" });

  let b; try { b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {}); } catch (e) { b = {}; }

  // Telegram's webhook call: recognised by the secret header, never by the body alone.
  const given = req.headers["x-telegram-bot-api-secret-token"];
  if (given !== undefined || b.update_id !== undefined) {
    if (!token || !hook || !sameSecret(given, hook)) return res.status(401).json({ error: "bad secret" });
    try { await onUpdate(b, token, req); } catch (e) { console.log("tg update error", e && e.name); }
    return res.status(200).json({ ok: true }); // always 200, or Telegram keeps resending the update
  }

  if (!token || !hook) return res.status(503).json({ error: "Telegram not configured" });

  if (b.op === "setup") {
    if (!sameSecret(b.secret, hook)) return res.status(401).json({ error: "bad secret" });
    const url = siteUrl(req);
    const out = {
      webhook: await bot(token, "setWebhook", { url: url + "api/tg", secret_token: hook, allowed_updates: ["message", "pre_checkout_query"] }),
      menu: await bot(token, "setChatMenuButton", { menu_button: { type: "web_app", text: "Moodessert", web_app: { url } } }),
      commands: await bot(token, "setMyCommands", { commands: [{ command: "start", description: "Which dessert are you?" }, { command: "paysupport", description: "Payment help" }, { command: "terms", description: "Terms" }] }),
    };
    const me = await bot(token, "getMe", {});
    return res.status(200).json({ site: url, bot: me.ok ? me.result.username : null, webhook: out.webhook.ok, menu: out.menu.ok, commands: out.commands.ok, errors: Object.values(out).filter((x) => !x.ok).map((x) => x.description) });
  }

  if (b.op === "invoice") {
    const user = checkInitData(b.initData, token);
    if (!user) return res.status(401).json({ error: "open this inside Telegram" });
    const now = Date.now(), h = (hits.get(user.id) || []).filter((t) => now - t < 3600e3);
    if (h.length >= 12) return res.status(429).json({ error: "Slow down" });
    h.push(now); hits.set(user.id, h);
    const c = COPY[b.lang === "zh" ? "zh" : "en"];
    const r = await bot(token, "createInvoiceLink", {
      title: c.title, description: c.desc, payload: `unlock:${user.id}:${now}`,
      provider_token: "", currency: "XTR", prices: [{ label: c.label, amount: STARS }],
    });
    if (!r.ok || !r.result) { console.log("invoice error", r.description); return res.status(502).json({ error: "Telegram upstream" }); }
    return res.status(200).json({ link: r.result, stars: STARS });
  }

  return res.status(400).json({ error: "unknown op" });
};

module.exports._test = { checkInitData, startQuery, STARS };
