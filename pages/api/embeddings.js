export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { model, input } = req.body;

  try {
    const r = await fetch('http://127.0.0.1:11434/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, input }),
    });
    const data = await r.json();
    return res.status(r.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Ollama unreachable: ' + err.message });
  }
}
