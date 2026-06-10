// supabase/functions/admin-create-user/index.ts
// Create an ADMIN or HERITAGE account from the console. (VIP guests keep using
// admin-create-vip.) SECURITY:
//   - caller must be an admin (verified server-side);
//   - creating an ADMIN additionally requires the caller to be the SUPER-admin;
//   - heritage accounts created here are pre-approved (status 'active', 12-month
//     membership); the tier comes from the admin, status is fixed server-side.
// Generates a one-time password and emails a sign-in invitation (Intermedia SMTP).
// Deploy: supabase functions deploy admin-create-user --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });

const SUPER_EMAIL = "admin@minervaluxurymotors.com";
const TIERS = ["admirer", "custodian", "commissioner"];

function genPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const r = crypto.getRandomValues(new Uint32Array(12));
  let out = "";
  for (let i = 0; i < 12; i++) { out += chars[r[i] % chars.length]; if (i === 3 || i === 7) out += "-"; }
  return out;
}

async function sendInvite(to: string, name: string, roleLabel: string, password: string) {
  const host = Deno.env.get("SMTP_HOST"); if (!host) return;
  const port = Number(Deno.env.get("SMTP_PORT") || 465);
  const user = Deno.env.get("SMTP_USER")!;
  const pass = Deno.env.get("SMTP_PASS")!;
  const site = (Deno.env.get("SITE_URL") || "https://minervaluxurymotors.com").replace(/\/$/, "");
  const link = site + "/login.html";
  const text = `Dear ${name || "member"},\n\nYou have been granted ${roleLabel} access to Minerva.\n\n`
    + `Sign in at ${link}\nEmail: ${to}\nTemporary password: ${password}\n\n`
    + `Please change your password after first sign-in.\n\nWith regard,\nMinerva Motors & Cie`;
  const client = new SMTPClient({ connection: { hostname: host, port, tls: port === 465, auth: { username: user, password: pass } } });
  try {
    await client.send({ from: `Minerva Motors & Cie <${user}>`, to, replyTo: "access@minervaluxurymotors.com",
      subject: "Your Minerva access", content: text });
  } finally { client.close().catch(() => {}); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1) caller must be an admin
  const jwt = (req.headers.get("authorization") || "").replace("Bearer ", "");
  const { data: me } = await admin.auth.getUser(jwt);
  if (!me?.user) return json({ error: "unauthorized" }, 401);
  const callerEmail = (me.user.email || "").toLowerCase();
  const { data: caller } = await admin.from("profiles").select("is_admin").eq("id", me.user.id).single();
  if (!caller?.is_admin) return json({ error: "forbidden" }, 403);
  const callerIsSuper = callerEmail === SUPER_EMAIL;

  // 2) input
  const body = await req.json().catch(() => ({}));
  const type = body.type === "admin" ? "admin" : (body.type === "heritage" ? "heritage" : "");
  const name = String(body.name || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().toLowerCase().slice(0, 200);
  const lang = ["en","nl","fr","de","it","es","zh","ja"].includes(body.lang) ? body.lang : "en";
  if (!type) return json({ error: "bad-type" }, 400);
  if (!name) return json({ error: "name-required" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "email-invalid" }, 400);

  // 3) build the profile per type (status/role fixed SERVER-SIDE)
  let profile: Record<string, unknown> = { name, email };
  let roleLabel = "";
  if (type === "admin") {
    if (!callerIsSuper) return json({ error: "super-only" }, 403); // only the super-admin may mint admins
    profile = { ...profile, is_admin: true, lang };
    roleLabel = "administrator";
  } else {
    const tier = TIERS.includes(body.tier) ? body.tier : "admirer";
    const isOwner = tier !== "admirer";
    const vin = isOwner ? String(body.vin || "").trim().toUpperCase().slice(0, 40) : null;
    if (isOwner && !vin) return json({ error: "vin-required" }, 400);
    const d = new Date(); d.setMonth(d.getMonth() + 12);
    profile = { ...profile, tier, status: "active", vin, member_lang: lang, membership_end: d.toISOString().slice(0, 10) };
    roleLabel = "Heritage (" + tier + ")";
  }

  // 4) create the auth user + profile
  const password = genPassword();
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name },
  });
  if (cErr) {
    const msg = /registered|exists|already/i.test(cErr.message) ? "email-taken" : cErr.message;
    return json({ error: msg }, 400);
  }
  const id = created.user!.id;
  const { error: pErr } = await admin.from("profiles").insert({ id, ...profile });
  if (pErr) { await admin.auth.admin.deleteUser(id).catch(() => {}); return json({ error: pErr.message }, 400); }

  await admin.from("audit_events").insert({
    actor: me.user.id, actor_email: me.user.email,
    event_type: type === "admin" ? "admin-created" : "member-created",
    target: email, detail: { type, ...(type === "heritage" ? { tier: profile.tier } : {}) },
  });

  // 5) invitation email (background) + return the one-time password to the console
  try { (globalThis as any).EdgeRuntime?.waitUntil(sendInvite(email, name, roleLabel, password)); }
  catch { sendInvite(email, name, roleLabel, password).catch(() => {}); }

  return json({ ok: true, id, password, name, email, lang, role: type });
});
