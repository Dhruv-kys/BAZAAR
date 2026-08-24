import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

export const config = {
  port: Number(process.env.PORT ?? 3001),
};

const FEATURE_KEYS = {
  chat: ["OPENAI_API_KEY"],
  payments: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"],
  webhooks: ["RAZORPAY_WEBHOOK_SECRET"],
} as const;

export type Feature = keyof typeof FEATURE_KEYS;

export function missingKeysFor(feature: Feature): string[] {
  return FEATURE_KEYS[feature].filter((key) => !process.env[key]);
}

export function reportConfig(): void {
  const disabled = (Object.keys(FEATURE_KEYS) as Feature[])
    .map((feature) => ({ feature, missing: missingKeysFor(feature) }))
    .filter((entry) => entry.missing.length > 0);

  if (disabled.length === 0) return;

  console.warn("Some features are disabled because environment variables are missing:");
  for (const { feature, missing } of disabled) {
    console.warn(`  ${feature}: set ${missing.join(", ")} in .env`);
  }
}
