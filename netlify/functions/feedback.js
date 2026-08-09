exports.handler = async (event) => {
  const cors = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: cors, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers: cors, body: JSON.stringify({ error: "method not allowed" }) };

  let body;
  try { body = JSON.parse(event.body || "{}"); }
  catch { return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "invalid json" }) }; }

  const message = String(body.message || "").trim();
  const page = String(body.page || "").slice(0, 300);
  const rating = String(body.rating || "").slice(0, 20);
  const email = String(body.email || "").slice(0, 200);
  const hp = String(body.website || ""); // honeypot

  if (hp) return { statusCode: 204, headers: cors, body: "" };
  if (!message || message.length > 5000) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: "message required (<=5000)" }) };

  const key = process.env.RESEND_API_KEY;
  const to = process.env.FEEDBACK_TO;
  if (!key || !to) return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "server not configured" }) };

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ua = event.headers?.["user-agent"] || "";
  const ip = event.headers?.["x-forwarded-for"] || event.headers?.["x-nf-client-connection-ip"] || "";

  const html = `<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:600px">
    <h2 style="color:#333">clim feedback</h2>
    ${page ? `<p><b>Page:</b> ${esc(page)}</p>` : ""}
    ${rating ? `<p><b>Rating:</b> ${esc(rating)}</p>` : ""}
    ${email ? `<p><b>Reply-to:</b> ${esc(email)}</p>` : ""}
    <p><b>Message:</b></p>
    <div style="border-left:3px solid #ccc;padding:8px 12px;background:#fafafa;white-space:pre-wrap">${esc(message)}</div>
    <hr>
    <p style="color:#888;font-size:12px">UA: ${esc(ua)}<br>IP: ${esc(ip)}</p>
  </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "clim feedback <onboarding@resend.dev>",
        to: [to],
        reply_to: email && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : undefined,
        subject: `clim feedback${rating ? ` (${rating})` : ""}${page ? ` — ${page}` : ""}`,
        html,
      }),
    });
    if (!res.ok) {
      const t = await res.text();
      return { statusCode: 502, headers: cors, body: JSON.stringify({ error: "resend failed", detail: t.slice(0, 300) }) };
    }
    return { statusCode: 200, headers: cors, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: "send error", detail: String(e).slice(0, 300) }) };
  }
};
