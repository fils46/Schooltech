import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListerEnfantsParent,
  getListerEnfantsParentQueryKey,
  getListerElevesQueryKey,
  useModifierLiaison,
  useSupprimerLiaison,
  useReinitialiserMdpParent,
  useListerUtilisateurs,
  useListerEleves,
  useLierParentExistant,
  type ModifierLiaisonBodyLien,
  type LierParentBodyLien,
} from "@workspace/api-client-react";
import { type ReactNode } from "react";
import {
  ArrowLeft, Users, UserCircle, BookOpen, Eye, EyeOff,
  MessageSquare, KeyRound, Trash2, Edit3, Plus, Loader2, X, Check, Copy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";

const LIEN_LABELS: Record<string, string> = { pere: "Père", mere: "Mère", tuteur: "Tuteur", autre: "Autre" };
const LIEN_OPTIONS = [
  { value: "pere", label: "Père" },
  { value: "mere", label: "Mère" },
  { value: "tuteur", label: "Tuteur" },
  { value: "autre", label: "Autre" },
];

/* ── Modal modifier liaison ──────────────────────────────── */
function ModalModifierLiaison({
  liaison,
  onClose,
  onSuccess,
}: {
  liaison: Record<string, unknown>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const mutation = useModifierLiaison();
  const [lien, setLien] = useState<ModifierLiaisonBodyLien>(String(liaison.lien ?? "pere") as ModifierLiaisonBodyLien);
  const [estPrincipal, setEstPrincipal] = useState(Boolean(liaison.est_principal));
  const [notes, setNotes] = useState(Boolean(liaison.peut_consulter_notes ?? true));
  const [absences, setAbsences] = useState(Boolean(liaison.peut_consulter_absences ?? true));
  const [messages, setMessages] = useState(Boolean(liaison.peut_envoyer_messages ?? true));

  const handleSave = async () => {
    try {
      await mutation.mutateAsync({
        id: String(liaison.liaison_id),
        data: {
          lien,
          est_principal: estPrincipal,
          peut_consulter_notes: notes,
          peut_consulter_absences: absences,
          peut_envoyer_messages: messages,
        },
      });
      toast({ title: "Liaison mise à jour" });
      onSuccess();
    } catch {
      toast({ title: "Erreur", description: "Impossible de modifier la liaison.", variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="bg-[var(--m15-card)] border-[var(--m15-border)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--m15-white)]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Modifier la liaison
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-5 pt-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--m15-muted)] block mb-1.5">Lien de parenté</label>
            <Select value={lien} onValueChange={v => setLien(v as ModifierLiaisonBodyLien)}>
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
          <div className="space-y-3">
            {[
              { label: "Contact principal", value: estPrincipal, set: setEstPrincipal },
              { label: "Peut consulter les notes", value: notes, set: setNotes },
              { label: "Peut consulter les absences", value: absences, set: setAbsences },
              { label: "Peut envoyer des messages", value: messages, set: setMessages },
            ].map(({ label, value, set }) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-sm text-[var(--m15-muted)]">{label}</span>
                <Switch checked={value} onCheckedChange={set} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={onClose}>
              Annuler
            </Button>
            <Button
              className="flex-1 bg-[var(--m15-cyan)] text-[var(--m15-navy)] font-semibold"
              onClick={handleSave}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Check className="w-4 h-4 mr-2" />}
              Sauvegarder
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Modal ajouter un enfant ─────────────────────────────── */
function ModalAjouterEnfant({
  parentId,
  onClose,
  onSuccess,
}: {
  parentId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const mutation = useLierParentExistant();
  const [search, setSearch] = useState("");
  const [eleveId, setEleveId] = useState("");
  const [lien, setLien] = useState<LierParentBodyLien>("tuteur");
  const [estPrincipal, setEstPrincipal] = useState(false);

  const { data: eleves = [] } = useListerEleves(
    {},
    { query: { queryKey: getListerElevesQueryKey(), enabled: search.length >= 2 } }
  );

  const filtres = (eleves as Array<Record<string, unknown>>).filter(e => {
    const q = search.toLowerCase();
    return (
      String(e.nom ?? "").toLowerCase().includes(q) ||
      String(e.prenoms ?? "").toLowerCase().includes(q) ||
      String(e.matricule ?? "").toLowerCase().includes(q)
    );
  }).slice(0, 8);

  const handleLier = async () => {
    if (!eleveId || !lien) return;
    try {
      await mutation.mutateAsync({ data: { utilisateur_id: parentId, eleve_id: eleveId, lien: lien as LierParentBodyLien, est_principal: estPrincipal } });
      toast({ title: "Enfant lié avec succès" });
      onSuccess();
    } catch {
      toast({ title: "Erreur", description: "Impossible de lier l'enfant.", variant: "destructive" });
    }
  };

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="bg-[var(--m15-card)] border-[var(--m15-border)] max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[var(--m15-white)]" style={{ fontFamily: "'Syne', sans-serif" }}>
            Ajouter un enfant
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--m15-muted)] block mb-1.5">Rechercher un élève</label>
            <input
              type="text"
              placeholder="Nom, prénom ou matricule…"
              value={search}
              onChange={e => { setSearch(e.target.value); setEleveId(""); }}
              className="w-full px-3 py-2 rounded-xl text-sm outline-none"
              style={{ background: "var(--m15-navy)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
            />
            {search.length >= 2 && filtres.length > 0 && !eleveId && (
              <div className="mt-1 rounded-xl overflow-hidden border" style={{ borderColor: "var(--m15-border)", background: "var(--m15-card)" }}>
                {filtres.map(e => (
                  <button
                    key={String(e.id)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-white/5 transition-colors"
                    style={{ color: "var(--m15-white)", borderBottom: "1px solid var(--m15-border)" }}
                    onClick={() => { setEleveId(String(e.id)); setSearch(`${e.prenoms} ${e.nom}`); }}
                  >
                    <span className="font-medium">{String(e.prenoms)} {String(e.nom)}</span>
                    <span className="ml-2 text-xs font-mono" style={{ color: "var(--m15-cyan)" }}>{String(e.matricule)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-widest text-[var(--m15-muted)] block mb-1.5">Lien de parenté</label>
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
          <div className="flex items-center justify-between">
            <span className="text-sm text-[var(--m15-muted)]">Contact principal</span>
            <Switch checked={estPrincipal} onCheckedChange={setEstPrincipal} />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1 border-[var(--m15-border)] text-[var(--m15-muted)]" onClick={onClose}>
              Annuler
            </Button>
            <Button
              className="flex-1 bg-[var(--m15-cyan)] text-[var(--m15-navy)] font-semibold"
              onClick={handleLier}
              disabled={!eleveId || mutation.isPending}
            >
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
              Lier l'enfant
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Page principale ─────────────────────────────────────── */
export default function DetailParent() {
  const params = useParams<{ id: string }>();
  const parentId = params.id ?? "";
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canManage = ["directeur", "censeur"].includes(user?.role ?? "");
  const canDelete = user?.role === "directeur";

  const [modifierLiaison, setModifierLiaison] = useState<Record<string, unknown> | null>(null);
  const [showAjouterEnfant, setShowAjouterEnfant] = useState(false);
  const [resetPassword, setResetPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: enfants, isLoading } = useListerEnfantsParent(
    parentId,
    { query: { queryKey: getListerEnfantsParentQueryKey(parentId), enabled: !!parentId } }
  );

  const { data: parentUsers } = useListerUtilisateurs(
    { role: "parent", etablissement_id: user?.etablissement_id ?? undefined },
  );
  const parentUser = (parentUsers as Array<Record<string, unknown>> | undefined)?.find(u => u.id === parentId);

  const reinitMutation = useReinitialiserMdpParent();
  const supprimerMutation = useSupprimerLiaison();

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListerEnfantsParentQueryKey(parentId) });

  const handleReinit = async () => {
    try {
      const res = await reinitMutation.mutateAsync({ id: parentId }) as Record<string, unknown>;
      setResetPassword(String(res.nouveau_mot_de_passe ?? ""));
    } catch {
      toast({ title: "Erreur", description: "Impossible de réinitialiser le mot de passe.", variant: "destructive" });
    }
  };

  const handleSupprimer = async (liaId: string) => {
    try {
      await supprimerMutation.mutateAsync({ id: liaId });
      toast({ title: "Liaison supprimée" });
      setConfirmDelete(null);
      invalidate();
    } catch {
      toast({ title: "Erreur", description: "Impossible de supprimer la liaison.", variant: "destructive" });
    }
  };

  const enfantsArr = (enfants as Array<Record<string, unknown>>) ?? [];
  const nom = parentUser ? `${String(parentUser.prenoms ?? "")} ${String(parentUser.nom ?? "")}` : "Parent";
  const actif = parentUser ? Boolean(parentUser.actif) : false;

  return (
    <div className="max-w-3xl mx-auto space-y-6 page-fade-in">
      {modifierLiaison && (
        <ModalModifierLiaison
          liaison={modifierLiaison}
          onClose={() => setModifierLiaison(null)}
          onSuccess={() => { setModifierLiaison(null); invalidate(); }}
        />
      )}
      {showAjouterEnfant && (
        <ModalAjouterEnfant
          parentId={parentId}
          onClose={() => setShowAjouterEnfant(false)}
          onSuccess={() => { setShowAjouterEnfant(false); invalidate(); }}
        />
      )}

      {/* ── Header navigation ── */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setLocation("/parents")}
          className="w-9 h-9 flex items-center justify-center rounded-xl"
          style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <h1 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
          Fiche parent
        </h1>
      </div>

      {/* ── Carte identité ── */}
      <div className="rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold flex-shrink-0"
          style={{ background: "rgba(245,200,66,0.15)", color: "#F5C842", fontFamily: "'Syne', sans-serif" }}>
          {nom.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              {nom}
            </h2>
            <Badge className={actif ? "bg-green-600/20 text-green-400 border-green-600/30" : "bg-red-600/20 text-red-400 border-red-600/30"}>
              {actif ? "Actif" : "Inactif"}
            </Badge>
          </div>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            {String(parentUser?.email ?? "")} · {enfantsArr.length} enfant(s)
          </p>
          {!!parentUser?.telephone && (
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>{String(parentUser.telephone)}</p>
          )}
        </div>
        {canManage && (
          <Button
            variant="outline"
            size="sm"
            className="border-[var(--m15-border)] text-[var(--m15-muted)] hover:text-[var(--m15-white)] flex items-center gap-2"
            onClick={handleReinit}
            disabled={reinitMutation.isPending}
          >
            {reinitMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Réinitialiser MDP
          </Button>
        )}
      </div>

      {/* ── Résultat réinitialisation ── */}
      {resetPassword && (
        <div className="rounded-2xl p-4 flex items-start gap-4"
          style={{ background: "rgba(0,201,167,0.06)", border: "1px solid rgba(0,201,167,0.2)" }}>
          <div className="flex-1">
            <p className="text-sm font-semibold" style={{ color: "#00C9A7" }}>Mot de passe temporaire généré</p>
            <div className="flex items-center gap-2 mt-1">
              <p className="font-mono text-lg tracking-widest" style={{ color: "var(--m15-white)" }}>{resetPassword}</p>
              <button
                onClick={() => copyToClipboard(resetPassword!)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium transition-all flex-shrink-0"
                style={{ background: copied ? "rgba(0,201,167,0.2)" : "rgba(0,201,167,0.08)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.25)" }}
              >
                {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copié !" : "Copier"}
              </button>
            </div>
            <p className="text-xs mt-1" style={{ color: "var(--m15-muted)" }}>Communiquez ce mot de passe à l'utilisateur. Il devra le changer à la prochaine connexion.</p>
          </div>
          <button onClick={() => setResetPassword(null)} className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg"
            style={{ background: "var(--elevate-1)", color: "var(--m15-muted)" }}>
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── Enfants ── */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid var(--m15-border)" }}>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5" style={{ color: "#00C9A7" }} />
            <h3 className="font-bold text-base" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Ses enfants
            </h3>
          </div>
          {canManage && (
            <Button
              size="sm"
              className="bg-[var(--m15-cyan)] text-[var(--m15-navy)] font-semibold flex items-center gap-2"
              onClick={() => setShowAjouterEnfant(true)}
            >
              <Plus className="w-4 h-4" /> Ajouter un enfant
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="p-4 space-y-3">
            {[1, 2].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
          </div>
        ) : enfantsArr.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <Users className="w-10 h-10" style={{ color: "var(--m15-muted)" }} />
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucun enfant lié à ce parent.</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
            {enfantsArr.map(enfant => (
              <div key={String(enfant.liaison_id)} className="p-5 flex flex-col sm:flex-row gap-4">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                  style={{ background: "rgba(0,128,255,0.12)", color: "#0080FF", fontFamily: "'Syne', sans-serif" }}>
                  {String(enfant.prenoms ?? "").charAt(0)}{String(enfant.nom ?? "").charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm" style={{ color: "var(--m15-white)" }}>
                      {String(enfant.prenoms ?? "")} {String(enfant.nom ?? "")}
                    </p>
                    <Badge className="text-xs px-2 py-0"
                      style={{ background: "rgba(0,201,167,0.1)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.2)" }}>
                      {LIEN_LABELS[String(enfant.lien)] ?? String(enfant.lien)}
                    </Badge>
                    {Boolean(enfant.est_principal) && (
                      <Badge className="text-xs px-2 py-0"
                        style={{ background: "rgba(245,200,66,0.12)", color: "#F5C842", border: "1px solid rgba(245,200,66,0.2)" }}>
                        Principal
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs mt-1 font-mono" style={{ color: "var(--m15-muted)" }}>
                    {String(enfant.matricule ?? "")} · {String(enfant.classe ?? "Pas de classe")}
                  </p>
                  <div className="flex items-center gap-4 mt-2 flex-wrap">
                    <PermIcon icon={<BookOpen className="w-3.5 h-3.5" />} label="Notes" on={Boolean(enfant.peut_consulter_notes)} />
                    <PermIcon icon={<Eye className="w-3.5 h-3.5" />} label="Absences" on={Boolean(enfant.peut_consulter_absences)} />
                    <PermIcon icon={<MessageSquare className="w-3.5 h-3.5" />} label="Messages" on={Boolean(enfant.peut_envoyer_messages)} />
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => setModifierLiaison(enfant)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg"
                      style={{ background: "rgba(0,128,255,0.1)", color: "#0080FF" }}
                      title="Modifier la liaison"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    {canDelete && (
                      confirmDelete === String(enfant.liaison_id) ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleSupprimer(String(enfant.liaison_id))}
                            className="px-2 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: "rgba(255,77,109,0.15)", color: "#FF4D6D" }}
                          >
                            Confirmer
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="px-2 py-1.5 rounded-lg text-xs"
                            style={{ background: "var(--elevate-1)", color: "var(--m15-muted)" }}
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(String(enfant.liaison_id))}
                          className="w-8 h-8 flex items-center justify-center rounded-lg"
                          style={{ background: "rgba(255,77,109,0.08)", color: "#FF4D6D" }}
                          title="Retirer cet enfant"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PermIcon({ icon, label, on }: { icon: ReactNode; label: string; on: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color: on ? "#00C9A7" : "var(--m15-muted)" }}>{icon}</span>
      {!on && <EyeOff className="w-3 h-3" style={{ color: "var(--m15-muted)" }} />}
      <span className="text-xs" style={{ color: on ? "var(--m15-muted)" : "rgba(139,157,195,0.5)" }}>{label}</span>
    </div>
  );
}
