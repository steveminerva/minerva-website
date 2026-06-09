// supabase/functions/admin-detail/index.ts
// Returns one VIP profile plus its full, ordered event log.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = adminClient();
  const me = await requireAdmin(admin, req);
  if (me instanceof Response) return me;

  const { id } = await req.json();
  if (!id) return json({ error: "missing id" }, 400);

  const { data: p, error } = await admin
    .from("profiles")
    .select("id, no, name, email, end_date, cancelled_at, invite_sent_at, created_at, lang")
    .eq("id", id).single();
  if (error || !p) return json({ error: error?.message || "not found" }, 404);

  const { data: events } = await admin
    .from("vip_events").select("type, ts").eq("user_id", id).order("ts", { ascending: false });

  const today = new Date().toISOString().slice(0, 10);
  const expired = !!(p.end_date && p.end_date < today);
  const cancelled = !!p.cancelled_at;

  return json({
    ok: true,
    user: {
      id: p.id, no: p.no, name: p.name, email: p.email,
      endDate: p.end_date, cancelledAt: p.cancelled_at, inviteSentAt: p.invite_sent_at,
      createdAt: p.created_at, lang: p.lang, expired, cancelled,
    },
    events: events || [],
  });
});
