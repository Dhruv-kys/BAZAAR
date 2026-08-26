const DEEPGRAM_URL = "https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true";

interface DeepgramResponse {
  results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
}

export async function transcribeAudio(audio: Buffer, contentType: string): Promise<string> {
  const res = await fetch(DEEPGRAM_URL, {
    method: "POST",
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      "Content-Type": contentType,
    },
    body: new Uint8Array(audio),
  });

  if (!res.ok) {
    throw new Error(`Deepgram responded ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data = (await res.json()) as DeepgramResponse;
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ?? "";
}
