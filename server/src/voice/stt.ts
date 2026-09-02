import { catalogKeyterms } from "../catalog/catalog.js";

const DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL ?? "nova-3";
const DEEPGRAM_LANGUAGE = process.env.DEEPGRAM_LANGUAGE ?? "multi";

function deepgramUrl(): string {
  const params = new URLSearchParams({
    model: DEEPGRAM_MODEL,
    language: DEEPGRAM_LANGUAGE,
    smart_format: "true",
    punctuate: "true",
  });
  for (const term of catalogKeyterms()) params.append("keyterm", term);
  return `https://api.deepgram.com/v1/listen?${params.toString()}`;
}

interface DeepgramResponse {
  results?: { channels?: { alternatives?: { transcript?: string }[] }[] };
}

export async function transcribeAudio(audio: Buffer, contentType: string): Promise<string> {
  const res = await fetch(deepgramUrl(), {
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
