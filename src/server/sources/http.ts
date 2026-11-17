export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly url: string,
  ) {
    super(message);
  }
}

export interface JsonResponse<T> {
  body: T;
  /** Value of X-Mock-Reference-Date — the API's notion of "today". */
  referenceDate: Date | null;
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

/** GET JSON with exponential backoff on transient failures. */
export async function getJson<T>(
  url: string,
  headers: Record<string, string>,
  { retries = 4 }: { retries?: number } = {},
): Promise<JsonResponse<T>> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, { headers, cache: "no-store" });
    } catch (err) {
      if (attempt >= retries) throw err;
      await sleep(backoff(attempt));
      continue;
    }

    if (RETRYABLE.has(res.status) && attempt < retries) {
      const retryAfter = Number(res.headers.get("retry-after"));
      await sleep(retryAfter > 0 ? retryAfter * 1000 : backoff(attempt));
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new ApiError(`GET ${url} → ${res.status}: ${text.slice(0, 300)}`, res.status, url);
    }

    const ref = res.headers.get("x-mock-reference-date");
    return { body: (await res.json()) as T, referenceDate: ref ? new Date(ref) : null };
  }
}

const backoff = (attempt: number) => 300 * 2 ** attempt + Math.random() * 200;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Run `fn` over items with at most `limit` in flight. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        results[i] = await fn(items[i]);
      }
    }),
  );
  return results;
}
