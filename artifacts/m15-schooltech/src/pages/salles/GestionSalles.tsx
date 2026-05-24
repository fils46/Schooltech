import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  useListerSalles, getListerSallesQueryKey,
  useCreerSalle, useModifierSalle, useDesactiverSalle,
  useGetDisponibiliteSalle, getGetDisponibiliteSalleQueryKey,
  useGetConflitsSalles, getGetConflitsSallesQueryKey,
  useListerAnneesScolaires, getListerAnneesScolairesQueryKey,
} from "@workspace/api-client-react";
import {
  Building2, FlaskConical, Monitor, Dumbbell, Library,
  UsersRound, Mic2, HelpCircle, Plus, Pencil, PowerOff,
  Calendar, AlertTriangle, X, ChevronDown, ChevronUp,
  Loader2, CheckCircle2, Users,
} from "lucide-react";

/* ─── Types locaux ───────────────────────────────────────── */
type TypeSalle = "classe" | "laboratoire" | "salle_info" | "gymnase" | "bibliotheque" | "salle_reunion" | "amphitheatre" | "autre";
type SalleRecord = Record<string, unknown>;

/* ─── Config type de salle ───────────────────────────────── */
const TYPE_CONFIG: Record<TypeSalle, { label: string; color: string; Icon: React.ElementType }> = {
  classe:       { label: "Classe",         color: "#00C9A7", Icon: Building2   },
  laboratoire:  { label: "Laboratoire",    color: "#0080FF", Icon: FlaskConical },
  salle_info:   { label: "Informatique",   color: "#F5C842", Icon: Monitor     },
  gymnase:      { label: "Gymnase",        color: "#9B59B6", Icon: Dumbbell    },
  bibliotheque: { label: "Bibliothèque",   color: "#E67E22", Icon: Library     },
  salle_reunion:{ label: "Réunion",        color: "#2ECC71", Icon: UsersRound  },
  amphitheatre: { label: "Amphithéâtre",   color: "#E74C3C", Icon: Mic2        },
  autre:        { label: "Autre",          color: "#8B9DC3", Icon: HelpCircle  },
};

const EQUIPEMENTS_OPTIONS = [
  { value: "projecteur",       label: "Projecteur" },
  { value: "tableau_blanc",    label: "Tableau blanc" },
  { value: "climatisation",    label: "Climatisation" },
  { value: "ordinateurs",      label: "Ordinateurs" },
  { value: "laboratoire",      label: "Équipement labo" },
  { value: "sono",             label: "Sono / Micro" },
  { value: "tableau_interactif", label: "Tableau interactif" },
  { value: "autre",            label: "Autre" },
];

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;
const JOUR_LABELS: Record<string, string> = {
  lundi: "Lun", mardi: "Mar", mercredi: "Mer", jeudi: "Jeu", vendredi: "Ven", samedi: "Sam",
};

