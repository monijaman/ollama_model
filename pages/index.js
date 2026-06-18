import { useState, useEffect, useRef, useCallback } from 'react';

// ─── palette ────────────────────────────────────────────────────────────────
const C = {
  bg: '#0f172a', surface: '#1e293b', border: '#334155',
  accent: '#6366f1', accentHover: '#4f46e5',
  text: '#e2e8f0', muted: '#94a3b8',
  success: '#22c55e', error: '#f87171', warn: '#fbbf24',
  user: '#1d4ed8', assistant: '#1e293b',
};

const S = {
  page: { display: 'flex', height: '100vh', background: C.bg, color: C.text, fontFamily: "'Segoe UI', system-ui, sans-serif", overflow: 'hidden' },
  sidebar: { width: 200, background: C.surface, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', padding: '16px 0', flexShrink: 0 },
  sideTitle: { color: C.accent, fontWeight: 700, fontSize: 15, padding: '0 16px 16px', letterSpacing: 1 },
  tabBtn: (active) => ({
    display: 'block', width: '100%', padding: '10px 16px', textAlign: 'left',
    background: active ? C.accent : 'transparent', color: active ? '#fff' : C.muted,
    border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: active ? 600 : 400,
    borderLeft: active ? `3px solid #a5b4fc` : '3px solid transparent',
    transition: 'all .15s',
  }),
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '12px 24px', borderBottom: `1px solid ${C.border}`, background: C.surface, display: 'flex', alignItems: 'center', gap: 12 },
  content: { flex: 1, padding: 24, overflowY: 'auto' },
  card: { background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 20, marginBottom: 16 },
  label: { fontSize: 12, color: C.muted, marginBottom: 4, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .5 },
  input: { width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', color: C.text, fontSize: 14, boxSizing: 'border-box', outline: 'none' },
  textarea: { width: '100%', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', color: C.text, fontSize: 14, boxSizing: 'border-box', resize: 'vertical', outline: 'none', fontFamily: 'inherit' },
  btn: (variant = 'primary') => ({
    padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
    background: variant === 'primary' ? C.accent : variant === 'danger' ? '#7f1d1d' : C.border,
    color: variant === 'danger' ? '#fca5a5' : '#fff',
    transition: 'opacity .15s',
  }),
  select: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: '8px 12px', color: C.text, fontSize: 14, outline: 'none', cursor: 'pointer' },
  badge: (color = C.muted) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: color + '33', color, border: `1px solid ${color}55` }),
  pre: { background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: 12, fontSize: 12, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, color: C.text },
  row: { display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' },
  col: { display: 'flex', flexDirection: 'column', gap: 6 },
  dot: (on) => ({ width: 8, height: 8, borderRadius: '50%', background: on ? C.success : C.error, flexShrink: 0 }),
};

// ─── helpers ─────────────────────────────────────────────────────────────────
function fmtBytes(b) {
  if (!b) return '—';
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  return (b / 1e3).toFixed(0) + ' KB';
}
function fmtDate(s) { return s ? new Date(s).toLocaleDateString() : '—'; }
function cosineSim(a, b) {
  if (!a || !b || a.length !== b.length) return null;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] ** 2; nb += b[i] ** 2; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
async function streamLines(response, onLine, onDone) {
  const reader = response.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const l of lines) {
      if (l.trim()) { try { onLine(JSON.parse(l)); } catch {} }
    }
  }
  if (buf.trim()) { try { onLine(JSON.parse(buf)); } catch {} }
  onDone?.();
}

// ─── ModelSelector ───────────────────────────────────────────────────────────
function ModelSelector({ models, value, onChange, style }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...S.select, ...style }}>
      {models.length === 0 && <option value="">No models installed</option>}
      {models.map(m => <option key={m.name} value={m.name}>{m.name}</option>)}
    </select>
  );
}

