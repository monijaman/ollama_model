export const config = { api: { bodyParser: true, responseLimit: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { model, messages, options, stream = true, keep_alive } = req.body;

  let ollamaRes;
  try {
    ollamaRes = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, options, stream, keep_alive }),
    });
  } catch (err) {
    return res.status(502).json({ error: 'Ollama unreachable: ' + err.message });
  }

  if (!stream) {
    const data = await ollamaRes.json();
    return res.status(ollamaRes.status).json(data);
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Transfer-Encoding', 'chunked');

  const reader = ollamaRes.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } finally {
    res.end();
  }
}
