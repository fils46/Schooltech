import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings, AlertTriangle, Clock, Bell, Save, Info,
  CheckCircle, Sun, Sunset,
} from "lucide-react";

interface ConfigAbsences {
  mode_saisie: "par_cours" | "demi_journee" | "les_deux";
  seuil_alerte_1: number;
  seuil_alerte_2: number;
  seuil_alerte_3: number;
  periode_calcul: "trimestre" | "annee";
  heure_debut_matin: string;
  heure_fin_matin: string;
  heure_debut_aprem: string;
  heure_fin_aprem: string;
  notifier_parent_seuil_1: boolean;
  notifier_parent_seuil_2: boolean;
  notifier_parent_seuil_3: boolean;
  notifier_censeur_seuil_1: boolean;
  notifier_censeur_seuil_2: boolean;
  notifier_censeur_seuil_3: boolean;
  notifier_directeur_seuil_3: boolean;
}

const DEFAUT: ConfigAbsences = {
  mode_saisie: "par_cours",
  seuil_alerte_1: 3,
  seuil_alerte_2: 6,
  seuil_alerte_3: 10,
  periode_calcul: "trimestre",
  heure_debut_matin: "07:30",
  heure_fin_matin: "12:30",
  heure_debut_aprem: "13:30",
  heure_fin_aprem: "17:30",
  notifier_parent_seuil_1: true,
  notifier_parent_seuil_2: true,
  notifier_parent_seuil_3: true,
  notifier_censeur_seuil_1: false,
  notifier_censeur_seuil_2: true,
  notifier_censeur_seuil_3: true,
  notifier_directeur_seuil_3: true,
};

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative w-10 h-5 rounded-full transition-all flex-shrink-0"
      style={{ background: checked ? "#00C9A7" : "rgba(139,157,195,0.2)" }}>
      <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform"
        style={{ transform: checked ? "translateX(20px)" : "translateX(0)" }} />
    </button>
  );
}

