import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListerUtilisateurs,
  useCreerUtilisateur,
  useActiverUtilisateur,
  useDesactiverUtilisateur,
  getListerUtilisateursQueryKey,
  useListerClasses,
  getListerClassesQueryKey,
  useAffecterProfesseur,
  useRetirerProfesseur,
  useListerAnneesScolaires,
  getListerAnneesScolairesQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  GraduationCap, Plus, Search, Mail, Phone, Calendar,
  BookOpen, Loader2, Trash2, CheckCircle2, UserX, ChevronRight,
  Users, ClipboardList, Copy, Check,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const BASE = import.meta.env.BASE_URL;

type ProfAssignment = {
  id: string;
  classe_id: string;
  classe_nom: string;
  classe_niveau: string;
  matiere: string;
  annee_scolaire_id: string;
  annee_label: string | null;
};

const professeureSchema = z.object({
  nom: z.string().min(1, "Requis"),
  prenoms: z.string().optional(),
  email: z.string().email("Email invalide"),
  telephone: z.string().optional(),
});
type ProfForm = z.infer<typeof professeureSchema>;

const affectSchema = z.object({
  classe_id: z.string().min(1, "Requis"),
  matiere: z.string().min(1, "Requis"),
  annee_scolaire_id: z.string().min(1, "Requis"),
});
type AffectForm = z.infer<typeof affectSchema>;

