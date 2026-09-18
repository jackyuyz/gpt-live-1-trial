import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const host = "127.0.0.1";
const __dirname = dirname(fileURLToPath(import.meta.url));

// OpenAI's GPT-Live guide: start with GPT-5.6 Terra for the Responses reasoning backend.
const REASONING_MODEL = "gpt-5.6-terra";

const liveVoiceInstructions = [
  "You are Domino, a calm, friendly voice tutor for standard double-six dominoes.",
  "Speak warmly and naturally, at an unhurried pace. Be clear and direct, not overly cheerful.",
  "If the user is frustrated, acknowledge it briefly and focus on the next helpful step.",
  "Backchannel policy: Use moderate backchannels. Acknowledge naturally without competing with the main response.",
  "Interruption policy: Stop speaking when the user interrupts. Listen to what they say.",
  "Use plain language, ask one helpful question at a time, and keep replies concise enough for a natural spoken conversation.",
].join(" ");

const liveDelegationPolicy = [
  "Delegation policy:",
  "Backend tools:",
  "- Careful reasoning: compare variants, scoring examples, strategy tradeoffs, and multi-step rule explanations.",
  "Delegate to the backend when:",
  "- The request needs careful reasoning beyond a simple reply.",
  "- The user asks about scoring, strategy, or how variants differ.",
  "- A correction changes an explanation already in progress.",
  "Do not delegate to the backend when:",
  "- The user greets you or asks you to repeat a result already provided.",
  "- You can answer from the conversation or a still-current result.",
  "- You need a brief clarification to understand the request.",
  "Delegate before giving an answer that depends on backend work.",
  "Do not guess the result while waiting.",
].join(" ");

const liveNoDelegationPolicy = [
  "Do not delegate to a backend. Answer from the conversation yourself.",
  "Explain rules, setup, turns, scoring, and beginner strategy. Give small examples when useful.",
  "If rules differ by dominoes variant, state the common double-six rule first and then mention the variation.",
  "Do not invent a current official rulebook; say that house rules can differ.",
].join(" ");

const reasoningBackendInstructions = [
  "You are the reasoning backend for Domino, a spoken double-six dominoes tutor.",
  "Return a concise, accurate answer the live tutor can speak aloud.",
  "Cover rules, setup, turns, scoring, and beginner strategy. Give small examples when useful.",
  "If variants differ, state the common double-six rule first, then the variation.",
  "Do not invent a current official rulebook; say house rules can differ.",
  "Prefer short spoken-friendly prose over lists unless a list is essential.",
].join(" ");

app.use(express.json({ limit: "64kb" }));
app.use(express.static(__dirname));

app.post("/api/session", async (request, response) => {
  const expectedOrigin = `http://${host}:${port}`;
  if (request.headers.origin !== expectedOrigin) {
    return response.status(403).json({ error: "Unexpected request origin." });
  }

  if (typeof request.body?.sdp !== "string" || !request.body.sdp.trim()) {
    return response.status(400).json({ error: "An SDP offer is required." });
  }

  if (!process.env.OPENAI_API_KEY) {
    return response.status(503).json({
      error: "OPENAI_API_KEY is not set. Add it to this project's environment, then restart the server.",
    });
  }

  const reasoningEnabled = request.body?.reasoning !== false;

  try {
    const session = {
      model: "gpt-live-1",
      instructions: reasoningEnabled
        ? `${liveVoiceInstructions} ${liveDelegationPolicy}`
        : `${liveVoiceInstructions} ${liveNoDelegationPolicy}`,
    };

    if (reasoningEnabled) {
      session.delegation = {
        type: "responses",
        responses: {
          model: REASONING_MODEL,
          instructions: reasoningBackendInstructions,
          reasoning: { effort: "medium", summary: "auto" },
          text: { verbosity: "low" },
        },
      };
    }

    const openAIResponse = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session,
        transport: {
          type: "webrtc",
          sdp: request.body.sdp,
        },
      }),
    });
    const result = await openAIResponse.json();
    if (!openAIResponse.ok) {
      console.error("Live session creation failed:", result);
      return response.status(openAIResponse.status).json({
        error: result?.error?.message ?? "Unable to create the GPT-Live session.",
      });
    }

    return response.status(201).json({
      ...result,
      reasoning: {
        enabled: reasoningEnabled,
        model: reasoningEnabled ? REASONING_MODEL : null,
      },
    });
  } catch (error) {
    console.error("Live session creation failed:", error);
    return response.status(502).json({
      error: "Unable to reach the GPT-Live API. Check the server terminal for details.",
    });
  }
});

app.get("/", (_request, response) => response.sendFile(join(__dirname, "index.html")));

app.listen(port, host, () => {
  console.log(`Dominoes tutor: http://${host}:${port}`);
});
