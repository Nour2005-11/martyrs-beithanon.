import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, ImagePlus, ShieldCheck, UserRoundPlus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabaseClient";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/suggest")({
  validateSearch: (search: Record<string, unknown>) => ({
    type: search["type"] === "photo" ? "photo" : "martyr",
    martyrId: typeof search["martyrId"] === "string" ? search["martyrId"] : "",
  }),
  head: () => ({ meta: [{ title: "المساهمة | ذاكرة بيت حانون" }] }),
  component: Suggest,
});

function Suggest() {
  const { t, lang } = usePrefs();
  const search = Route.useSearch();
  const [kind, setKind] = useState<"martyr" | "photo">(search.type);
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [martyrId, setMartyrId] = useState(search.martyrId);
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const ar = lang === "ar";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSuccess(false);
    const client = getSupabaseClient();
    if (!client || !isSupabaseConfigured()) {
      setMessage(ar ? "الاتصال بقاعدة البيانات غير مكتمل. جرّبي لاحقًا." : "Database connection is not configured.");
      return;
    }
    if (kind === "photo" && !file) {
      setMessage(ar ? "اختاري صورة أولًا." : "Please choose a photo first.");
      return;
    }
    if (file && (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024)) {
      setMessage(ar ? "اختاري صورة صالحة وحجمها أقل من 8 ميغابايت." : "Choose a valid image under 8 MB.");
      return;
    }
    setBusy(true);
    try {
      let photoPath: string | null = null;
      if (file) {
        const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
        const random = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        photoPath = `suggestions/${random}.${ext}`;
        const upload = await client.storage.from("pending-martyr-photos").upload(photoPath, file, { upsert: false, contentType: file.type });
        if (upload.error) throw upload.error;
      }
      const table = kind === "photo" ? "photo_contributions" : "martyr_contributions";
      const payload = kind === "photo"
        ? { martyr_id: Number(martyrId), photo_path: photoPath, notes: notes.trim() || null }
        : { name_ar: nameAr.trim(), name_en: nameEn.trim() || null, martyrdom_date: date || null, image_path: photoPath, notes: notes.trim() || null };
      const { error } = await client.from(table).insert(payload);
      if (error) {
        if (photoPath) await client.storage.from("pending-martyr-photos").remove([photoPath]);
        throw error;
      }
      setSuccess(true);
      setMessage(ar ? "وصلت مساهمتك، وهي الآن بانتظار المراجعة. شكرًا لمساعدتك في حفظ الذاكرة." : "Your contribution was received and is awaiting review. Thank you.");
      setNameAr(""); setNameEn(""); setDate(""); setNotes(""); setFile(null);
    } catch (error) {
      console.error("Contribution submission failed", error);
      setMessage(ar ? "ما قدرنا نرسل المساهمة. تأكدي من إعدادات Supabase وسياسات الإرسال والرفع، ثم جرّبي مرة ثانية." : "The contribution could not be sent. Check the Supabase submission and upload policies, then try again.");
    } finally { setBusy(false); }
  }

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <header className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-bold tracking-[0.16em] text-brand">{t.nav.contribute}</p>
        <h1 className="mt-3 font-heading text-4xl font-extrabold text-foreground sm:text-5xl">{t.contributeTitle}</h1>
        <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{t.contributeLead}</p>
      </header>
      <div className="mt-10 grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
        <form className="rounded-[1.7rem] border border-border bg-card p-6 shadow-card sm:p-8" onSubmit={submit}>
          <div className="flex flex-wrap gap-3" role="group" aria-label={ar ? "نوع المساهمة" : "Contribution type"}>
            <button type="button" onClick={() => setKind("martyr")} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold ${kind === "martyr" ? "bg-brand text-brand-foreground" : "border border-border text-foreground"}`}><UserRoundPlus size={17}/>{ar ? "إضافة شهيد" : "Suggest a martyr"}</button>
            <button type="button" onClick={() => setKind("photo")} className={`inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold ${kind === "photo" ? "bg-brand text-brand-foreground" : "border border-border text-foreground"}`}><ImagePlus size={17}/>{ar ? "إضافة صورة" : "Suggest a photo"}</button>
          </div>
          <div className="mt-7 grid gap-5">
            {kind === "martyr" ? <>
              <label className="block"><span className="text-sm font-bold text-foreground">{t.fullNameAr} *</span><input required value={nameAr} onChange={e=>setNameAr(e.target.value)} maxLength={180} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" /></label>
              <label className="block"><span className="text-sm font-bold text-foreground">{t.fullNameEn}</span><input value={nameEn} onChange={e=>setNameEn(e.target.value)} maxLength={180} dir="auto" className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" /></label>
              <label className="block"><span className="text-sm font-bold text-foreground">{t.martyrdomDate}</span><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" /></label>
              <label className="block"><span className="text-sm font-bold text-foreground">{ar ? "صورة الشهيد (اختياري)" : "Martyr photo (optional)"}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" /><span className="mt-1 block text-xs text-muted-foreground">{ar ? "الصورة تبقى خاصة وبانتظار المراجعة مع بيانات الشهيد." : "The photo remains private and pending review with the martyr details."}</span></label>
            </> : <>
              <label className="block"><span className="text-sm font-bold text-foreground">{ar ? "رقم سجل الشهيد" : "Martyr record ID"} *</span><input required type="number" min="1" value={martyrId} onChange={e=>setMartyrId(e.target.value)} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" placeholder={ar ? "رقم السجل الظاهر في رابط الشهيد" : "Record ID from the martyr page URL"} /></label>
              <label className="block"><span className="text-sm font-bold text-foreground">{ar ? "الصورة" : "Photograph"} *</span><input required type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setFile(e.target.files?.[0] ?? null)} className="mt-2 block w-full text-sm" /></label>
            </>}
            <label className="block"><span className="text-sm font-bold text-foreground">{ar ? "ملاحظات أو معلومات تساعد في التحقق" : "Notes to help verify the contribution"}</span><textarea rows={3} value={notes} onChange={e=>setNotes(e.target.value)} maxLength={1500} className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3" /></label>
            <p className="text-xs leading-relaxed text-muted-foreground">{ar ? "الصور المقترحة تُرفع إلى مساحة خاصة ولا تظهر للزوار قبل مراجعتها والموافقة عليها." : "Suggested photos are uploaded to private storage and will not be visible before review and approval."}</p>
            <button disabled={busy} type="submit" className="rounded-xl bg-brand px-5 py-3 font-bold text-brand-foreground disabled:opacity-60">{busy ? (ar ? "جارٍ الإرسال…" : "Sending…") : t.submitForReview}</button>
            {message ? <p role="status" className={`rounded-xl p-4 text-sm leading-relaxed ${success ? "bg-secondary text-foreground" : "bg-destructive/10 text-destructive"}`}>{success ? <CheckCircle2 className="me-2 inline h-4 w-4"/> : null}{message}</p> : null}
          </div>
        </form>
        <aside className="rounded-[1.7rem] bg-secondary p-7"><ShieldCheck className="h-8 w-8 text-brand" aria-hidden="true"/><h2 className="mt-5 font-heading text-2xl font-extrabold text-foreground">{t.privacyTitle}</h2><p className="mt-4 leading-relaxed text-muted-foreground">{t.privacyText}</p><p className="mt-6 text-sm leading-relaxed text-muted-foreground">{ar ? "كل مساهمة تبقى معلّقة حتى تراجعيها. لا يتم تعديل سجل الشهداء الأساسي من نموذج الإرسال العام." : "Each contribution stays pending until reviewed. Public submissions do not modify the main martyrs table."}</p></aside>
      </div>
    </section>
  );
}
