import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(import.meta.dirname, "../../.env") });

export const config = {
  port: Number(process.env.PORT ?? 3001),
};
