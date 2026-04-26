// OpenAI-powered storyboard + keyframe generation.
// Modes: "storyboard" (chat completions w/ tool calling) and "keyframe" (image generation).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  mode: "storyboard" | "keyframe";
  prompt: string;
  count?: number;
  style?: string;
  referenceDataUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;
    if (!body?.prompt || !body?.mode) {
      return json({ error: "prompt and mode are required" }, 400);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) {
      return json({ error: "OPENAI_API_KEY is not configured" }, 500);
    }

    if (body.mode === "storyboard") {
      const count = Math.max(2, Math.min(12, body.count ?? 6));
      const sys = `You are an animation director. Break a short scene description into ${count} concise storyboard beats. Each beat: one camera/action sentence (<= 18 words). Return JSON via the tool only.`;

      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: sys },
            { role: "user", content: body.prompt },
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_storyboard",
              description: "Return storyboard beats",
              parameters: {
                type: "object",
                properties: {
                  beats: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        label: { type: "string" },
                        description: { type: "string" },
                      },
                      required: ["label", "description"],
                    },
                  },
                },
                required: ["beats"],
              },
            },
          }],
          tool_choice: { type: "function", function: { name: "return_storyboard" } },
        }),
      });

      if (!resp.ok) return passThrough(resp);
      const data = await resp.json();
      const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
      const parsed = args ? JSON.parse(args) : { beats: [] };
      return json(parsed);
    }

    if (body.mode === "keyframe") {
      const styleHint = body.style ?? "clean black and white line art, minimal hatching, white background";
      const refHint = body.referenceDataUrl
        ? " Maintain visual consistency with a previously established character design."
        : "";
      const fullPrompt = `${body.prompt}. Style: ${styleHint}.${refHint} Single illustration, no text.`;

      const resp = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: fullPrompt,
          size: "1024x1024",
          n: 1,
        }),
      });

      if (!resp.ok) return passThrough(resp);
      const data = await resp.json();
      const b64 = data.data?.[0]?.b64_json;
      const url = data.data?.[0]?.url;
      let imageDataUrl: string | undefined;
      if (b64) imageDataUrl = `data:image/png;base64,${b64}`;
      else if (url) imageDataUrl = url;
      if (!imageDataUrl) return json({ error: "No image returned" }, 502);
      return json({ imageDataUrl });
    }

    return json({ error: "Unknown mode" }, 400);
  } catch (e) {
    console.error("ai-direction error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function passThrough(resp: Response) {
  const t = await resp.text();
  console.error("OpenAI error", resp.status, t);
  if (resp.status === 429) return json({ error: "OpenAI rate limit hit. Please wait and retry." }, 429);
  if (resp.status === 401) return json({ error: "Invalid OPENAI_API_KEY." }, 401);
  if (resp.status === 402 || resp.status === 403) {
    return json({ error: "OpenAI billing issue. Check your account credits/limits." }, 402);
  }
  return json({ error: `OpenAI error: ${t.slice(0, 300)}` }, 500);
}
