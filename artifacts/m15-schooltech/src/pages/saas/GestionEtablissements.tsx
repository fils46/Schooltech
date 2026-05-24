import { useState, useEffect, useCallback } from "react";
import { Link } from "wouter";
import { saasApi } from "@/services/saasApi";
import {
  Plus, Search, Eye, Edit2, PauseCircle, PlayCircle,
  X, Copy, Check, ChevronLeft, ChevronRight, Building2,
} from "lucide-react";

const C = {
  navy: "var(--m15-navy)", card: "var(--m15-card)", cyan: "#00C9A7", gold: "#F5C842",
  blue: "#0080FF", red: "#FF4D6D", muted: "#8B9DC3", border: "rgba(0,201,167,0.15)",
};

function Badge({ actif, type }: { actif: boolean; type?: string }) {
  if (!actif) return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(139,157,195,.15)", color: C.muted }}>Suspendu</span>;
  if (type === "essai") return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(245,200,66,.15)", color: C.gold }}>Essai</span>;
  return <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(0,201,167,.15)", color: C.cyan }}>Actif</span>;
}

interface ModalCreerProps {
  onClose: () => void;
  onCreated: () => void;
}

function ModalCreer({ onClose, onCreated }: ModalCreerProps) {
  const [form, setForm] = useState({
    nom: "", type: "lycée", ville: "", adresse: "", telephone: "", email_contact: "",
    nom_directeur: "", prenom_directeur: "", email_directeur: "",
    licence_type: "annuel", licence_duree_mois: "12", montant_licence: "", renouvellement_auto: false,
  });
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  function update(k: string, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    if (!form.nom || !form.email_directeur || !form.montant_licence) {
      setError("Veuillez remplir tous les champs obligatoires.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await saasApi.creerEtablissement(form) as any;
      setResult(res.data);
      setStep(4);
    } catch (err: any) {
      setError(err.message ?? "Erreur lors de la création.");
    } finally {
      setLoading(false);
    }
  }

  function copyMdp() {
    navigator.clipboard.writeText(result?.mot_de_passe_temporaire ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const inputCls = "w-full px-3 py-2.5 rounded-lg text-sm text-[var(--m15-white)] border outline-none focus:ring-1 transition-all";
  const inputStyle = { backgroundColor: C.navy, borderColor: C.border, outline: "none" };
  const labelCls = "block text-xs font-medium mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,.7)" }}>
      <div className="rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b sticky top-0" style={{ backgroundColor: C.card, borderColor: C.border }}>
          <div>
            <h2 className="text-lg font-bold text-[var(--m15-white)]">Nouvel établissement</h2>
            {step < 4 && <p className="text-xs mt-0.5" style={{ color: C.muted }}>Étape {step}/3</p>}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-all" style={{ backgroundColor: "rgba(255,77,109,.1)", color: C.red }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-5">
          {error && (
            <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ backgroundColor: "rgba(255,77,109,.1)", color: C.red, border: `1px solid rgba(255,77,109,.2)` }}>
              {error}
            </div>
          )}

          {/* Étape 1 : Infos établissement */}
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold mb-4" style={{ color: C.cyan }}>Informations établissement</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className={labelCls} style={{ color: C.muted }}>Nom de l'établissement *</label>
                  <input className={inputCls} style={inputStyle} value={form.nom} onChange={(e) => update("nom", e.target.value)} placeholder="Ex: Lycée Moderne d'Abidjan" />
                </div>
                <div>
                  <label className={labelCls} style={{ color: C.muted }}>Type *</label>
                  <select className={inputCls} style={inputStyle} value={form.type} onChange={(e) => update("type", e.target.value)}>
                    <option value="lycée">Lycée</option>
                    <option value="collège">Collège</option>
                    <option value="autre">Autre</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={{ color: C.muted }}>Ville</label>
                  <input className={inputCls} style={inputStyle} value={form.ville} onChange={(e) => update("ville", e.target.value)} placeholder="Ex: Abidjan" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls} style={{ color: C.muted }}>Adresse</label>
                  <input className={inputCls} style={inputStyle} value={form.adresse} onChange={(e) => update("adresse", e.target.value)} placeholder="Adresse complète" />
                </div>
                <div>
                  <label className={labelCls} style={{ color: C.muted }}>Téléphone</label>
                  <input className={inputCls} style={inputStyle} value={form.telephone} onChange={(e) => update("telephone", e.target.value)} placeholder="+225 00 00 00 00" />
                </div>
                <div>
                  <label className={labelCls} style={{ color: C.muted }}>Email de contact</label>
                  <input className={inputCls} style={inputStyle} value={form.email_contact} onChange={(e) => update("email_contact", e.target.value)} placeholder="contact@etablissement.ci" />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button onClick={() => setStep(2)} disabled={!form.nom} className="px-5 py-2.5 rounded-lg text-sm font-medium text-[var(--m15-white)] disabled:opacity-50" style={{ backgroundColor: C.cyan }}>
                  Suivant →
                </button>
              </div>
            </div>
          )}

          {/* Étape 2 : Compte directeur */}
          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold mb-4" style={{ color: C.cyan }}>Compte directeur</h3>
              <p className="text-xs mb-4" style={{ color: C.muted }}>Un mot de passe temporaire sera généré automatiquement.</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} style={{ color: C.muted }}>Nom *</label>
                  <input className={inputCls} style={inputStyle} value={form.nom_directeur} onChange={(e) => update("nom_directeur", e.target.value)} placeholder="Nom de famille" />
                </div>
                <div>
                  <label className={labelCls} style={{ color: C.muted }}>Prénom(s)</label>
                  <input className={inputCls} style={inputStyle} value={form.prenom_directeur} onChange={(e) => update("prenom_directeur", e.target.value)} placeholder="Prénom" />
                </div>
                <div className="col-span-2">
                  <label className={labelCls} style={{ color: C.muted }}>Email *</label>
                  <input className={inputCls} style={inputStyle} value={form.email_directeur} onChange={(e) => update("email_directeur", e.target.value)} placeholder="directeur@etablissement.ci" type="email" />
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <button onClick={() => setStep(1)} className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ color: C.muted, border: `1px solid ${C.border}` }}>← Retour</button>
                <button onClick={() => setStep(3)} disabled={!form.email_directeur || !form.nom_directeur} className="px-5 py-2.5 rounded-lg text-sm font-medium text-[var(--m15-white)] disabled:opacity-50" style={{ backgroundColor: C.cyan }}>Suivant →</button>
              </div>
            </div>
          )}

          {/* Étape 3 : Licence */}
          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold mb-4" style={{ color: C.cyan }}>Licence</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls} style={{ color: C.muted }}>Type *</label>
                  <select className={inputCls} style={inputStyle} value={form.licence_type} onChange={(e) => update("licence_type", e.target.value)}>
                    <option value="mensuel">Mensuel</option>
                    <option value="trimestriel">Trimestriel</option>
                    <option value="annuel">Annuel</option>
                    <option value="essai">Essai gratuit</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={{ color: C.muted }}>Durée (mois) *</label>
                  <input className={inputCls} style={inputStyle} value={form.licence_duree_mois} onChange={(e) => update("licence_duree_mois", e.target.value)} type="number" min="1" max="24" />
                </div>
                <div>
                  <label className={labelCls} style={{ color: C.muted }}>Montant (FCFA) *</label>
                  <input className={inputCls} style={inputStyle} value={form.montant_licence} onChange={(e) => update("montant_licence", e.target.value)} placeholder="Ex: 150000" type="number" />
                </div>
                <div className="flex items-center gap-3 mt-5">
                  <button
                    onClick={() => update("renouvellement_auto", !form.renouvellement_auto)}
                    className="w-10 h-5 rounded-full transition-all"
                    style={{ backgroundColor: form.renouvellement_auto ? C.cyan : "rgba(139,157,195,.3)" }}
                  >
                    <div className="w-4 h-4 rounded-full bg-white transition-all mx-auto" style={{ transform: form.renouvellement_auto ? "translateX(5px)" : "translateX(-5px)" }} />
                  </button>
                  <label className="text-sm" style={{ color: C.muted }}>Renouvellement auto</label>
                </div>
              </div>
              <div className="flex justify-between mt-4">
                <button onClick={() => setStep(2)} className="px-5 py-2.5 rounded-lg text-sm font-medium" style={{ color: C.muted, border: `1px solid ${C.border}` }}>← Retour</button>
                <button onClick={submit} disabled={loading || !form.montant_licence} className="px-5 py-2.5 rounded-lg text-sm font-medium text-[var(--m15-white)] disabled:opacity-50 flex items-center gap-2" style={{ backgroundColor: C.cyan }}>
                  {loading ? <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: "white", borderTopColor: "transparent" }} /> : null}
                  Créer l'établissement
                </button>
              </div>
            </div>
          )}

          {/* Étape 4 : Succès */}
          {step === 4 && result && (
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "rgba(0,201,167,.15)" }}>
                <Check className="w-8 h-8" style={{ color: C.cyan }} />
              </div>
              <h3 className="text-lg font-bold text-[var(--m15-white)] mb-1">{result.etablissement?.nom} créé !</h3>
              <p className="text-sm mb-6" style={{ color: C.muted }}>Le compte directeur a été créé et la licence est active.</p>

              <div className="rounded-xl p-5 mb-4 border text-left" style={{ backgroundColor: C.navy, borderColor: "rgba(245,200,66,.3)" }}>
                <p className="text-xs font-semibold mb-3" style={{ color: C.gold }}>⚠ Mot de passe temporaire — À communiquer au directeur</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs mb-1" style={{ color: C.muted }}>Directeur : {result.directeur?.email}</p>
                    <p className="text-xl font-mono font-bold text-[var(--m15-white)] tracking-wider">{result.mot_de_passe_temporaire}</p>
                  </div>
                  <button onClick={copyMdp} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all" style={{ backgroundColor: copied ? "rgba(0,201,167,.15)" : "rgba(245,200,66,.1)", color: copied ? C.cyan : C.gold }}>
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copié !" : "Copier"}
                  </button>
                </div>
                <p className="text-xs mt-3 italic" style={{ color: C.muted }}>Ce mot de passe ne sera plus affiché après fermeture.</p>
              </div>

              <button onClick={() => { onCreated(); onClose(); }} className="px-6 py-2.5 rounded-lg text-sm font-medium text-[var(--m15-white)]" style={{ backgroundColor: C.cyan }}>
                Fermer
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GestionEtablissements() {
  const [etabs, setEtabs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtreStatut, setFiltreStatut] = useState("");
  const [filtreType, setFiltreType] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [actionLoad, setActionLoad] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await saasApi.getEtablissements() as any;
      setEtabs(res.data ?? []);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function suspendre(id: string) {
    if (!confirm("Suspendre cet établissement ? Tous les accès seront bloqués immédiatement.")) return;
    setActionLoad(id);
    try {
      await saasApi.suspendreEtablissement(id);
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoad(null);
    }
  }

  async function reactiver(id: string) {
    setActionLoad(id);
    try {
      await saasApi.reactiverEtablissement(id);
      await load();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoad(null);
    }
  }

  const filtered = etabs.filter((e) => {
    if (search && !e.nom.toLowerCase().includes(search.toLowerCase())) return false;
    if (filtreStatut === "actif" && !e.licence_active) return false;
    if (filtreStatut === "suspendu" && e.licence_active) return false;
    if (filtreType && e.type !== filtreType) return false;
    return true;
  });

  return (
    <div className="p-4 md:p-8 min-h-screen" style={{ backgroundColor: C.navy }}>
      {showModal && <ModalCreer onClose={() => setShowModal(false)} onCreated={load} />}

      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-[var(--m15-white)]">Établissements</h1>
          <p className="text-sm mt-1" style={{ color: C.muted }}>{etabs.length} établissement(s) au total</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-[var(--m15-white)]"
          style={{ backgroundColor: C.cyan }}
        >
          <Plus className="w-4 h-4" /> Nouvel établissement
        </button>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
          <input
            className="w-full pl-9 pr-4 py-2.5 rounded-lg text-sm text-[var(--m15-white)] border outline-none"
            style={{ backgroundColor: C.card, borderColor: C.border }}
            placeholder="Rechercher un établissement…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select className="px-3 py-2.5 rounded-lg text-sm border outline-none" style={{ backgroundColor: C.card, borderColor: C.border, color: filtreStatut ? "white" : C.muted }} value={filtreStatut} onChange={(e) => setFiltreStatut(e.target.value)}>
          <option value="">Tous les statuts</option>
          <option value="actif">Actif</option>
          <option value="suspendu">Suspendu</option>
        </select>
        <select className="px-3 py-2.5 rounded-lg text-sm border outline-none" style={{ backgroundColor: C.card, borderColor: C.border, color: filtreType ? "white" : C.muted }} value={filtreType} onChange={(e) => setFiltreType(e.target.value)}>
          <option value="">Tous les types</option>
          <option value="lycée">Lycée</option>
          <option value="collège">Collège</option>
          <option value="autre">Autre</option>
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: C.card, borderColor: C.border }}>
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="w-7 h-7 rounded-full border-2 animate-spin" style={{ borderColor: C.cyan, borderTopColor: "transparent" }} />
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                {["Nom", "Type", "Ville", "Directeur", "Licence", "Expiration", "Élèves", "Utilisateurs", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: C.muted }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={9} className="px-5 py-12 text-center text-sm" style={{ color: C.muted }}>Aucun établissement trouvé</td></tr>
              ) : filtered.map((e) => (
                <tr key={e.id} className="border-b hover:bg-white/[0.02] transition-colors" style={{ borderColor: C.border }}>
                  <td className="px-4 py-3">
                    <Link href={`/saas/etablissements/${e.id}`}>
                      <a className="text-sm font-medium" style={{ color: C.cyan }}>{e.nom}</a>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm capitalize" style={{ color: C.muted }}>{e.type ?? "—"}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{e.ville ?? "—"}</td>
                  <td className="px-4 py-3 text-sm text-[var(--m15-white)]">—</td>
                  <td className="px-4 py-3">
                    <Badge actif={e.licence_active} type={e.licence?.type} />
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>
                    {e.date_expiration_licence ? new Date(e.date_expiration_licence).toLocaleDateString("fr-FR") : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{e.nb_eleves}</td>
                  <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{e.nb_utilisateurs}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Link href={`/saas/etablissements/${e.id}`}>
                        <a className="p-1.5 rounded-lg transition-all" style={{ backgroundColor: "rgba(0,128,255,.1)", color: C.blue }} title="Voir">
                          <Eye className="w-3.5 h-3.5" />
                        </a>
                      </Link>
                      {e.licence_active ? (
                        <button
                          onClick={() => suspendre(e.id)}
                          disabled={actionLoad === e.id}
                          className="p-1.5 rounded-lg transition-all disabled:opacity-50"
                          style={{ backgroundColor: "rgba(255,77,109,.1)", color: C.red }}
                          title="Suspendre"
                        >
                          <PauseCircle className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => reactiver(e.id)}
                          disabled={actionLoad === e.id}
                          className="p-1.5 rounded-lg transition-all disabled:opacity-50"
                          style={{ backgroundColor: "rgba(0,201,167,.1)", color: C.cyan }}
                          title="Réactiver"
                        >
                          <PlayCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}
