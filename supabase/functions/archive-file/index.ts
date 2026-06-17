// supabase/functions/archive-file/index.ts
// Mints a short-lived signed download URL for an archive file, after checking the
// caller may see it: PUBLIC items are open to any authenticated member; PRIVATE
// items only to their owner or an admin. The 'archives' Storage bucket stays
// private — only this function (service role) signs URLs, so tier/visibility is
// enforced server-side and never in the browser.
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

  const { id } = await req.json().catch(() => ({}));
  if (!id) return json({ error: "missing id" }, 400);

  // Load the archive row (service role bypasses RLS so we can run the check here).
  const { data: row, error: rErr } = await admin
    .from("archives").select("id, owner, visibility, file_path, file_name").eq("id", id).single();
  if (rErr || !row) return json({ error: "not found" }, 404);
  if (!row.file_path) return json({ error: "no file" }, 404);

  // Access check.
  const { data: prof } = await admin.from("profiles").select("is_admin").eq("id", user.id).single();
  const isAdmin = !!prof?.is_admin;
  const isOwner = row.owner && row.owner === user.id;
  const allowed = row.visibility === "public" || isOwner || isAdmin;
  if (!allowed) return json({ error: "forbidden" }, 403);

  const { data: signed, error: sErr } = await admin
    .storage.from("archives").createSignedUrl(row.file_path, 60, { download: row.file_name || undefined });
  if (sErr || !signed) return json({ error: sErr?.message || "sign failed" }, 400);

  return json({ ok: true, url: signed.signedUrl, fileName: row.file_name || "" });
});
