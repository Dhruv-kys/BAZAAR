const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "JBFqnCBsd6RMkjVDRZzb";
const MODEL_ID = process.env.ELEVENLABS_MODEL ?? "eleven_turbo_v2_5";
const LATENCY = process.env.ELEVENLABS_LATENCY ?? "3";

export async function synthesizeSpeech(text: string): Promise<ReadableStream<Uint8Array>> {
  const url =
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}/stream` +
    `?optimize_streaming_latency=${LATENCY}&output_format=mp3_44100_128`;

  const res = await fetch(url, {
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
  if (!res.body) {
    throw new Error("ElevenLabs returned no audio stream");
  }

  return res.body;
}
