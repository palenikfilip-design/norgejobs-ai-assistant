import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const Body = z.object({ application_id: z.string().uuid() });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  const reply = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return reply({ error: "Unauthorized" }, 401);
    const { data: u } = await db.auth.getUser(token);
    if (!u.user) return reply({ error: "Unauthorized" }, 401);
    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return reply({ error: parsed.error.flatten().fieldErrors }, 400);

    const { data: a } = await db.from("job_applications").select("id, method, note, applicant_name, applicant_user_id, employer_job_id, company_id, created_at")
      .eq("id", parsed.data.application_id).maybeSingle();
    if (!a || a.applicant_user_id !== u.user.id) return reply({ error: "Not found" }, 404);
    if (Date.now() - new Date(a.created_at).getTime() > 10 * 60_000) return reply({ sent: false, reason: "too_old" });

    const [{ data: j }, { data: c }] = await Promise.all([
      db.from("employer_jobs").select("title").eq("id", a.employer_job_id).maybeSingle(),
      db.from("companies").select("name, contact_email, user_id").eq("id", a.company_id).maybeSingle(),
    ]);
    let to = c?.contact_email ?? null;
    if (!to && c?.user_id) to = (await db.auth.admin.getUserById(c.user_id)).data.user?.email ?? null;
    if (!to) return reply({ sent: false, reason: "no_recipient" });

    const key = Deno.env.get("RESEND_API_KEY");
    if (!key) return reply({ sent: false, reason: "email_not_configured" });
    const origin = req.headers.get("origin") ?? "https://leslie.app";
    const who = esc(a.applicant_name ?? "Uchazeč");
    const title = esc(j?.title ?? "");
    const kind = a.method === "cv" ? "se přihlásil(a) s životopisem" : "ti poslal(a) zprávu";
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from: Deno.env.get("RESEND_FROM") ?? "Leslie <onboarding@resend.dev>", to: [to],
        subject: `Nová přihláška: ${j?.title ?? ""}`,
        html: `<div style="font-family:sans-serif;max-width:560px"><p><b>${who}</b> ${kind} na nabídku <b>${title}</b>.</p>${a.note ? `<p style="background:#f4f4f5;padding:12px;border-radius:8px">${esc(a.note)}</p>` : ""}<p><a href="${origin}/employer/dashboard">Otevřít přihlášky</a></p><p style="color:#888">Leslie</p></div>`,
      }),
    });
    if (!r.ok) { const t = await r.text(); console.error(`Resend failed [${r.status}]: ${t}`); return reply({ sent: false, status: r.status, details: t }); }
    return reply({ sent: true });
  } catch (e) {
    console.error(e);
    return reply({ sent: false, error: String(e) });
  }
});
