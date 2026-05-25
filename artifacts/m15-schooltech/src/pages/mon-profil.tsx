import { useState, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  useGetMonProfil,
  getGetMonProfilQueryKey,
  useModifierMonProfil,
  useUploaderPhoto,
  useChangerMotDePasse,
  useModifierPreferencesNotifs,
} from "@workspace/api-client-react";
import {
  Camera, User, Shield, Bell, Save, Eye, EyeOff, Loader2, Check,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  dev: "Développeur",
  directeur: "Directeur",
  censeur: "Censeur",
  professeur: "Professeur",
  eleve: "Élève",
  parent: "Parent",
  infirmier: "Infirmier(ère)",
};

function PasswordStrength({ password }: { password: string }) {
  const hasLen = password.length >= 8;
  const hasMaj = /[A-Z]/.test(password);
  const hasNum = /\d/.test(password);
  const score = [hasLen, hasMaj, hasNum].filter(Boolean).length;
  const color = score === 3 ? "#00C9A7" : score === 2 ? "#F5C842" : score === 1 ? "#FF8C42" : "var(--m15-muted)";
  const label = score === 3 ? "Fort" : score === 2 ? "Moyen" : score === 1 ? "Faible" : "";

  if (!password) return null;
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full transition-colors"
            style={{ background: i <= score ? color : "var(--m15-border)" }} />
        ))}
      </div>
      <div className="flex gap-4 text-xs" style={{ color: "var(--m15-muted)" }}>
        <span style={{ color: hasLen ? "#00C9A7" : "var(--m15-muted)" }}>✓ 8 caractères min</span>
        <span style={{ color: hasMaj ? "#00C9A7" : "var(--m15-muted)" }}>✓ Majuscule</span>
        <span style={{ color: hasNum ? "#00C9A7" : "var(--m15-muted)" }}>✓ Chiffre</span>
      </div>
      {label && <p className="text-xs font-semibold" style={{ color }}>Force : {label}</p>}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!checked)}
      className="relative w-10 h-5 rounded-full transition-colors flex-shrink-0"
      style={{ background: checked ? "#00C9A7" : "var(--m15-border)" }}>
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} />
    </button>
  );
}

const NOTIF_KEYS = [
  { key: "email_absences", label: "Absences", emailKey: "email_absences", pushKey: "push_absences" },
  { key: "email_notes", label: "Notes", emailKey: "email_notes", pushKey: "push_notes" },
  { key: "email_messages", label: "Messages", emailKey: "email_messages", pushKey: "push_messages" },
  { key: "email_annonces", label: "Annonces", emailKey: "email_annonces", pushKey: "push_annonces" },
];