export default function Professeurs() {
  const [addOpen, setAddOpen] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyToClipboard = (text: string) => {
    void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  const [search, setSearch] = useState("");
  const [selectedProfId, setSelectedProfId] = useState<string | null>(null);
  const [affectOpen, setAffectOpen] = useState(false);

  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: professeurs, isLoading } = useListerUtilisateurs(
    { role: "professeur" },
    { query: { queryKey: getListerUtilisateursQueryKey({ role: "professeur" }) } }
  );

  const { data: annees } = useListerAnneesScolaires({
    query: { queryKey: getListerAnneesScolairesQueryKey() },
  });

  const { data: classes } = useListerClasses(
    {},
    { query: { queryKey: getListerClassesQueryKey({}) } }
  );

  const anneesArr = annees?.annees ?? [];
  const anneeActive = anneesArr.find(a => a.est_active) ?? anneesArr[0] ?? null;

  const selectedProf = professeurs?.find(p => p.id === selectedProfId) ?? null;

  const { data: assignmentsData, isLoading: loadingAssignments } = useQuery<{ success: boolean; data: ProfAssignment[] }>({
    queryKey: ["prof-classes", selectedProfId],
    queryFn: async () => {
      const token = localStorage.getItem("m15_token");
      const res = await fetch(`${BASE}api/professeurs/${selectedProfId}/classes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Erreur chargement affectations");
      return res.json() as Promise<{ success: boolean; data: ProfAssignment[] }>;
    },
    enabled: !!selectedProfId,
  });

  const assignments = assignmentsData?.data ?? [];

  const createMutation = useCreerUtilisateur();
  const activerMutation = useActiverUtilisateur();
  const desactiverMutation = useDesactiverUtilisateur();
  const affecterMutation = useAffecterProfesseur();
  const retirerMutation = useRetirerProfesseur();

  const addForm = useForm<ProfForm>({
    resolver: zodResolver(professeureSchema),
    defaultValues: { nom: "", prenoms: "", email: "", telephone: "" },
  });

  const affectForm = useForm<AffectForm>({
    resolver: zodResolver(affectSchema),
    defaultValues: {
      classe_id: "",
      matiere: "",
      annee_scolaire_id: anneeActive?.id ?? "",
    },
  });

  const onAddSubmit = (data: ProfForm) => {
    createMutation.mutate({
      data: { ...data, role: "professeur", etablissement_id: user?.etablissement_id ?? null },
    }, {
      onSuccess: (res) => {
        qc.invalidateQueries({ queryKey: getListerUtilisateursQueryKey({ role: "professeur" }) });
        setNewPassword(res.passwordTemporaire);
        addForm.reset();
      },
      onError: (err) => {
        toast({ title: "Erreur", description: err.message, variant: "destructive" });
      },
    });
  };

  const handleToggle = (id: string, actif: boolean) => {
    const mutation = actif ? desactiverMutation : activerMutation;
    mutation.mutate({ id }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListerUtilisateursQueryKey({ role: "professeur" }) });
        toast({ title: actif ? "Compte suspendu" : "Compte activé" });
      },
      onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
    });
  };

  const onAffectSubmit = (data: AffectForm) => {
    if (!selectedProfId) return;
    affecterMutation.mutate({
      id: data.classe_id,
      data: {
        professeur_id: selectedProfId,
        matiere: data.matiere,
        annee_scolaire_id: data.annee_scolaire_id,
      },
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["prof-classes", selectedProfId] });
        toast({ title: "Professeur affecté", description: `Affecté à la classe avec succès.` });
        setAffectOpen(false);
        affectForm.reset({ classe_id: "", matiere: "", annee_scolaire_id: anneeActive?.id ?? "" });
      },
      onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
    });
  };

  const handleRetirer = (assignment: ProfAssignment) => {
    if (!confirm(`Retirer ${selectedProf?.nom} de "${assignment.classe_nom}" (${assignment.matiere}) ?`)) return;
    retirerMutation.mutate({
      id: assignment.classe_id,
      profId: assignment.id,
    }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["prof-classes", selectedProfId] });
        toast({ title: "Affectation retirée" });
      },
      onError: (err) => toast({ title: "Erreur", description: err.message, variant: "destructive" }),
    });
  };

  const filtered = (professeurs ?? []).filter(u =>
    search === "" ||
    `${u.nom} ${u.prenoms ?? ""} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const total = professeurs?.length ?? 0;
  const actifCount = (professeurs ?? []).filter(u => u.actif).length;
  const inactifCount = total - actifCount;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Professeurs
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--m15-muted)" }}>
            {total} professeur{total !== 1 ? "s" : ""} · {actifCount} actif{actifCount !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "#00C9A7", color: "var(--m15-navy)", fontFamily: "'Syne', sans-serif" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#00b396"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#00C9A7"}
        >
          <Plus className="w-4 h-4" /> Ajouter un professeur
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total", value: total, icon: Users, color: "#00C9A7" },
          { label: "Actifs", value: actifCount, icon: CheckCircle2, color: "#0080FF" },
          { label: "Suspendus", value: inactifCount, icon: UserX, color: "#FF4D6D" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: `${color}18` }}>
              <Icon className="w-4 h-4" style={{ color }} />
            </div>
            <div>
              <p className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                {isLoading ? "–" : value}
              </p>
              <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Recherche ── */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--m15-muted)" }} />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, email..."
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--m15-white)", fontFamily: "'DM Sans', sans-serif" }}
        />
        {search && (
          <button onClick={() => setSearch("")} className="text-xs" style={{ color: "var(--m15-muted)" }}>
            Effacer
          </button>
        )}
      </div>

      {/* ── Liste ── */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <GraduationCap className="w-12 h-12 mb-4" style={{ color: "var(--m15-muted)", opacity: 0.35 }} />
            <p className="font-semibold" style={{ color: "var(--m15-white)" }}>
              {search ? "Aucun résultat" : "Aucun professeur enregistré"}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
              {search ? "Essayez une autre recherche" : "Cliquez sur « Ajouter un professeur » pour commencer"}
            </p>
          </div>
        ) : (
          filtered.map((u) => (
            <div
              key={u.id}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all cursor-pointer group"
              style={{
                background: "var(--m15-card)",
                border: selectedProfId === u.id ? "1px solid #00C9A7" : "1px solid var(--m15-border)",
                opacity: u.actif ? 1 : 0.65,
              }}
              onClick={() => setSelectedProfId(u.id === selectedProfId ? null : u.id)}
            >
              {/* Avatar */}
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{
                  background: u.actif
                    ? "linear-gradient(135deg, #F59E0B, #EF4444)"
                    : "var(--elevate-2, rgba(255,255,255,0.06))",
                  color: "#fff",
                  fontFamily: "'Syne', sans-serif",
                }}
              >
                {String(u.prenoms ?? "").charAt(0)}{String(u.nom ?? "").charAt(0)}
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                  {u.prenoms} {u.nom}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-1">
                  <span className="flex items-center gap-1 text-xs" style={{ color: "var(--m15-muted)" }}>
                    <Mail className="w-3 h-3" /> {u.email}
                  </span>
                  {u.telephone && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--m15-muted)" }}>
                      <Phone className="w-3 h-3" /> {u.telephone}
                    </span>
                  )}
                  {u.created_at && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: "var(--m15-muted)" }}>
                      <Calendar className="w-3 h-3" />
                      {format(new Date(u.created_at), "d MMM yyyy", { locale: fr })}
                    </span>
                  )}
                </div>
              </div>

              {/* Badge + toggle + chevron */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold hidden sm:inline"
                  style={{
                    background: u.actif ? "rgba(0,201,167,0.12)" : "rgba(255,77,109,0.10)",
                    color: u.actif ? "#00C9A7" : "#FF4D6D",
                  }}>
                  {u.actif ? "Actif" : "Suspendu"}
                </span>
                <div onClick={e => e.stopPropagation()}>
                  <Switch
                    checked={u.actif}
                    onCheckedChange={() => handleToggle(u.id, u.actif)}
                    disabled={u.id === user?.id}
                  />
                </div>
                <ChevronRight
                  className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                  style={{ color: selectedProfId === u.id ? "#00C9A7" : "var(--m15-muted)" }}
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* ═══ Sheet Fiche Professeur ═══ */}
      <Sheet open={!!selectedProf} onOpenChange={(open) => { if (!open) setSelectedProfId(null); }}>
        <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto" style={{ background: "var(--m15-card)" }}>
          {selectedProf && (
            <>
              <SheetHeader className="pb-4 border-b" style={{ borderColor: "var(--m15-border)" }}>
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-bold"
                    style={{
                      background: selectedProf.actif
                        ? "linear-gradient(135deg, #F59E0B, #EF4444)"
                        : "rgba(255,255,255,0.06)",
                      color: "#fff",
                      fontFamily: "'Syne', sans-serif",
                    }}
                  >
                    {String(selectedProf.prenoms ?? "").charAt(0)}{String(selectedProf.nom ?? "").charAt(0)}
                  </div>
                  <div>
                    <SheetTitle style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                      {selectedProf.prenoms} {selectedProf.nom}
                    </SheetTitle>
                    <p className="text-sm mt-0.5" style={{ color: "var(--m15-muted)" }}>Professeur</p>
                  </div>
                </div>

                {/* Infos contact */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm" style={{ color: "var(--m15-muted)" }}>
                    <Mail className="w-3.5 h-3.5" />
                    <span>{selectedProf.email}</span>
                  </div>
                  {selectedProf.telephone && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--m15-muted)" }}>
                      <Phone className="w-3.5 h-3.5" />
                      <span>{selectedProf.telephone}</span>
                    </div>
                  )}
                  {selectedProf.created_at && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: "var(--m15-muted)" }}>
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Ajouté le {format(new Date(selectedProf.created_at), "d MMMM yyyy", { locale: fr })}</span>
                    </div>
                  )}
                </div>

                {/* Statut */}
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>
                    Compte {selectedProf.actif ? "actif" : "suspendu"}
                  </span>
                  <Switch
                    checked={selectedProf.actif}
                    onCheckedChange={() => handleToggle(selectedProf.id, selectedProf.actif)}
                    disabled={selectedProf.id === user?.id}
                  />
                </div>
              </SheetHeader>

              {/* ── Affectations ── */}
              <div className="pt-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" style={{ color: "#00C9A7" }} />
                    <h3 className="font-semibold text-sm" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                      Classes & Matières
                    </h3>
                  </div>
                  <button
                    onClick={() => {
                      affectForm.reset({ classe_id: "", matiere: "", annee_scolaire_id: anneeActive?.id ?? "" });
                      setAffectOpen(true);
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg"
                    style={{ background: "rgba(0,201,167,0.12)", color: "#00C9A7" }}
                  >
                    <Plus className="w-3 h-3" /> Affecter
                  </button>
                </div>

                {loadingAssignments ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-14 w-full rounded-xl" />
                    ))}
                  </div>
                ) : assignments.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 rounded-xl"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed var(--m15-border)" }}>
                    <BookOpen className="w-8 h-8 mb-2" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
                    <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucune affectation</p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)", opacity: 0.7 }}>
                      Cliquez sur « Affecter » pour assigner ce professeur à une classe
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {assignments.map((a) => (
                      <div key={a.id}
                        className="flex items-center gap-3 px-4 py-3 rounded-xl"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid var(--m15-border)" }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: "rgba(0,201,167,0.10)" }}>
                          <BookOpen className="w-4 h-4" style={{ color: "#00C9A7" }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                            {a.classe_nom}
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>
                            {a.matiere}
                            {a.annee_label && <span className="ml-2 opacity-60">· {a.annee_label}</span>}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRetirer(a)}
                          disabled={retirerMutation.isPending}
                          className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10"
                          title="Retirer de cette classe"
                        >
                          {retirerMutation.isPending
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "var(--m15-muted)" }} />
                            : <Trash2 className="w-3.5 h-3.5" style={{ color: "#FF4D6D" }} />
                          }
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══ Dialog Affecter à une classe ═══ */}
      <Dialog open={affectOpen} onOpenChange={setAffectOpen}>
        <DialogContent className="sm:max-w-[440px]" style={{ background: "var(--m15-card)" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Affecter à une classe
            </DialogTitle>
            <DialogDescription style={{ color: "var(--m15-muted)" }}>
              Choisissez la classe, la matière et l'année scolaire.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={affectForm.handleSubmit(onAffectSubmit)} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label style={{ color: "var(--m15-white)" }}>Classe *</Label>
              <Select
                value={affectForm.watch("classe_id")}
                onValueChange={v => affectForm.setValue("classe_id", v)}
              >
                <SelectTrigger style={{ background: "var(--m15-input, rgba(255,255,255,0.06))", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                  <SelectValue placeholder="Sélectionner une classe" />
                </SelectTrigger>
                <SelectContent>
                  {(classes?.classes ?? []).map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {affectForm.formState.errors.classe_id && (
                <p className="text-xs text-red-500">{affectForm.formState.errors.classe_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label style={{ color: "var(--m15-white)" }}>Matière *</Label>
              <Input
                placeholder="ex. Mathématiques, Français, SVT..."
                {...affectForm.register("matiere")}
                style={{ background: "var(--m15-input, rgba(255,255,255,0.06))", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
              />
              {affectForm.formState.errors.matiere && (
                <p className="text-xs text-red-500">{affectForm.formState.errors.matiere.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label style={{ color: "var(--m15-white)" }}>Année scolaire *</Label>
              <Select
                value={affectForm.watch("annee_scolaire_id")}
                onValueChange={v => affectForm.setValue("annee_scolaire_id", v)}
              >
                <SelectTrigger style={{ background: "var(--m15-input, rgba(255,255,255,0.06))", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                  <SelectValue placeholder="Sélectionner une année" />
                </SelectTrigger>
                <SelectContent>
                  {anneesArr.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.libelle}{a.est_active ? " (active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {affectForm.formState.errors.annee_scolaire_id && (
                <p className="text-xs text-red-500">{affectForm.formState.errors.annee_scolaire_id.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={affecterMutation.isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: "#00C9A7", color: "var(--m15-navy)", fontFamily: "'Syne', sans-serif" }}
            >
              {affecterMutation.isPending
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Affectation...</>
                : <><Plus className="w-4 h-4" /> Confirmer l'affectation</>
              }
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ═══ Dialog Ajouter un professeur ═══ */}
      <Dialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) { setNewPassword(null); addForm.reset(); } }}>
        <DialogContent className="sm:max-w-[480px]" style={{ background: "var(--m15-card)" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Ajouter un professeur
            </DialogTitle>
            <DialogDescription style={{ color: "var(--m15-muted)" }}>
              Un mot de passe temporaire sera généré automatiquement.
            </DialogDescription>
          </DialogHeader>

          {newPassword ? (
            <div className="py-6 space-y-5 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto"
                style={{ background: "rgba(0,201,167,0.12)" }}>
                <GraduationCap className="w-8 h-8" style={{ color: "#00C9A7" }} />
              </div>
              <div>
                <p className="font-semibold text-base" style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
                  Professeur créé !
                </p>
                <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
                  Communiquez ce mot de passe temporaire au professeur. Il devra le changer à sa première connexion.
                </p>
              </div>
              <div className="py-3 px-4 rounded-xl" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--m15-border)" }}>
                <p className="text-xs mb-2" style={{ color: "var(--m15-muted)" }}>Mot de passe temporaire</p>
                <div className="flex items-center justify-between gap-2">
                  <code className="text-2xl font-mono font-bold select-all" style={{ color: "#00C9A7", letterSpacing: "0.1em" }}>
                    {newPassword}
                  </code>
                  <button
                    onClick={() => copyToClipboard(newPassword!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-shrink-0"
                    style={{ background: copied ? "rgba(0,201,167,0.2)" : "rgba(0,201,167,0.08)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.25)" }}
                  >
                    {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? "Copié !" : "Copier"}
                  </button>
                </div>
              </div>
              <button
                className="w-full py-2.5 rounded-xl text-sm font-semibold"
                style={{ background: "#00C9A7", color: "var(--m15-navy)", fontFamily: "'Syne', sans-serif" }}
                onClick={() => { setAddOpen(false); setNewPassword(null); }}
              >
                Fermer
              </button>
            </div>
          ) : (
            <form onSubmit={addForm.handleSubmit(onAddSubmit)} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label style={{ color: "var(--m15-white)" }}>Nom *</Label>
                  <Input
                    {...addForm.register("nom")}
                    placeholder="KOUASSI"
                    style={{ background: "var(--m15-input, rgba(255,255,255,0.06))", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                  />
                  {addForm.formState.errors.nom && (
                    <p className="text-xs text-red-500">{addForm.formState.errors.nom.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label style={{ color: "var(--m15-white)" }}>Prénoms</Label>
                  <Input
                    {...addForm.register("prenoms")}
                    placeholder="Ange Marie"
                    style={{ background: "var(--m15-input, rgba(255,255,255,0.06))", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label style={{ color: "var(--m15-white)" }}>Email *</Label>
                <Input
                  type="email"
                  {...addForm.register("email")}
                  placeholder="a.kouassi@ecole.ci"
                  style={{ background: "var(--m15-input, rgba(255,255,255,0.06))", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                />
                {addForm.formState.errors.email && (
                  <p className="text-xs text-red-500">{addForm.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label style={{ color: "var(--m15-white)" }}>Téléphone</Label>
                <Input
                  {...addForm.register("telephone")}
                  placeholder="+225 07 XX XX XX XX"
                  style={{ background: "var(--m15-input, rgba(255,255,255,0.06))", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                />
              </div>

              <button
                type="submit"
                disabled={createMutation.isPending}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold mt-2"
                style={{ background: "#00C9A7", color: "var(--m15-navy)", fontFamily: "'Syne', sans-serif" }}
              >
                {createMutation.isPending
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Création...</>
                  : <><GraduationCap className="w-4 h-4" /> Créer le compte</>
                }
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
