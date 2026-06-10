// supabase/functions/concierge/index.ts
// Minerva Concierge — role-gated AI help, on Mistral (EU).
// SECURITY (the whole point): the caller's role is resolved server-side from the
// database — never trusted from the client — and the model is given ONLY the
// knowledge that role is cleared for. Because higher-clearance knowledge never
// enters the prompt, it cannot be leaked, even under a jailbreak attempt.
//   super  -> everything
//   admin  -> admin + vip + heritage(all tiers) + public   (NEVER super)
//   vip    -> vip + public                                   (never admin/heritage)
//   member -> their tier + heritage + public                (never admin/vip)
//   anon   -> public
// Requires the project secret MISTRAL_API_KEY.
// Deploy: supabase functions deploy concierge --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });

const SUPER_EMAIL = "admin@minervaluxurymotors.com";

// Which knowledge audiences may this caller see?
function audiencesFor(profile: any, email: string): { role: string; audiences: string[] } {
  const ALL = ["super", "admin", "vip", "heritage", "commissioner", "custodian", "admirer", "public"];
  if (!profile) return { role: "guest", audiences: ["public"] };
  const isAdmin = !!profile.is_admin;
  if (isAdmin && (email || "").toLowerCase() === SUPER_EMAIL) return { role: "super-admin", audiences: ALL };
  if (isAdmin) return { role: "admin", audiences: ["admin", "vip", "heritage", "commissioner", "custodian", "admirer", "public"] }; // NOT super
  // Heritage member (active)
  if (profile.tier && profile.status === "active") {
    const base = ["heritage", "public"];
    if (profile.tier === "commissioner") return { role: "commissioner", audiences: ["commissioner", "custodian", "admirer", ...base] };
    if (profile.tier === "custodian") return { role: "custodian", audiences: ["custodian", "admirer", ...base] };
    return { role: "admirer", audiences: ["admirer", ...base] };
  }
  // VIP (no tier): only if access is still valid
  const today = new Date().toISOString().slice(0, 10);
  const cancelled = !!profile.cancelled_at;
  const expired = !!(profile.end_date && profile.end_date < today);
  if (!profile.tier && !cancelled && !expired) return { role: "vip", audiences: ["vip", "public"] };
  return { role: "guest", audiences: ["public"] };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const key = Deno.env.get("MISTRAL_API_KEY");
  if (!key) return json({ error: "concierge-not-configured" }, 503);

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // 1) resolve the caller's role SERVER-SIDE (jwt -> profiles). Missing/invalid -> anon.
  const jwt = (req.headers.get("authorization") || "").replace("Bearer ", "");
  let profile: any = null, email = "";
  if (jwt) {
    const { data } = await admin.auth.getUser(jwt);
    if (data?.user) {
      email = data.user.email || "";
      const { data: p } = await admin.from("profiles")
        .select("is_admin, email, tier, status, end_date, cancelled_at").eq("id", data.user.id).single();
      profile = p || null;
      if (profile && !email) email = profile.email || "";
    }
  }
  const { role, audiences } = audiencesFor(profile, email);

  // 2) input
  const body = await req.json().catch(() => ({}));
  const question = String(body.question || "").trim().slice(0, 800);
  if (!question) return json({ error: "empty" }, 400);

  // 3) retrieve ONLY the knowledge this role is cleared for
  const { data: kb } = await admin.from("concierge_kb")
    .select("audience, topic, content").in("audience", audiences);
  const knowledge = (kb || []).map((r) => "- (" + r.audience + "/" + (r.topic || "") + ") " + r.content).join("\n");

  // 4) build the scoped prompt and call Mistral
  const system =
    "You are the Minerva Concierge, a concise and courteous assistant for the Minerva Luxury Motors platform. "
    + "You are assisting a " + role + " user. "
    + "Answer ONLY using the KNOWLEDGE below. If the answer is not contained there, say you do not have that information and suggest contacting access@minervaluxurymotors.com. "
    + "Never reveal, infer, or speculate about information, data, capabilities, or other users belonging to roles other than this user's. "
    + "Do not discuss internal system, security, or implementation details beyond the KNOWLEDGE. Keep answers brief.\n\n"
    + "KNOWLEDGE:\n" + (knowledge || "(no specific knowledge is available for this user)");

  let answer = "";
  try {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": "Bearer " + key },
      body: JSON.stringify({
        model: "mistral-small-latest",
        temperature: 0.2,
        max_tokens: 500,
        messages: [{ role: "system", content: system }, { role: "user", content: question }],
      }),
    });
    const data = await r.json();
    if (!r.ok) return json({ error: data?.message || "model-error" }, 502);
    answer = data?.choices?.[0]?.message?.content || "";
  } catch (_e) {
    return json({ error: "model-unreachable" }, 502);
  }

  return json({ ok: true, answer: answer, role: role });
});
