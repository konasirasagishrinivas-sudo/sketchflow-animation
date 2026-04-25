// Lovable AI gateway proxy for storyboard + keyframe sketches.
// Two modes: "storyboard" (text JSON) and "keyframe" (image generation).

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
  referenceDataUrl?: string; // for keyframe consistency
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const body = (await req.json()) as Body;
    if (!body?.prompt || !body?.mode) {
      return json({ error: "prompt and mode are required" }, 400);
    }

    if (body.mode === "storyboard") {
      const count = Math.max(2, Math.min(12, body.count ?? 6));
      const sys = `You are an animation director. Break a short scene description into ${count} concise storyboard beats. Each beat: one camera/action sentence (<= 18 words). Return JSON via the tool only.`;
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
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
      const fullPrompt = `${body.prompt}. Style: ${styleHint}. Single illustration, no text.`;
      const messages: any[] = [{
        role: "user",
        content: body.referenceDataUrl
          ? [
              { type: "text", text: fullPrompt + " Match the character in the reference image." },
              { type: "image_url", image_url: { url: body.referenceDataUrl } },
            ]
          : fullPrompt,
      }];

      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-image",
          messages,
          modalities: ["image", "text"],
        }),
      });

      if (!resp.ok) return passThrough(resp);
      const data = await resp.json();
      const imgUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (!imgUrl) return json({ error: "No image returned" }, 502);
      return json({ imageDataUrl: imgUrl });
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
  if (resp.status === 429) return json({ error: "AI is rate-limited. Please wait a moment." }, 429);
  if (resp.status === 402) return json({ error: "AI credits exhausted. Add credits in Workspace settings." }, 402);
  const t = await resp.text();
  console.error("AI gateway error", resp.status, t);
  return json({ error: "AI gateway error" }, 500);
}
