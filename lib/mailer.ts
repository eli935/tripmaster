import nodemailer from "nodemailer";

/**
 * Gmail SMTP transport. Credentials live in env:
 *   GMAIL_USER           = sender address (e.g. eli@biglog.co.il)
 *   GMAIL_APP_PASSWORD   = 16-char Google app password (no spaces)
 *
 * Missing env → `sendInvitationEmail` returns { ok: false, skipped: true }
 * so local dev still works (admin sees the link manually).
 */
function createTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: { user, pass },
  });
}

interface InvitationEmailArgs {
  to: string;
  tripName: string;
  destination: string;
  inviterName: string;
  acceptUrl: string;
  message?: string | null;
}

export async function sendInvitationEmail(args: InvitationEmailArgs): Promise<
  | { ok: true }
  | { ok: false; skipped: true; reason: string }
  | { ok: false; skipped: false; error: string }
> {
  const transport = createTransport();
  if (!transport) {
    return {
      ok: false,
      skipped: true,
      reason: "GMAIL_USER / GMAIL_APP_PASSWORD not configured",
    };
  }

  const { to, tripName, destination, inviterName, acceptUrl, message } = args;

  const html = `
  <!DOCTYPE html>
  <html lang="he" dir="rtl">
    <head><meta charset="UTF-8" /></head>
    <body style="margin:0;padding:0;background:#0f0f10;font-family:'Frank Ruhl Libre','David',serif;color:#f2efe7;">
      <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
        <div style="text-align:center;margin-bottom:32px;">
          <span style="display:inline-block;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#D4A960;font-style:italic;">
            הזמנה לטיול משותף
          </span>
        </div>

        <div style="background:linear-gradient(135deg,#F4E4BC 0%,#D4A960 50%,#8B6F3A 100%);border-radius:24px;padding:40px 28px;text-align:center;color:#1a1206;margin-bottom:28px;">
          <h1 style="margin:0 0 8px;font-size:36px;font-weight:900;letter-spacing:-0.02em;line-height:1.05;">
            ${escapeHtml(tripName)}
          </h1>
          <p style="margin:0;font-size:14px;opacity:0.85;">${escapeHtml(destination)}</p>
        </div>

        <p style="font-size:16px;line-height:1.65;margin:0 0 16px;color:#e6e1d3;">
          שלום,<br>
          <strong>${escapeHtml(inviterName)}</strong> הזמין/ה אותך להצטרף לטיול המשותף הזה ב-TripMaster.
        </p>

        ${
          message
            ? `<blockquote style="margin:20px 0;padding:14px 20px;border-right:3px solid #D4A960;background:#1a1a1c;font-style:italic;color:#c5bfa8;border-radius:8px;">${escapeHtml(
                message
              )}</blockquote>`
            : ""
        }

        <p style="font-size:14px;line-height:1.65;margin:24px 0;color:#a8a293;">
          באפליקציה תמצא/י את תכנון הארוחות, רשימת הציוד והקניות, מעקב הוצאות ומאזן משפחתי, צ׳אט קבוצתי, וזמני הלכה לכל יום של הטיול. הכל בעברית ומותאם למשפחה דתית.
        </p>

        <div style="text-align:center;margin:32px 0;">
          <a href="${acceptUrl}" style="display:inline-block;background:linear-gradient(135deg,#F4E4BC 0%,#D4A960 50%,#8B6F3A 100%);color:#1a1206;text-decoration:none;padding:14px 40px;border-radius:999px;font-weight:600;font-size:16px;letter-spacing:0.02em;">
            אישור ההזמנה
          </a>
        </div>

        <p style="font-size:11px;color:#6b6757;text-align:center;line-height:1.5;margin-top:40px;">
          אם הכפתור לא עובד, העתק והדבק את הקישור:<br>
          <a href="${acceptUrl}" style="color:#D4A960;word-break:break-all;">${acceptUrl}</a>
        </p>

        <hr style="border:none;border-top:1px solid #2a2a2d;margin:32px 0;">
        <p style="font-size:10px;color:#5a5547;text-align:center;line-height:1.6;">
          הזמנה זו בתוקף 30 יום.<br>
          אם לא ביקשת לקבל הזמנה זו, אפשר פשוט להתעלם.
        </p>
      </div>
    </body>
  </html>
  `;

  try {
    await transport.sendMail({
      from: `"TripMaster" <${process.env.GMAIL_USER}>`,
      to,
      subject: `הזמנה לטיול: ${tripName}`,
      html,
    });
    return { ok: true };
  } catch (e: any) {
    return { ok: false, skipped: false, error: e?.message || "send_failed" };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
