// supabase/functions/admin-list/index.ts
// Returns every VIP profile with derived fields (last login, invite-sent, status).
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

  const { data: profiles, error } = await admin
    .from("profiles")
    .select("id, no, name, email, end_date, cancelled_at, invite_sent_at, created_at")
    .eq("is_admin", false)
    .order("no", { ascending: true });
  if (error) return json({ error: error.message }, 400);

  const { data: logins } = await admin
    .from("vip_events").select("user_id, ts").eq("type", "login").order("ts", { ascending: false });
  const lastLogin: Record<string, string> = {};
  for (const e of logins || []) { if (!lastLogin[e.user_id]) lastLogin[e.user_id] = e.ts; }

  const today = new Date().toISOString().slice(0, 10);
  const rows = (profiles || []).map((p) => {
    const expired = !!(p.end_date && p.end_date < today);
    const cancelled = !!p.cancelled_at;
    const status = cancelled ? "cancelled" : (!p.end_date ? "active" : (expired ? "expired" : "active"));
    return {
      id: p.id, no: p.no, name: p.name, email: p.email,
      endDate: p.end_date, cancelledAt: p.cancelled_at, inviteSentAt: p.invite_sent_at,
      createdAt: p.created_at, lastLogin: lastLogin[p.id] || null, expired, cancelled, status,
    };
  });
  return json({ ok: true, users: rows });
});
