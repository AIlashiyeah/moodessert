// Netlify adapter: reuses the handler in api/judge.js (written in req/res style).
const handler = require("../../api/judge.js");

exports.handler = async (event) => {
  let body = {};
  try { body = JSON.parse(event.body || "{}"); } catch (e) { body = {}; }
  const req = { method: event.httpMethod, headers: event.headers || {}, body, diag: !!(event.queryStringParameters || {}).diag };
  return await new Promise((resolve) => {
    const headers = { "Content-Type": "application/json" };
    const res = {
      code: 200,
      setHeader(k, v) { headers[k] = v; },
      status(c) { this.code = c; return this; },
      json(o) { resolve({ statusCode: this.code, headers, body: JSON.stringify(o) }); return this; },
    };
    Promise.resolve(handler(req, res)).catch(() => resolve({ statusCode: 502, headers, body: '{"error":"AI failed"}' }));
  });
};
