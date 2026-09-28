// Desktop supplies its exact listening origin; Next may normalize loopback URLs.
export function isAllowedOrigin(request: Request, configuredOrigin?: string): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === (configuredOrigin || new URL(request.url).origin);
}
