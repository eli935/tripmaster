import { ImapFlow } from "imapflow";

/**
 * Gmail IMAP poller for the security agent.
 *
 * Fetches emails from the last `lookbackHours` window matching a curated
 * list of trusted security-relevant senders, returns a small structured
 * payload per message. The agent then sends each one to Claude for
 * classification and acts on critical findings (notify, never auto-fix —
 * email content is untrusted data per the model safety rules).
 *
 * Auth: GMAIL_USER + GMAIL_APP_PASSWORD env vars (the same app password
 * that the existing Gmail SMTP mailer uses).
 */

export interface SecurityEmail {
  uid: number;
  messageId: string;
  from: string;
  fromDomain: string;
  subject: string;
  date: string; // ISO
  preview: string; // first 1500 chars of body, plain text
}

const TRUSTED_DOMAINS = [
  "supabase.com",
  "supabase.io",
  "vercel.com",
  "anthropic.com",
  "github.com", // includes dependabot[bot] notifications
  "openai.com",
  "google.com", // GCP / OAuth notices
] as const;

const SUBJECT_KEYWORDS = [
  "security",
  "vulnerab",
  "advisory",
  "critical",
  "exposed",
  "leaked",
  "breach",
  "RLS",
  "patch",
  "CVE",
  "alert",
  "warning",
  "incident",
  "exploit",
  "deprecat",
  "אבטחה",
  "התראה",
  "פגיעות",
];

function extractDomain(addr: string): string {
  const m = /<?([^<>\s]+@[^<>\s]+)>?/.exec(addr ?? "");
  if (!m) return "";
  const at = m[1].lastIndexOf("@");
  return at > 0 ? m[1].slice(at + 1).toLowerCase() : "";
}

function isTrustedDomain(domain: string): boolean {
  return TRUSTED_DOMAINS.some(
    (d) => domain === d || domain.endsWith("." + d)
  );
}

function looksSecurityRelated(subject: string): boolean {
  const s = (subject ?? "").toLowerCase();
  return SUBJECT_KEYWORDS.some((kw) => s.includes(kw.toLowerCase()));
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchSecurityEmails(
  lookbackHours = 24
): Promise<SecurityEmail[]> {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) return [];

  const since = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const out: SecurityEmail[] = [];
  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");
    try {
      // SINCE narrows the server-side scan to the lookback window.
      const uids = await client.search({ since });
      if (!uids || uids.length === 0) return out;

      // Fetch envelope + a small body slice in one go.
      for await (const msg of client.fetch(
        { uid: uids.join(",") },
        { envelope: true, source: true, uid: true }
      )) {
        const env = msg.envelope;
        if (!env) continue;
        const fromAddr = env.from?.[0];
        const fromStr = fromAddr
          ? `${fromAddr.name ? fromAddr.name + " " : ""}<${fromAddr.address}>`
          : "";
        const fromDomain = extractDomain(fromAddr?.address ?? "");
        const subject = env.subject ?? "";

        if (!isTrustedDomain(fromDomain)) continue;
        if (!looksSecurityRelated(subject)) continue;

        const sourceBuf = msg.source ?? Buffer.alloc(0);
        const raw = sourceBuf.toString("utf8");
        // Crude body extraction: take everything after the first blank line,
        // strip MIME boundaries roughly, then strip HTML.
        const blankIdx = raw.indexOf("\r\n\r\n");
        const body = blankIdx >= 0 ? raw.slice(blankIdx + 4) : raw;
        const preview = stripHtml(body).slice(0, 1500);

        out.push({
          uid: msg.uid,
          messageId: env.messageId ?? `gmail-${msg.uid}`,
          from: fromStr,
          fromDomain,
          subject,
          date: (env.date ?? new Date()).toISOString(),
          preview,
        });
      }
    } finally {
      lock.release();
    }
  } finally {
    try {
      await client.logout();
    } catch {
      /* noop */
    }
  }

  return out;
}
