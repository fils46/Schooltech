import { useState } from "react";
import { useLocation } from "wouter";
import { useInscrireEleve, type InscrireEleveInputMatriculeStatut } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import {
  UserSquare, ArrowLeft, ArrowRight, Check, CheckCircle2,
  User, Users, ClipboardList, Loader2,
} from "lucide-react";

/* ─── Stepper ────────────────────────────────────────────── */
const STEPS = [
  { id: 1, label: "Élève",       icon: User },
  { id: 2, label: "Parent",      icon: Users },
  { id: 3, label: "Confirmation",icon: ClipboardList },
];

function Stepper({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0">
      {STEPS.map((step, i) => {
        const Icon = step.icon;
        const done = current > step.id;
        const active = current === step.id;
        return (
          <div key={step.id} className="flex items-center">
            <div className="flex flex-col items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all border-2`}
                style={{
                  background: done ? "#00C9A7" : active ? "rgba(0,201,167,0.12)" : "var(--elevate-1)",
                  borderColor: done || active ? "#00C9A7" : "var(--m15-border)",
                  color: done || active ? (done ? "#fff" : "#00C9A7") : "var(--m15-muted)",
                }}>
                {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
              </div>
              <span className="mt-1.5 text-xs font-semibold"
                style={{ color: active ? "#00C9A7" : "var(--m15-muted)", fontFamily: "'DM Sans', sans-serif" }}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="w-16 h-0.5 mb-4 mx-2 transition-all"
                style={{ background: current > step.id ? "#00C9A7" : "var(--m15-border)" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── Champ formulaire ──────────────────────────────────── */
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-widest"
        style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-muted)" }}>
        {label}{required && <span style={{ color: "#FF4D6D" }}> *</span>}
      </label>
      {children}
    </div>
  );
}

const inputStyle = {
  background: "var(--elevate-1)",
  border: "1px solid var(--m15-border)",
  color: "var(--m15-white)",
  fontFamily: "'DM Sans', sans-serif",
  borderRadius: "0.75rem",
  padding: "0.625rem 0.875rem",
  fontSize: "0.875rem",
  outline: "none",
  width: "100%",
} as const;

/* ─── Interfaces ─────────────────────────────────────────── */
interface EleveData {
  nom: string; prenoms: string; date_naissance: string; lieu_naissance: string;
  sexe: string; adresse: string; situation_familiale: string; annee_inscription: string;
  matricule: string; matricule_statut: string; matricule_provisoire: string;
}
interface ParentData {
  parent_nom: string; parent_prenoms: string; parent_email: string;
  parent_telephone: string; parent_lien: string; est_principal: boolean;
}

/* ─── Étape 1 — Informations élève ───────────────────────── */
function EtapeEleve({ data, onChange }: { data: EleveData; onChange: (d: Partial<EleveData>) => void }) {
  const anneeActuelle = new Date().getFullYear();
  const annees = Array.from({ length: 3 }, (_, i) => anneeActuelle - i);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Nom" required>
        <input style={inputStyle} value={data.nom} onChange={e => onChange({ nom: e.target.value })} placeholder="KOUASSI" />
      </Field>
      <Field label="Prénoms" required>
        <input style={inputStyle} value={data.prenoms} onChange={e => onChange({ prenoms: e.target.value })} placeholder="Jean-Pierre" />
      </Field>
      <Field label="Date de naissance" required>
        <input type="date" style={inputStyle} value={data.date_naissance} onChange={e => onChange({ date_naissance: e.target.value })} />
      </Field>
      <Field label="Lieu de naissance">
        <input style={inputStyle} value={data.lieu_naissance} onChange={e => onChange({ lieu_naissance: e.target.value })} placeholder="Abidjan" />
      </Field>
      <Field label="Sexe" required>
        <div className="flex gap-3">
          {[{ val: "M", label: "♂ Masculin" }, { val: "F", label: "♀ Féminin" }].map(({ val, label }) => (
            <button key={val} type="button"
              onClick={() => onChange({ sexe: val })}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: data.sexe === val ? "rgba(0,201,167,0.12)" : "var(--elevate-1)",
                border: `1px solid ${data.sexe === val ? "#00C9A7" : "var(--m15-border)"}`,
                color: data.sexe === val ? "#00C9A7" : "var(--m15-muted)",
              }}>
              {label}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Année d'inscription" required>
        <select style={inputStyle} value={data.annee_inscription} onChange={e => onChange({ annee_inscription: e.target.value })}>
          {annees.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </Field>
      <Field label="Adresse">
        <input style={inputStyle} value={data.adresse} onChange={e => onChange({ adresse: e.target.value })} placeholder="Cocody, Abidjan" />
      </Field>
      <Field label="Situation familiale">
        <select style={inputStyle} value={data.situation_familiale} onChange={e => onChange({ situation_familiale: e.target.value })}>
          <option value="">Non précisée</option>
          <option value="pere_mere">Père et mère</option>
          <option value="mere">Mère seule</option>
          <option value="pere">Père seul</option>
          <option value="tuteur">Sous tutelle</option>
        </select>
      </Field>

      {/* ── Matricule ── */}
      <div className="md:col-span-2 rounded-xl p-4 space-y-3" style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-muted)" }}>
            Matricule élève
          </span>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(245,200,66,0.12)", color: "#F5C842", border: "1px solid rgba(245,200,66,0.25)" }}>
            Attribué par le Ministère
          </span>
        </div>
        <input
          style={inputStyle}
          value={data.matricule}
          onChange={e => onChange({ matricule: e.target.value })}
          placeholder="Ex: CI-2024-ABJ-00123  —  format libre"
        />
        {!data.matricule && (
          <p className="text-xs flex items-center gap-1.5" style={{ color: "#F5C842" }}>
            ⚠️ L'élève pourra être inscrit sans matricule. Pensez à le renseigner dès réception du document ministériel.
          </p>
        )}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--m15-muted)", fontFamily: "'Syne', sans-serif" }}>
            Statut du matricule
          </label>
          <div className="flex gap-2 flex-wrap">
            {[
              { val: "en_attente", label: "⏳ En attente", color: "#F5C842" },
              { val: "provisoire", label: "🔵 Provisoire", color: "#0080FF" },
              { val: "officiel",   label: "✅ Officiel",   color: "#00C9A7" },
            ].map(({ val, label, color }) => (
              <button key={val} type="button"
                onClick={() => onChange({ matricule_statut: val })}
                className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all"
                style={{
                  background: data.matricule_statut === val ? `${color}20` : "var(--m15-card)",
                  border: `1px solid ${data.matricule_statut === val ? color : "var(--m15-border)"}`,
                  color: data.matricule_statut === val ? color : "var(--m15-muted)",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {data.matricule_statut === "provisoire" && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5" style={{ color: "var(--m15-muted)", fontFamily: "'Syne', sans-serif" }}>
              Numéro provisoire interne
            </label>
            <input
              style={inputStyle}
              value={data.matricule_provisoire}
              onChange={e => onChange({ matricule_provisoire: e.target.value })}
              placeholder="Référence interne temporaire"
            />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Étape 2 — Informations parent ──────────────────────── */
function EtapeParent({ data, onChange }: { data: ParentData; onChange: (d: Partial<ParentData>) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <Field label="Nom du parent" required>
        <input style={inputStyle} value={data.parent_nom} onChange={e => onChange({ parent_nom: e.target.value })} placeholder="KOUASSI" />
      </Field>
      <Field label="Prénoms du parent" required>
        <input style={inputStyle} value={data.parent_prenoms} onChange={e => onChange({ parent_prenoms: e.target.value })} placeholder="Amadou" />
      </Field>
      <Field label="Email" required>
        <input type="email" style={inputStyle} value={data.parent_email} onChange={e => onChange({ parent_email: e.target.value })} placeholder="parent@email.com" />
      </Field>
      <Field label="Téléphone">
        <input style={inputStyle} value={data.parent_telephone} onChange={e => onChange({ parent_telephone: e.target.value })} placeholder="+225 07 XX XX XX XX" />
      </Field>
      <Field label="Lien avec l'élève" required>
        <select style={inputStyle} value={data.parent_lien} onChange={e => onChange({ parent_lien: e.target.value })}>
          <option value="">Choisir…</option>
          <option value="pere">Père</option>
          <option value="mere">Mère</option>
          <option value="tuteur">Tuteur / Tutrice</option>
        </select>
      </Field>
      <Field label="Contact principal">
        <div className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}
          onClick={() => onChange({ est_principal: !data.est_principal })}>
          <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all"
            style={{ background: data.est_principal ? "#00C9A7" : "transparent", border: `2px solid ${data.est_principal ? "#00C9A7" : "var(--m15-border)"}` }}>
            {data.est_principal && <Check className="w-3 h-3 text-[var(--m15-white)]" />}
          </div>
          <span className="text-sm" style={{ color: "var(--m15-muted)" }}>Est le contact principal</span>
        </div>
      </Field>
    </div>
  );
}

/* ─── Étape 3 — Récapitulatif ─────────────────────────────── */
function EtapeRecap({
  eleveData, parentData, confirme, setConfirme,
}: {
  eleveData: EleveData; parentData: ParentData;
  confirme: boolean; setConfirme: (v: boolean) => void;
}) {
  const sexeLabel = eleveData.sexe === "M" ? "Masculin" : eleveData.sexe === "F" ? "Féminin" : "—";
  const sfLabel: Record<string, string> = { pere_mere: "Père et mère", mere: "Mère seule", pere: "Père seul", tuteur: "Sous tutelle" };
  const lienLabel: Record<string, string> = { pere: "Père", mere: "Mère", tuteur: "Tuteur" };

  const rows = [
    { label: "Nom complet", value: `${eleveData.prenoms} ${eleveData.nom}` },
    { label: "Date de naissance", value: eleveData.date_naissance || "—" },
    { label: "Lieu de naissance", value: eleveData.lieu_naissance || "—" },
    { label: "Sexe", value: sexeLabel },
    { label: "Année d'inscription", value: eleveData.annee_inscription },
    { label: "Adresse", value: eleveData.adresse || "—" },
    { label: "Situation familiale", value: sfLabel[eleveData.situation_familiale] ?? "—" },
  ];

  const parentRows = [
    { label: "Nom complet", value: `${parentData.parent_prenoms} ${parentData.parent_nom}` },
    { label: "Email", value: parentData.parent_email },
    { label: "Téléphone", value: parentData.parent_telephone || "—" },
    { label: "Lien", value: lienLabel[parentData.parent_lien] ?? parentData.parent_lien },
    { label: "Contact principal", value: parentData.est_principal ? "Oui" : "Non" },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(0,201,167,0.2)" }}>
        <div className="px-4 py-2.5 flex items-center gap-2"
          style={{ background: "rgba(0,201,167,0.08)", borderBottom: "1px solid rgba(0,201,167,0.15)" }}>
          <User className="w-4 h-4" style={{ color: "#00C9A7" }} />
          <h3 className="font-bold text-sm" style={{ fontFamily: "'Syne', sans-serif", color: "#00C9A7" }}>
            Informations élève
          </h3>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
          {rows.map(({ label, value }) => (
            <div key={label} className="flex px-4 py-2.5 gap-3">
              <span className="text-xs w-36 flex-shrink-0 font-semibold uppercase tracking-wide"
                style={{ color: "var(--m15-muted)", fontFamily: "'Syne', sans-serif" }}>{label}</span>
              <span className="text-sm" style={{ color: "var(--m15-white)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: "1px solid rgba(245,200,66,0.2)" }}>
        <div className="px-4 py-2.5 flex items-center gap-2"
          style={{ background: "rgba(245,200,66,0.08)", borderBottom: "1px solid rgba(245,200,66,0.15)" }}>
          <Users className="w-4 h-4" style={{ color: "#F5C842" }} />
          <h3 className="font-bold text-sm" style={{ fontFamily: "'Syne', sans-serif", color: "#F5C842" }}>
            Informations parent
          </h3>
        </div>
        <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
          {parentRows.map(({ label, value }) => (
            <div key={label} className="flex px-4 py-2.5 gap-3">
              <span className="text-xs w-36 flex-shrink-0 font-semibold uppercase tracking-wide"
                style={{ color: "var(--m15-muted)", fontFamily: "'Syne', sans-serif" }}>{label}</span>
              <span className="text-sm" style={{ color: "var(--m15-white)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 p-4 rounded-xl cursor-pointer"
        style={{ background: confirme ? "rgba(0,201,167,0.06)" : "var(--elevate-1)", border: `1px solid ${confirme ? "rgba(0,201,167,0.3)" : "var(--m15-border)"}` }}
        onClick={() => setConfirme(!confirme)}>
        <div className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: confirme ? "#00C9A7" : "transparent", border: `2px solid ${confirme ? "#00C9A7" : "var(--m15-border)"}` }}>
          {confirme && <Check className="w-3 h-3 text-[var(--m15-white)]" />}
        </div>
        <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
          Je confirme l'exactitude des informations saisies et autorise la création des comptes élève et parent.
        </p>
      </div>
    </div>
  );
}

/* ─── Succès ──────────────────────────────────────────────── */
function EtapeSucces({
  matricule, matricule_statut, emailEleve, passwordEleve, onReset,
}: {
  matricule?: string | null; matricule_statut?: string;
  emailEleve?: string; passwordEleve?: string; onReset: () => void;
}) {
  const [, setLocation] = useLocation();
  const statut = matricule_statut ?? "en_attente";
  const badgeLabel = statut === "officiel" ? "✅ Matricule officiel"
    : statut === "provisoire" ? "🔵 Provisoire"
    : "⏳ En attente d'attribution";
  const badgeColor = statut === "officiel" ? "#00C9A7" : statut === "provisoire" ? "#0080FF" : "#F5C842";

  return (
    <div className="flex flex-col items-center text-center gap-5 py-6">
      <div className="w-16 h-16 rounded-full flex items-center justify-center"
        style={{ background: "rgba(0,201,167,0.12)", border: "2px solid rgba(0,201,167,0.3)" }}>
        <CheckCircle2 className="w-8 h-8" style={{ color: "#00C9A7" }} />
      </div>
      <div>
        <h3 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
          Inscription réussie !
        </h3>
        <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
          L'élève a été inscrit et les comptes ont été créés avec succès.
        </p>
      </div>

      <div className="rounded-xl p-4 w-full text-left space-y-3"
        style={{ background: "var(--elevate-1)", border: "1px solid rgba(0,201,167,0.2)" }}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--m15-muted)" }}>Matricule</span>
          {matricule ? (
            <span className="text-sm font-mono font-bold px-3 py-1 rounded-lg"
              style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7" }}>
              {matricule}
            </span>
          ) : (
            <span className="text-sm italic" style={{ color: "var(--m15-muted)" }}>Non renseigné</span>
          )}
          <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold"
            style={{ background: `${badgeColor}18`, color: badgeColor, border: `1px solid ${badgeColor}40` }}>
            {badgeLabel}
          </span>
        </div>
        {statut !== "officiel" && (
          <p className="text-xs" style={{ color: "#F5C842" }}>
            ⚠️ Pensez à renseigner le matricule officiel dès réception du document du Ministère.
          </p>
        )}
        {emailEleve && (
          <div className="pt-2" style={{ borderTop: "1px solid var(--m15-border)" }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "var(--m15-muted)" }}>
              Identifiants élève (à communiquer)
            </p>
            <p className="text-sm" style={{ color: "var(--m15-white)" }}>Email : {emailEleve}</p>
            {passwordEleve && <p className="text-sm" style={{ color: "var(--m15-white)" }}>Mot de passe temporaire : <strong style={{ color: "#F5C842" }}>{passwordEleve}</strong></p>}
          </div>
        )}
        <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
          Lors de la première connexion, l'élève et le parent devront changer leur mot de passe.
        </p>
      </div>

      <div className="flex gap-3 w-full">
        <button onClick={onReset}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
          Inscrire un autre élève
        </button>
        <button onClick={() => setLocation("/eleves")}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
          style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
          Retour à la liste
        </button>
      </div>
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────── */
export default function EleveForm() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [step, setStep] = useState(1);
  const [success, setSuccess] = useState(false);
  const [resultat, setResultat] = useState<{ matricule?: string | null; matricule_statut?: string; emailEleve?: string; passwordEleve?: string }>({});

  const ANNEE = new Date().getFullYear();
  const [eleveData, setEleveData] = useState<EleveData>({
    nom: "", prenoms: "", date_naissance: "", lieu_naissance: "",
    sexe: "", adresse: "", situation_familiale: "", annee_inscription: String(ANNEE),
    matricule: "", matricule_statut: "en_attente", matricule_provisoire: "",
  });
  const [parentData, setParentData] = useState<ParentData>({
    parent_nom: "", parent_prenoms: "", parent_email: "",
    parent_telephone: "", parent_lien: "", est_principal: true,
  });
  const [confirme, setConfirme] = useState(false);

  const mutation = useInscrireEleve();

  const validateStep1 = () => {
    if (!eleveData.nom.trim()) { toast({ title: "Erreur", description: "Le nom est obligatoire.", variant: "destructive" }); return false; }
    if (!eleveData.prenoms.trim()) { toast({ title: "Erreur", description: "Les prénoms sont obligatoires.", variant: "destructive" }); return false; }
    if (!eleveData.date_naissance) { toast({ title: "Erreur", description: "La date de naissance est obligatoire.", variant: "destructive" }); return false; }
    if (!eleveData.sexe) { toast({ title: "Erreur", description: "Le sexe est obligatoire.", variant: "destructive" }); return false; }
    return true;
  };

  const validateStep2 = () => {
    if (!parentData.parent_nom.trim()) { toast({ title: "Erreur", description: "Le nom du parent est obligatoire.", variant: "destructive" }); return false; }
    if (!parentData.parent_prenoms.trim()) { toast({ title: "Erreur", description: "Les prénoms du parent sont obligatoires.", variant: "destructive" }); return false; }
    if (!parentData.parent_email.trim() || !parentData.parent_email.includes("@")) {
      toast({ title: "Erreur", description: "L'email du parent est invalide.", variant: "destructive" }); return false;
    }
    if (!parentData.parent_lien) { toast({ title: "Erreur", description: "Le lien avec l'élève est obligatoire.", variant: "destructive" }); return false; }
    return true;
  };

  const handleNext = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    if (!confirme) { toast({ title: "Confirmation requise", description: "Veuillez confirmer l'exactitude des informations.", variant: "destructive" }); return; }
    try {
      const result = await mutation.mutateAsync({
        data: {
          nom: eleveData.nom,
          prenoms: eleveData.prenoms,
          date_naissance: eleveData.date_naissance,
          lieu_naissance: eleveData.lieu_naissance || undefined,
          sexe: eleveData.sexe,
          adresse: eleveData.adresse || undefined,
          situation_familiale: eleveData.situation_familiale || undefined,
          annee_inscription: parseInt(eleveData.annee_inscription),
          matricule: eleveData.matricule || undefined,
          matricule_statut: (eleveData.matricule_statut || undefined) as InscrireEleveInputMatriculeStatut | undefined,
          matricule_provisoire: eleveData.matricule_provisoire || undefined,
          parent_nom: parentData.parent_nom,
          parent_prenoms: parentData.parent_prenoms,
          parent_email: parentData.parent_email,
          parent_lien: parentData.parent_lien,
          parent_telephone: parentData.parent_telephone || undefined,
        },
      });
      setResultat({
        matricule: (result as unknown as Record<string, unknown>).matricule as string | null,
        matricule_statut: (result as unknown as Record<string, unknown>).matricule_statut as string,
        emailEleve: result.email_eleve,
        passwordEleve: result.password_eleve_temporaire,
      });
      setSuccess(true);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur lors de l'inscription.";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  };

  const handleReset = () => {
    setStep(1); setSuccess(false); setConfirme(false); setResultat({});
    setEleveData({ nom: "", prenoms: "", date_naissance: "", lieu_naissance: "", sexe: "", adresse: "", situation_familiale: "", annee_inscription: String(ANNEE), matricule: "", matricule_statut: "en_attente", matricule_provisoire: "" });
    setParentData({ parent_nom: "", parent_prenoms: "", parent_email: "", parent_telephone: "", parent_lien: "", est_principal: true });
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 page-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/eleves")}
          className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(0,201,167,0.12)", border: "1px solid rgba(0,201,167,0.2)" }}>
            <UserSquare className="w-4 h-4" style={{ color: "#00C9A7" }} />
          </div>
          <h1 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Inscription d'un élève
          </h1>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-2xl p-6 md:p-8"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>

        {!success && <div className="mb-8"><Stepper current={step} /></div>}

        {success ? (
          <EtapeSucces matricule={resultat.matricule} matricule_statut={resultat.matricule_statut} emailEleve={resultat.emailEleve} passwordEleve={resultat.passwordEleve} onReset={handleReset} />
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-lg font-bold mb-1" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                {step === 1 ? "Informations de l'élève" : step === 2 ? "Informations du parent/tuteur" : "Récapitulatif"}
              </h2>
              <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
                {step === 1 ? "Renseignez les informations personnelles de l'élève." :
                 step === 2 ? "Renseignez les informations du parent ou tuteur légal." :
                 "Vérifiez les informations avant de valider l'inscription."}
              </p>
            </div>

            {step === 1 && <EtapeEleve data={eleveData} onChange={(d) => setEleveData((p) => ({ ...p, ...d }))} />}
            {step === 2 && <EtapeParent data={parentData} onChange={(d) => setParentData((p) => ({ ...p, ...d }))} />}
            {step === 3 && <EtapeRecap eleveData={eleveData} parentData={parentData} confirme={confirme} setConfirme={setConfirme} />}

            <div className="flex justify-between mt-8 pt-5" style={{ borderTop: "1px solid var(--m15-border)" }}>
              {step > 1 ? (
                <button onClick={handleBack}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
                  <ArrowLeft className="w-4 h-4" /> Précédent
                </button>
              ) : (
                <button onClick={() => setLocation("/eleves")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
                  <ArrowLeft className="w-4 h-4" /> Annuler
                </button>
              )}
              {step < 3 ? (
                <button onClick={handleNext}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
                  Suivant <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button onClick={handleSubmit} disabled={mutation.isPending}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
                  style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff", opacity: mutation.isPending ? 0.7 : 1 }}>
                  {mutation.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Inscription…</> : <><Check className="w-4 h-4" /> Valider l'inscription</>}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
