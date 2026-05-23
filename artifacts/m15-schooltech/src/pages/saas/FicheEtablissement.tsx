import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { saasApi } from "@/services/saasApi";
import {
  ArrowLeft, Building2, Edit2, PauseCircle, PlayCircle,
  RefreshCw, X, Check, Copy, Plus, Clock, User, CreditCard,
} from "lucide-react";

const C = {
  navy: "var(--m15-navy)", card: "var(--m15-card)", cyan: "#00C9A7", gold: "#F5C842",
  blue: "#0080FF", red: "#FF4D6D", muted: "#8B9DC3", border: "rgba(0,201,167,0.15)",
};

const MODES: Record<string, string> = {
  virement: "Virement", mobile_money: "Mobile Money",
  especes: "Espèces", cheque: "Chèque", autre: "Autre",
};
const STATUTS_PAI: Record<string, { label: string; color: string }> = {
  confirme: { label: "Confirmé", color: C.cyan },
  en_attente: { label: "En attente", color: C.gold },
  echec: { label: "Échec", color: C.red },
};

function ActionIcon({ label, icon: Icon, color, bg, onClick, disabled }: any) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all disabled:opacity-50"
      style={{ backgroundColor: bg, color, border: `1px solid ${color}33` }}
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </button>
  );
}

