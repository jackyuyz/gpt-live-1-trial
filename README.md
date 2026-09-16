# GPT-Live 1 trial — Dominoes Tutor

A small local experiment for OpenAI’s **GPT-Live 1** (`gpt-live-1`) voice model. It opens a full-duplex WebRTC session with a spoken dominoes tutor so you can try the Live API without a larger app around it.

The OpenAI API key is used only by `server.mjs`. It is never sent to the browser.

## What this trial covers

GPT-Live 1 is a full-duplex voice model: it can listen and speak at the same time. This project uses that voice layer only.

| Capability | In this trial? |
| --- | --- |
| Live voice conversation | Yes |
| Typed questions + live captions | Yes |
| Session cost / duration meter | Yes |
| Reasoning / thinking output | **No** |
| Delegation to a backend model | **No** |
| Tools / function calling | **No** |

Right now this is **just chatting**. The session is created with `model: "gpt-live-1"` and spoken-tutor instructions. There is no `delegation`, no tools, and no separate reasoning model. The tutor can listen, speak, and teach from its instructions, but it will not spin up a backend model to “think harder,” and it will not show a thinking trace.

GPT-Live can attach a backend Responses model for deeper reasoning and tool use. That is intentionally not wired up here.

## Billing (not tokens)

`gpt-live-1` is billed by **voice session time**, not by tokens:

- **$0.05 per minute**
- billed **per second** (not rounded up to a whole minute)
- idle time in an open session still counts (listening, speaking, or silence)

Backend model and tool usage would be extra, if you later add delegation. This trial does not do that, so the usual bill is only the voice-session duration.

The page estimates cost as:

```text
(billable seconds ÷ 60) × $0.05
```

Duration comes from official Live events (`session.usage.updated`, then the final `session.closed` snapshot). Those usage payloads are **cumulative snapshots**, not amounts to add together.

Creating a WebRTC session bills about 15 seconds of voice time during initialization. OpenAI credits that against the running session, so do not add another 15 seconds on top of the reported duration.

Official references:

- [GPT-Live 1 model](https://developers.openai.com/api/docs/models/gpt-live-1)
- [Managing GPT-Live sessions](https://developers.openai.com/api/docs/guides/live-conversations)
- [Voice cost optimization](https://developers.openai.com/api/docs/guides/voice-latency-cost)

## Usage meter

The UI shows a live **This session** panel:

- **Estimated USD** for the current voice session
- **Billed time** from Live usage events (with a short local tick between snapshots)
- **Context** occupancy from `context_window.usage_ratio`
- **Backend tokens** from nested Responses completion events, if any

Because this trial does not delegate backend work, **Backend tokens stays at 0**. End the lesson with **End lesson** so the client can receive `session.closed` and freeze the final billed seconds. Closing the tab immediately can leave usage unconfirmed.

## How it works

1. The browser builds a WebRTC peer connection and an `oai-events` data channel.
2. `POST /api/session` sends the SDP offer to the local Express server.
3. The server posts to `https://api.openai.com/v1/live/sessions` with the `gpt-live-1` session config.
4. The browser applies the SDP answer and waits for `session.started`.
5. Audio, captions, and usage events arrive over the data channel.

Main files:

- `server.mjs` — local server and Live session creation
- `index.html` — voice UI, captions, and usage meter

## Run it

You need an OpenAI API project with access to `gpt-live-1`.

1. Copy `.env.example` to `.env` and put your project API key in `OPENAI_API_KEY`.
2. Load that key into the shell (this server does not auto-load `.env`):

   ```bash
   set -a
   source .env
   set +a
   ```

3. Install packages:

   ```bash
   npm install
   ```

4. Start the server:

   ```bash
   npm start
   ```

5. Open [http://127.0.0.1:3000](http://127.0.0.1:3000), select **Start voice lesson**, and allow microphone access.

Use `npm run dev` if you want the server to restart when `server.mjs` changes.

## If you extend it

To add reasoning later, configure Live **delegation** so the voice session can hand hard work to a backend Responses model. That would:

- keep the voice frontend billed by time
- add a second bill for backend tokens / tools
- make **Backend tokens** on the usage panel start moving
