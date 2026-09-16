import express from "express";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const app = express();
const port = Number(process.env.PORT ?? 3000);
const host = "127.0.0.1";
const __dirname = dirname(fileURLToPath(import.meta.url));

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

  try {
    const sessionRequest = {
      session: {
        model: "gpt-live-1",
        instructions: [
          "You are Domino, a friendly, patient dominoes tutor.",
          "Teach the user how to play standard double-six dominoes step by step.",
          "Use plain language, ask one helpful question at a time, and keep replies concise enough for a natural spoken conversation.",
          "Explain rules, setup, turns, scoring, and beginner strategy. Give small examples when useful.",
          "If rules differ by dominoes variant, state the common double-six rule first and then mention the variation.",
          "Do not invent a current official rulebook; say that house rules can differ.",
        ].join(" "),
      },
      transport: {
        type: "webrtc",
        sdp: request.body.sdp,
      },
    };
    const openAIResponse = await fetch("https://api.openai.com/v1/live/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sessionRequest),
    });
    const result = await openAIResponse.json();
    if (!openAIResponse.ok) {
      console.error("Live session creation failed:", result);
      return response.status(openAIResponse.status).json({
        error: result?.error?.message ?? "Unable to create the GPT-Live session.",
      });
    }

    return response.status(201).json(result);
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
