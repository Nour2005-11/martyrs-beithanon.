
import { createFileRoute } from "@tanstack/react-router";
import {
  Check,
  Clock3,
  Image as ImageIcon,
  LogIn,
  LogOut,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabaseClient, isSupabaseConfigured } from "@/data/supabaseClient";

type MartyrContribution = {
  id: number;
  name_ar: string;
  name_en: string | null;
  martyrdom_date: string | null;
  image_path: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

type PhotoContribution = {
  id: number;
  martyr_id: number;
  photo_path: string;
  notes: string | null;
  status: string;
  created_at: string;
};

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "لوحة الإدارة | ذاكرة بيت حانون" }] }),
  component: AdminDashboard,
});

function AdminDashboard() {
  const client = getSupabaseClient();
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [martyrs, setMartyrs] = useState<MartyrContribution[]>([]);
  const [photos, setPhotos] = useState<PhotoContribution[]>([]);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"martyrs" | "photos">("martyrs");

  useEffect(() => {
    if (!client) return;

    void client.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null);
    });

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => data.subscription.unsubscribe();
  }, [client]);

  const load = useCallback(async () => {
    if (!client || !user) return;

    setBusy(true);
    setNotice("");

    try {
      const [m, p] = await Promise.all([
        client
          .from("martyr_contributions")
          .select(
            "id,name_ar,name_en,martyrdom_date,image_path,notes,status,created_at",
          )
          .eq("status", "pending")
          .order("created_at", { ascending: true }),

        client
          .from("photo_contributions")
          .select("id,martyr_id,photo_path,notes,status,created_at")
          .eq("status", "pending")
          .order("created_at", { ascending: true }),
      ]);

      if (m.error) throw m.error;
      if (p.error) throw p.error;

      setMartyrs((m.data ?? []) as MartyrContribution[]);
      setPhotos((p.data ?? []) as PhotoContribution[]);
    } catch (error) {
      setNotice(
        `تعذر تحميل المساهمات: ${
          error instanceof Error ? error.message : "خطأ غير معروف"
        }`,
      );
    } finally {
      setBusy(false);
    }
  }, [client, user]);

  useEffect(() => {
    void load();
  }, [load]);

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client) return;

    setBusy(true);
    setNotice("");

    const { error } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setBusy(false);

    if (error) {
      setNotice(`تعذر تسجيل الدخول: ${error.message}`);
    } else {
      setPassword("");
      setNotice(
        "تم تسجيل الدخول. إذا لم تظهر المساهمات، تأكدي أن حسابك مُضاف كمديرة في Supabase.",
      );
    }
  }

  async function decide(
    kind: "martyr" | "photo",
    id: number,
    action: "approve" | "reject",
  ) {
    if (!client || busy) return;

    const message =
      action === "approve"
        ? kind === "photo"
          ? "هل تريدين اعتماد الصورة واستبدال الصورة الحالية للشهيد المرتبط بها؟"
          : "تأكيد قبول هذه المساهمة وإضافة الشهيد للأرشيف؟"
        : "تأكيد رفض هذه المساهمة؟";

    if (!window.confirm(message)) return;

    setBusy(true);
    setNotice("");

    try {
      if (action === "reject") {
        const { error } = await client.rpc("admin_reject_contribution", {
          p_kind: kind,
          p_contribution_id: id,
        });

        if (error) throw error;

        setNotice("تم رفض المساهمة.");
      } else if (kind === "martyr") {
        const contribution = martyrs.find((item) => item.id === id);

        if (!contribution) {
          throw new Error("لم يتم العثور على المساهمة.");
        }

        let publicUrl: string | null = null;

        if (contribution.image_path) {
          const { data: image, error: downloadError } = await client.storage
            .from("pending-martyr-photos")
            .download(contribution.image_path);

          if (downloadError || !image) {
            throw downloadError ?? new Error("تعذر تنزيل الصورة الخاصة.");
          }

          const ext =
            contribution.image_path
              .split(".")
              .pop()
              ?.replace(/[^a-z0-9]/gi, "") || "jpg";

          const path = `archive/${crypto.randomUUID()}.${ext}`;

          const { error: uploadError } = await client.storage
            .from("martyr-photos")
            .upload(path, image, {
              contentType: image.type || "image/jpeg",
              upsert: false,
            });

          if (uploadError) throw uploadError;

          publicUrl = client.storage.from("martyr-photos").getPublicUrl(path)
            .data.publicUrl;
        }

        const { error } = await client.rpc(
          "admin_approve_martyr_contribution",
          {
            p_contribution_id: id,
            p_image_url: publicUrl,
          },
        );

        if (error) throw error;

        setNotice("تمت إضافة الشهيد إلى الأرشيف واعتماد المساهمة.");
      } else {
        const contribution = photos.find((item) => item.id === id);

        if (!contribution) {
          throw new Error("لم يتم العثور على مساهمة الصورة.");
        }

        // تنزيل الصورة من مساحة التخزين الخاصة
        const { data: image, error: downloadError } = await client.storage
          .from("pending-martyr-photos")
          .download(contribution.photo_path);

        if (downloadError || !image) {
          throw downloadError ?? new Error("تعذر تنزيل الصورة الخاصة.");
        }

        // التحقق من نوع الصورة قبل رفعها
        const allowedTypes = [
          "image/jpeg",
          "image/png",
          "image/webp",
        ];

        if (!allowedTypes.includes(image.type)) {
          throw new Error(
            `نوع الصورة غير مدعوم (${image.type || "غير معروف"}). الأنواع المدعومة: JPG وPNG وWebP.`,
          );
        }

        // رفع نسخة إلى مساحة التخزين العامة
        const extensionByType: Record<string, string> = {
          "image/jpeg": "jpg",
          "image/png": "png",
          "image/webp": "webp",
        };

        const extension = extensionByType[image.type];
        const publicPath = `archive/${crypto.randomUUID()}.${extension}`;

        const { error: uploadError } = await client.storage
          .from("martyr-photos")
          .upload(publicPath, image, {
            contentType: image.type,
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const publicUrl = client.storage
          .from("martyr-photos")
          .getPublicUrl(publicPath).data.publicUrl;

        // تحديث سجل الشهيد واعتماد المساهمة عبر دالة إدارية
        const { error: approvalError } = await client.rpc(
          "admin_approve_photo_contribution",
          {
            p_contribution_id: id,
            p_image_url: publicUrl,
          },
        );

        if (approvalError) {
          throw new Error(
            `تم رفع الصورة، لكن تعذر تحديث قاعدة البيانات: ${approvalError.message}. لم تُعتمد المساهمة؛ تحققي من لوحة الإدارة قبل إعادة المحاولة.`,
          );
        }

        setNotice(
          `تم اعتماد الصورة بنجاح وتحديث صورة سجل الشهيد رقم ${contribution.martyr_id}.`,
        );
      }

      await load();
    } catch (error) {
      setNotice(
        `لم تكتمل العملية: ${
          error instanceof Error ? error.message : "خطأ غير معروف"
        }`,
      );
    } finally {
      setBusy(false);
    }
  }

  if (!isSupabaseConfigured() || !client) {
    return (
      <main className="mx-auto max-w-xl px-4 py-16">
        <h1 className="text-3xl font-extrabold">لوحة الإدارة</h1>
        <p className="mt-4 text-muted-foreground">
          إعدادات Supabase غير مكتملة. راجعي متغيرات البيئة.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold tracking-widest text-brand">
            ذاكرة بيت حانون
          </p>
          <h1 className="mt-2 text-3xl font-extrabold">
            لوحة مراجعة المساهمات
          </h1>
          <p className="mt-2 text-muted-foreground">
            مساحة خاصة لمراجعة الاقتراحات قبل نشرها في الأرشيف.
          </p>
        </div>

        {user && (
          <button
            onClick={async () => {
              await client.auth.signOut();
              setMartyrs([]);
              setPhotos([]);
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2"
          >
            <LogOut size={17} />
            تسجيل الخروج
          </button>
        )}
      </header>

      {!user ? (
        <form
          onSubmit={signIn}
          className="mx-auto mt-10 max-w-md rounded-3xl border border-border bg-card p-6 shadow-card"
        >
          <ShieldCheck className="h-9 w-9 text-brand" />
          <h2 className="mt-4 text-xl font-bold">دخول الإدارة</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            سجّلي الدخول بحساب أنشأتِه مسبقًا في Supabase Auth وأُضيف إلى قائمة
            المديرات.
          </p>

          <label className="mt-5 block text-sm font-bold">
            البريد الإلكتروني
            <input
              required
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
            />
          </label>

          <label className="mt-4 block text-sm font-bold">
            كلمة المرور
            <input
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-2 w-full rounded-xl border border-border bg-background px-4 py-3"
            />
          </label>

          <button
            disabled={busy}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 font-bold text-brand-foreground disabled:opacity-60"
          >
            <LogIn size={18} />
            {busy ? "جارٍ الدخول…" : "تسجيل الدخول"}
          </button>
        </form>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              onClick={() => setTab("martyrs")}
              className={`rounded-full px-4 py-2 font-bold ${
                tab === "martyrs"
                  ? "bg-brand text-brand-foreground"
                  : "border border-border"
              }`}
            >
              إضافة شهيد ({martyrs.length})
            </button>

            <button
              onClick={() => setTab("photos")}
              className={`rounded-full px-4 py-2 font-bold ${
                tab === "photos"
                  ? "bg-brand text-brand-foreground"
                  : "border border-border"
              }`}
            >
              صور لشهداء موجودين ({photos.length})
            </button>

            <button
              onClick={() => void load()}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 disabled:opacity-50"
            >
              <RefreshCw size={16} />
              تحديث
            </button>
          </div>

          {busy && (
            <p className="mt-5 text-sm text-muted-foreground">
              جارٍ تنفيذ العملية…
            </p>
          )}

          {tab === "martyrs" ? (
            <div className="mt-5 grid gap-4">
              {martyrs.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        مساهمة رقم {item.id} ·{" "}
                        {new Date(item.created_at).toLocaleString("ar")}
                      </p>
                      <h2 className="mt-2 text-xl font-extrabold">
                        {item.name_ar}
                      </h2>
                      {item.name_en && (
                        <p
                          className="mt-1 text-sm text-muted-foreground"
                          dir="auto"
                        >
                          {item.name_en}
                        </p>
                      )}
                      <p className="mt-2 text-sm">
                        تاريخ الاستشهاد: {item.martyrdom_date || "غير محدد"}
                      </p>
                      {item.notes && (
                        <p className="mt-3 whitespace-pre-wrap text-sm">
                          {item.notes}
                        </p>
                      )}
                    </div>

                    {item.image_path ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs">
                        <ImageIcon size={14} />
                        توجد صورة خاصة
                      </span>
                    ) : (
                      <span className="rounded-full bg-secondary px-3 py-1 text-xs">
                        بدون صورة
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      disabled={busy}
                      onClick={() => void decide("martyr", item.id, "approve")}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 font-bold text-brand-foreground disabled:opacity-50"
                    >
                      <Check size={17} />
                      قبول وإضافة للأرشيف
                    </button>

                    <button
                      disabled={busy}
                      onClick={() => void decide("martyr", item.id, "reject")}
                      className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 font-bold disabled:opacity-50"
                    >
                      <X size={17} />
                      رفض
                    </button>
                  </div>
                </article>
              ))}

              {martyrs.length === 0 && !busy && <EmptyQueue />}
            </div>
          ) : (
            <div className="mt-5 grid gap-4">
              {photos.map((item) => (
                <article
                  key={item.id}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <p className="text-xs text-muted-foreground">
                    مساهمة رقم {item.id} ·{" "}
                    {new Date(item.created_at).toLocaleString("ar")}
                  </p>

                  <h2 className="mt-2 text-lg font-bold">
                    اقتراح صورة لسجل الشهيد رقم {item.martyr_id}
                  </h2>

                  {item.notes && (
                    <p className="mt-2 whitespace-pre-wrap text-sm">
                      {item.notes}
                    </p>
                  )}

                  <p className="mt-2 break-all text-xs text-muted-foreground">
                    مسار الصورة الخاصة: {item.photo_path}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      onClick={() => void decide("photo", item.id, "approve")}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 font-bold text-brand-foreground disabled:opacity-50"
                    >
                      <Check size={17} />
                      اعتماد الصورة
                    </button>

                    <button
                      onClick={() => void decide("photo", item.id, "reject")}
                      disabled={busy}
                      className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 font-bold disabled:opacity-50"
                    >
                      <X size={16} />
                      رفض
                    </button>
                  </div>
                </article>
              ))}

              {photos.length === 0 && !busy && <EmptyQueue />}
            </div>
          )}
        </>
      )}

      {notice && (
        <p
          role="status"
          className="mt-5 whitespace-pre-wrap rounded-xl bg-secondary p-4 text-sm leading-relaxed"
        >
          {notice}
        </p>
      )}

      <p className="mt-8 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
        <Clock3 size={15} className="mt-0.5 shrink-0" />
        المساهمات لا تُنشر تلقائيًا. لا تُعتمد إلا بعد مراجعتها من حساب الإدارة.
      </p>
    </main>
  );
}

function EmptyQueue() {
  return (
    <div className="rounded-2xl border border-dashed border-border p-10 text-center">
      <Check className="mx-auto h-8 w-8 text-brand" />
      <p className="mt-3 font-bold">ما في مساهمات معلّقة حاليًا</p>
    </div>
  );
}
