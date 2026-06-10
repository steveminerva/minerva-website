// supabase/functions/heritage-decision/index.ts
// Edge Function (Deno). Admin approves or denies a Heritage applicant.
// SECURITY: verifies the caller is is_admin (their JWT) before doing ANYTHING.
//   accept -> status 'active', 12-month membership_end, decision logged, welcome email
//   deny   -> status 'denied', decision logged, courteous decline email
// The decision email is sent in the member's own language (member_lang), reusing the
// existing Intermedia SMTP secrets (same as VIP invites).
// Deploy: supabase functions deploy heritage-decision --no-verify-jwt
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors, "content-type": "application/json" } });

// ---- 8-language decision email templates (from assets/heritage-i18n.js) ----
const T: Record<string, any> = {
  en: { subject: "Your Minerva Heritage membership", greeting: "Dear {name},",
    approved: "We are delighted to welcome you to the Minerva Heritage circle as {tier}. Your membership is active for twelve months, through {date}.",
    approvedNoDate: "We are delighted to welcome you to the Minerva Heritage circle as {tier}. Your membership is active for twelve months.",
    denied: "Thank you for your interest in the Minerva Heritage circle. Following review, we are unable to confirm your membership at this time.",
    signoff: "With regard,\nMinerva Motors & Cie", tier: { admirer: "Admirer", custodian: "Custodian", commissioner: "Commissioner" } },
  nl: { subject: "Uw Minerva Heritage-lidmaatschap", greeting: "Geachte {name},",
    approved: "Het is ons een genoegen u als {tier} te verwelkomen in de Minerva Heritage-kring. Uw lidmaatschap is twaalf maanden geldig, tot {date}.",
    approvedNoDate: "Het is ons een genoegen u als {tier} te verwelkomen in de Minerva Heritage-kring. Uw lidmaatschap is twaalf maanden geldig.",
    denied: "Dank u voor uw interesse in de Minerva Heritage-kring. Na beoordeling kunnen wij uw lidmaatschap op dit moment niet bevestigen.",
    signoff: "Met achting,\nMinerva Motors & Cie", tier: { admirer: "Liefhebber", custodian: "Bewaarder", commissioner: "Opdrachtgever" } },
  fr: { subject: "Votre adhésion Minerva Heritage", greeting: "Cher/Chère {name},",
    approved: "Nous sommes ravis de vous accueillir au cercle Minerva Heritage en tant que {tier}. Votre adhésion est active pour douze mois, jusqu’au {date}.",
    approvedNoDate: "Nous sommes ravis de vous accueillir au cercle Minerva Heritage en tant que {tier}. Votre adhésion est active pour douze mois.",
    denied: "Nous vous remercions de votre intérêt pour le cercle Minerva Heritage. Après examen, nous ne sommes pas en mesure de confirmer votre adhésion pour le moment.",
    signoff: "Avec considération,\nMinerva Motors & Cie", tier: { admirer: "Admirateur", custodian: "Gardien", commissioner: "Commanditaire" } },
  de: { subject: "Ihre Minerva-Heritage-Mitgliedschaft", greeting: "Sehr geehrte(r) {name},",
    approved: "Wir freuen uns, Sie als {tier} im Minerva-Heritage-Kreis willkommen zu heißen. Ihre Mitgliedschaft ist zwölf Monate gültig, bis {date}.",
    approvedNoDate: "Wir freuen uns, Sie als {tier} im Minerva-Heritage-Kreis willkommen zu heißen. Ihre Mitgliedschaft ist zwölf Monate gültig.",
    denied: "Vielen Dank für Ihr Interesse am Minerva-Heritage-Kreis. Nach Prüfung können wir Ihre Mitgliedschaft derzeit nicht bestätigen.",
    signoff: "Mit vorzüglicher Hochachtung,\nMinerva Motors & Cie", tier: { admirer: "Liebhaber", custodian: "Bewahrer", commissioner: "Auftraggeber" } },
  it: { subject: "La sua adesione Minerva Heritage", greeting: "Gentile {name},",
    approved: "Siamo lieti di darle il benvenuto nel circolo Minerva Heritage come {tier}. La sua adesione è attiva per dodici mesi, fino al {date}.",
    approvedNoDate: "Siamo lieti di darle il benvenuto nel circolo Minerva Heritage come {tier}. La sua adesione è attiva per dodici mesi.",
    denied: "La ringraziamo per l’interesse verso il circolo Minerva Heritage. Dopo l’esame, non siamo in grado di confermare la sua adesione in questo momento.",
    signoff: "Con stima,\nMinerva Motors & Cie", tier: { admirer: "Ammiratore", custodian: "Custode", commissioner: "Committente" } },
  es: { subject: "Su membresía Minerva Heritage", greeting: "Estimado/a {name}:",
    approved: "Nos complace darle la bienvenida al círculo Minerva Heritage como {tier}. Su membresía está activa por doce meses, hasta el {date}.",
    approvedNoDate: "Nos complace darle la bienvenida al círculo Minerva Heritage como {tier}. Su membresía está activa por doce meses.",
    denied: "Le agradecemos su interés en el círculo Minerva Heritage. Tras la revisión, no podemos confirmar su membresía en este momento.",
    signoff: "Atentamente,\nMinerva Motors & Cie", tier: { admirer: "Admirador", custodian: "Custodio", commissioner: "Comitente" } },
  zh: { subject: "您的 Minerva Heritage 会员资格", greeting: "尊敬的 {name}：",
    approved: "我们非常荣幸地欢迎您以{tier}身份加入 Minerva Heritage 圈层。您的会员资格有效期十二个月，至 {date}。",
    approvedNoDate: "我们非常荣幸地欢迎您以{tier}身份加入 Minerva Heritage 圈层。您的会员资格有效期十二个月。",
    denied: "感谢您对 Minerva Heritage 圈层的关注。经审核，我们目前无法确认您的会员资格。",
    signoff: "此致敬意，\nMinerva Motors & Cie", tier: { admirer: "品牌挚友", custodian: "典藏守护者", commissioner: "委约车主" } },
  ja: { subject: "Minerva Heritage 会員について", greeting: "{name} 様",
    approved: "{tier}として Minerva Heritage サークルにお迎えできることを大変うれしく存じます。ご入会は12か月間、{date}まで有効です。",
    approvedNoDate: "{tier}として Minerva Heritage サークルにお迎えできることを大変うれしく存じます。ご入会は12か月間有効です。",
    denied: "Minerva Heritage サークルにご関心をお寄せいただき、ありがとうございます。審査の結果、現時点ではご入会を確定いたしかねます。",
    signoff: "敬具\nMinerva Motors & Cie", tier: { admirer: "アドマイアラー", custodian: "カストディアン", commissioner: "コミッショナー" } },
};

