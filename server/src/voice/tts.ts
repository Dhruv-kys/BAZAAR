const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb";
const MODEL_ID = process.env.ELEVENLABS_MODEL ?? "eleven_turbo_v2_5";

export async function synthesizeSpeech(text: string): Promise<Buffer> {
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
    method: "POST",
    headers: {
      "xi-api-key": process.env.ELEVENLABS_API_KEY ?? "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text, model_id: MODEL_ID }),
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
