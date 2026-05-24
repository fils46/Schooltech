import { useState } from "react";
import { useLocation } from "wouter";
import {
  useListerParents,
  getListerParentsQueryKey,
  getListerElevesQueryKey,
  useCreerCompteParent,
  useLierParentExistant,
  useReinitialiserMdpParent,
  useListerEleves,
  type CreerParentBodyLien,
  type LierParentBodyLien,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  UserCircle, Search, Plus, KeyRound, Eye, Loader2, Check, X,
} from "lucide-react";

const LIEN_LABELS: Record<string, string> = { pere: "Père", mere: "Mère", tuteur: "Tuteur", autre: "Autre" };
const LIEN_OPTIONS = [
  { value: "pere", label: "Père" },
  { value: "mere", label: "Mère" },
  { value: "tuteur", label: "Tuteur" },
  { value: "autre", label: "Autre" },
];

type ParentRow = {
  id: string;
  nom: string;
  prenoms: string;
  email: string;
  telephone?: string | null;
  actif: boolean;
  nb_enfants: number;
  enfants: Array<{ id: string; nom: string; prenoms: string; lien: string; est_principal: boolean }>;
};

/* ── Onglet : créer nouveau compte parent ─────────────────── */
function OngletNouveauCompte({
  onSuccess,
  onClose,
}: {
  onSuccess: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const mutation = useCreerCompteParent();

  const [form, setForm] = useState<{ nom: string; prenoms: string; email: string; telephone: string; eleve_id: string; lien: CreerParentBodyLien; est_principal: boolean }>({ nom: "", prenoms: "", email: "", telephone: "", eleve_id: "", lien: "mere", est_principal: false });
  const [search, setSearch] = useState("");
  const [searchEleve, setSearchEleve] = useState("");

  const { data: eleves = [] } = useListerEleves(
    {},
    { query: { queryKey: getListerElevesQueryKey(), enabled: searchEleve.length >= 2 } }
  );

  const filtres = (eleves as Array<Record<string, unknown>>).filter(e => {
    const q = searchEleve.toLowerCase();
    return (
      String(e.nom ?? "").toLowerCase().includes(q) ||
      String(e.prenoms ?? "").toLowerCase().includes(q) ||
      String(e.matricule ?? "").toLowerCase().includes(q)
    );
  }).slice(0, 8);

  const set = (k: string, v: string | boolean) => setForm(p => ({ ...p, [k]: v as CreerParentBodyLien }));

  const handleSubmit = async () => {
    if (!form.nom || !form.prenoms || !form.email || !form.eleve_id || !form.lien) {
      toast({ title: "Champs requis", description: "Remplissez tous les champs obligatoires.", variant: "destructive" });
      return;
    }
    try {
      const res = await mutation.mutateAsync({ data: { ...form } }) as Record<string, unknown>;
      const mdp = res.mot_de_passe_temporaire ? `Mot de passe temporaire : ${res.mot_de_passe_temporaire}` : "";
      toast({
        title: (res.nouveau as boolean) ? "Compte parent créé" : "Parent lié à l'élève",
        description: mdp || "La liaison a été créée avec succès.",
      });
      onSuccess();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast({ title: "Erreur", description: err?.response?.data?.message ?? "Impossible de créer le parent.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {[
          { k: "nom", l: "Nom *", placeholder: "Ex: Kouassi" },
          { k: "prenoms", l: "Prénoms *", placeholder: "Ex: Marie" },
          { k: "email", l: "Email *", placeholder: "parent@email.ci" },
          { k: "telephone", l: "Téléphone", placeholder: "+225 07 00 00 00" },
        ].map(({ k, l, placeholder }) => (
          <div key={k}>
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--m15-muted)] block mb-1">{l}</label>
            <Input
              placeholder={placeholder}
              value={String(form[k as keyof typeof form])}
              onChange={e => set(k, e.target.value)}
              className="bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)] text-sm"
            />
          </div>
        ))}
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-widest text-[var(--m15-muted)] block mb-1">Élève *</label>
        <Input
          placeholder="Rechercher par nom ou matricule…"
          value={search || searchEleve}
          onChange={e => { setSearchEleve(e.target.value); setSearch(""); set("eleve_id", ""); }}
          className="bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)] text-sm"
        />
        {searchEleve.length >= 2 && filtres.length > 0 && !form.eleve_id && (
          <div className="mt-1 rounded-xl overflow-hidden border" style={{ borderColor: "var(--m15-border)", background: "var(--m15-card)" }}>
            {filtres.map(e => (
              <button
                key={String(e.id)}
                className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/5 transition-colors"
                style={{ color: "var(--m15-white)", borderBottom: "1px solid var(--m15-border)" }}
                onClick={() => {
                  set("eleve_id", String(e.id));
                  setSearch(`${e.prenoms} ${e.nom} (${e.matricule})`);
                  setSearchEleve("");
                }}
              >
                <span className="font-medium">{String(e.prenoms)} {String(e.nom)}</span>
                <span className="ml-2 text-xs font-mono" style={{ color: "var(--m15-cyan)" }}>{String(e.matricule)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-widest text-[var(--m15-muted)] block mb-1">Lien *</label>
          <Select value={form.lien} onValueChange={v => set("lien", v)}>
            <SelectTrigger className="bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
              {LIEN_OPTIONS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-[var(--m15-white)]">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end pb-2">
          <div className="flex items-center gap-2">
            <Switch checked={form.est_principal} onCheckedChange={v => set("est_principal", v)} />
            <span className="text-sm text-[var(--m15-muted)]">Contact principal</span>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" className="flex-1 border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={onClose}>
          Annuler
        </Button>
        <Button
          className="flex-1 bg-[var(--m15-cyan)] text-[var(--m15-navy)] font-semibold"
          onClick={handleSubmit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
          Créer le compte
        </Button>
      </div>
    </div>
  );
}

/* ── Onglet : lier un compte existant ───────────────────── */
function OngletCompteExistant({
  onSuccess,
  onClose,
}: {
  onSuccess: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const mutation = useLierParentExistant();

  const [emailRecherche, setEmailRecherche] = useState("");
  const [parentTrouve, setParentTrouve] = useState<Record<string, unknown> | null>(null);
  const [searchEleve, setSearchEleve] = useState("");
  const [searchDisplay, setSearchDisplay] = useState("");
  const [eleveId, setEleveId] = useState("");
  const [lien, setLien] = useState<LierParentBodyLien>("tuteur");
  const [estPrincipal, setEstPrincipal] = useState(false);

  const { data: parentsList = [] } = useListerParents(
    { etablissement_id: user?.etablissement_id ?? undefined }
  );

  const { data: eleves = [] } = useListerEleves(
    {},
    { query: { queryKey: getListerElevesQueryKey(), enabled: searchEleve.length >= 2 } }
  );

  const filtresEleves = (eleves as Array<Record<string, unknown>>).filter(e => {
    const q = searchEleve.toLowerCase();
    return (
      String(e.nom ?? "").toLowerCase().includes(q) ||
      String(e.prenoms ?? "").toLowerCase().includes(q) ||
      String(e.matricule ?? "").toLowerCase().includes(q)
    );
  }).slice(0, 8);

  const handleRecherche = () => {
    const found = (parentsList as ParentRow[]).find(
      p => p.email.toLowerCase() === emailRecherche.toLowerCase().trim()
    );
    if (found) setParentTrouve(found as unknown as Record<string, unknown>);
    else toast({ title: "Parent introuvable", description: "Aucun compte parent avec cet email.", variant: "destructive" });
  };

  const handleLier = async () => {
    if (!parentTrouve || !eleveId || !lien) return;
    try {
      await mutation.mutateAsync({ data: { utilisateur_id: String(parentTrouve.id), eleve_id: eleveId, lien: lien as LierParentBodyLien, est_principal: estPrincipal } });
      toast({ title: "Parent lié à l'élève", description: "La liaison a été créée avec succès." });
      onSuccess();
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } };
      toast({ title: "Erreur", description: err?.response?.data?.message ?? "Impossible de créer la liaison.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-semibold uppercase tracking-widest text-[var(--m15-muted)] block mb-1">Email du parent existant</label>
        <div className="flex gap-2">
          <Input
            placeholder="parent@email.ci"
            value={emailRecherche}
            onChange={e => { setEmailRecherche(e.target.value); setParentTrouve(null); }}
            className="bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)] text-sm"
          />
          <Button variant="outline" className="border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={handleRecherche}>
            <Search className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {parentTrouve && (
        <div className="rounded-xl p-4 space-y-4" style={{ background: "rgba(0,201,167,0.06)", border: "1px solid rgba(0,201,167,0.2)" }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold"
              style={{ background: "rgba(245,200,66,0.15)", color: "#F5C842" }}>
              {String(parentTrouve.prenoms ?? "").charAt(0)}
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--m15-white)" }}>
                {String(parentTrouve.prenoms ?? "")} {String(parentTrouve.nom ?? "")}
              </p>
              <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                {String(parentTrouve.email ?? "")} · {Number(parentTrouve.nb_enfants ?? 0)} enfant(s) lié(s)
              </p>
            </div>
            <Check className="w-5 h-5 ml-auto" style={{ color: "#00C9A7" }} />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--m15-muted)] block mb-1">Élève à lier</label>
            <Input
              placeholder="Rechercher l'élève…"
              value={searchDisplay || searchEleve}
              onChange={e => { setSearchEleve(e.target.value); setSearchDisplay(""); setEleveId(""); }}
              className="bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)] text-sm"
            />
            {searchEleve.length >= 2 && filtresEleves.length > 0 && !eleveId && (
              <div className="mt-1 rounded-xl overflow-hidden border" style={{ borderColor: "var(--m15-border)", background: "var(--m15-card)" }}>
                {filtresEleves.map(e => (
                  <button
                    key={String(e.id)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/5 transition-colors"
                    style={{ color: "var(--m15-white)", borderBottom: "1px solid var(--m15-border)" }}
                    onClick={() => {
                      setEleveId(String(e.id));
                      setSearchDisplay(`${e.prenoms} ${e.nom} (${e.matricule})`);
                      setSearchEleve("");
                    }}
                  >
                    <span className="font-medium">{String(e.prenoms)} {String(e.nom)}</span>
                    <span className="ml-2 text-xs font-mono" style={{ color: "var(--m15-cyan)" }}>{String(e.matricule)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest text-[var(--m15-muted)] block mb-1">Lien</label>
              <Select value={lien} onValueChange={v => setLien(v as LierParentBodyLien)}>
                <SelectTrigger className="bg-[var(--m15-navy)] border-[var(--m15-border)] text-[var(--m15-white)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                  {LIEN_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value} className="text-[var(--m15-white)]">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end pb-2">
              <div className="flex items-center gap-2">
                <Switch checked={estPrincipal} onCheckedChange={setEstPrincipal} />
                <span className="text-sm text-[var(--m15-muted)]">Principal</span>
              </div>
            </div>
          </div>

          <Button
            className="w-full bg-[var(--m15-cyan)] text-[var(--m15-navy)] font-semibold"
            onClick={handleLier}
            disabled={!eleveId || mutation.isPending}
          >
            {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
            Lier ce parent
          </Button>
        </div>
      )}

      <Button variant="outline" className="w-full border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={onClose}>
        Annuler
      </Button>
    </div>
  );
}

/* ── Page principale ─────────────────────────────────────── */
export default function Parents() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [onglet, setOnglet] = useState<"nouveau" | "existant">("nouveau");
  const [resetTarget, setResetTarget] = useState<{ id: string; nom: string } | null>(null);
  const [resetPassword, setResetPassword] = useState<string | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const { data: rawData, isLoading } = useListerParents(
    { etablissement_id: user?.role !== "dev" ? (user?.etablissement_id ?? undefined) : undefined }
  );

  const { mutate: reinitMdp, isPending: reinitPending } = useReinitialiserMdpParent();

  const parents: ParentRow[] = (rawData as ParentRow[] ?? []).filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.nom.toLowerCase().includes(q) ||
      (p.prenoms ?? "").toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q)
    );
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListerParentsQueryKey() });

  const handleReinit = () => {
    if (!resetTarget) return;
    reinitMdp(
      { id: resetTarget.id },
      {
        onSuccess: (res) => {
          setResetPassword((res as { nouveau_mot_de_passe?: string }).nouveau_mot_de_passe ?? null);
          invalidate();
        },
        onError: () => toast({ title: "Erreur lors de la réinitialisation", variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--m15-white)] flex items-center gap-2"
            style={{ fontFamily: "'Syne', sans-serif" }}>
            <UserCircle className="h-7 w-7 text-[var(--m15-cyan)]" />
            Parents & Tuteurs
          </h1>
          <p className="text-[var(--m15-muted)] text-sm mt-1">
            {parents.length} parent(s) enregistré(s)
          </p>
        </div>
        {["directeur", "censeur"].includes(user?.role ?? "") && (
          <Button
            className="bg-[var(--m15-cyan)] text-[var(--m15-navy)] font-semibold flex items-center gap-2"
            onClick={() => { setOnglet("nouveau"); setShowModal(true); }}
          >
            <Plus className="w-4 h-4" /> Ajouter un parent
          </Button>
        )}
      </div>

      {/* ── Recherche ── */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--m15-muted)]" />
        <Input
          placeholder="Rechercher par nom ou email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)]"
        />
      </div>

      {/* ── Tableau ── */}
      <div className="rounded-xl border border-[var(--m15-border)] overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
              {["Nom", "Email", "Enfants", "Statut", "Actions"].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "var(--m15-muted)", fontFamily: "'Syne', sans-serif" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--m15-border)" }}>
                  {Array.from({ length: 5 }).map((__, j) => (
                    <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                  ))}
                </tr>
              ))
            ) : parents.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-12" style={{ color: "var(--m15-muted)" }}>
                  Aucun parent trouvé
                </td>
              </tr>
            ) : (
              parents.map(p => (
                <tr key={p.id} style={{ borderBottom: "1px solid var(--m15-border)" }}
                  className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: "rgba(245,200,66,0.12)", color: "#F5C842", fontFamily: "'Syne', sans-serif" }}>
                        {(p.prenoms ?? "").charAt(0)}
                      </div>
                      <span className="font-medium text-sm" style={{ color: "var(--m15-white)" }}>
                        {p.prenoms} {p.nom}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: "var(--m15-muted)" }}>{p.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>
                        {p.nb_enfants} enfant{p.nb_enfants !== 1 ? "s" : ""}
                      </span>
                      {p.enfants?.slice(0, 2).map(e => (
                        <span key={e.id} className="text-xs" style={{ color: "var(--m15-muted)" }}>
                          {e.prenoms} {e.nom} · {LIEN_LABELS[e.lien] ?? e.lien}
                        </span>
                      ))}
                      {(p.enfants?.length ?? 0) > 2 && (
                        <span className="text-xs" style={{ color: "var(--m15-muted)" }}>+{p.enfants.length - 2} autre(s)</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={p.actif
                      ? "bg-green-600/20 text-green-400 border-green-600/30"
                      : "bg-red-600/20 text-red-400 border-red-600/30"}>
                      {p.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[var(--m15-border)] text-[var(--m15-muted)] hover:text-[var(--m15-white)] flex items-center gap-1.5"
                        onClick={() => setLocation(`/parents/detail/${p.id}`)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Détail
                      </Button>
                      {["directeur", "censeur"].includes(user?.role ?? "") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-[var(--m15-border)] text-[var(--m15-muted)] hover:text-[var(--m15-white)]"
                          onClick={() => { setResetPassword(null); setResetTarget({ id: p.id, nom: `${p.prenoms} ${p.nom}` }); }}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ── Modal ajouter parent ── */}
      <Dialog open={showModal} onOpenChange={open => { if (!open) setShowModal(false); }}>
        <DialogContent className="bg-[var(--m15-card)] border-[var(--m15-border)] max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[var(--m15-white)]" style={{ fontFamily: "'Syne', sans-serif" }}>
              Ajouter un parent
            </DialogTitle>
          </DialogHeader>

          {/* Onglets */}
          <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: "var(--m15-border)" }}>
            {[
              { id: "nouveau" as const, label: "Nouveau compte" },
              { id: "existant" as const, label: "Compte existant" },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setOnglet(id)}
                className="flex-1 py-2.5 text-sm font-semibold transition-all"
                style={{
                  background: onglet === id ? "rgba(0,201,167,0.1)" : "transparent",
                  color: onglet === id ? "#00C9A7" : "var(--m15-muted)",
                  borderBottom: onglet === id ? "2px solid #00C9A7" : "2px solid transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="pt-2">
            {onglet === "nouveau" ? (
              <OngletNouveauCompte
                onSuccess={() => { setShowModal(false); invalidate(); }}
                onClose={() => setShowModal(false)}
              />
            ) : (
              <OngletCompteExistant
                onSuccess={() => { setShowModal(false); invalidate(); }}
                onClose={() => setShowModal(false)}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal réinitialisation MDP ── */}
      <Dialog open={!!resetTarget} onOpenChange={open => { if (!open) { setResetTarget(null); setResetPassword(null); } }}>
        <DialogContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <DialogHeader>
            <DialogTitle className="text-[var(--m15-white)]">Réinitialiser le mot de passe</DialogTitle>
          </DialogHeader>
          {resetPassword ? (
            <div className="space-y-3">
              <p className="text-[var(--m15-muted)] text-sm">Nouveau mot de passe temporaire :</p>
              <div className="bg-[var(--m15-navy)] rounded-lg p-3 font-mono text-[var(--m15-cyan)] text-lg tracking-widest text-center">
                {resetPassword}
              </div>
              <p className="text-[var(--m15-muted)] text-xs">
                Communiquez ce mot de passe à l'utilisateur. Il devra le changer à sa prochaine connexion.
              </p>
              <Button className="w-full" onClick={() => { setResetTarget(null); setResetPassword(null); }}>Fermer</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[var(--m15-muted)] text-sm">
                Réinitialiser le mot de passe de{" "}
                <span className="text-[var(--m15-white)] font-medium">{resetTarget?.nom}</span> ?
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 border-[var(--m15-border)]" onClick={() => setResetTarget(null)}>
                  Annuler
                </Button>
                <Button className="flex-1 bg-[var(--m15-cyan)] text-[var(--m15-navy)]" onClick={handleReinit} disabled={reinitPending}>
                  {reinitPending ? "En cours…" : "Réinitialiser"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
