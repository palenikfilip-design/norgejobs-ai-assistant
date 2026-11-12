import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const Body = z.object({
  event: z.enum(["job_approved", "job_rejected", "company_approved", "company_rejected"]),
  company_id: z.string().uuid(),
  job_id: z.string().uuid().optional(),
  note: z.string().max(2000).optional(),
});
const GATEWAY_URL = "https://connector-gateway.lovable.dev/resend";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  const reply = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const url = Deno.env.get("SUPABASE_URL")!, key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const db = createClient(url, key);
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return reply({ error: "Unauthorized" }, 401);
    const { data: u } = await db.auth.getUser(token);
    if (!u.user) return reply({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await db.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "admin").maybeSingle();
    if (!isAdmin) return reply({ error: "Forbidden" }, 403);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return reply({ error: parsed.error.flatten().fieldErrors }, 400);
    const { event, company_id, job_id, note } = parsed.data;

    const { data: c } = await db.from("companies").select("name, slug, contact_email, user_id, trust_level").eq("id", company_id).maybeSingle();
    if (!c) return reply({ error: "Company not found" }, 404);
    let to = c.contact_email as string | null;
    if (!to && c.user_id) to = (await db.auth.admin.getUserById(c.user_id)).data.user?.email ?? null;
    if (!to) return reply({ sent: false, reason: "no_recipient" });
    let jobTitle = "";
    if (job_id) jobTitle = (await db.from("employer_jobs").select("title").eq("id", job_id).maybeSingle()).data?.title ?? "";

    const origin = req.headers.get("origin") ?? "https://leslie.app";
    const noteHtml = note ? `<p style="background:#fff4e5;padding:12px;border-radius:8px"><b>Poznámka:</b> ${esc(note)}</p>` : "";
    const t = esc(jobTitle), n = esc(c.name);
    const tpl: Record<string, [string, string]> = {
      job_approved: [`Nabídka „${jobTitle}" je zveřejněná`, `<p>Tvoje nabídka <b>${t}</b> byla schválena a je teď vidět uchazečům.</p>${c.trust_level === "verified" ? "<p>Firma má status <b>Ověřená</b> — úpravy se zveřejní okamžitě.</p>" : ""}<p><a href="${origin}/company/${c.slug}">Zobrazit stránku firmy</a></p>`],
      job_rejected: [`Nabídka „${jobTitle}" potřebuje úpravu`, `<p>Tvoje nabídka <b>${t}</b> byla vrácena k úpravě.</p>${noteHtml}<p><a href="${origin}/employer/jobs/${job_id}/edit">Upravit nabídku</a></p>`],
      company_approved: [`Profil firmy ${c.name} je schválený`, `<p>Profil firmy <b>${n}</b> byl schválen a je veřejně viditelný.</p><p><a href="${origin}/employer/dashboard">Přejít do přehledu</a></p>`],
      company_rejected: [`Profil firmy ${c.name} potřebuje úpravu`, `<p>Profil firmy <b>${n}</b> byl vrácen k úpravě.</p>${noteHtml}<p><a href="${origin}/employer/company">Upravit profil</a></p>`],
    };
    const [subject, body] = tpl[event];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY"), RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!LOVABLE_API_KEY || !RESEND_API_KEY) return reply({ sent: false, reason: "email_not_configured" });
    const r = await fetch(`${GATEWAY_URL}/emails`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": RESEND_API_KEY },
      body: JSON.stringify({ from: Deno.env.get("RESEND_FROM") ?? "Leslie <onboarding@resend.dev>", to: [to], subject,
        html: `<div style="font-family:sans-serif;max-width:560px">${body}<p style="color:#888">Leslie</p></div>` }),
    });
    if (!r.ok) { const txt = await r.text(); console.error(`Resend failed [${r.status}]: ${txt}`); return reply({ sent: false, status: r.status, details: txt }); }
    return reply({ sent: true });
  } catch (e) {
    console.error(e);
    return reply({ sent: false, error: String(e) });
  }
});
