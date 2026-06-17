// supabase/functions/admin-create-vip/index.ts
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(o: unknown, status = 200): Response {
  return new Response(JSON.stringify(o), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}

function adminClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, service);
}
async function callerUser(admin: SupabaseClient, req: Request) {
  const jwt = (req.headers.get("authorization") || "").replace("Bearer ", "");
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data?.user || null;
}
async function requireAdmin(admin: SupabaseClient, req: Request) {
  const user = await callerUser(admin, req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  if (!prof?.is_admin) return json({ error: "forbidden" }, 403);
  return user;
}

// Enforce the 3-month VIP cap server-side: a VIP's end date is at most 90 days
// from today. A missing/empty date is forced to the cap (a VIP must have an
// expiry); a date beyond the cap is clamped down. Dates are 'YYYY-MM-DD'.
function capVipEnd(endDate?: string | null): string {
  const max = new Date();
  max.setUTCDate(max.getUTCDate() + 90);
  const maxStr = max.toISOString().slice(0, 10);
  if (!endDate) return maxStr;
  const d = String(endDate).slice(0, 10);
  return d > maxStr ? maxStr : d;
}

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const r = crypto.getRandomValues(new Uint32Array(12));
  let out = "";
  for (let i = 0; i < 12; i++) { out += chars[r[i] % chars.length]; if (i === 3 || i === 7) out += "-"; }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = adminClient();
  const me = await requireAdmin(admin, req);
  if (me instanceof Response) return me;

  const { name, email, endDate, lang = "en" } = await req.json();
  const cappedEnd = capVipEnd(endDate);
  const password = genPassword();
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name },
  });
  if (cErr) return json({ error: cErr.message }, 400);
  const id = created.user!.id;

  await admin.from("profiles").insert({ id, name, email: email.toLowerCase(), end_date: cappedEnd, lang, invite_sent_at: new Date().toISOString() });
  await admin.from("vip_events").insert([{ user_id: id, type: "created" }, { user_id: id, type: "invited" }]);

  // Send the invitation email in the BACKGROUND, then return immediately.
  const mail = sendInvite({ name, email, password, endDate: cappedEnd, lang })
    .catch((e) => console.error("sendInvite failed:", e));
  try { (globalThis as any).EdgeRuntime?.waitUntil(mail); } catch (_) { /* no-op */ }

  return json({ ok: true, id, password });
});

async function sendInvite({ name, email, password, endDate, lang }: any) {
  const site = Deno.env.get("SITE_URL") || "https://minervaluxurymotors.com";
  const port = Number(Deno.env.get("SMTP_PORT") || 465);
  const client = new SMTPClient({
    connection: {
      hostname: Deno.env.get("SMTP_HOST")!,
      port,
      tls: port === 465,
      auth: { username: Deno.env.get("SMTP_USER")!, password: Deno.env.get("SMTP_PASS")! },
    },
  });
  const greet: Record<string, (n: string) => string> = {
    en: (n) => `Dear ${n},\n\nYou have been granted private VIP access to Minerva.\nClick here to enter:`,
    fr: (n) => `Cher/Chère ${n},\n\nUn accès VIP privé à Minerva vous a été accordé.\nCliquez ici pour entrer :`,
    nl: (n) => `Beste ${n},\n\nU heeft privé VIP-toegang tot Minerva gekregen.\nKlik hier om binnen te gaan:`,
    de: (n) => `Sehr geehrte(r) ${n},\n\nIhnen wurde privater VIP-Zugang zu Minerva gewährt.\nKlicken Sie hier:`,
    it: (n) => `Gentile ${n},\n\nLe è stato concesso l'accesso VIP privato a Minerva.\nClicchi qui per entrare:`,
    es: (n) => `Estimado/a ${n},\n\nSe le ha concedido acceso VIP privado a Minerva.\nHaga clic aquí:`,
    zh: (n) => `尊敬的 ${n}：\n\n您已获得 Minerva 的专属 VIP 访问权限。\n点击此处进入：`,
    ja: (n) => `${n} 様\n\nMinerva のプライベート VIP アクセスが付与されました。\n下記より入場ください：`,
  };
  const g = (greet[lang] || greet.en)(name);
  const body =
    `${g} ${site}/login.html\n\n` +
    `Email: ${email}\nPassword: ${password}\nValid until: ${endDate || "no expiry"}\n\n` +
    `Minerva — access@minervaluxurymotors.com`;
  try {
    await client.send({
      from: "Minerva <noreply@minervaluxurymotors.com>",
      to: email,
      replyTo: "access@minervaluxurymotors.com",
      subject: "Your Minerva VIP access",
      content: body,
    });
  } finally {
    client.close().catch(() => {});
  }
}
