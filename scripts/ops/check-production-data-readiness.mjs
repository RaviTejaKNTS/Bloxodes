const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const MAX_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 10_000;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Production data readiness check requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and a Supabase API key."
  );
  process.exit(1);
}

const endpoint = new URL("/rest/v1/code_pages", SUPABASE_URL);
endpoint.searchParams.set("select", "id");
endpoint.searchParams.set("limit", "1");

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  try {
    const response = await fetch(endpoint, {
      method: "HEAD",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`
      },
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });

    if (response.ok) {
      console.log(`Production data readiness check passed on attempt ${attempt}.`);
      process.exit(0);
    }

    console.error(
      `Production data readiness check attempt ${attempt}/${MAX_ATTEMPTS} returned HTTP ${response.status}.`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Production data readiness check attempt ${attempt}/${MAX_ATTEMPTS} failed: ${message}`
    );
  }

  if (attempt < MAX_ATTEMPTS) {
    await wait(2 ** (attempt - 1) * 1_000);
  }
}

console.error("Production data remained unavailable; refusing to start the application build.");
process.exit(1);
