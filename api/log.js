export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, key } = req.body || {};
  if (!name || !key) return res.status(400).json({ error: "missing fields" });

  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  const ua = req.headers["user-agent"] || "unknown";

  try {
    const r = await fetch(
      `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/Access%20log`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.AIRTABLE_PAT}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fields: {
            Persona:        name,
            Timestamp:      new Date().toISOString(),
            IP:             ip,
            Agent:          ua,
            Clave:          key.slice(0, 5) + "***",
          },
        }),
      }
    );
    if (!r.ok) {
      const err = await r.text();
      console.error("Airtable error:", err);
      return res.status(502).json({ error: "airtable" });
    }
  } catch (e) {
    console.error("Log error:", e);
    return res.status(500).json({ error: "internal" });
  }

  res.status(200).json({ ok: true });
}
