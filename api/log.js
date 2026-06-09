export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, key } = req.body || {};
  if (!name || !key) return res.status(400).json({ error: "missing fields" });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const ua = req.headers["user-agent"] || "unknown";

  const baseId = process.env.AIRTABLE_BASE_ID || "";
  const pat = process.env.AIRTABLE_PAT || "";
  console.log("DEBUG base:", baseId.slice(0,8), "pat:", pat.slice(0,6), "lengths:", baseId.length, pat.length);

  try {
    const r = await fetch(
      `https://api.airtable.com/v0/${baseId}/tblItjLfVoIQ36NT6`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${pat}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          records: [{
            fields: {
              Persona:    name,
              Timestamp:  new Date().toISOString(),
              IP:         ip,
              Agent:      ua,
              Clave:      key.slice(0, 5) + "***",
            },
          }],
        }),
      }
    );
    if (!r.ok) {
      const err = await r.text();
      console.error(`AIRTABLE FAIL status=${r.status} body=${err}`);
      return res.status(502).json({ status: r.status, body: err });
    }
  } catch (e) {
    console.error("Log error:", e);
    return res.status(500).json({ error: "internal" });
  }

  res.status(200).json({ ok: true });
}
