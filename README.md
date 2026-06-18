# Ollama Explorer

A full-featured Next.js web UI for exploring every major Ollama capability — chat, generation, model management, embeddings, vision, and a live API tester.

---

## How I Set This Up (Step by Step)

### 1. Install Ollama

Download and install from https://ollama.com/download, then start the server:

```bash
ollama serve
```

Ollama runs locally at `http://localhost:11434` by default.

### 2. Pull a Model

```bash
ollama pull gemma3:4b         # general chat & generation
ollama pull qwen2.5-coder:7b  # code-focused model (used in Continue)
ollama pull llava              # vision / image understanding
ollama pull nomic-embed-text   # embeddings
```

List what you have installed:

```bash
ollama list
```

### 3. Create the Next.js App

Started with a minimal Next.js 13 app (Pages Router) with a single chat page and one API route proxying to Ollama.

```bash
npx create-next-app@13 ollama-next-app --no-typescript --no-tailwind --no-eslint
cd ollama-next-app
npm run dev
```

### 4. Build the Ollama Explorer UI

Extended the app to cover every major Ollama API feature across 6 tabs:

| Tab | Feature |
|-----|---------|
| **Chat** | Streaming multi-turn chat with system prompt, temperature, keep-alive |
| **Generate** | Raw text completion with temperature / top-p / top-k / seed / num_ctx sliders + live tok/s stats |
| **Models** | List models, view Modelfile/template/license, pull with live progress, delete, copy/rename, create from Modelfile |
| **Embeddings** | Get embedding vectors, compare two texts with cosine similarity score |
| **Vision** | Upload an image and query multimodal models (llava, moondream, gemma3, etc.) |
| **Server** | Version/status, running models (`ps`), raw HTTP API tester |

New API routes added:

```
pages/api/chat.js        →  POST /api/chat      (streaming)
pages/api/generate.js    →  POST /api/generate  (streaming)
pages/api/models.js      →  list, pull, delete, show, copy, create, ps, version
pages/api/embeddings.js  →  POST /api/embed
```

### 5. Configure Continue (VS Code AI Assistant)

[Continue](https://marketplace.visualstudio.com/items?itemName=Continue.continue) is a VS Code extension that gives you AI chat and tab autocomplete powered by your local Ollama models.

**Install Continue** from the VS Code Extensions panel.

**Open its config:**
```
Ctrl + Shift + P  →  Continue: Open Config
```

This opens `~/.continue/config.yaml`. Add the Ollama + Qwen config:

```yaml
name: Main Config
version: 1.0.0
schema: v1

models:
  - title: Qwen2.5 Coder 7B
    provider: ollama
    model: qwen2.5-coder:7b
    apiBase: http://localhost:11434

tabAutocompleteModel:
  title: Qwen Autocomplete
  provider: ollama
  model: qwen2.5-coder:7b
  apiBase: http://localhost:11434
```

Then reload:
```
Ctrl + Shift + P  →  Continue: Reload Config
```

You now have:
- **Chat panel** — ask questions about your code using `qwen2.5-coder:7b`
- **Tab autocomplete** — start typing and press Tab to accept AI suggestions

---

## Running the App

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the sidebar shows Ollama connection status and model count.

---

## Project Structure

```
pages/
  index.js            Main UI — all 6 tabs
  api/
    chat.js           Streaming chat proxy
    generate.js       Streaming generate proxy
    models.js         Model management (list/pull/delete/show/copy/create/ps/version)
    embeddings.js     Embeddings proxy
    ollama.js         Original minimal proxy (kept for reference)
```

---

## Ollama Quick Reference

```bash
# Server
ollama serve                          # start server
ollama list                           # list installed models
ollama ps                             # show models loaded in memory

# Models
ollama pull llama3.2                  # download a model
ollama run gemma3:4b                  # interactive chat in terminal
ollama run gemma3:4b "why is sky blue?"  # one-off prompt
ollama rm gemma3:4b                   # delete model

# HTTP API (direct)
curl http://localhost:11434/api/tags                      # list models
curl http://localhost:11434/api/version                   # version
curl http://localhost:11434/api/generate -d '{"model":"gemma3:4b","prompt":"Hello","stream":false}'
curl http://localhost:11434/api/chat -d '{"model":"gemma3:4b","messages":[{"role":"user","content":"Hi"}]}'
curl http://localhost:11434/api/embed  -d '{"model":"nomic-embed-text","input":"Hello world"}'
```

---

## Stack

- **Next.js 13** (Pages Router)
- **React 18** — hooks only, inline styles, no CSS framework
- **Ollama** — local LLM runtime
- **Continue** — VS Code extension for AI-assisted coding
- All streaming done via `ReadableStream` on both server and client side
