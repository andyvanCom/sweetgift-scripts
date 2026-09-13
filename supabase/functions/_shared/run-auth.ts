export const NEW_RUN_SECRET_HEADER = "x-sweetgift-run-secret";

export type RunAuthConfig = {
  newSecret: string | null | undefined;
  legacySecret: string | null | undefined;
  legacyHeaders: string[];
};

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );
}

export async function timingSafeEqual(
  supplied: string | null | undefined,
  expected: string | null | undefined,
): Promise<boolean> {
  if (!supplied || !expected) return false;

  const [left, right] = await Promise.all([digest(supplied), digest(expected)]);
  let difference = 0;

  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }

  return difference === 0;
}

function legacyHeaderValue(request: Request, header: string): string | null {
  const value = request.headers.get(header);
  if (!value) return null;

  if (header.toLowerCase() === "authorization") {
    const match = value.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
  }

  return value.trim() || null;
}

export async function authorizeRunRequest(
  request: Request,
  config: RunAuthConfig,
): Promise<boolean> {
  const suppliedNew = request.headers.get(NEW_RUN_SECRET_HEADER);

  if (await timingSafeEqual(suppliedNew, config.newSecret)) {
    return true;
  }

  for (const header of config.legacyHeaders) {
    if (
      await timingSafeEqual(
        legacyHeaderValue(request, header),
        config.legacySecret,
      )
    ) {
      return true;
    }
  }

  return false;
}

export function forwardRunAuthHeaders(request: Request): Headers {
  const headers = new Headers({ "Content-Type": "application/json" });
  const newSecret = request.headers.get(NEW_RUN_SECRET_HEADER);
  const legacySecret = request.headers.get("x-report-secret");

  if (newSecret) headers.set(NEW_RUN_SECRET_HEADER, newSecret);
  if (legacySecret) headers.set("x-report-secret", legacySecret);

  return headers;
}