/* ─── Composant carte salle ──────────────────────────────── */
function SalleCard({
  salle, canEdit, onEdit, onDesactiver, onVoirDispo,
}: {
  salle: SalleRecord;
  canEdit: boolean;
  onEdit: (s: SalleRecord) => void;
  onDesactiver: (id: string) => void;
  onVoirDispo: (s: SalleRecord) => void;
}) {
  const type = String(salle.type ?? "autre") as TypeSalle;
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.autre;
  const { Icon, color, label } = cfg;
  const equipements = (salle.equipements as string[] | null) ?? [];
  const actif = Boolean(salle.actif);

  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3" style={{
      background: "var(--m15-card)",
      border: "1px solid var(--m15-border)",
      opacity: actif ? 1 : 0.6,
    }}>
      <div className="flex items-start justify-between gap-2">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ background: `${color}18`, color }}>
            {label}
          </span>
          {!actif && (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
              style={{ background: "rgba(255,77,109,0.12)", color: "#FF4D6D" }}>
              Inactive
            </span>
          )}
        </div>
      </div>

      <div className="flex-1">
        <h3 className="font-extrabold text-base" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
          {String(salle.nom)}
        </h3>
        <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
          {salle.capacite != null && (
            <span className="text-xs flex items-center gap-1" style={{ color: "var(--m15-muted)" }}>
              <Users className="w-3 h-3" />{String(salle.capacite)} places
            </span>
          )}
          {salle.etage ? (
            <span className="text-xs" style={{ color: "var(--m15-muted)" }}>
              Étage : {String(salle.etage)}
            </span>
          ) : null}
          {salle.batiment ? (
            <span className="text-xs" style={{ color: "var(--m15-muted)" }}>
              Bât. {String(salle.batiment)}
            </span>
          ) : null}
        </div>
      </div>

      {equipements.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {equipements.slice(0, 4).map(eq => (
            <span key={eq} className="text-xs px-1.5 py-0.5 rounded-md"
              style={{ background: "var(--m15-navy)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
              {EQUIPEMENTS_OPTIONS.find(o => o.value === eq)?.label ?? eq}
            </span>
          ))}
          {equipements.length > 4 && (
            <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ color: "var(--m15-muted)" }}>
              +{equipements.length - 4}
            </span>
          )}
        </div>
      )}

      <div className="flex gap-2 pt-2" style={{ borderTop: "1px solid var(--m15-border)" }}>
        <button onClick={() => onVoirDispo(salle)}
          className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: "rgba(0,201,167,0.08)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }}>
          <Calendar className="w-3.5 h-3.5" />Disponibilités
        </button>
        {canEdit && actif && (
          <>
            <button onClick={() => onEdit(salle)}
              className="w-8 h-8 flex items-center justify-center rounded-xl"
              style={{ background: "rgba(0,128,255,0.08)", color: "#0080FF", border: "1px solid rgba(0,128,255,0.2)" }}>
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => onDesactiver(String(salle.id))}
              className="w-8 h-8 flex items-center justify-center rounded-xl"
              style={{ background: "rgba(255,77,109,0.08)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.2)" }}>
              <PowerOff className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/* ─── Modal CRUD ─────────────────────────────────────────── */
function ModalSalle({
  editItem, onClose, onSuccess, etablissementId,
}: {
  editItem: SalleRecord | null;
  onClose: () => void;
  onSuccess: () => void;
  etablissementId: string;
}) {
  const { toast } = useToast();
  const creerMut = useCreerSalle();
  const modifierMut = useModifierSalle();
  const isEdit = editItem !== null;

  const [nom, setNom] = useState(String(editItem?.nom ?? ""));
  const [type, setType] = useState<TypeSalle>((editItem?.type as TypeSalle) ?? "classe");
  const [capacite, setCapacite] = useState(editItem?.capacite != null ? String(editItem.capacite) : "");
  const [etage, setEtage] = useState(String(editItem?.etage ?? ""));
  const [batiment, setBatiment] = useState(String(editItem?.batiment ?? ""));
  const [equipements, setEquipements] = useState<string[]>(
    Array.isArray(editItem?.equipements) ? editItem.equipements as string[] : []
  );

  function toggleEquip(val: string) {
    setEquipements(prev =>
      prev.includes(val) ? prev.filter(e => e !== val) : [...prev, val]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) { toast({ title: "Le nom est requis.", variant: "destructive" }); return; }

    const payload = {
      nom: nom.trim(),
      type,
      capacite: capacite ? parseInt(capacite) : undefined,
      equipements: equipements.length > 0 ? equipements : undefined,
      etage: etage.trim() || undefined,
      batiment: batiment.trim() || undefined,
      etablissement_id: etablissementId,
    };

    try {
      if (isEdit) {
        await modifierMut.mutateAsync({ id: String(editItem.id), data: payload });
        toast({ title: "Salle modifiée." });
      } else {
        await creerMut.mutateAsync({ data: payload });
        toast({ title: "Salle créée !" });
      }
      onSuccess();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
      toast({ title: "Erreur", description: msg, variant: "destructive" });
    }
  }

  const isPending = creerMut.isPending || modifierMut.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)" }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
          <h2 className="font-extrabold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
            {isEdit ? "Modifier la salle" : "Nouvelle salle"}
          </h2>
          <button onClick={onClose} style={{ color: "var(--m15-muted)" }}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Nom */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>Nom *</label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Salle A12"
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: "var(--m15-muted)" }}>Type *</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(TYPE_CONFIG) as [TypeSalle, typeof TYPE_CONFIG[TypeSalle]][]).map(([val, cfg]) => {
                const { Icon, color, label } = cfg;
                const selected = type === val;
                return (
                  <button key={val} type="button" onClick={() => setType(val)}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: selected ? `${color}20` : "var(--m15-navy)",
                      border: `1px solid ${selected ? color : "var(--m15-border)"}`,
                      color: selected ? color : "var(--m15-muted)",
                    }}>
                    <Icon className="w-4 h-4" />
                    <span className="leading-tight text-center">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Capacité + Étage + Bâtiment */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>Capacité</label>
              <input value={capacite} onChange={e => setCapacite(e.target.value)} type="number" min="1" placeholder="30"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>Étage</label>
              <input value={etage} onChange={e => setEtage(e.target.value)} placeholder="RDC"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest block mb-1.5" style={{ color: "var(--m15-muted)" }}>Bâtiment</label>
              <input value={batiment} onChange={e => setBatiment(e.target.value)} placeholder="A"
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>
          </div>

          {/* Équipements */}
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest block mb-2" style={{ color: "var(--m15-muted)" }}>Équipements</label>
            <div className="grid grid-cols-2 gap-2">
              {EQUIPEMENTS_OPTIONS.map(opt => {
                const checked = equipements.includes(opt.value);
                return (
                  <button key={opt.value} type="button" onClick={() => toggleEquip(opt.value)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all text-left"
                    style={{
                      background: checked ? "rgba(0,201,167,0.1)" : "var(--m15-navy)",
                      border: `1px solid ${checked ? "#00C9A7" : "var(--m15-border)"}`,
                      color: checked ? "#00C9A7" : "var(--m15-muted)",
                    }}>
                    <div className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0"
                      style={{ background: checked ? "#00C9A7" : "var(--m15-border)" }}>
                      {checked && <CheckCircle2 className="w-3 h-3 text-white" />}
                    </div>
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
              Annuler
            </button>
            <button type="submit" disabled={isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : isEdit ? "Enregistrer" : "Créer la salle"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Modal Disponibilités ───────────────────────────────── */
function ModalDisponibilites({
  salle, anneeId, onClose,
}: {
  salle: SalleRecord;
  anneeId: string;
  onClose: () => void;
}) {
  const { data } = useGetDisponibiliteSalle(String(salle.id), { annee_scolaire_id: anneeId }, {
    query: { queryKey: getGetDisponibiliteSalleQueryKey(String(salle.id), { annee_scolaire_id: anneeId }) },
  });

  const d = data as Record<string, unknown> | undefined;
  const occupes = (d?.creneaux_occupes as Record<string, unknown>[]) ?? [];
  const libres = (d?.creneaux_libres as Record<string, unknown>[]) ?? [];

  // Construire un set de clés occupées : "jour|creneau_id"
  const occupesMap = new Map<string, Record<string, unknown>>();
  for (const c of occupes) occupesMap.set(`${c.jour}|${c.creneau_id}`, c);

  // Regrouper les créneaux (libres + occupés) par heure
  const allCreneauxIds = new Set([
    ...occupes.map(c => String(c.creneau_id)),
    ...libres.map(c => String(c.creneau_id)),
  ]);

  type CreneauMeta = { id: string; libelle: string; heure_debut: string };
  const creneauMetas: CreneauMeta[] = [...new Map(
    [...occupes, ...libres].map(c => [
      String(c.creneau_id),
      { id: String(c.creneau_id), libelle: String(c.creneau_libelle ?? c.libelle ?? c.creneau_id), heure_debut: String(c.creneau_heure_debut ?? c.heure_debut ?? "") },
    ])
  ).values()].sort((a, b) => a.heure_debut.localeCompare(b.heure_debut));

  const type = String(salle.type ?? "autre") as TypeSalle;
  const cfg = TYPE_CONFIG[type] ?? TYPE_CONFIG.autre;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid var(--m15-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${cfg.color}18` }}>
              <cfg.Icon className="w-4 h-4" style={{ color: cfg.color }} />
            </div>
            <div>
              <h2 className="font-extrabold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
                {String(salle.nom)}
              </h2>
              <p className="text-xs" style={{ color: "var(--m15-muted)" }}>Disponibilités sur la semaine</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: "var(--m15-muted)" }}><X className="w-5 h-5" /></button>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {!d ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "#00C9A7" }} />
            </div>
          ) : creneauMetas.length === 0 ? (
            <div className="text-center py-12" style={{ color: "var(--m15-muted)" }}>
              <Calendar className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>Aucun créneau configuré pour cet établissement.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="text-left px-3 py-2 text-xs uppercase tracking-widest font-semibold"
                      style={{ color: "var(--m15-muted)", borderBottom: "1px solid var(--m15-border)" }}>
                      Créneau
                    </th>
                    {JOURS.map(j => (
                      <th key={j} className="px-2 py-2 text-center text-xs uppercase tracking-widest font-semibold"
                        style={{ color: "var(--m15-muted)", borderBottom: "1px solid var(--m15-border)" }}>
                        {JOUR_LABELS[j]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {creneauMetas.map(creneau => (
                    <tr key={creneau.id} style={{ borderBottom: "1px solid var(--m15-border)" }}>
                      <td className="px-3 py-2.5 font-medium text-xs" style={{ color: "var(--m15-white)", whiteSpace: "nowrap" }}>
                        {creneau.libelle}
                      </td>
                      {JOURS.map(jour => {
                        const key = `${jour}|${creneau.id}`;
                        const occ = occupesMap.get(key);
                        return (
                          <td key={jour} className="px-2 py-2 text-center">
                            {occ ? (
                              <div className="rounded-lg px-2 py-1.5 text-xs leading-tight"
                                style={{ background: "rgba(255,77,109,0.12)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.2)" }}>
                                <p className="font-semibold truncate max-w-[80px]">{String(occ.matiere ?? "")}</p>
                              </div>
                            ) : (
                              <div className="rounded-lg px-2 py-1.5"
                                style={{ background: "rgba(0,201,167,0.08)", border: "1px solid rgba(0,201,167,0.15)" }}>
                                <span className="text-xs" style={{ color: "#00C9A7" }}>Libre</span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Légende */}
          <div className="flex items-center gap-6 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "rgba(255,77,109,0.2)", border: "1px solid rgba(255,77,109,0.3)" }} />
              <span className="text-xs" style={{ color: "var(--m15-muted)" }}>Occupé ({occupes.length})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: "rgba(0,201,167,0.12)", border: "1px solid rgba(0,201,167,0.2)" }} />
              <span className="text-xs" style={{ color: "var(--m15-muted)" }}>Libre ({libres.length})</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Section conflits ───────────────────────────────────── */
function SectionConflits({ etablissementId, anneeId }: { etablissementId: string; anneeId: string }) {
  const [open, setOpen] = useState(false);
  const { data } = useGetConflitsSalles(
    { annee_scolaire_id: anneeId, etablissement_id: etablissementId },
    { query: { queryKey: getGetConflitsSallesQueryKey({ annee_scolaire_id: anneeId }) } }
  );
  const d = data as Record<string, unknown> | undefined;
  const conflits = (d?.conflits as Record<string, unknown>[]) ?? [];
  const total = Number(d?.total ?? 0);

  if (!anneeId) return null;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: `1px solid ${total > 0 ? "rgba(255,77,109,0.3)" : "var(--m15-border)"}` }}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ borderBottom: open ? "1px solid var(--m15-border)" : "none" }}>
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-4 h-4" style={{ color: total > 0 ? "#FF4D6D" : "#F5C842" }} />
          <span className="font-bold text-sm" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
            Conflits de réservation
          </span>
          {total > 0 ? (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(255,77,109,0.15)", color: "#FF4D6D" }}>
              {total} conflit{total > 1 ? "s" : ""}
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7" }}>
              Aucun conflit
            </span>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4" style={{ color: "var(--m15-muted)" }} /> : <ChevronDown className="w-4 h-4" style={{ color: "var(--m15-muted)" }} />}
      </button>
      {open && (
        <div className="px-5 pb-5 pt-3">
          {conflits.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucun conflit détecté pour cette année scolaire.</p>
          ) : (
            <div className="space-y-3">
              {conflits.map((c, i) => (
                <div key={i} className="rounded-xl p-4" style={{ background: "rgba(255,77,109,0.06)", border: "1px solid rgba(255,77,109,0.2)" }}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#FF4D6D" }} />
                    <span className="font-semibold text-sm" style={{ color: "#FF4D6D" }}>
                      {String(c.salle_nom ?? "")} — {String(c.jour ?? "")} ({String(c.creneau_id ?? "")})
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                    {(c.creneaux_conflictuels as { matiere: string }[]).map(cc => cc.matiere).join(" · ")} assignés au même créneau
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────── */
export default function GestionSalles() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const etablissementId = user?.etablissement_id ?? "";
  const canEdit = ["directeur", "censeur"].includes(user?.role ?? "");

  // Filtres
  const [typeFilter, setTypeFilter] = useState<TypeSalle | "">("");
  const [actifFilter, setActifFilter] = useState<"true" | "false" | "">("");

  // Hooks données
  const qKey = getListerSallesQueryKey({ etablissement_id: etablissementId });
  const { data: sallesData, isLoading } = useListerSalles(
    { etablissement_id: etablissementId },
    { query: { queryKey: qKey } }
  );
  const allSalles = ((sallesData as unknown as Record<string, unknown>)?.salles as SalleRecord[] | undefined) ?? [];
  // Filtrage client-side
  const salles = allSalles.filter(s =>
    (!typeFilter || s.type === typeFilter) &&
    (!actifFilter || String(s.actif) === actifFilter)
  );

  // Années scolaires pour disponibilités
  const { data: anneesData } = useListerAnneesScolaires({ query: { queryKey: getListerAnneesScolairesQueryKey() } });
  const annees = ((anneesData as unknown as Record<string, unknown>)?.annees as Record<string, unknown>[] | undefined) ?? [];
  const anneeActive = annees.find(a => a.statut === "active") ?? annees[0];
  const anneeId = String(anneeActive?.id ?? "");

  // Mutations
  const desactiverMut = useDesactiverSalle();

  // État modales
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<SalleRecord | null>(null);
  const [sallesDispo, setSallesDispo] = useState<SalleRecord | null>(null);

  function handleEdit(s: SalleRecord) { setEditItem(s); setShowModal(true); }
  function handleNouveauSalle() { setEditItem(null); setShowModal(true); }
  function handleModalClose() { setShowModal(false); setEditItem(null); }
  function handleModalSuccess() { handleModalClose(); void qc.invalidateQueries({ queryKey: qKey }); }

  function handleDesactiver(id: string) {
    if (!confirm("Désactiver cette salle ? Elle ne pourra plus être assignée à des cours.")) return;
    desactiverMut.mutate({ id }, {
      onSuccess: () => { toast({ title: "Salle désactivée." }); void qc.invalidateQueries({ queryKey: qKey }); },
      onError: (err: unknown) => {
        const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    });
  }

  // Stats
  const actives = salles.filter(s => s.actif).length;
  const totalCapacite = salles.filter(s => s.actif && s.capacite != null).reduce((sum, s) => sum + Number(s.capacite), 0);
  const parType = Object.entries(
    salles.filter(s => s.actif).reduce<Record<string, number>>((acc, s) => {
      const t = String(s.type ?? "autre");
      acc[t] = (acc[t] ?? 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="max-w-7xl mx-auto space-y-6 page-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-extrabold" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
            Salles & Espaces
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            Gérez le référentiel des salles et vérifiez les disponibilités
          </p>
        </div>
        {canEdit && (
          <button onClick={handleNouveauSalle}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
            <Plus className="w-4 h-4" />Nouvelle salle
          </button>
        )}
      </div>

      {/* ── KPIs ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Salles actives", value: actives, color: "#00C9A7" },
          { label: "Capacité totale", value: totalCapacite > 0 ? `${totalCapacite} places` : "—", color: "#0080FF" },
          { label: "Types différents", value: parType.length, color: "#F5C842" },
          { label: "Inactives", value: salles.length - actives, color: "#FF4D6D" },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-4" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <p className="text-2xl font-extrabold" style={{ color: k.color, fontFamily: "'Syne', sans-serif" }}>{k.value}</p>
            <p className="text-xs mt-1 font-semibold uppercase tracking-widest" style={{ color: "var(--m15-muted)" }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* ── Conflits ── */}
      {canEdit && anneeId && (
        <SectionConflits etablissementId={etablissementId} anneeId={anneeId} />
      )}

      {/* ── Filtres ── */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value as TypeSalle | "")}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
          <option value="">Tous les types</option>
          {Object.entries(TYPE_CONFIG).map(([val, cfg]) => (
            <option key={val} value={val}>{cfg.label}</option>
          ))}
        </select>
        <select value={actifFilter} onChange={e => setActifFilter(e.target.value as "true" | "false" | "")}
          className="rounded-xl px-3 py-2 text-sm outline-none"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
          <option value="">Actif + Inactif</option>
          <option value="true">Actives seulement</option>
          <option value="false">Inactives seulement</option>
        </select>
        {(typeFilter || actifFilter) && (
          <button onClick={() => { setTypeFilter(""); setActifFilter(""); }}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl"
            style={{ color: "#00C9A7", background: "rgba(0,201,167,0.08)", border: "1px solid rgba(0,201,167,0.2)" }}>
            <X className="w-3.5 h-3.5" />Réinitialiser
          </button>
        )}
        <span className="text-xs ml-auto" style={{ color: "var(--m15-muted)" }}>
          {salles.length} salle{salles.length > 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Grille salles ── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#00C9A7" }} />
        </div>
      ) : salles.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "var(--m15-card)", border: "2px dashed var(--m15-border)" }}>
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: "var(--m15-muted)" }} />
          <p className="font-semibold" style={{ color: "var(--m15-white)" }}>Aucune salle trouvée</p>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            {canEdit ? "Cliquez sur \"Nouvelle salle\" pour commencer." : "Aucune salle configurée."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {salles.map(s => (
            <SalleCard
              key={String(s.id)}
              salle={s}
              canEdit={canEdit}
              onEdit={handleEdit}
              onDesactiver={handleDesactiver}
              onVoirDispo={setSallesDispo}
            />
          ))}
        </div>
      )}

      {/* ── Répartition par type ── */}
      {parType.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <h3 className="font-bold text-sm uppercase tracking-widest mb-4" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
            Répartition par type
          </h3>
          <div className="space-y-2.5">
            {parType.map(([t, count]) => {
              const cfg = TYPE_CONFIG[t as TypeSalle] ?? TYPE_CONFIG.autre;
              const pct = actives > 0 ? Math.round((count / actives) * 100) : 0;
              return (
                <div key={t} className="flex items-center gap-3">
                  <cfg.Icon className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />
                  <span className="text-sm w-28 flex-shrink-0" style={{ color: "var(--m15-white)" }}>{cfg.label}</span>
                  <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--m15-border)" }}>
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: cfg.color }} />
                  </div>
                  <span className="text-sm font-bold w-10 text-right" style={{ color: cfg.color }}>{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Modales ── */}
      {showModal && etablissementId && (
        <ModalSalle
          editItem={editItem}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
          etablissementId={etablissementId}
        />
      )}
      {sallesDispo && anneeId && (
        <ModalDisponibilites
          salle={sallesDispo}
          anneeId={anneeId}
          onClose={() => setSallesDispo(null)}
        />
      )}
    </div>
  );
}
