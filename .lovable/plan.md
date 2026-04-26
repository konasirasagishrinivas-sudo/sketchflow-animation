## Switch AI Direction to OpenAI

Replace the Lovable AI gateway calls in the `ai-direction` edge function with direct OpenAI API calls using your own `OPENAI_API_KEY`.

### What changes

**1. Add `OPENAI_API_KEY` secret**
You'll be prompted to paste your OpenAI API key (from https://platform.openai.com/api-keys). It's stored securely as a backend secret — never exposed to the browser.

**2. Update `supabase/functions/ai-direction/index.ts`**
- **Storyboard mode** (text → beats): call `https://api.openai.com/v1/chat/completions` with `gpt-4o-mini` using OpenAI tool-calling (same JSON schema as today, so the frontend keeps working unchanged).
- **Keyframe mode** (text → image): call `https://api.openai.com/v1/images/generations` with `gpt-image-1`, return the image as a base64 data URL so `onAddImageFrame` keeps working.
  - Note: OpenAI image generation does not natively accept a character reference image the way Gemini does. The reference image will be described in the prompt instead (best-effort consistency). If you need true reference-image conditioning, that requires a different provider — let me know.
- Keep CORS headers, error handling, and the 429/402 messages.

**3. No frontend changes**
`AiDirection.tsx` already calls the edge function via `supabase.functions.invoke("ai-direction", ...)` and reads `beats` / `imageDataUrl` from the response. The contract stays identical.

### Cost note
OpenAI billing is on your own OpenAI account, not Lovable credits. `gpt-image-1` images cost ~$0.04–0.17 each depending on size; `gpt-4o-mini` storyboard calls are fractions of a cent.

### Files touched
- `supabase/functions/ai-direction/index.ts` (rewrite)
- New secret: `OPENAI_API_KEY`
