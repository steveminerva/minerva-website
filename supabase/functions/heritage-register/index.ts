// supabase/functions/heritage-register/index.ts
// Edge Function (Deno). PUBLIC Heritage self-registration (called from login.html, anon).
// SECURITY — this endpoint is open, so it is deliberately constrained: it can ONLY ever
// create a Heritage member. It NEVER sets is_admin, NEVER trusts a client-sent tier/status,
// and owner tiers (Custodian/Commissioner) are forced to 'pending' — they cannot self-activate.
//   tier:   commission -> commissioner ; owns a Minerva -> custodian ; otherwise -> admirer
//   status: admirer -> 'active' (immediate) ; owner tiers -> 'pending' (await admin review)
// Deploy: supabase functions deploy heritage-register --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const clean = (s: unknown, max = 200) => (s == null ? "" : String(s)).trim().slice(0, max);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);

  const body = await req.json().catch(() => ({}));
  const name = clean(body.name, 120);
  const email = clean(body.email, 200).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";
  const lang = ["en","nl","fr","de","it","es","zh","ja"].includes(body.lang) ? body.lang : "en";
  const ownsMinerva = body.ownsMinerva === true;
  const hasCommission = body.hasCommission === true;
  const vinRaw = clean(body.vin, 40).toUpperCase();

  // ---- validation ----
  if (!name) return json({ error: "name-required" }, 400);
  if (!isEmail(email)) return json({ error: "email-invalid" }, 400);
  if (password.length < 8) return json({ error: "password-weak" }, 400);

  // ---- derive tier + status SERVER-SIDE (never from the client) ----
  const tier = hasCommission ? "commissioner" : (ownsMinerva ? "custodian" : "admirer");
  const isOwner = tier !== "admirer";
  const status = isOwner ? "pending" : "active";
  const vin = isOwner ? (vinRaw || null) : null;
  if (isOwner && !vin) return json({ error: "vin-required" }, 400);

  // ---- create the auth user (auto-confirmed so they can sign in; status gates the portal) ----
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { name },
  });
  if (cErr) {
    const msg = /registered|exists|already/i.test(cErr.message) ? "email-taken" : cErr.message;
    return json({ error: msg }, 400);
  }
  const id = created.user!.id;

  // ---- profile: hard-coded safe fields only. is_admin is NEVER set here (defaults false). ----
  const { error: pErr } = await admin.from("profiles").insert({
    id, name, email,
    tier, status, vin,
    member_lang: lang,
  });
  if (pErr) {
    // roll back the orphaned auth user so a retry can succeed
    await admin.auth.admin.deleteUser(id).catch(() => {});
    return json({ error: pErr.message }, 400);
  }

  // ---- audit ----
  await admin.from("audit_events").insert({
    actor: id, actor_email: email, event_type: "member-registered",
    target: email, detail: { tier, status, vin },
  });

  // active (Admirer) -> portal opens now ; pending (owner) -> application received screen
  return json({ ok: true, tier, status });
});