function composeEmail(lang: string, action: string, name: string, tier: string, endDate: string | null) {
  const t = T[lang] || T.en;
  const tierLabel = (t.tier && t.tier[tier]) || tier || "";
  const greeting = t.greeting.replace("{name}", name || "");
  let line: string;
  if (action === "accept") {
    line = endDate
      ? t.approved.replace("{tier}", tierLabel).replace("{date}", endDate)
      : t.approvedNoDate.replace("{tier}", tierLabel);
  } else {
    line = t.denied;
  }
  const text = `${greeting}\n\n${line}\n\n${t.signoff}`;
  const html = `<div style="font-family:Georgia,serif;font-size:15px;line-height:1.6;color:#1a2230">`
    + text.split("\n").map((l) => l ? `<p style="margin:0 0 10px">${l}</p>` : "").join("")
    + `</div>`;
  return { subject: t.subject, text, html };
}

async function sendDecisionEmail(to: string, subject: string, text: string, html: string) {
  const host = Deno.env.get("SMTP_HOST")!;
  const port = Number(Deno.env.get("SMTP_PORT") || 465);
  const user = Deno.env.get("SMTP_USER")!;
  const pass = Deno.env.get("SMTP_PASS")!;
  const client = new SMTPClient({
    connection: { hostname: host, port, tls: port === 465, auth: { username: user, password: pass } },
  });
  try {
    await client.send({
      from: `Minerva Motors & Cie <${user}>`,
      to,
      replyTo: "access@minervaluxurymotors.com",
      subject, content: text, html,
    });
  } finally {
    client.close().catch(() => {});
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(url, service);

  // 1) AUTH GATE — caller must be a real admin
  const jwt = (req.headers.get("authorization") || "").replace("Bearer ", "");
  const { data: me } = await admin.auth.getUser(jwt);
  if (!me?.user) return json({ error: "unauthorized" }, 401);
  const { data: caller } = await admin.from("profiles").select("is_admin").eq("id", me.user.id).single();
  if (!caller?.is_admin) return json({ error: "forbidden" }, 403);

  // 2) input
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId || "");
  const action = body.action === "deny" ? "deny" : (body.action === "accept" ? "accept" : "");
  const comment = (body.comment ? String(body.comment) : "").slice(0, 2000);
  const tierOverride = ["admirer", "custodian", "commissioner"].includes(body.tier) ? body.tier : null;
  if (!userId || !action) return json({ error: "bad-request" }, 400);

  // 3) load the member
  const { data: member, error: mErr } = await admin
    .from("profiles").select("id,name,email,tier,member_lang,status").eq("id", userId).single();
  if (mErr || !member) return json({ error: "member-not-found" }, 404);

  const tier = tierOverride || member.tier || "admirer";
  const lang = member.member_lang || "en";
  const nowIso = new Date().toISOString();

  // 4) apply the decision
  const update: Record<string, unknown> = {
    decision_action: action, decision_comment: comment, decision_ts: nowIso, tier,
  };
  let endDate: string | null = null;
  if (action === "accept") {
    const d = new Date(); d.setMonth(d.getMonth() + 12);
    endDate = d.toISOString().slice(0, 10);
    update.status = "active";
    update.membership_end = endDate;
  } else {
    update.status = "denied";
  }
  const { error: uErr } = await admin.from("profiles").update(update).eq("id", userId);
  if (uErr) return json({ error: uErr.message }, 400);

  // 5) audit
  await admin.from("audit_events").insert({
    actor: me.user.id, actor_email: me.user.email,
    event_type: action === "accept" ? "member-approved" : "member-denied",
    target: member.email, detail: { tier, comment, membership_end: endDate },
  });

  // 6) decision email (member's language), in the background so the UI returns fast
  const mail = composeEmail(lang, action, member.name || "", tier, endDate);
  try { (globalThis as any).EdgeRuntime?.waitUntil(sendDecisionEmail(member.email, mail.subject, mail.text, mail.html)); }
  catch { sendDecisionEmail(member.email, mail.subject, mail.text, mail.html).catch(() => {}); }

  // return the composed email so the console can show what was sent
  return json({ ok: true, status: update.status, membership_end: endDate, email: { subject: mail.subject, body: mail.text } });
});
