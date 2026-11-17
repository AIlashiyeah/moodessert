// Netlify adapter: reuses the handler in api/tg.js (written in req/res style).
const handler = require("../../api/tg.js");

exports.handler = async (event) => {
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { body = {}; }
  const lower = {};
  for (const k of Object.keys(event.headers || {})) lower[k.toLowerCase()] = event.headers[k];
  const req = { method: event.httpMethod, headers: lower, body };
  return await new Promise((resolve) => {
    const headers = { "Content-Type": "application/json" };
    const res = {
      code: 200,
      setHeader(k, v) { headers[k] = v; },
      status(c) { this.code = c; return this; },
      json(o) { resolve({ statusCode: this.code, headers, body: JSON.stringify(o) }); return this; },
    };
    Promise.resolve(handler(req, res)).catch(() => resolve({ statusCode: 502, headers, body: '{"error":"failed"}' }));
  });
};