// ─── ParamSlider ─────────────────────────────────────────────────────────────
function ParamSlider({ label, value, onChange, min, max, step = 0.05 }) {
  return (
    <div style={S.col}>
      <span style={{ ...S.label, marginBottom: 0 }}>{label} <span style={{ color: C.text, fontWeight: 700 }}>{value}</span></span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ accentColor: C.accent, cursor: 'pointer', width: 160 }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: CHAT
// ═══════════════════════════════════════════════════════════════════════════════
function ChatTab({ models }) {
  const [model, setModel] = useState(models[0]?.name ?? '');
  const [system, setSystem] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [streaming, setStreaming] = useState(false);
  const [keepAlive, setKeepAlive] = useState('5m');
  const [temp, setTemp] = useState(0.8);
  const [showParams, setShowParams] = useState(false);
  const bottomRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
  useEffect(() => { if (models[0] && !model) setModel(models[0].name); }, [models]);

  async function send() {
    if (!input.trim() || !model) return;
    const userMsg = { role: 'user', content: input };
    const history = system
      ? [{ role: 'system', content: system }, ...messages, userMsg]
      : [...messages, userMsg];
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setStreaming(true);
    let assistantContent = '';
    setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: history, stream: true, keep_alive: keepAlive, options: { temperature: temp } }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      await streamLines(res, (data) => {
        if (data.message?.content) {
          assistantContent += data.message.content;
          setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: assistantContent }]);
        }
      });
    } catch (err) {
      setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content: '⚠ ' + err.message }]);
    } finally {
      setStreaming(false);
    }
  }

  function handleKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>
      {/* toolbar */}
      <div style={{ ...S.card, marginBottom: 0, borderRadius: '10px 10px 0 0', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={S.col}>
          <span style={S.label}>Model</span>
          <ModelSelector models={models} value={model} onChange={setModel} />
        </div>
        <div style={S.col}>
          <span style={S.label}>Keep Alive</span>
          <select value={keepAlive} onChange={e => setKeepAlive(e.target.value)} style={S.select}>
            {['1m','5m','10m','30m','1h','-1'].map(v => <option key={v} value={v}>{v === '-1' ? 'forever' : v}</option>)}
          </select>
        </div>
        <button onClick={() => setShowParams(p => !p)} style={{ ...S.btn('secondary'), alignSelf: 'flex-end' }}>
          {showParams ? 'Hide' : 'Params'}
        </button>
        <button onClick={() => setMessages([])} style={{ ...S.btn('secondary'), alignSelf: 'flex-end' }}>Clear</button>
      </div>
      {showParams && (
        <div style={{ ...S.card, borderRadius: 0, marginBottom: 0, borderTop: 'none' }}>
          <div style={{ ...S.row, marginBottom: 12 }}>
            <ParamSlider label="Temperature" value={temp} onChange={setTemp} min={0} max={2} step={0.1} />
          </div>
          <span style={S.label}>System Prompt</span>
          <textarea rows={2} value={system} onChange={e => setSystem(e.target.value)}
            placeholder="e.g. You are a helpful assistant." style={S.textarea} />
        </div>
      )}
      {/* messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: C.muted, marginTop: 60, fontSize: 15 }}>
            Start a conversation below
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: m.role === 'user' ? 'row-reverse' : 'row', gap: 8 }}>
            <div style={{
              maxWidth: '75%', padding: '10px 14px', borderRadius: 12,
              background: m.role === 'user' ? C.accent : C.surface,
              border: `1px solid ${C.border}`, fontSize: 14, lineHeight: 1.6,
              whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {m.content || (streaming && i === messages.length - 1 ? <span style={{ color: C.muted }}>▋</span> : '')}
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      {/* input */}
      <div style={{ padding: 12, borderTop: `1px solid ${C.border}`, background: C.surface, display: 'flex', gap: 8 }}>
        <textarea rows={2} value={input} onChange={e => setInput(e.target.value)} onKeyDown={handleKey}
          placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
          style={{ ...S.textarea, flex: 1, resize: 'none' }} />
        <button onClick={send} disabled={streaming || !model} style={{ ...S.btn(), alignSelf: 'stretch' }}>
          {streaming ? '■ Stop' : 'Send'}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: GENERATE
// ═══════════════════════════════════════════════════════════════════════════════
function GenerateTab({ models }) {
  const [model, setModel] = useState(models[0]?.name ?? '');
  const [prompt, setPrompt] = useState('');
  const [system, setSystem] = useState('');
  const [output, setOutput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [stats, setStats] = useState(null);
  const [params, setParams] = useState({ temperature: 0.8, top_p: 0.9, top_k: 40, seed: '', num_predict: -1, num_ctx: 2048 });
  const outRef = useRef(null);

  useEffect(() => { if (models[0] && !model) setModel(models[0].name); }, [models]);
  useEffect(() => { outRef.current?.scrollTo({ top: outRef.current.scrollHeight, behavior: 'smooth' }); }, [output]);

  function setParam(k, v) { setParams(p => ({ ...p, [k]: v })); }

  async function run() {
    if (!prompt.trim() || !model) return;
    setOutput('');
    setStats(null);
    setStreaming(true);
    let text = '';
    try {
      const opts = { temperature: params.temperature, top_p: params.top_p, top_k: params.top_k, num_predict: params.num_predict, num_ctx: params.num_ctx };
      if (params.seed !== '') opts.seed = parseInt(params.seed);
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt, system: system || undefined, options: opts, stream: true }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      await streamLines(res, (data) => {
        if (data.response) { text += data.response; setOutput(text); }
        if (data.done && data.total_duration) {
          setStats({
            total: (data.total_duration / 1e9).toFixed(2) + 's',
            tokens: data.eval_count,
            speed: data.eval_count ? (data.eval_count / (data.eval_duration / 1e9)).toFixed(1) + ' tok/s' : '—',
            ctx: data.prompt_eval_count,
          });
        }
      });
    } catch (err) {
      setOutput('⚠ ' + err.message);
    } finally {
      setStreaming(false);
    }
  }

  return (
    <div style={{ display: 'flex', height: '100%', gap: 16 }}>
      {/* left: controls */}
      <div style={{ width: 260, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
        <div style={S.card}>
          <span style={S.label}>Model</span>
          <ModelSelector models={models} value={model} onChange={setModel} style={{ width: '100%' }} />
        </div>
        <div style={S.card}>
          <span style={S.label}>System</span>
          <textarea rows={3} value={system} onChange={e => setSystem(e.target.value)}
            placeholder="System instruction (optional)" style={S.textarea} />
        </div>
        <div style={S.card}>
          <p style={{ ...S.label, marginBottom: 16 }}>Parameters</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ParamSlider label="Temperature" value={params.temperature} onChange={v => setParam('temperature', v)} min={0} max={2} step={0.1} />
            <ParamSlider label="Top P" value={params.top_p} onChange={v => setParam('top_p', v)} min={0} max={1} />
            <ParamSlider label="Top K" value={params.top_k} onChange={v => setParam('top_k', v)} min={1} max={100} step={1} />
            <div style={S.col}>
              <span style={S.label}>Seed (blank=random)</span>
              <input type="number" value={params.seed} onChange={e => setParam('seed', e.target.value)} style={S.input} placeholder="e.g. 42" />
            </div>
            <div style={S.col}>
              <span style={S.label}>Max tokens (num_predict)</span>
              <input type="number" value={params.num_predict} onChange={e => setParam('num_predict', parseInt(e.target.value))} style={S.input} />
            </div>
            <div style={S.col}>
              <span style={S.label}>Context (num_ctx)</span>
              <input type="number" value={params.num_ctx} onChange={e => setParam('num_ctx', parseInt(e.target.value))} style={S.input} />
            </div>
          </div>
        </div>
      </div>
      {/* right: prompt + output */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={S.card}>
          <span style={S.label}>Prompt</span>
          <textarea rows={4} value={prompt} onChange={e => setPrompt(e.target.value)}
            placeholder="Enter your prompt…" style={S.textarea} />
          <div style={{ ...S.row, marginTop: 10 }}>
            <button onClick={run} disabled={streaming || !model} style={S.btn()}>
              {streaming ? '⏳ Generating…' : 'Generate'}
            </button>
            <button onClick={() => { setOutput(''); setStats(null); }} style={S.btn('secondary')}>Clear</button>
          </div>
        </div>
        <div style={{ ...S.card, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ ...S.row, marginBottom: 8 }}>
            <span style={S.label}>Output</span>
            {stats && (
              <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                {[['Time', stats.total], ['Tokens', stats.tokens], ['Speed', stats.speed], ['Prompt tokens', stats.ctx]].map(([k, v]) => (
                  <span key={k} style={{ fontSize: 11, color: C.muted }}><b style={{ color: C.text }}>{v}</b> {k}</span>
                ))}
              </div>
            )}
          </div>
          <div ref={outRef} style={{ ...S.pre, flex: 1, overflowY: 'auto', minHeight: 200 }}>
            {output || <span style={{ color: C.muted }}>Output will appear here…</span>}
            {streaming && <span style={{ color: C.accent }}>▋</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: MODELS
// ═══════════════════════════════════════════════════════════════════════════════
function ModelsTab({ models, onRefresh }) {
  const [selected, setSelected] = useState(null);
  const [info, setInfo] = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [pullName, setPullName] = useState('');
  const [pullLog, setPullLog] = useState('');
  const [pulling, setPulling] = useState(false);
  const [copyFrom, setCopyFrom] = useState('');
  const [copyTo, setCopyTo] = useState('');
  const [delConfirm, setDelConfirm] = useState(null);
  const [running, setRunning] = useState([]);
  const [modelfile, setModelfile] = useState('');
  const [newName, setNewName] = useState('');

  async function showInfo(name) {
    setSelected(name); setInfo(null); setLoadingInfo(true);
    try {
      const r = await fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'show', name }) });
      setInfo(await r.json());
    } catch (e) { setInfo({ error: e.message }); }
    setLoadingInfo(false);
  }

  async function pull() {
    if (!pullName.trim()) return;
    setPulling(true); setPullLog('');
    let log = '';
    try {
      const res = await fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'pull', name: pullName }) });
      await streamLines(res, (d) => {
        const line = d.status + (d.completed && d.total ? ` ${Math.round(d.completed / d.total * 100)}%` : '');
        log = line + '\n' + log;
        setPullLog(log);
      });
      onRefresh();
    } catch (e) { setPullLog('Error: ' + e.message); }
    setPulling(false);
  }

  async function deleteModel(name) {
    await fetch('/api/models', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    setDelConfirm(null); if (selected === name) { setSelected(null); setInfo(null); }
    onRefresh();
  }

  async function copyModel() {
    if (!copyFrom || !copyTo) return;
    await fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'copy', source: copyFrom, destination: copyTo }) });
    setCopyFrom(''); setCopyTo(''); onRefresh();
  }

  async function loadRunning() {
    const r = await fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ps' }) });
    const d = await r.json(); setRunning(d.models || []);
  }

  async function createModel() {
    if (!newName || !modelfile) return;
    let log = '';
    const res = await fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', name: newName, modelfile }) });
    await streamLines(res, (d) => { log = d.status + '\n' + log; setPullLog(log); });
    onRefresh();
  }

  useEffect(() => { loadRunning(); }, []);

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%' }}>
      {/* left: model list */}
      <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
        <div style={{ ...S.card, padding: '12px 14px' }}>
          <div style={{ ...S.row, justifyContent: 'space-between', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Installed ({models.length})</span>
            <button onClick={onRefresh} style={{ ...S.btn('secondary'), padding: '4px 10px', fontSize: 12 }}>↻ Refresh</button>
          </div>
          {models.length === 0 && <p style={{ color: C.muted, fontSize: 13 }}>No models. Pull one below.</p>}
          {models.map(m => (
            <div key={m.name} onClick={() => showInfo(m.name)} style={{
              padding: '8px 10px', borderRadius: 6, cursor: 'pointer', marginBottom: 4,
              background: selected === m.name ? C.accent + '33' : 'transparent',
              border: `1px solid ${selected === m.name ? C.accent : C.border}`,
              transition: 'all .15s',
            }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: selected === m.name ? '#a5b4fc' : C.text }}>{m.name}</div>
              <div style={{ fontSize: 11, color: C.muted }}>{fmtBytes(m.size)} · {fmtDate(m.modified_at)}</div>
            </div>
          ))}
        </div>

        {/* running models */}
        <div style={S.card}>
          <div style={{ ...S.row, justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14 }}>Running in memory</span>
            <button onClick={loadRunning} style={{ ...S.btn('secondary'), padding: '4px 10px', fontSize: 12 }}>↻</button>
          </div>
          {running.length === 0
            ? <p style={{ color: C.muted, fontSize: 12 }}>None</p>
            : running.map(m => <div key={m.name} style={{ fontSize: 12, color: C.text, marginBottom: 4 }}><b>{m.name}</b> · {fmtBytes(m.size)}</div>)}
        </div>

        {/* pull */}
        <div style={S.card}>
          <span style={S.label}>Pull a Model</span>
          <input value={pullName} onChange={e => setPullName(e.target.value)} placeholder="e.g. llama3.2, phi4, mistral"
            style={{ ...S.input, marginBottom: 8 }} onKeyDown={e => e.key === 'Enter' && pull()} />
          <button onClick={pull} disabled={pulling} style={S.btn()}>{pulling ? 'Pulling…' : 'Pull'}</button>
          {pullLog && <pre style={{ ...S.pre, marginTop: 8, maxHeight: 120 }}>{pullLog}</pre>}
        </div>

        {/* copy */}
        <div style={S.card}>
          <span style={S.label}>Copy / Rename</span>
          <input value={copyFrom} onChange={e => setCopyFrom(e.target.value)} placeholder="Source model" style={{ ...S.input, marginBottom: 6 }} />
          <input value={copyTo} onChange={e => setCopyTo(e.target.value)} placeholder="Destination name" style={{ ...S.input, marginBottom: 8 }} />
          <button onClick={copyModel} style={S.btn()}>Copy</button>
        </div>

        {/* create from modelfile */}
        <div style={S.card}>
          <span style={S.label}>Create from Modelfile</span>
          <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="New model name" style={{ ...S.input, marginBottom: 6 }} />
          <textarea rows={4} value={modelfile} onChange={e => setModelfile(e.target.value)}
            placeholder={'FROM llama3.2\nSYSTEM "You are a pirate."'} style={{ ...S.textarea, marginBottom: 8 }} />
          <button onClick={createModel} style={S.btn()}>Create</button>
        </div>
      </div>

      {/* right: model info */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {!selected && <div style={{ color: C.muted, marginTop: 40, textAlign: 'center' }}>Select a model to view details</div>}
        {selected && (
          <div style={S.card}>
            <div style={{ ...S.row, justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ margin: 0, fontSize: 18 }}>{selected}</h2>
              <div style={S.row}>
                {delConfirm === selected
                  ? <>
                      <span style={{ color: C.error, fontSize: 13 }}>Confirm delete?</span>
                      <button onClick={() => deleteModel(selected)} style={S.btn('danger')}>Yes, delete</button>
                      <button onClick={() => setDelConfirm(null)} style={S.btn('secondary')}>Cancel</button>
                    </>
                  : <button onClick={() => setDelConfirm(selected)} style={S.btn('danger')}>Delete</button>
                }
              </div>
            </div>
            {loadingInfo && <p style={{ color: C.muted }}>Loading…</p>}
            {info && !loadingInfo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {info.details && (
                  <div>
                    <p style={S.label}>Details</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {[['Family', info.details.family], ['Format', info.details.format], ['Params', info.details.parameter_size], ['Quant', info.details.quantization_level]].map(([k, v]) => v && (
                        <span key={k}><span style={{ color: C.muted, fontSize: 12 }}>{k}: </span><span style={{ fontSize: 13 }}>{v}</span></span>
                      ))}
                    </div>
                  </div>
                )}
                {info.parameters && (
                  <div><p style={S.label}>Parameters</p><pre style={S.pre}>{info.parameters}</pre></div>
                )}
                {info.template && (
                  <div><p style={S.label}>Template</p><pre style={S.pre}>{info.template}</pre></div>
                )}
                {info.modelfile && (
                  <div><p style={S.label}>Modelfile</p><pre style={{ ...S.pre, maxHeight: 300 }}>{info.modelfile}</pre></div>
                )}
                {info.license && (
                  <div><p style={S.label}>License</p><pre style={{ ...S.pre, maxHeight: 150 }}>{info.license}</pre></div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: EMBEDDINGS
// ═══════════════════════════════════════════════════════════════════════════════
function EmbeddingsTab({ models }) {
  const [model, setModel] = useState(models[0]?.name ?? '');
  const [text1, setText1] = useState('');
  const [text2, setText2] = useState('');
  const [emb1, setEmb1] = useState(null);
  const [emb2, setEmb2] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (models[0] && !model) setModel(models[0].name); }, [models]);

  async function embed() {
    if (!text1.trim() && !text2.trim()) return;
    setLoading(true); setError(''); setEmb1(null); setEmb2(null);
    try {
      const inputs = [text1, text2].filter(Boolean);
      const r = await fetch('/api/embeddings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, input: inputs }),
      });
      const d = await r.json();
      if (d.error) throw new Error(d.error);
      const embeddings = d.embeddings || [];
      if (text1) setEmb1(embeddings[0] ?? null);
      if (text2) setEmb2(embeddings[text1 ? 1 : 0] ?? null);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }

  const sim = emb1 && emb2 ? cosineSim(emb1, emb2) : null;
  const simColor = sim === null ? C.muted : sim > 0.85 ? C.success : sim > 0.5 ? C.warn : C.error;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 }}>
      <div style={S.card}>
        <div style={{ ...S.row, marginBottom: 12 }}>
          <div style={S.col}>
            <span style={S.label}>Model</span>
            <ModelSelector models={models} value={model} onChange={setModel} />
          </div>
          <button onClick={embed} disabled={loading} style={{ ...S.btn(), alignSelf: 'flex-end' }}>
            {loading ? 'Embedding…' : 'Get Embeddings'}
          </button>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, ...S.col }}>
            <span style={S.label}>Text A</span>
            <textarea rows={4} value={text1} onChange={e => setText1(e.target.value)} placeholder="First text…" style={S.textarea} />
          </div>
          <div style={{ flex: 1, ...S.col }}>
            <span style={S.label}>Text B (optional, for similarity)</span>
            <textarea rows={4} value={text2} onChange={e => setText2(e.target.value)} placeholder="Second text…" style={S.textarea} />
          </div>
        </div>
      </div>

      {error && <div style={{ color: C.error, padding: 12, background: C.error + '22', borderRadius: 8 }}>{error}</div>}

      {sim !== null && (
        <div style={{ ...S.card, textAlign: 'center' }}>
          <p style={S.label}>Cosine Similarity</p>
          <div style={{ fontSize: 48, fontWeight: 800, color: simColor }}>{sim.toFixed(4)}</div>
          <p style={{ color: C.muted, fontSize: 13 }}>
            {sim > 0.85 ? 'Very similar' : sim > 0.5 ? 'Somewhat related' : 'Quite different'}
          </p>
          <div style={{ height: 8, background: C.border, borderRadius: 99, margin: '0 auto', maxWidth: 300 }}>
            <div style={{ width: `${Math.max(0, Math.min(1, sim)) * 100}%`, height: '100%', background: simColor, borderRadius: 99, transition: 'width .4s' }} />
          </div>
        </div>
      )}

      {emb1 && (
        <div style={S.card}>
          <span style={S.label}>Embedding A — {emb1.length} dimensions</span>
          <pre style={{ ...S.pre, maxHeight: 120 }}>[{emb1.slice(0, 16).map(v => v.toFixed(6)).join(', ')}{emb1.length > 16 ? `, … (+${emb1.length - 16} more)` : ''}]</pre>
        </div>
      )}
      {emb2 && (
        <div style={S.card}>
          <span style={S.label}>Embedding B — {emb2.length} dimensions</span>
          <pre style={{ ...S.pre, maxHeight: 120 }}>[{emb2.slice(0, 16).map(v => v.toFixed(6)).join(', ')}{emb2.length > 16 ? `, … (+${emb2.length - 16} more)` : ''}]</pre>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: VISION
// ═══════════════════════════════════════════════════════════════════════════════
function VisionTab({ models }) {
  const [model, setModel] = useState('');
  const [prompt, setPrompt] = useState('Describe this image in detail.');
  const [imageB64, setImageB64] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [output, setOutput] = useState('');
  const [streaming, setStreaming] = useState(false);

  const visionModels = models.filter(m => /llava|bakllava|moondream|vision|minicpm|gemma3|llama3\.2.*vision/i.test(m.name));

  useEffect(() => { if (visionModels[0] && !model) setModel(visionModels[0].name); }, [models]);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImagePreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = () => setImageB64(reader.result.split(',')[1]);
    reader.readAsDataURL(file);
  }

  async function run() {
    if (!imageB64 || !model) return;
    setOutput(''); setStreaming(true);
    let text = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: true, messages: [{ role: 'user', content: prompt, images: [imageB64] }] }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      await streamLines(res, (d) => { if (d.message?.content) { text += d.message.content; setOutput(text); } });
    } catch (e) { setOutput('⚠ ' + e.message); }
    setStreaming(false);
  }

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      <div style={{ width: 340, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={S.card}>
          <span style={S.label}>Vision Model</span>
          {visionModels.length === 0
            ? <p style={{ color: C.warn, fontSize: 13 }}>No vision models detected. Pull one like <b>llava</b>, <b>moondream</b>, or <b>gemma3</b>.</p>
            : <ModelSelector models={visionModels} value={model} onChange={setModel} style={{ width: '100%' }} />
          }
        </div>
        <div style={S.card}>
          <span style={S.label}>Upload Image</span>
          <input type="file" accept="image/*" onChange={handleFile} style={{ color: C.text, fontSize: 13 }} />
          {imagePreview && <img src={imagePreview} alt="preview" style={{ marginTop: 12, maxWidth: '100%', borderRadius: 8, border: `1px solid ${C.border}` }} />}
        </div>
        <div style={S.card}>
          <span style={S.label}>Prompt</span>
          <textarea rows={3} value={prompt} onChange={e => setPrompt(e.target.value)} style={S.textarea} />
          <button onClick={run} disabled={streaming || !imageB64 || !model} style={{ ...S.btn(), marginTop: 10 }}>
            {streaming ? '⏳ Analyzing…' : 'Analyze Image'}
          </button>
        </div>
      </div>
      <div style={{ flex: 1, ...S.col }}>
        <div style={{ ...S.card, flex: 1 }}>
          <span style={S.label}>Response</span>
          <div style={{ ...S.pre, marginTop: 8, minHeight: 200, whiteSpace: 'pre-wrap' }}>
            {output || <span style={{ color: C.muted }}>Upload an image and click Analyze…</span>}
            {streaming && <span style={{ color: C.accent }}>▋</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: SERVER
// ═══════════════════════════════════════════════════════════════════════════════
function ServerTab() {
  const [version, setVersion] = useState(null);
  const [ps, setPs] = useState(null);
  const [raw, setRaw] = useState('');
  const [rawPath, setRawPath] = useState('/api/tags');
  const [rawMethod, setRawMethod] = useState('GET');
  const [rawBody, setRawBody] = useState('');
  const [rawOut, setRawOut] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [vr, pr] = await Promise.all([
        fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'version' }) }),
        fetch('/api/models', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'ps' }) }),
      ]);
      setVersion(await vr.json());
      setPs(await pr.json());
    } catch (e) { setVersion({ error: e.message }); }
    setLoading(false);
  }

  async function fireRaw() {
    try {
      const r = await fetch(`http://127.0.0.1:11434${rawPath}`, {
        method: rawMethod,
        headers: rawBody ? { 'Content-Type': 'application/json' } : {},
        body: rawBody || undefined,
      });
      const text = await r.text();
      try { setRawOut(JSON.stringify(JSON.parse(text), null, 2)); }
      catch { setRawOut(text); }
    } catch (e) { setRawOut('Error: ' + e.message); }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ display: 'flex', gap: 16, maxWidth: 1000 }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={S.card}>
          <div style={{ ...S.row, justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 700 }}>Server Status</span>
            <button onClick={load} style={S.btn('secondary')}>↻ Refresh</button>
          </div>
          {loading && <p style={{ color: C.muted }}>Checking…</p>}
          {version && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={S.dot(!version.error)} />
              {version.error
                ? <span style={{ color: C.error }}>{version.error}</span>
                : <span>Ollama <b>{version.version}</b> is running</span>}
            </div>
          )}
        </div>

        {ps && (
          <div style={S.card}>
            <span style={S.label}>Loaded Models (ps)</span>
            {(ps.models ?? []).length === 0
              ? <p style={{ color: C.muted, fontSize: 13 }}>No models currently loaded in memory.</p>
              : (ps.models ?? []).map(m => (
                  <div key={m.name} style={{ padding: '8px 0', borderBottom: `1px solid ${C.border}`, fontSize: 13 }}>
                    <b>{m.name}</b>
                    <span style={{ color: C.muted, marginLeft: 12 }}>{fmtBytes(m.size)} · expires {m.expires_at ? new Date(m.expires_at).toLocaleTimeString() : '—'}</span>
                  </div>
                ))
            }
          </div>
        )}

        <div style={S.card}>
          <span style={S.label}>Raw API Tester</span>
          <div style={{ ...S.row, marginBottom: 8 }}>
            <select value={rawMethod} onChange={e => setRawMethod(e.target.value)} style={{ ...S.select, width: 90 }}>
              {['GET','POST','DELETE'].map(m => <option key={m}>{m}</option>)}
            </select>
            <input value={rawPath} onChange={e => setRawPath(e.target.value)} style={{ ...S.input, flex: 1 }} placeholder="/api/…" />
          </div>
          <textarea rows={4} value={rawBody} onChange={e => setRawBody(e.target.value)}
            placeholder='JSON body (optional), e.g. {"model":"llama3.2"}' style={{ ...S.textarea, marginBottom: 8 }} />
          <button onClick={fireRaw} style={S.btn()}>Send Request</button>
          {rawOut && <pre style={{ ...S.pre, marginTop: 10, maxHeight: 300 }}>{rawOut}</pre>}
        </div>
      </div>

      <div style={{ width: 280, flexShrink: 0 }}>
        <div style={S.card}>
          <span style={S.label}>Quick API Reference</span>
          {[
            ['GET', '/api/tags', 'List installed models'],
            ['GET', '/api/version', 'Ollama version'],
            ['GET', '/api/ps', 'Running models'],
            ['POST', '/api/chat', 'Chat completion'],
            ['POST', '/api/generate', 'Text generation'],
            ['POST', '/api/embed', 'Embeddings'],
            ['POST', '/api/pull', 'Pull a model'],
            ['POST', '/api/show', 'Model info'],
            ['POST', '/api/copy', 'Copy model'],
            ['POST', '/api/create', 'Create from Modelfile'],
            ['DELETE', '/api/delete', 'Delete model'],
          ].map(([method, path, desc]) => (
            <div key={path} style={{ marginBottom: 8, fontSize: 12 }}>
              <span style={{ ...S.badge(method === 'GET' ? C.success : method === 'DELETE' ? C.error : C.accent), marginRight: 6 }}>{method}</span>
              <code style={{ color: C.text }}>{path}</code>
              <div style={{ color: C.muted, paddingLeft: 4 }}>{desc}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'chat', label: '💬 Chat' },
  { id: 'generate', label: '✨ Generate' },
  { id: 'models', label: '📦 Models' },
  { id: 'embeddings', label: '🔢 Embeddings' },
  { id: 'vision', label: '🖼 Vision' },
  { id: 'server', label: '⚙ Server' },
];

export default function Home() {
  const [tab, setTab] = useState('chat');
  const [models, setModels] = useState([]);
  const [connected, setConnected] = useState(null);

  async function fetchModels() {
    try {
      const r = await fetch('/api/models');
      const d = await r.json();
      setModels(d.models ?? []);
      setConnected(true);
    } catch {
      setConnected(false);
    }
  }

  useEffect(() => { fetchModels(); }, []);

  return (
    <div style={S.page}>
      {/* sidebar */}
      <nav style={S.sidebar}>
        <div style={S.sideTitle}>OLLAMA</div>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={S.tabBtn(tab === t.id)}>{t.label}</button>
        ))}
        <div style={{ marginTop: 'auto', padding: '16px 16px 0', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: C.muted }}>
            <div style={S.dot(connected)} />
            {connected === null ? 'Connecting…' : connected ? `${models.length} model${models.length !== 1 ? 's' : ''}` : 'Disconnected'}
          </div>
        </div>
      </nav>

      {/* main area */}
      <div style={S.main}>
        <header style={S.header}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{TABS.find(t => t.id === tab)?.label}</h1>
          {connected === false && (
            <span style={{ marginLeft: 'auto', color: C.error, fontSize: 13 }}>
              ⚠ Ollama not reachable at 127.0.0.1:11434 — run <code>ollama serve</code>
            </span>
          )}
        </header>
        <div style={S.content}>
          {tab === 'chat' && <ChatTab models={models} />}
          {tab === 'generate' && <GenerateTab models={models} />}
          {tab === 'models' && <ModelsTab models={models} onRefresh={fetchModels} />}
          {tab === 'embeddings' && <EmbeddingsTab models={models} />}
          {tab === 'vision' && <VisionTab models={models} />}
          {tab === 'server' && <ServerTab />}
        </div>
      </div>
    </div>
  );
}
