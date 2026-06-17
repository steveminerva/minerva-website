// supabase/functions/concierge/index.ts
// Minerva Concierge — role-gated AI help, on Mistral (EU).
// SECURITY (the whole point): the caller's role is resolved server-side from the
// database — never trusted from the client — and the model is given ONLY the
// knowledge that role is cleared for. Because higher-clearance knowledge never
// enters the prompt, it cannot be leaked, even under a jailbreak attempt.
//   super        -> everything
//   admin        -> admin + models + public            (NEVER super/vip/heritage member content)
//   vip          -> vip + models + public              (never admin/heritage)
//   commissioner -> commissioner+custodian+admirer + heritage + VIP + models + public  (new-car owners get VIP web access)
//   custodian    -> custodian+admirer + heritage + public   (no modern models)
//   admirer      -> admirer + heritage + public              (no modern models)
//   anon         -> public  (the UI only shows the concierge to signed-in users)
// 'models' = the modern confidential vehicles (Aegis, Sovereign). 'public' = history + historic vehicles.
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
  const ALL = ["super", "admin", "vip", "models", "heritage", "commissioner", "custodian", "admirer", "public"];
  if (!profile) return { role: "guest", audiences: ["public"] };
  const isAdmin = !!profile.is_admin;
  if (isAdmin && (email || "").toLowerCase() === SUPER_EMAIL) return { role: "super-admin", audiences: ALL };
  if (isAdmin) return { role: "admin", audiences: ["admin", "models", "public"] }; // features/technical/marketing + modern models + history/vehicles; NO super/vip/heritage member content
  // Heritage member (active)
  if (profile.tier && profile.status === "active") {
    const base = ["heritage", "public"];
    // Commissioners order a new car -> also get VIP web access + the modern models.
    if (profile.tier === "commissioner") return { role: "commissioner", audiences: ["commissioner", "custodian", "admirer", "vip", "models", ...base] };
    if (profile.tier === "custodian") return { role: "custodian", audiences: ["custodian", "admirer", ...base] };
    return { role: "admirer", audiences: ["admirer", ...base] };
  }
  // VIP (no tier): only if access is still valid
  const today = new Date().toISOString().slice(0, 10);
  const cancelled = !!profile.cancelled_at;
  const expired = !!(profile.end_date && profile.end_date < today);
  if (!profile.tier && !cancelled && !expired) return { role: "vip", audiences: ["vip", "models", "public"] };
  return { role: "guest", audiences: ["public"] };
}

// A few contextual starter questions per role (shown as clickable chips).
function startersFor(role: string): string[] {
  switch (role) {
    case "super-admin": return ["Tell me about Minerva's history.", "Who are our current partners?", "What are the Aegis specifications?"];
    case "admin":       return ["How do I extend a VIP's access?", "How do I publish a news post?", "What are the Aegis specifications?"];
    case "vip":         return ["What are the Aegis Pista's specifications?", "Tell me about the Sovereign.", "Tell me about Minerva's history."];
    case "commissioner":return ["What does my Commissioner membership include?", "What are the Aegis specifications?", "Tell me about Minerva's history."];
    case "custodian":   return ["What does my Custodian membership include?", "Which historic models has Minerva made?", "Tell me about Minerva's heritage."];
    case "admirer":     return ["What does my membership include?", "Tell me about Minerva's history.", "Which historic models has Minerva made?"];
    default:            return ["Tell me about Minerva's history.", "Which historic models has Minerva made?"];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

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
  const starters = startersFor(role);

  // 2) input — an empty question is a "starters only" request (used to populate the chips).
  const body = await req.json().catch(() => ({}));
  const question = String(body.question || "").trim().slice(0, 800);
  if (!question) return json({ ok: true, role: role, starters: starters });

  const key = Deno.env.get("MISTRAL_API_KEY");
  if (!key) return json({ error: "concierge-not-configured" }, 503);

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

  return json({ ok: true, answer: answer, role: role, starters: starters });
});