export default function MonProfil() {
  const { user: authUser } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const qKey = getGetMonProfilQueryKey();
  const { data: profil, isLoading } = useGetMonProfil({ query: { queryKey: qKey } });
  const p = profil as Record<string, unknown> | undefined;

  const modifierMutation = useModifierMonProfil();
  const photoMutation = useUploaderPhoto();
  const mdpMutation = useChangerMotDePasse();
  const prefsMutation = useModifierPreferencesNotifs();

  const [nomEdit, setNomEdit] = useState("");
  const [prenomsEdit, setPrenomsEdit] = useState("");
  const [telEdit, setTelEdit] = useState("");
  const [editInit, setEditInit] = useState(false);

  if (!editInit && p) {
    setNomEdit(String(p.nom ?? ""));
    setPrenomsEdit(String(p.prenoms ?? ""));
    setTelEdit(String(p.telephone ?? ""));
    setEditInit(true);
  }

  const [mdpActuel, setMdpActuel] = useState("");
  const [mdpNouv, setMdpNouv] = useState("");
  const [mdpConf, setMdpConf] = useState("");
  const [showMdpActuel, setShowMdpActuel] = useState(false);
  const [showMdpNouv, setShowMdpNouv] = useState(false);

  const DEFAULT_PREFS: Record<string, boolean> = {
    email_absences: true, email_notes: true, email_messages: true, email_annonces: false,
    push_absences: true, push_notes: true, push_messages: true, push_annonces: true,
  };
  const currentPrefs = (p?.preferences_notifs as Record<string, boolean>) ?? DEFAULT_PREFS;
  const [prefs, setPrefs] = useState<Record<string, boolean>>(currentPrefs);
  const [prefsInit, setPrefsInit] = useState(false);
  if (!prefsInit && p) { setPrefs(currentPrefs); setPrefsInit(true); }

  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      toast({ title: "Photo trop grande", description: "La photo ne doit pas dépasser 500 Ko.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    const validTypes = ["image/png", "image/jpeg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      toast({ title: "Format invalide", description: "Utilisez un fichier PNG, JPG ou WebP.", variant: "destructive" });
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setPhotoPreview(base64);
      try {
        await photoMutation.mutateAsync({ data: { photo_base64: base64 } });
        toast({ title: "Photo mise à jour" });
        void qc.invalidateQueries({ queryKey: qKey });
      } catch {
        toast({ title: "Erreur", description: "Impossible d'enregistrer la photo.", variant: "destructive" });
        setPhotoPreview(null);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfil = async () => {
    try {
      await modifierMutation.mutateAsync({ data: { nom: nomEdit, prenoms: prenomsEdit, telephone: telEdit } });
      toast({ title: "Profil mis à jour" });
      void qc.invalidateQueries({ queryKey: qKey });
    } catch {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le profil.", variant: "destructive" });
    }
  };

  const handleChangerMdp = async () => {
    try {
      await mdpMutation.mutateAsync({
        data: { mot_de_passe_actuel: mdpActuel, nouveau_mot_de_passe: mdpNouv, confirmation: mdpConf },
      });
      toast({ title: "Mot de passe changé avec succès" });
      setMdpActuel(""); setMdpNouv(""); setMdpConf("");
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast({ title: "Erreur", description: err?.response?.data?.message ?? "Erreur inattendue", variant: "destructive" });
    }
  };

  const handleSavePrefs = async () => {
    try {
      await prefsMutation.mutateAsync({ data: { preferences_notifs: prefs } });
      toast({ title: "Préférences enregistrées" });
      void qc.invalidateQueries({ queryKey: qKey });
    } catch {
      toast({ title: "Erreur", description: "Impossible de sauvegarder les préférences.", variant: "destructive" });
    }
  };

  const photoSrc = photoPreview ?? (p?.photo_url ? String(p.photo_url) : null);
  const initials = `${String(p?.prenoms ?? "").charAt(0)}${String(p?.nom ?? "").charAt(0)}`.toUpperCase();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#00C9A7" }} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 page-fade-in">

      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-extrabold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>Mon profil</h1>
        <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>Gérez vos informations personnelles et préférences</p>
      </div>

      {/* ── Section photo + infos ── */}
      <div className="rounded-2xl p-6 space-y-6" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-2 mb-2">
          <User className="w-4 h-4" style={{ color: "#00C9A7" }} />
          <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>Informations personnelles</h2>
        </div>

        {/* Avatar */}
        <div className="flex items-center gap-5">
          <div className="relative">
            {photoSrc ? (
              <img src={photoSrc} alt="Photo profil"
                className="w-20 h-20 rounded-full object-cover"
                style={{ border: "3px solid rgba(0,201,167,0.4)" }} />
            ) : (
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-extrabold"
                style={{ background: "rgba(0,201,167,0.15)", color: "#00C9A7", border: "3px solid rgba(0,201,167,0.3)", fontFamily: "'Syne', sans-serif" }}>
                {initials || "?"}
              </div>
            )}
            {photoMutation.isPending && (
              <div className="absolute inset-0 rounded-full flex items-center justify-center" style={{ background: "rgba(10,14,39,0.7)" }}>
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: "#00C9A7" }} />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handlePhotoChange} />
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.25)" }}>
              <Camera className="w-4 h-4" />Changer la photo
            </button>
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>PNG, JPG ou WebP · 500 Ko max</p>
          </div>
        </div>

        {/* Champs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>Nom</label>
            <input value={nomEdit} onChange={e => setNomEdit(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>Prénoms</label>
            <input value={prenomsEdit} onChange={e => setPrenomsEdit(e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>Email <span className="normal-case font-normal">(non modifiable)</span></label>
            <input value={String(p?.email ?? "")} readOnly
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none cursor-not-allowed"
              style={{ background: "rgba(139,157,195,0.06)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>Téléphone</label>
            <input value={telEdit} onChange={e => setTelEdit(e.target.value)} placeholder="+225 07 00 00 00 00"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>Rôle <span className="normal-case font-normal">(non modifiable)</span></label>
            <div className="rounded-xl px-3 py-2.5 flex items-center"
              style={{ background: "rgba(139,157,195,0.06)", border: "1px solid var(--m15-border)" }}>
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(0,201,167,0.12)", color: "#00C9A7" }}>
                {ROLE_LABELS[String(p?.role ?? "")] ?? String(p?.role ?? "")}
              </span>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>Établissement</label>
            <input value={String((p?.etablissement as Record<string, unknown>)?.nom ?? "—")} readOnly
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none cursor-not-allowed"
              style={{ background: "rgba(139,157,195,0.06)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }} />
          </div>
        </div>
        <button onClick={handleSaveProfil} disabled={modifierMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: "#00C9A7", color: "#0A0E27" }}>
          {modifierMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Save className="w-4 h-4" />Enregistrer</>}
        </button>
      </div>

      {/* ── Section sécurité ── */}
      <div className="rounded-2xl p-6 space-y-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" style={{ color: "#0080FF" }} />
          <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>Sécurité</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>Mot de passe actuel</label>
            <div className="relative">
              <input value={mdpActuel} onChange={e => setMdpActuel(e.target.value)}
                type={showMdpActuel ? "text" : "password"} placeholder="••••••••"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none pr-10"
                style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              <button onClick={() => setShowMdpActuel(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--m15-muted)" }}>
                {showMdpActuel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>Nouveau mot de passe</label>
            <div className="relative">
              <input value={mdpNouv} onChange={e => setMdpNouv(e.target.value)}
                type={showMdpNouv ? "text" : "password"} placeholder="••••••••"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none pr-10"
                style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              <button onClick={() => setShowMdpNouv(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--m15-muted)" }}>
                {showMdpNouv ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <PasswordStrength password={mdpNouv} />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>Confirmation</label>
            <input value={mdpConf} onChange={e => setMdpConf(e.target.value)}
              type="password" placeholder="••••••••"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            {mdpConf && mdpNouv !== mdpConf && (
              <p className="text-xs mt-1" style={{ color: "#FF4D6D" }}>Les mots de passe ne correspondent pas</p>
            )}
          </div>
        </div>
        <button onClick={handleChangerMdp}
          disabled={!mdpActuel || !mdpNouv || mdpNouv !== mdpConf || mdpMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold disabled:opacity-40"
          style={{ background: "#0080FF", color: "#fff" }}>
          {mdpMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Shield className="w-4 h-4" />Changer le mot de passe</>}
        </button>
      </div>

      {/* ── Section notifications ── */}
      <div className="rounded-2xl p-6 space-y-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4" style={{ color: "#F5C842" }} />
          <h2 className="font-bold text-sm uppercase tracking-widest" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>Préférences de notifications</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                <th className="text-left pb-3 font-semibold text-xs uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>Type</th>
                <th className="pb-3 text-center font-semibold text-xs uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>Email</th>
                <th className="pb-3 text-center font-semibold text-xs uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>Push</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
              {NOTIF_KEYS.map(row => (
                <tr key={row.key}>
                  <td className="py-3.5 font-medium" style={{ color: "var(--m15-white)" }}>{row.label}</td>
                  <td className="py-3.5 text-center">
                    <div className="flex justify-center">
                      <Toggle
                        checked={prefs[row.emailKey] ?? false}
                        onChange={v => setPrefs(p => ({ ...p, [row.emailKey]: v }))}
                      />
                    </div>
                  </td>
                  <td className="py-3.5 text-center">
                    <div className="flex justify-center">
                      <Toggle
                        checked={prefs[row.pushKey] ?? false}
                        onChange={v => setPrefs(p => ({ ...p, [row.pushKey]: v }))}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button onClick={handleSavePrefs} disabled={prefsMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
          style={{ background: "#F5C842", color: "#0A0E27" }}>
          {prefsMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-4 h-4" />Enregistrer les préférences</>}
        </button>
      </div>

      {/* ── Infos compte ── */}
      <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
          Compte créé le : {p?.created_at ? new Date(String(p.created_at)).toLocaleDateString("fr-FR") : "—"}
        </p>
      </div>
    </div>
  );
}