interface ModalPaiementProps {
  licenceId: string;
  onClose: () => void;
  onSaved: () => void;
}
function ModalPaiement({ licenceId, onClose, onSaved }: ModalPaiementProps) {
  const [form, setForm] = useState({
    montant: "", date_paiement: new Date().toISOString().split("T")[0],
    mode_paiement: "mobile_money", reference: "", statut: "confirme", note: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!form.montant) { setError("Montant obligatoire."); return; }
    setLoading(true);
    try {
      await saasApi.enregistrerPaiement(licenceId, form);
      onSaved(); onClose();
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  const inp = "w-full px-3 py-2.5 rounded-lg text-sm text-[var(--m15-white)] border outline-none";
  const is = { backgroundColor: C.navy, borderColor: C.border };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,.7)" }}>
      <div className="rounded-2xl w-full max-w-md" style={{ backgroundColor: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: C.border }}>
          <h3 className="font-semibold text-[var(--m15-white)]">Enregistrer un paiement</h3>
          <button onClick={onClose} className="w-7 h-7 rounded flex items-center justify-center" style={{ color: C.muted }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-5 space-y-4">
          {error && <p className="text-sm px-3 py-2 rounded" style={{ backgroundColor: "rgba(255,77,109,.1)", color: C.red }}>{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs block mb-1" style={{ color: C.muted }}>Montant (FCFA) *</label>
              <input className={inp} style={is} type="number" value={form.montant} onChange={(e) => setForm(f => ({ ...f, montant: e.target.value }))} placeholder="150000" />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: C.muted }}>Date *</label>
              <input className={inp} style={is} type="date" value={form.date_paiement} onChange={(e) => setForm(f => ({ ...f, date_paiement: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: C.muted }}>Mode *</label>
              <select className={inp} style={is} value={form.mode_paiement} onChange={(e) => setForm(f => ({ ...f, mode_paiement: e.target.value }))}>
                {Object.entries(MODES).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: C.muted }}>Statut</label>
              <select className={inp} style={is} value={form.statut} onChange={(e) => setForm(f => ({ ...f, statut: e.target.value }))}>
                <option value="confirme">Confirmé</option>
                <option value="en_attente">En attente</option>
                <option value="echec">Échec</option>
              </select>
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: C.muted }}>Référence</label>
              <input className={inp} style={is} value={form.reference} onChange={(e) => setForm(f => ({ ...f, reference: e.target.value }))} placeholder="N° transaction" />
            </div>
            <div>
              <label className="text-xs block mb-1" style={{ color: C.muted }}>Note</label>
              <input className={inp} style={is} value={form.note} onChange={(e) => setForm(f => ({ ...f, note: e.target.value }))} placeholder="Note optionnelle" />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.muted, border: `1px solid ${C.border}` }}>Annuler</button>
            <button onClick={submit} disabled={loading} className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--m15-white)] disabled:opacity-50 flex gap-2 items-center" style={{ backgroundColor: C.cyan }}>
              {loading && <div className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: "white", borderTopColor: "transparent" }} />}
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FicheEtablissement() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [onglet, setOnglet] = useState<"general" | "licence" | "logs">("general");
  const [actionLoad, setActionLoad] = useState(false);
  const [showPaiement, setShowPaiement] = useState(false);
  const [reinitResult, setReinitResult] = useState<string | null>(null);
  const [copiedMdp, setCopiedMdp] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<any>({});

  async function load() {
    setLoading(true);
    try {
      const res = await saasApi.getEtablissement(id) as any;
      setData(res.data);
      setEditForm({
        nom: res.data?.etablissement?.nom ?? "",
        type: res.data?.etablissement?.type ?? "",
        ville: res.data?.etablissement?.ville ?? "",
        adresse: res.data?.etablissement?.adresse ?? "",
        telephone: res.data?.etablissement?.telephone ?? "",
        email_contact: res.data?.etablissement?.email ?? "",
      });
    } catch { } finally { setLoading(false); }
  }

  useEffect(() => { if (id) load(); }, [id]);

  async function suspendre() {
    if (!confirm("Suspendre cet établissement ?")) return;
    setActionLoad(true);
    try { await saasApi.suspendreEtablissement(id); await load(); } catch (e: any) { alert(e.message); } finally { setActionLoad(false); }
  }

  async function reactiver() {
    setActionLoad(true);
    try { await saasApi.reactiverEtablissement(id); await load(); } catch (e: any) { alert(e.message); } finally { setActionLoad(false); }
  }

  async function reinitMdp() {
    if (!data?.directeur?.id) return;
    setActionLoad(true);
    try {
      const res = await saasApi.reinitialiserMdp(data.directeur.id) as any;
      setReinitResult(res.data?.mot_de_passe_temporaire ?? "");
    } catch (e: any) { alert(e.message); } finally { setActionLoad(false); }
  }

  async function saveEdit() {
    try {
      await saasApi.modifierEtablissement(id, editForm);
      setEditMode(false);
      await load();
    } catch (e: any) { alert(e.message); }
  }

  const etab = data?.etablissement;
  const licence = data?.licence;
  const paiements = data?.paiements ?? [];
  const stats = data?.stats_utilisation ?? {};
  const logs = data?.logs ?? [];

  const TAB = [
    { key: "general", label: "Vue générale" },
    { key: "licence", label: "Licence & Paiements" },
    { key: "logs", label: "Logs activité" },
  ] as const;

  if (loading) return (
    <div className="flex items-center justify-center h-screen" style={{ backgroundColor: C.navy }}>
      <div className="w-8 h-8 rounded-full border-2 animate-spin" style={{ borderColor: C.cyan, borderTopColor: "transparent" }} />
    </div>
  );

  if (!etab) return (
    <div className="p-8" style={{ backgroundColor: C.navy }}>
      <p style={{ color: C.muted }}>Établissement introuvable.</p>
    </div>
  );

  const inp = "w-full px-3 py-2.5 rounded-lg text-sm text-[var(--m15-white)] border outline-none";
  const is = { backgroundColor: C.navy, borderColor: C.border };

  return (
    <div className="p-8 min-h-screen" style={{ backgroundColor: C.navy }}>
      {showPaiement && licence && (
        <ModalPaiement licenceId={licence.id} onClose={() => setShowPaiement(false)} onSaved={load} />
      )}

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link href="/saas/etablissements">
          <a className="p-2 rounded-lg" style={{ backgroundColor: C.card, color: C.muted }}>
            <ArrowLeft className="w-4 h-4" />
          </a>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-[var(--m15-white)]">{etab.nom}</h1>
            {etab.licence_active
              ? <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(0,201,167,.15)", color: C.cyan }}>Actif</span>
              : <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(255,77,109,.15)", color: C.red }}>Suspendu</span>
            }
          </div>
          <p className="text-sm mt-0.5 capitalize" style={{ color: C.muted }}>{etab.type} — {etab.ville ?? "Ville non renseignée"}</p>
        </div>
        <div className="flex gap-2">
          {etab.licence_active
            ? <ActionIcon label="Suspendre" icon={PauseCircle} color={C.red} bg="rgba(255,77,109,.1)" onClick={suspendre} disabled={actionLoad} />
            : <ActionIcon label="Réactiver" icon={PlayCircle} color={C.cyan} bg="rgba(0,201,167,.1)" onClick={reactiver} disabled={actionLoad} />
          }
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6" style={{ borderColor: C.border }}>
        {TAB.map((t) => (
          <button
            key={t.key}
            onClick={() => setOnglet(t.key)}
            className="px-4 py-3 text-sm font-medium transition-all border-b-2"
            style={{
              color: onglet === t.key ? C.cyan : C.muted,
              borderColor: onglet === t.key ? C.cyan : "transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Vue générale */}
      {onglet === "general" && (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 rounded-xl border p-5" style={{ backgroundColor: C.card, borderColor: C.border }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[var(--m15-white)]">Informations établissement</h3>
              {editMode
                ? <div className="flex gap-2">
                  <button onClick={() => setEditMode(false)} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: C.muted, border: `1px solid ${C.border}` }}>Annuler</button>
                  <button onClick={saveEdit} className="text-xs px-3 py-1.5 rounded-lg text-[var(--m15-white)] font-medium" style={{ backgroundColor: C.cyan }}>Enregistrer</button>
                </div>
                : <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ color: C.cyan, border: `1px solid ${C.border}` }}>
                  <Edit2 className="w-3 h-3" /> Modifier
                </button>
              }
            </div>
            {editMode ? (
              <div className="grid grid-cols-2 gap-3">
                {[["nom", "Nom"], ["type", "Type"], ["ville", "Ville"], ["adresse", "Adresse"], ["telephone", "Téléphone"], ["email_contact", "Email"]].map(([k, l]) => (
                  <div key={k}>
                    <label className="text-xs block mb-1" style={{ color: C.muted }}>{l}</label>
                    <input className={inp} style={is} value={editForm[k] ?? ""} onChange={(e) => setEditForm((f: any) => ({ ...f, [k]: e.target.value }))} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[["Nom", etab.nom], ["Type", etab.type], ["Ville", etab.ville], ["Adresse", etab.adresse], ["Téléphone", etab.telephone], ["Email", etab.email]].map(([l, v]) => (
                  <div key={l as string}>
                    <p className="text-xs mb-0.5" style={{ color: C.muted }}>{l}</p>
                    <p className="text-sm text-[var(--m15-white)]">{(v as string) ?? "—"}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Directeur */}
            <div className="rounded-xl border p-4" style={{ backgroundColor: C.card, borderColor: C.border }}>
              <div className="flex items-center gap-2 mb-3">
                <User className="w-4 h-4" style={{ color: C.cyan }} />
                <h3 className="text-sm font-semibold text-[var(--m15-white)]">Directeur actif</h3>
              </div>
              {data?.directeur ? (
                <>
                  <p className="text-sm font-medium text-[var(--m15-white)]">{data.directeur.nom} {data.directeur.prenoms}</p>
                  <p className="text-xs mt-0.5" style={{ color: C.muted }}>{data.directeur.email}</p>
                  {reinitResult ? (
                    <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: C.navy, border: `1px solid ${C.border}` }}>
                      <p className="text-xs mb-1" style={{ color: C.gold }}>Nouveau mot de passe :</p>
                      <div className="flex items-center gap-2">
                        <code className="text-sm font-mono text-[var(--m15-white)]">{reinitResult}</code>
                        <button onClick={() => { navigator.clipboard.writeText(reinitResult); setCopiedMdp(true); setTimeout(() => setCopiedMdp(false), 2000); }}>
                          {copiedMdp ? <Check className="w-3.5 h-3.5" style={{ color: C.cyan }} /> : <Copy className="w-3.5 h-3.5" style={{ color: C.muted }} />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={reinitMdp} disabled={actionLoad} className="mt-3 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg w-full justify-center" style={{ color: C.gold, border: `1px solid rgba(245,200,66,.3)`, backgroundColor: "rgba(245,200,66,.05)" }}>
                      <RefreshCw className="w-3 h-3" /> Réinitialiser MDP
                    </button>
                  )}
                </>
              ) : (
                <p className="text-sm" style={{ color: C.muted }}>Aucun directeur actif</p>
              )}
            </div>

            {/* Stats utilisation */}
            <div className="rounded-xl border p-4" style={{ backgroundColor: C.card, borderColor: C.border }}>
              <h3 className="text-sm font-semibold text-[var(--m15-white)] mb-3">Stats d'utilisation</h3>
              {Object.keys(stats).length === 0
                ? <p className="text-sm" style={{ color: C.muted }}>Aucun utilisateur</p>
                : Object.entries(stats).map(([role, nb]) => (
                  <div key={role} className="flex justify-between items-center py-1.5 border-b last:border-0" style={{ borderColor: C.border }}>
                    <span className="text-xs capitalize" style={{ color: C.muted }}>{role}</span>
                    <span className="text-xs font-semibold" style={{ color: C.cyan }}>{nb as number}</span>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* Licence & Paiements */}
      {onglet === "licence" && (
        <div className="space-y-6">
          {/* Licence active */}
          <div className="rounded-xl border p-5" style={{ backgroundColor: C.card, borderColor: C.border }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CreditCard className="w-4 h-4" style={{ color: C.cyan }} />
                <h3 className="text-sm font-semibold text-[var(--m15-white)]">Licence active</h3>
              </div>
              {licence && (
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const duree = prompt("Durée de renouvellement (mois) :");
                      if (!duree) return;
                      saasApi.renouvelerLicence(id, { duree_mois: Number(duree) }).then(() => load()).catch((e: any) => alert(e.message));
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg font-medium" style={{ backgroundColor: "rgba(0,201,167,.1)", color: C.cyan, border: `1px solid ${C.border}` }}
                  >
                    Renouveler
                  </button>
                  <button onClick={() => setShowPaiement(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg" style={{ color: C.gold, border: `1px solid rgba(245,200,66,.3)` }}>
                    <Plus className="w-3 h-3" /> Paiement
                  </button>
                </div>
              )}
            </div>
            {licence ? (
              <div className="grid grid-cols-4 gap-4">
                {[
                  ["Type", licence.type], ["Début", new Date(licence.date_debut).toLocaleDateString("fr-FR")],
                  ["Expiration", new Date(licence.date_expiration).toLocaleDateString("fr-FR")],
                  ["Montant", `${Number(licence.montant).toLocaleString("fr-FR")} FCFA`],
                ].map(([l, v]) => (
                  <div key={l as string}>
                    <p className="text-xs mb-1" style={{ color: C.muted }}>{l}</p>
                    <p className="text-sm font-medium text-[var(--m15-white)] capitalize">{v}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: C.muted }}>Aucune licence active.</p>
            )}
          </div>

          {/* Historique paiements */}
          <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: C.card, borderColor: C.border }}>
            <div className="px-5 py-4 border-b" style={{ borderColor: C.border }}>
              <h3 className="text-sm font-semibold text-[var(--m15-white)]">Historique des paiements</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {["Date", "Montant", "Mode", "Référence", "Statut", "Note"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium" style={{ color: C.muted }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paiements.length === 0
                  ? <tr><td colSpan={6} className="px-5 py-8 text-center text-sm" style={{ color: C.muted }}>Aucun paiement enregistré</td></tr>
                  : paiements.map((p: any) => {
                    const s = STATUTS_PAI[p.statut] ?? STATUTS_PAI.en_attente;
                    return (
                      <tr key={p.id} className="border-b" style={{ borderColor: C.border }}>
                        <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{new Date(p.date_paiement).toLocaleDateString("fr-FR")}</td>
                        <td className="px-4 py-3 text-sm font-medium text-[var(--m15-white)]">{Number(p.montant).toLocaleString("fr-FR")} FCFA</td>
                        <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{MODES[p.mode_paiement] ?? p.mode_paiement}</td>
                        <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{p.reference ?? "—"}</td>
                        <td className="px-4 py-3"><span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${s.color}20`, color: s.color }}>{s.label}</span></td>
                        <td className="px-4 py-3 text-sm" style={{ color: C.muted }}>{p.note ?? "—"}</td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Logs */}
      {onglet === "logs" && (
        <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: C.card, borderColor: C.border }}>
          <div className="px-5 py-4 border-b" style={{ borderColor: C.border }}>
            <h3 className="text-sm font-semibold text-[var(--m15-white)]">Logs d'activité SaaS</h3>
          </div>
          {logs.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm" style={{ color: C.muted }}>Aucun log disponible</p>
          ) : (
            <div className="p-5 space-y-3">
              {logs.map((l: any) => (
                <div key={l.id} className="flex gap-3">
                  <div className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: C.cyan }} />
                  <div>
                    <p className="text-sm text-[var(--m15-white)]">{l.action.replace(/_/g, " ")}</p>
                    {l.details && <p className="text-xs mt-0.5" style={{ color: C.muted }}>{JSON.stringify(l.details)}</p>}
                    <p className="text-xs mt-0.5" style={{ color: C.muted }}>{new Date(l.created_at).toLocaleString("fr-FR")}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
