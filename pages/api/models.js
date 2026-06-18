export const config = { api: { bodyParser: true, responseLimit: false } };

const OLLAMA = 'http://127.0.0.1:11434';

async function proxy(path, method, body, res) {
  const r = await fetch(`${OLLAMA}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return res.status(r.status).json(data);
}

async function stream(path, method, body, res) {
  const r = await fetch(`${OLLAMA}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Transfer-Encoding', 'chunked');
  const reader = r.body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    res.write(value);
  }
  res.end();
}

export default async function handler(req, res) {
  const { action, name, source, destination, modelfile } = req.body || {};

  try {
    if (req.method === 'GET') {
      // list models
      const r = await fetch(`${OLLAMA}/api/tags`);
      const data = await r.json();
      return res.status(r.status).json(data);
    }

    if (req.method === 'DELETE') {
      return proxy('/api/delete', 'DELETE', { name }, res);
    }

    if (req.method === 'POST') {
      switch (action) {
        case 'show':
          return proxy('/api/show', 'POST', { name }, res);
        case 'copy':
          return proxy('/api/copy', 'POST', { source, destination }, res);
        case 'ps':
          return proxy('/api/ps', 'GET', null, res);
        case 'version':
          return proxy('/api/version', 'GET', null, res);
        case 'pull':
          return stream('/api/pull', 'POST', { name, stream: true }, res);
        case 'create':
          return stream('/api/create', 'POST', { name, modelfile, stream: true }, res);
        default:
          return res.status(400).json({ error: 'Unknown action' });
      }
    }

    return res.status(405).end();
  } catch (err) {
    return res.status(502).json({ error: 'Ollama unreachable: ' + err.message });
  }
}
