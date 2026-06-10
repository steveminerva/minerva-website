// supabase/functions/admin-set-role/index.ts
// Change an existing user's account type (VIP <-> Admin <-> Heritage).
// SECURITY: super-admin ONLY (verified server-side). The super-admin account
// itself cannot be changed here. Role/status are set server-side, not trusted.
// Deploy: supabase functions deploy admin-set-role --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });

const SUPER_EMAIL = "admin@minervaluxurymotors.com";
const TIERS = ["admirer", "custodian", "commissioner"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1) caller MUST be the super-admin
  const jwt = (req.headers.get("authorization") || "").replace("Bearer ", "");
  const { data: me } = await admin.auth.getUser(jwt);
  if (!me?.user) return json({ error: "unauthorized" }, 401);
  const { data: caller } = await admin.from("profiles").select("is_admin").eq("id", me.user.id).single();
  if (!caller?.is_admin || (me.user.email || "").toLowerCase() !== SUPER_EMAIL) return json({ error: "super-only" }, 403);

  // 2) input
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || "");
  const role = ["vip", "admin", "heritage"].includes(body.role) ? body.role : "";
  if (!userId || !role) return json({ error: "bad-request" }, 400);
  if (userId === me.user.id) return json({ error: "cannot-change-self" }, 400);

  // never let the super-admin account be reclassified
  const { data: target } = await admin.from("profiles").select("email").eq("id", userId).single();
  if (!target) return json({ error: "user-not-found" }, 404);
  if ((target.email || "").toLowerCase() === SUPER_EMAIL) return json({ error: "cannot-change-super" }, 400);

  // 3) build the update (status/flags fixed server-side)
  const upd: Record<string, unknown> = { decision_action: null, decision_comment: null };
  if (role === "admin") {
    Object.assign(upd, { is_admin: true, tier: null, status: null, vin: null, end_date: null, membership_end: null });
  } else if (role === "vip") {
    const d = new Date(); d.setMonth(d.getMonth() + 3);
    Object.assign(upd, { is_admin: false, tier: null, status: null, vin: null, membership_end: null, end_date: d.toISOString().slice(0, 10), cancelled_at: null });
  } else {
    const tier = TIERS.includes(body.tier) ? body.tier : "admirer";
    const d = new Date(); d.setMonth(d.getMonth() + 12);
    Object.assign(upd, { is_admin: false, tier, status: "active", end_date: null, membership_end: d.toISOString().slice(0, 10), cancelled_at: null });
  }

  const { error: uErr } = await admin.from("profiles").update(upd).eq("id", userId);
  if (uErr) return json({ error: uErr.message }, 400);

  await admin.from("audit_events").insert({
    actor: me.user.id, actor_email: me.user.email,
    event_type: "role-changed", target: target.email, detail: { role, tier: upd.tier || null },
  });

  return json({ ok: true, role });
});