export default function ConfigAbsences() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [form, setForm] = useState<ConfigAbsences>(DEFAUT);

  if (!["dev", "directeur"].includes(user?.role ?? "")) {
    return <div className="p-6" style={{ color: "var(--m15-muted)" }}>Accès réservé au directeur.</div>;
  }

  const { data, isLoading } = useQuery({
    queryKey: ["config-absences"],
    queryFn: async () => {
      const token = localStorage.getItem("m15_token") ?? "";
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${base}/api/absences/config`, { headers: { Authorization: `Bearer ${token}` } });
      return r.json() as Promise<{ config: ConfigAbsences }>;
    },
  });

  useEffect(() => {
    if (data?.config) setForm({ ...DEFAUT, ...data.config });
  }, [data]);

  const mutation = useMutation({
    mutationFn: async (body: ConfigAbsences) => {
      const token = localStorage.getItem("m15_token") ?? "";
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const r = await fetch(`${base}/api/absences/config`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error("Erreur sauvegarde");
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Configuration enregistrée." });
      void qc.invalidateQueries({ queryKey: ["config-absences"] });
    },
    onError: () => toast({ title: "Erreur lors de l'enregistrement.", variant: "destructive" }),
  });

  const set = (key: keyof ConfigAbsences, val: unknown) =>
    setForm(f => ({ ...f, [key]: val }));

  const seuils = [
    {
      num: 1 as const,
      label: "Seuil 1",
      color: "#FFB300",
      bg: "rgba(255,179,0,0.06)",
      border: "rgba(255,179,0,0.2)",
      desc: "1ère alerte — Notification parents",
      seuilKey: "seuil_alerte_1" as keyof ConfigAbsences,
      parent: "notifier_parent_seuil_1" as keyof ConfigAbsences,
      censeur: "notifier_censeur_seuil_1" as keyof ConfigAbsences,
    },
    {
      num: 2 as const,
      label: "Seuil 2",
      color: "#FF8C00",
      bg: "rgba(255,140,0,0.06)",
      border: "rgba(255,140,0,0.2)",
      desc: "2ème alerte — Convocation parents",
      seuilKey: "seuil_alerte_2" as keyof ConfigAbsences,
      parent: "notifier_parent_seuil_2" as keyof ConfigAbsences,
      censeur: "notifier_censeur_seuil_2" as keyof ConfigAbsences,
    },
    {
      num: 3 as const,
      label: "Seuil 3",
      color: "#FF4D6D",
      bg: "rgba(255,77,109,0.06)",
      border: "rgba(255,77,109,0.2)",
      desc: "Alerte critique — Conseil disciplinaire",
      seuilKey: "seuil_alerte_3" as keyof ConfigAbsences,
      parent: "notifier_parent_seuil_3" as keyof ConfigAbsences,
      censeur: "notifier_censeur_seuil_3" as keyof ConfigAbsences,
    },
  ];

  const showHoraires = form.mode_saisie !== "par_cours";

  return (
    <div className="space-y-6 page-fade-in max-w-3xl">

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: "rgba(0,128,255,0.12)", border: "1px solid rgba(0,128,255,0.2)" }}>
          <Settings className="w-5 h-5" style={{ color: "#0080FF" }} />
        </div>
        <div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Configuration des absences
          </h1>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            Modes de saisie, seuils d'alerte et notifications
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--m15-card)" }} />
          ))}
        </div>
      ) : (
        <form onSubmit={e => { e.preventDefault(); mutation.mutate(form); }} className="space-y-6">

          {/* Mode de saisie */}
          <section className="rounded-2xl p-5 space-y-4"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--m15-muted)", fontFamily: "'Syne', sans-serif" }}>
              Mode de saisie
            </h2>
            <div className="grid gap-3">
              {([
                { val: "par_cours", label: "Par cours", desc: "L'absence est enregistrée matière par matière via l'appel du professeur." },
                { val: "demi_journee", label: "Demi-journée", desc: "L'absence est enregistrée le matin ou l'après-midi par l'administration." },
                { val: "les_deux", label: "Les deux", desc: "Les deux modes sont actifs simultanément." },
              ] as const).map(({ val, label, desc }) => {
                const active = form.mode_saisie === val;
                return (
                  <label key={val} className="flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all"
                    style={{
                      background: active ? "rgba(0,201,167,0.06)" : "var(--elevate-1)",
                      border: `1px solid ${active ? "rgba(0,201,167,0.3)" : "var(--m15-border)"}`,
                    }}>
                    <input type="radio" name="mode_saisie" value={val}
                      checked={active} onChange={() => set("mode_saisie", val)}
                      className="sr-only" />
                    <div className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0 flex items-center justify-center"
                      style={{ border: `2px solid ${active ? "#00C9A7" : "var(--m15-border)"}` }}>
                      {active && <div className="w-2 h-2 rounded-full" style={{ background: "#00C9A7" }} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>{label}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>{desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Horaires demi-journées */}
          {showHoraires && (
            <section className="rounded-2xl p-5 space-y-4"
              style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--m15-muted)", fontFamily: "'Syne', sans-serif" }}>
                Horaires demi-journées
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl space-y-3"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}>
                  <div className="flex items-center gap-2">
                    <Sun className="w-4 h-4" style={{ color: "#FFB300" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>Matin</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="time" value={form.heure_debut_matin} onChange={e => set("heure_debut_matin", e.target.value)}
                      className="flex-1 bg-transparent text-sm outline-none rounded-lg px-3 py-2"
                      style={{ border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
                    <span className="text-sm" style={{ color: "var(--m15-muted)" }}>→</span>
                    <input type="time" value={form.heure_fin_matin} onChange={e => set("heure_fin_matin", e.target.value)}
                      className="flex-1 bg-transparent text-sm outline-none rounded-lg px-3 py-2"
                      style={{ border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
                  </div>
                </div>
                <div className="p-4 rounded-xl space-y-3"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}>
                  <div className="flex items-center gap-2">
                    <Sunset className="w-4 h-4" style={{ color: "#0080FF" }} />
                    <span className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>Après-midi</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="time" value={form.heure_debut_aprem} onChange={e => set("heure_debut_aprem", e.target.value)}
                      className="flex-1 bg-transparent text-sm outline-none rounded-lg px-3 py-2"
                      style={{ border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
                    <span className="text-sm" style={{ color: "var(--m15-muted)" }}>→</span>
                    <input type="time" value={form.heure_fin_aprem} onChange={e => set("heure_fin_aprem", e.target.value)}
                      className="flex-1 bg-transparent text-sm outline-none rounded-lg px-3 py-2"
                      style={{ border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Seuils d'alerte */}
          <section className="rounded-2xl p-5 space-y-4"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--m15-muted)", fontFamily: "'Syne', sans-serif" }}>
              Seuils d'alerte (absences non justifiées)
            </h2>
            <div className="space-y-3">
              {seuils.map(({ label, color, bg, border, desc, seuilKey, parent, censeur, num }) => (
                <div key={num} className="rounded-xl p-4 space-y-3"
                  style={{ background: bg, border: `1px solid ${border}` }}>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <span className="text-sm font-bold" style={{ color }}>{label}</span>
                      <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>{desc}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs" style={{ color: "var(--m15-muted)" }}>À partir de</span>
                      <input type="number" min={1} max={100}
                        value={form[seuilKey] as number}
                        onChange={e => set(seuilKey, parseInt(e.target.value) || 1)}
                        className="w-16 text-center text-sm font-bold rounded-lg px-2 py-1.5 outline-none"
                        style={{ background: "var(--m15-card)", border: `1px solid ${border}`, color }} />
                      <span className="text-xs" style={{ color: "var(--m15-muted)" }}>abs.</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 pt-1">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Toggle checked={form[parent] as boolean} onChange={v => set(parent, v)} />
                      <span className="text-xs" style={{ color: "var(--m15-muted)" }}>Notifier les parents</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <Toggle checked={form[censeur] as boolean} onChange={v => set(censeur, v)} />
                      <span className="text-xs" style={{ color: "var(--m15-muted)" }}>Notifier le censeur</span>
                    </label>
                    {num === 3 && (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <Toggle checked={form.notifier_directeur_seuil_3}
                          onChange={v => set("notifier_directeur_seuil_3", v)} />
                        <span className="text-xs" style={{ color: "var(--m15-muted)" }}>Notifier le directeur</span>
                      </label>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Période de calcul */}
          <section className="rounded-2xl p-5 space-y-4"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--m15-muted)", fontFamily: "'Syne', sans-serif" }}>
              Période de calcul
            </h2>
            <div className="grid gap-3">
              {([
                { val: "trimestre", label: "Par trimestre (recommandé)", desc: "Les compteurs se remettent à zéro à chaque trimestre." },
                { val: "annee", label: "Sur l'année entière", desc: "Le compteur est cumulatif sur toute l'année scolaire." },
              ] as const).map(({ val, label, desc }) => {
                const active = form.periode_calcul === val;
                return (
                  <label key={val} className="flex items-start gap-3 p-4 rounded-xl cursor-pointer transition-all"
                    style={{
                      background: active ? "rgba(0,201,167,0.06)" : "var(--elevate-1)",
                      border: `1px solid ${active ? "rgba(0,201,167,0.3)" : "var(--m15-border)"}`,
                    }}>
                    <input type="radio" name="periode_calcul" value={val} checked={active}
                      onChange={() => set("periode_calcul", val)} className="sr-only" />
                    <div className="w-4 h-4 rounded-full mt-0.5 flex-shrink-0 flex items-center justify-center"
                      style={{ border: `2px solid ${active ? "#00C9A7" : "var(--m15-border)"}` }}>
                      {active && <div className="w-2 h-2 rounded-full" style={{ background: "#00C9A7" }} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>{label}</p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>{desc}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Aperçu */}
          <div className="rounded-xl p-4 flex gap-3"
            style={{ background: "rgba(0,128,255,0.06)", border: "1px solid rgba(0,128,255,0.2)" }}>
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "#0080FF" }} />
            <div className="text-sm space-y-1" style={{ color: "var(--m15-muted)" }}>
              <p className="font-semibold mb-2" style={{ color: "var(--m15-white)" }}>Avec cette configuration :</p>
              <p>→ À <strong style={{ color: "#FFB300" }}>{form.seuil_alerte_1} abs. NJ</strong> : {form.notifier_parent_seuil_1 ? "parents notifiés" : "—"}{form.notifier_censeur_seuil_1 ? " + censeur" : ""}</p>
              <p>→ À <strong style={{ color: "#FF8C00" }}>{form.seuil_alerte_2} abs. NJ</strong> : {form.notifier_parent_seuil_2 ? "parents notifiés" : "—"}{form.notifier_censeur_seuil_2 ? " + censeur" : ""}</p>
              <p>→ À <strong style={{ color: "#FF4D6D" }}>{form.seuil_alerte_3} abs. NJ</strong> : tous notifiés + conseil disciplinaire possible</p>
              <p className="pt-1">Calcul sur : <strong style={{ color: "var(--m15-white)" }}>{form.periode_calcul === "trimestre" ? "le trimestre en cours" : "toute l'année scolaire"}</strong></p>
            </div>
          </div>

          <button type="submit" disabled={mutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff", opacity: mutation.isPending ? 0.7 : 1 }}>
            {mutation.isPending ? <Clock className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer la configuration
          </button>
        </form>
      )}
    </div>
  );
}
