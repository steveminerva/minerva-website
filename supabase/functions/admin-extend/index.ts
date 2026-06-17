// supabase/functions/admin-extend/index.ts
// Sets (or clears) a VIP's end_date, clearing any cancellation. Logs 'extension'.
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(o: unknown, status = 200): Response {
  return new Response(JSON.stringify(o), { status, headers: { ...cors, "content-type": "application/json" } });
}
function adminClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
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

// Enforce the 3-month VIP cap server-side: a provided end date is clamped to at
// most 90 days from today. Clearing the date (null) is left to the admin.
function capVipEnd(endDate: string): string {
  const max = new Date();
  max.setUTCDate(max.getUTCDate() + 90);
  const maxStr = max.toISOString().slice(0, 10);
  const d = String(endDate).slice(0, 10);
  return d > maxStr ? maxStr : d;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = adminClient();
  const me = await requireAdmin(admin, req);
  if (me instanceof Response) return me;

  const { id, endDate } = await req.json();
  if (!id) return json({ error: "missing id" }, 400);

  const cappedEnd = endDate ? capVipEnd(endDate) : null;
  const { error } = await admin
    .from("profiles").update({ end_date: cappedEnd, cancelled_at: null }).eq("id", id);
  if (error) return json({ error: error.message }, 400);

  await admin.from("vip_events").insert({ user_id: id, type: "extension" });
  return json({ ok: true });
});
