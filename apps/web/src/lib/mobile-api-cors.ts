export function mobileCredentialedHeaders(request: Request, methods: string) {
  const origin = request.headers.get("origin") ?? "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Vary": "Origin",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "private, no-store, max-age=0"
  };
}

export function mobileCredentialedFallbackHeaders(methods: string) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": methods,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "private, no-store, max-age=0"
  };
}
