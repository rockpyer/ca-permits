// Outgoing email through Resend (https://resend.com/docs/api-reference/emails/send-batch-emails). One provider call
// per 100 messages. Without RESEND_API_KEY nothing is sent: messages are logged and reported as "dry-run", so the
// Worker can be deployed and tested before the sending domain is verified.
export const transport = { fetch: (...a) => fetch(...a) };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// msgs: [{ to, subject, html, text, headers? }]. Returns one { ok, id?, error? } per message, in order.
export async function sendMail(env, msgs) {
  if (!msgs.length) return [];
  if (!env.RESEND_API_KEY) {
    for (const m of msgs) console.log('dry-run email', m.to, m.subject);
    return msgs.map(() => ({ ok: true, id: 'dry-run' }));
  }
  const out = [];
  for (let i = 0; i < msgs.length; i += 100) {
    const chunk = msgs.slice(i, i + 100).map((m) => ({
      from: env.MAIL_FROM, to: [m.to], subject: m.subject, html: m.html, text: m.text,
      ...(env.MAIL_REPLY_TO && { reply_to: env.MAIL_REPLY_TO }), ...(m.headers && { headers: m.headers })
    }));
    try {
      const r = await transport.fetch('https://api.resend.com/emails/batch', {
        method: 'POST', headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' }, body: JSON.stringify(chunk)
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body?.message || `Resend ${r.status}`);
      chunk.forEach((_, j) => out.push({ ok: true, id: body?.data?.[j]?.id || null }));
    } catch (e) {
      chunk.forEach(() => out.push({ ok: false, error: String(e?.message || e).slice(0, 300) }));
    }
    if (i + 100 < msgs.length) await sleep(600); // Resend allows 2 requests a second by default.
  }
  return out;
}
