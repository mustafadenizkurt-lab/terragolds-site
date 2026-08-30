const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/**
 * Changes every 6 hours, aligned to UTC 00/06/12/18 (same schedule as the XML
 * sync cron) since it buckets off the Unix epoch, which itself starts at
 * 00:00 UTC.
 */
export function sixHourBucket(now: number = Date.now()): number {
  return Math.floor(now / SIX_HOURS_MS);
}

/** Deterministic PRNG (mulberry32) so the same seed always shuffles the same way. */
function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const result = items.slice();
  const random = mulberry32(seed);
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

/**
 * Picks `count` items from `pool`, rotating to a different selection every 6
 * hours. `salt` decorrelates multiple showcases (e.g. "new" vs "discounted")
 * so they don't rotate in lockstep.
 */
export function pickRotatingShowcase<T>(
  pool: readonly T[],
  count: number,
  salt = 0,
  now: number = Date.now(),
): T[] {
  const seed = sixHourBucket(now) * 2654435761 + salt;
  return seededShuffle(pool, seed).slice(0, count);
}
