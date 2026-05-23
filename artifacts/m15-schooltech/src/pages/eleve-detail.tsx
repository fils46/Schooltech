import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import {
  useGetEleve,
  getGetEleveQueryKey,
  useChangerStatutEleve,
  useModifierEleve,
  useSupprimerDocumentEleve,
  useListerDocumentsEleve,
  getListerDocumentsEleveQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, UserSquare, Info, Users, FileText, Clock,
  Edit3, ShieldAlert, Loader2, X, Check, Upload, Trash2,
  Download, ExternalLink,
} from "lucide-react";

/* ─── Badge statut ───────────────────────────────────────── */
const STATUT_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  actif:    { bg: "rgba(0,201,167,0.12)",  color: "#00C9A7", label: "Actif" },
  inactif:  { bg: "rgba(139,157,195,0.12)", color: "#8B9DC3", label: "Inactif" },
  transfere:{ bg: "rgba(0,128,255,0.12)",  color: "#0080FF", label: "Transféré" },
  exclu:    { bg: "rgba(255,77,109,0.12)", color: "#FF4D6D", label: "Exclu" },
};

function BadgeStatut({ statut }: { statut: string }) {
  const s = STATUT_STYLES[statut] ?? STATUT_STYLES.inactif;
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

/* ─── Onglets ─────────────────────────────────────────────── */
const TABS = [
  { id: "infos",     label: "Informations", icon: Info },
  { id: "parents",   label: "Parents",      icon: Users },
  { id: "documents", label: "Documents",    icon: FileText },
  { id: "historique",label: "Historique",   icon: Clock },
];

/* ─── Modal changement statut ─────────────────────────────── */
function ModalChangerStatut({
  eleveId, currentStatut, onClose, onSuccess,
}: {
  eleveId: string; currentStatut: string; onClose: () => void; onSuccess: () => void;
}) {
  const { toast } = useToast();
  const mutation = useChangerStatutEleve();
  const [statut, setStatut] = useState(currentStatut);
  const [motif, setMotif] = useState("");

  const handleSubmit = async () => {
    try {
      await mutation.mutateAsync({ id: eleveId, data: { statut, motif: motif || undefined } });
      toast({ title: "Statut mis à jour", description: `Nouveau statut : ${statut}.` });
      onSuccess();
    } catch {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le statut.", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.7)" }} onClick={onClose} />
      <div className="relative rounded-2xl p-6 w-full max-w-md"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", zIndex: 1 }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-bold text-lg" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Changer le statut
          </h3>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg"
            style={{ background: "var(--elevate-1)", color: "var(--m15-muted)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(STATUT_STYLES).map(([val, s]) => (
              <button key={val} onClick={() => setStatut(val)}
                className="py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{
                  background: statut === val ? s.bg : "var(--elevate-1)",
                  border: `1px solid ${statut === val ? s.color : "var(--m15-border)"}`,
                  color: statut === val ? s.color : "var(--m15-muted)",
                }}>
                {s.label}
              </button>
            ))}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-widest mb-1.5"
              style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-muted)" }}>
              Motif {(statut === "exclu" || statut === "transfere") && <span style={{ color: "#FF4D6D" }}>*</span>}
            </label>
            <textarea
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              placeholder="Précisez le motif du changement…"
              rows={3}
              className="w-full outline-none resize-none rounded-xl px-3 py-2.5 text-sm"
              style={{
                background: "var(--elevate-1)", border: "1px solid var(--m15-border)",
                color: "var(--m15-white)", fontFamily: "'DM Sans', sans-serif",
              }}
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
              Annuler
            </button>
            <button onClick={handleSubmit} disabled={mutation.isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2"
              style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Confirmer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Upload document ─────────────────────────────────────── */
async function uploadDocument(eleveId: string, file: File, typeDocument: string, token: string) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("type_document", typeDocument);
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
  const res = await fetch(`${basePath}/api/eleves/${eleveId}/documents/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  if (!res.ok) throw new Error("Échec de l'upload");
  return res.json();
}

/* ─── Onglet Informations ─────────────────────────────────── */
function TabInfos({ eleve }: { eleve: Record<string, unknown> }) {
  const sfLabel: Record<string, string> = { pere_mere: "Père et mère", mere: "Mère seule", pere: "Père seul", tuteur: "Sous tutelle" };
  const rows = [
    { label: "Nom complet",         value: `${eleve.prenoms} ${eleve.nom}` },
    { label: "Matricule",           value: String(eleve.matricule ?? "") },
    { label: "Date de naissance",   value: String(eleve.date_naissance ?? "—") },
    { label: "Lieu de naissance",   value: String(eleve.lieu_naissance ?? "—") },
    { label: "Sexe",                value: eleve.sexe === "M" ? "Masculin" : "Féminin" },
    { label: "Adresse",             value: String(eleve.adresse ?? "—") },
    { label: "Situation familiale", value: sfLabel[String(eleve.situation_familiale ?? "")] ?? "—" },
    { label: "Année d'inscription", value: String(eleve.annee_inscription ?? "—") },
  ];
  return (
    <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
      {rows.map(({ label, value }) => (
        <div key={label} className="flex items-center px-4 py-3 gap-4">
          <span className="text-xs w-40 flex-shrink-0 font-semibold uppercase tracking-wide"
            style={{ color: "var(--m15-muted)", fontFamily: "'Syne', sans-serif" }}>{label}</span>
          <span className="text-sm" style={{ color: "var(--m15-white)" }}>
            {label === "Matricule"
              ? <span className="font-mono px-2 py-0.5 rounded text-xs" style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7" }}>{value}</span>
              : value}
          </span>
        </div>
      ))}
    </div>
  );
}

/* ─── Onglet Parents ──────────────────────────────────────── */
function TabParents({ parents }: { parents: Array<Record<string, unknown>> }) {
  const lienLabel: Record<string, string> = { pere: "Père", mere: "Mère", tuteur: "Tuteur" };
  if (!parents?.length) {
    return <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--m15-muted)" }}>Aucun parent lié à cet élève.</p>;
  }
  return (
    <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
      {parents.map((p: Record<string, unknown>) => (
        <div key={String(p.utilisateur_id)} className="flex items-center gap-4 px-4 py-4">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
            style={{ background: "rgba(245,200,66,0.12)", color: "#F5C842", fontFamily: "'Syne', sans-serif" }}>
            {String(p.prenoms ?? "").charAt(0)}{String(p.nom ?? "").charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm" style={{ color: "var(--m15-white)" }}>
              {String(p.prenoms ?? "")} {String(p.nom ?? "")}
              {Boolean(p.est_principal) && (
                <span className="ml-2 text-xs px-2 py-0.5 rounded-full"
                  style={{ background: "rgba(0,201,167,0.12)", color: "#00C9A7" }}>Principal</span>
              )}
            </p>
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{String(p.email ?? "")} · {lienLabel[String(p.lien ?? "")] ?? String(p.lien ?? "")}</p>
            {p.telephone ? <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{String(p.telephone)}</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ─── Onglet Documents ────────────────────────────────────── */
function TabDocuments({ eleveId, canManage, token }: { eleveId: string; canManage: boolean; token: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: docs, isLoading } = useListerDocumentsEleve(
    eleveId,
    { query: { queryKey: getListerDocumentsEleveQueryKey(eleveId) } }
  );
  const deleteMutation = useSupprimerDocumentEleve();
  const [uploading, setUploading] = useState(false);
  const [typeDoc, setTypeDoc] = useState("autre");

  const typeLabels: Record<string, string> = {
    acte_naissance: "Acte de naissance", certificat: "Certificat", photo: "Photo", autre: "Autre",
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast({ title: "Fichier trop volumineux", description: "Maximum 5 Mo.", variant: "destructive" }); return; }
    setUploading(true);
    try {
      await uploadDocument(eleveId, file, typeDoc, token);
      toast({ title: "Document ajouté", description: file.name });
      queryClient.invalidateQueries({ queryKey: getListerDocumentsEleveQueryKey(eleveId) });
    } catch {
      toast({ title: "Erreur", description: "Échec de l'upload.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await deleteMutation.mutateAsync({ id: eleveId, docId });
      toast({ title: "Document supprimé" });
      queryClient.invalidateQueries({ queryKey: getListerDocumentsEleveQueryKey(eleveId) });
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer.", variant: "destructive" });
    }
  };

  return (
    <div>
      {canManage && (
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid var(--m15-border)" }}>
          <select value={typeDoc} onChange={e => setTypeDoc(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm outline-none"
            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
            {Object.entries(typeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold cursor-pointer"
            style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }}>
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Upload…" : "Ajouter un fichier"}
            <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={handleUpload} disabled={uploading} />
          </label>
          <span className="text-xs" style={{ color: "var(--m15-muted)" }}>PDF ou image · max 5 Mo</span>
        </div>
      )}
      {isLoading ? (
        <div className="p-4 space-y-2">
          {[1,2].map(i => <div key={i} className="h-12 rounded-lg animate-pulse" style={{ background: "var(--elevate-1)" }} />)}
        </div>
      ) : !docs?.length ? (
        <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--m15-muted)" }}>Aucun document enregistré.</p>
      ) : (
        <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-4 py-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: "rgba(0,128,255,0.1)", border: "1px solid rgba(0,128,255,0.2)" }}>
                <FileText className="w-4 h-4" style={{ color: "#0080FF" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--m15-white)" }}>{doc.nom_fichier}</p>
                <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{typeLabels[String(doc.type_document ?? "")] ?? "Document"}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <a href={doc.url_fichier} target="_blank" rel="noopener noreferrer"
                  className="w-7 h-7 flex items-center justify-center rounded-lg"
                  style={{ background: "var(--elevate-1)", color: "var(--m15-muted)" }}>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a href={doc.url_fichier} download={doc.nom_fichier}
                  className="w-7 h-7 flex items-center justify-center rounded-lg"
                  style={{ background: "var(--elevate-1)", color: "var(--m15-muted)" }}>
                  <Download className="w-3.5 h-3.5" />
                </a>
                {canManage && (
                  <button onClick={() => handleDelete(doc.id)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg"
                    style={{ background: "rgba(255,77,109,0.08)", color: "#FF4D6D" }}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Onglet Historique ───────────────────────────────────── */
function TabHistorique({ historique }: { historique: Array<{ statut: string; motif?: string | null; date: string }> }) {
  if (!historique?.length) {
    return <p className="px-4 py-8 text-center text-sm" style={{ color: "var(--m15-muted)" }}>Aucun changement de statut enregistré.</p>;
  }
  return (
    <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
      {[...historique].reverse().map((h, i) => {
        const s = STATUT_STYLES[h.statut] ?? STATUT_STYLES.inactif;
        return (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
              style={{ background: s.bg }}>
              <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <BadgeStatut statut={h.statut} />
                <span className="text-xs" style={{ color: "var(--m15-muted)" }}>
                  {new Date(h.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              {h.motif && <p className="text-sm" style={{ color: "var(--m15-muted)" }}>{h.motif}</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────── */
export default function EleveDetail() {
  const params = useParams<{ id: string }>();
  const eleveId = params.id ?? "";
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canManage = ["dev", "directeur", "censeur"].includes(user?.role ?? "");
  const token = localStorage.getItem("m15_token") ?? "";

  const [activeTab, setActiveTab] = useState("infos");
  const [showStatutModal, setShowStatutModal] = useState(false);

  const { data: eleve, isLoading, error } = useGetEleve(
    eleveId,
    { query: { queryKey: getGetEleveQueryKey(eleveId), enabled: !!eleveId } }
  );

  const modifierMutation = useModifierEleve();
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Record<string, string>>({});

  const handleEditSave = async () => {
    try {
      await modifierMutation.mutateAsync({ id: eleveId, data: editData });
      toast({ title: "Dossier mis à jour" });
      queryClient.invalidateQueries({ queryKey: getGetEleveQueryKey(eleveId) });
      setEditMode(false);
    } catch {
      toast({ title: "Erreur", description: "Impossible de mettre à jour le dossier.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "#00C9A7" }} />
      </div>
    );
  }

  if (error || !eleve) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p style={{ color: "var(--m15-muted)" }}>Élève introuvable ou accès refusé.</p>
        <button onClick={() => setLocation("/eleves")} style={{ color: "#00C9A7" }} className="text-sm underline">
          Retour à la liste
        </button>
      </div>
    );
  }

  const e = eleve as unknown as Record<string, unknown>;
  const parents = (e.parents as Array<Record<string, unknown>>) ?? [];
  const historique = (e.historique_statut as Array<{ statut: string; motif?: string | null; date: string }>) ?? [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 page-fade-in">
      {showStatutModal && (
        <ModalChangerStatut
          eleveId={eleveId}
          currentStatut={String(e.statut ?? "actif")}
          onClose={() => setShowStatutModal(false)}
          onSuccess={() => {
            setShowStatutModal(false);
            queryClient.invalidateQueries({ queryKey: getGetEleveQueryKey(eleveId) });
          }}
        />
      )}

      {/* ── Header navigation ── */}
      <div className="flex items-center gap-3">
        <button onClick={() => setLocation("/eleves")}
          className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
          Dossier élève
        </h1>
      </div>

      {/* ── En-tête élève ── */}
      <div className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff", fontFamily: "'Syne', sans-serif" }}>
          {String(e.prenoms ?? "").charAt(0)}{String(e.nom ?? "").charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            {String(e.prenoms ?? "")} {String(e.nom ?? "")}
          </h2>
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <span className="text-xs font-mono px-2.5 py-1 rounded-lg"
              style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7" }}>
              {String(e.matricule ?? "")}
            </span>
            <BadgeStatut statut={String(e.statut ?? "actif")} />
          </div>
        </div>
        {canManage && (
          <div className="flex items-center gap-2">
            {!editMode ? (
              <button onClick={() => { setEditMode(true); setEditData({}); }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
                <Edit3 className="w-4 h-4" /> Modifier
              </button>
            ) : (
              <>
                <button onClick={() => setEditMode(false)}
                  className="px-3 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
                  Annuler
                </button>
                <button onClick={handleEditSave} disabled={modifierMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
                  style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff" }}>
                  {modifierMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Sauvegarder
                </button>
              </>
            )}
            <button onClick={() => setShowStatutModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
              style={{ background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)", color: "#FF4D6D" }}>
              <ShieldAlert className="w-4 h-4" /> Statut
            </button>
          </div>
        )}
      </div>

      {/* ── Onglets ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        {/* Barre onglets */}
        <div className="flex" style={{ borderBottom: "1px solid var(--m15-border)" }}>
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className="flex items-center gap-2 px-4 py-3.5 text-sm font-semibold transition-all relative"
              style={{
                color: activeTab === id ? "#00C9A7" : "var(--m15-muted)",
                background: activeTab === id ? "rgba(0,201,167,0.05)" : "transparent",
                borderBottom: activeTab === id ? "2px solid #00C9A7" : "2px solid transparent",
              }}>
              <Icon className="w-4 h-4" /><span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Contenu onglet */}
        <div className="min-h-[200px]">
          {activeTab === "infos" && (
            editMode ? (
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { key: "nom", label: "Nom", default: String(e.nom ?? "") },
                  { key: "prenoms", label: "Prénoms", default: String(e.prenoms ?? "") },
                  { key: "date_naissance", label: "Date de naissance", default: String(e.date_naissance ?? "") },
                  { key: "lieu_naissance", label: "Lieu de naissance", default: String(e.lieu_naissance ?? "") },
                  { key: "adresse", label: "Adresse", default: String(e.adresse ?? "") },
                ].map(({ key, label, default: def }) => (
                  <div key={key}>
                    <label className="block text-xs font-semibold uppercase tracking-widest mb-1"
                      style={{ color: "var(--m15-muted)", fontFamily: "'Syne', sans-serif" }}>{label}</label>
                    <input
                      defaultValue={def}
                      onChange={ev => setEditData(p => ({ ...p, [key]: ev.target.value }))}
                      className="w-full outline-none rounded-xl px-3 py-2 text-sm"
                      style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <TabInfos eleve={e} />
            )
          )}
          {activeTab === "parents" && <TabParents parents={parents} />}
          {activeTab === "documents" && <TabDocuments eleveId={eleveId} canManage={canManage} token={token} />}
          {activeTab === "historique" && <TabHistorique historique={historique} />}
        </div>
      </div>
    </div>
  );
}
