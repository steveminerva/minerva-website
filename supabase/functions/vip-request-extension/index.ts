// supabase/functions/vip-request-extension/index.ts
// Lets a signed-in VIP request more time on their OWN access. Not admin-only;
// the event is always written for the caller's own id (from their JWT).
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const admin = adminClient();
  const user = await callerUser(admin, req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const { data: prof } = await admin.from("profiles").select("id").eq("id", user.id).single();
  if (!prof) return json({ error: "forbidden" }, 403);

  await admin.from("vip_events").insert({ user_id: user.id, type: "extension" });
  return json({ ok: true });
});
