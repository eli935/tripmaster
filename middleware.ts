import { NextResponse, type NextRequest } from "next/server";

// SHUTDOWN MODE — project is intentionally offline.
// All requests short-circuited to a 503 static page. Original middleware
// preserved in git history (revert this commit to bring the app back).
export function middleware(_request: NextRequest) {
  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>TripMaster — כבוי</title>
<style>
  html,body{margin:0;height:100%}
  body{display:grid;place-items:center;font-family:system-ui,-apple-system,sans-serif;background:#0a0a0f;color:#fafafa}
  .card{text-align:center;padding:2rem;max-width:28rem}
  h1{font-size:1.5rem;margin:0 0 .75rem;font-weight:600}
  p{color:#a1a1aa;line-height:1.7;margin:0}
</style>
</head>
<body>
  <div class="card">
    <h1>המערכת כבויה</h1>
    <p>TripMaster אינה זמינה כעת.</p>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status: 503,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export const config = {
  matcher: ["/((?!_next/static|favicon).*)"],
};
