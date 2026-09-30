# GPT-Live 1 trial — Dominoes Tutor

A small local experiment for OpenAI’s **GPT-Live 1** (`gpt-live-1`) voice model. It opens a full-duplex WebRTC session with a spoken dominoes tutor, and can attach a separate **reasoning backend** for harder questions.

The OpenAI API key is used only by `server.mjs`. Voice and reasoning share that same key. It is never sent to the browser.

## Architecture

Official GPT-Live docs split the product in two:

1. **GPT-Live** handles the spoken conversation. It listens, speaks, and decides when to ask a backend for help.
2. **Responses delegation** is the reasoning layer. GPT-Live calls a Responses model, supplies conversation context, and speaks the result.

This trial follows that recommended path:

- Voice model: `gpt-live-1`
- Reasoning backend: **GPT-6 Luna** (`gpt-6-luna`), OpenAI’s current suggested starting backend for Live (`gpt-6-sol` for harder tasks)
- Mode: `delegation.type: "responses"` when the toggle is on

References:

- [Getting started with GPT-Live](https://developers.openai.com/api/docs/guides/live)
- [Delegation and tools](https://developers.openai.com/api/docs/guides/live-delegation)
- [Prompting GPT-Live](https://developers.openai.com/api/docs/guides/live-prompting)

## Reasoning toggle

The **Reasoning layer** switch is **on by default**.

| Toggle | What happens |
| --- | --- |
| **On** | Session is created with Responses delegation to GPT-6 Luna (`reasoning.effort: medium`, `summary: auto`). Harder questions can be handed off. Reasoning summaries appear in the transcript. Backend tokens are billed extra. |
| **Off** | Voice chat only. No Responses backend. The live prompt tells the tutor not to delegate. |

Live cannot change delegation mode after `session.started`. Turn the switch **before** you start a lesson. During a call the toggle is locked; end the lesson to change it.

## What this trial covers

| Capability | In this trial? |
| --- | --- |
| Live voice conversation | Yes |
| Typed questions + live captions | Yes, as Live context injects — not Realtime chat turns |
| Session cost / duration meter | Yes |
| Reasoning / thinking summaries | Yes, when the toggle is on |
| Delegation to GPT-6 Luna | Yes, when the toggle is on |
| Tools / function calling / web search | No |

## Billing

Two separate bills, one API key:

- **Voice (`gpt-live-1`)**: **$0.05 per minute**, billed per second. Idle time in an open session still counts.
- **Reasoning (`gpt-6-luna`)**: token usage from delegated Responses calls, billed at that model’s current Responses rates. The on-page dollar figure is a rough estimate.

The usage panel adds those together. Duration comes from official Live snapshots (`session.usage.updated`, then `session.closed`). Those snapshots are cumulative; they are not amounts to add together.

Creating a WebRTC session bills about 15 seconds of voice time during initialization. OpenAI credits that against the running session, so do not add another 15 seconds on top of the reported duration.

## Usage meter

- **Estimated USD** = voice time + delegated Luna tokens (if any)
- **Billed time** from Live usage events
- **Context** occupancy from `context_window.usage_ratio`
- **Backend tokens** from nested `response.completed` events
- **Reasoning** captions from `session.delegation.created` and `response.reasoning_summary_text.delta`

End the lesson with **End lesson** so the client can receive `session.closed` and freeze the final billed seconds.

## How it works

1. The browser builds a WebRTC peer connection and an `oai-events` data channel.
2. `POST /api/session` sends the SDP offer plus `{ reasoning: true|false }`.
3. The server posts to `https://api.openai.com/v1/live/sessions` with `gpt-live-1` and, if reasoning is on, `delegation.responses.model: "gpt-6-luna"`.
4. The browser applies the SDP answer and waits for `session.started`.
5. Audio, captions, usage, and nested Responses events arrive over the data channel.

The page also lets you type a question during a live session. GPT-Live does **not** accept Realtime’s `conversation.item.create`. Typed text is injected with `session.thinking.append` and `session.commentary.append` so the tutor can answer aloud. A voice-only app does not need this path.

Main files:

- `server.mjs` — local server, Live session creation, optional Responses delegation
- `index.html` — voice UI, reasoning toggle, captions, usage meter

## Run it

You need an OpenAI API project with access to `gpt-live-1` and `gpt-6-luna`.

1. Copy `.env.example` to `.env` and put your project API key in `OPENAI_API_KEY`. The server loads this file on startup. Uncommented values in `.env` override the same variable from your shell (for example `~/.zshrc`). Commented or missing keys still fall back to the shell.
2. Install packages:

   ```bash
   npm install
   ```

3. Start the server:

   ```bash
   npm start
   ```

4. Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Reasoning is on by default. Select **Start voice lesson** and allow microphone access.

Use `npm run dev` if you want the server to restart when `server.mjs` changes.
