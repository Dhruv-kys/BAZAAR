import type { NextFunction, Request, Response } from "express";

const CLEANUP_INTERVAL_MS = 60_000;

export interface SlidingWindow {
  hit(key: string, now?: number): boolean;
}

export function createSlidingWindow(maxRequests: number, windowMs: number): SlidingWindow {
  const hits = new Map<string, number[]>();
  let lastCleanup = 0;

  return {
    hit(key, now = Date.now()) {
      if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
        lastCleanup = now;
        for (const [k, times] of hits) {
          if (times.every((t) => now - t >= windowMs)) hits.delete(k);
        }
      }

      const times = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (times.length >= maxRequests) {
        hits.set(key, times);
        return false;
      }
      times.push(now);
      hits.set(key, times);
      return true;
    },
  };
}

export function rateLimit(maxRequests: number, windowMs: number) {
  const window = createSlidingWindow(maxRequests, windowMs);
  return (req: Request, res: Response, next: NextFunction) => {
    if (!window.hit(req.ip ?? "unknown")) {
      res.status(429).json({ error: "Too many requests. Wait a moment and try again." });
      return;
    }
    next();
  };
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
}
