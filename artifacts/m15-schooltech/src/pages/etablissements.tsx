import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useListerEtablissements,
  useCreerEtablissement,
  useUpdateEtablissement,
  useSupprimerEtablissement,
  useActiverEtablissement,
  useDesactiverEtablissement,
  getListerEtablissementsQueryKey,
  type Etablissement,
  type EtablissementInputType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Loader2,
  Building2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Pencil,
  Trash2,
  Power,
  PowerOff,
  Users,
  Eye,
  CalendarClock,
} from "lucide-react";
import { format, differenceInDays, parseISO } from "date-fns";
import { fr } from "date-fns/locale";

/* ─── Helpers ─────────────────────────────────────────────── */

function daysUntilExpiry(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  try {
    return differenceInDays(parseISO(dateStr), new Date());
  } catch {
    return null;
  }
}

function getTypeLabel(type?: string | null) {
  if (type === "college") return "Collège";
  if (type === "lycee") return "Lycée";
  return "Collège & Lycée";
}

function TypeBadge({ type }: { type?: string | null }) {
  const color = type === "college" ? "#0080FF" : type === "lycee" ? "#A78BFA" : "#00C9A7";
  return (
    <span
      className="px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: `${color}20`, color, border: `1px solid ${color}40` }}
    >
      {getTypeLabel(type)}
    </span>
  );
}

function LicenceBadge({ active }: { active: boolean }) {
  return active ? (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "#00C9A720", color: "#00C9A7", border: "1px solid #00C9A740" }}
    >
      <CheckCircle2 className="w-3 h-3" /> Active
    </span>
  ) : (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: "#FF4D6D20", color: "#FF4D6D", border: "1px solid #FF4D6D40" }}
    >
      <XCircle className="w-3 h-3" /> Suspendue
    </span>
  );
}

/* ─── Schéma Zod ───────────────────────────────────────────── */

const etablissementSchema = z.object({
  nom: z.string().min(1, "Requis"),
  type: z.enum(["college", "lycee", "college_lycee"]),
  ville: z.string().min(1, "Requis"),
  telephone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  adresse: z.string().optional(),
  nombre_eleves_max: z.coerce.number().int().min(1).optional(),
  date_expiration_licence: z.string().optional(),
});

type EtabFormValues = z.infer<typeof etablissementSchema>;

/* ─── Composant formulaire partagé ───────────────────────────── */

function EtabForm({
  defaultValues,
  onSubmit,
  isPending,
  onCancel,
}: {
  defaultValues?: Partial<EtabFormValues>;
  onSubmit: (data: EtabFormValues) => void;
  isPending: boolean;
  onCancel: () => void;
}) {
  const form = useForm<EtabFormValues>({
    resolver: zodResolver(etablissementSchema),
    defaultValues: {
      nom: "",
      type: "college_lycee",
      ville: "",
      telephone: "",
      email: "",
      adresse: "",
      nombre_eleves_max: 500,
      date_expiration_licence: "",
      ...defaultValues,
    },
  });

  const inputStyle = {
    background: "var(--m15-card)",
    border: "1px solid var(--m15-border)",
    color: "var(--m15-white)",
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label style={{ color: "var(--m15-muted)" }}>Nom de l'établissement *</Label>
        <Input {...form.register("nom")} style={inputStyle} placeholder="Ex : Lycée Moderne d'Abidjan" />
        {form.formState.errors.nom && <p className="text-xs text-destructive">{form.formState.errors.nom.message}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label style={{ color: "var(--m15-muted)" }}>Type *</Label>
          <Select
            onValueChange={(v) => form.setValue("type", v as EtabFormValues["type"])}
            defaultValue={form.getValues("type")}
          >
            <SelectTrigger style={inputStyle}>
              <SelectValue placeholder="Sélectionner..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="college">Collège</SelectItem>
              <SelectItem value="lycee">Lycée</SelectItem>
              <SelectItem value="college_lycee">Collège & Lycée</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label style={{ color: "var(--m15-muted)" }}>Ville *</Label>
          <Input {...form.register("ville")} style={inputStyle} placeholder="Ex : Abidjan" />
          {form.formState.errors.ville && <p className="text-xs text-destructive">{form.formState.errors.ville.message}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label style={{ color: "var(--m15-muted)" }}>Téléphone</Label>
          <Input {...form.register("telephone")} style={inputStyle} placeholder="+225 XX XX XX XX" />
        </div>
        <div className="space-y-1.5">
          <Label style={{ color: "var(--m15-muted)" }}>Email</Label>
          <Input {...form.register("email")} type="email" style={inputStyle} placeholder="contact@ecole.ci" />
          {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label style={{ color: "var(--m15-muted)" }}>Adresse complète</Label>
        <Input {...form.register("adresse")} style={inputStyle} placeholder="Quartier, rue, commune..." />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label style={{ color: "var(--m15-muted)" }}>Capacité max élèves</Label>
          <Input {...form.register("nombre_eleves_max")} type="number" min={1} style={inputStyle} />
        </div>
        <div className="space-y-1.5">
          <Label style={{ color: "var(--m15-muted)" }}>Expiration licence</Label>
          <Input {...form.register("date_expiration_licence")} type="date" style={inputStyle} />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Annuler</Button>
        <Button
          type="submit"
          disabled={isPending}
          style={{ background: "#00C9A7", color: "#fff" }}
        >
          {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Enregistrer
        </Button>
      </div>
    </form>
  );
}

/* ─── Composant Detail ──────────────────────────────────────── */

function EtabDetail({ etab }: { etab: Etablissement }) {
  const days = daysUntilExpiry(etab.date_expiration_licence);

  return (
    <div className="space-y-5 py-2">
      {days !== null && days <= 30 && days >= 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
          style={{ background: "#F5C84220", color: "#F5C842", border: "1px solid #F5C84240" }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" />
          La licence expire dans {days} jour{days > 1 ? "s" : ""}
        </div>
      )}
      {days !== null && days < 0 && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium"
          style={{ background: "#FF4D6D20", color: "#FF4D6D", border: "1px solid #FF4D6D40" }}
        >
          <XCircle className="w-4 h-4 shrink-0" />
          Licence expirée depuis {Math.abs(days)} jour{Math.abs(days) > 1 ? "s" : ""}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-sm">
        {[
          ["Nom", etab.nom],
          ["Type", getTypeLabel(etab.type)],
          ["Ville", etab.ville ?? "-"],
          ["Téléphone", etab.telephone ?? "-"],
          ["Email", etab.email ?? "-"],
          ["Adresse", etab.adresse ?? "-"],
          ["Capacité max", etab.nombre_eleves_max != null ? `${etab.nombre_eleves_max} élèves` : "500 élèves"],
          [
            "Expiration licence",
            etab.date_expiration_licence
              ? format(parseISO(etab.date_expiration_licence), "dd MMMM yyyy", { locale: fr })
              : "-",
          ],
          [
            "Créé le",
            etab.created_at ? format(new Date(etab.created_at), "dd/MM/yyyy", { locale: fr }) : "-",
          ],
        ].map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl p-3"
            style={{ background: "var(--elevate-1)" }}
          >
            <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--m15-muted)" }}>
              {label}
            </div>
            <div style={{ color: "var(--m15-white)" }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-3 rounded-xl" style={{ background: "var(--elevate-1)" }}>
        <span className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>Statut licence</span>
        <LicenceBadge active={etab.licence_active} />
      </div>

      <div className="flex items-center justify-between px-3 py-3 rounded-xl" style={{ background: "var(--elevate-1)" }}>
        <span className="text-sm font-medium" style={{ color: "var(--m15-white)" }}>Utilisateurs</span>
        <span className="font-bold" style={{ color: "#00C9A7" }}>{etab.nbUtilisateurs ?? 0}</span>
      </div>
    </div>
  );
}

/* ─── Compteur / stat card ──────────────────────────────────── */

function StatPill({ value, label, color, icon: Icon }: {
  value: number;
  label: string;
  color: string;
  icon: React.ElementType;
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl flex-1"
      style={{ background: "var(--m15-card)", border: `1px solid ${color}25` }}
    >
      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: `${color}18` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <div className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color }}>
          {value}
        </div>
        <div className="text-xs font-medium" style={{ color: "var(--m15-muted)" }}>{label}</div>
      </div>
    </div>
  );
}

/* ─── Page principale ──────────────────────────────────────── */

type ModalState =
  | { kind: "closed" }
  | { kind: "create" }
  | { kind: "edit"; etab: Etablissement }
  | { kind: "detail"; etab: Etablissement }
  | { kind: "delete"; etab: Etablissement };

export default function Etablissements() {
  const [modal, setModal] = useState<ModalState>({ kind: "closed" });
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListerEtablissementsQueryKey() });

  const { data: etablissements, isLoading } = useListerEtablissements({
    query: { queryKey: getListerEtablissementsQueryKey() },
  });

  const createMutation = useCreerEtablissement();
  const updateMutation = useUpdateEtablissement();
  const deleteMutation = useSupprimerEtablissement();
  const activerMutation = useActiverEtablissement();
  const desactiverMutation = useDesactiverEtablissement();

  /* Stats */
  const stats = useMemo(() => {
    if (!etablissements) return { total: 0, actifs: 0, suspendus: 0, expirent: 0 };
    const total = etablissements.length;
    const actifs = etablissements.filter((e) => e.licence_active).length;
    const suspendus = total - actifs;
    const expirent = etablissements.filter((e) => {
      const d = daysUntilExpiry(e.date_expiration_licence);
      return d !== null && d >= 0 && d <= 30;
    }).length;
    return { total, actifs, suspendus, expirent };
  }, [etablissements]);

  /* Filtrage */
  const filtered = useMemo(() => {
    if (!etablissements) return [];
    const q = search.toLowerCase().trim();
    if (!q) return etablissements;
    return etablissements.filter(
      (e) =>
        e.nom.toLowerCase().includes(q) ||
        (e.ville ?? "").toLowerCase().includes(q)
    );
  }, [etablissements, search]);

  /* Handlers */
  function handleCreate(data: EtabFormValues) {
    createMutation.mutate(
      {
        data: {
          ...data,
          type: data.type as EtablissementInputType,
          date_expiration_licence: data.date_expiration_licence || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Établissement créé" });
          invalidate();
          setModal({ kind: "closed" });
        },
        onError: (err) =>
          toast({ title: "Erreur", description: err.message, variant: "destructive" }),
      }
    );
  }

  function handleEdit(data: EtabFormValues) {
    if (modal.kind !== "edit") return;
    updateMutation.mutate(
      {
        id: modal.etab.id,
        data: {
          ...data,
          date_expiration_licence: data.date_expiration_licence || null,
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Établissement mis à jour" });
          invalidate();
          setModal({ kind: "closed" });
        },
        onError: (err) =>
          toast({ title: "Erreur", description: err.message, variant: "destructive" }),
      }
    );
  }

  function handleDelete() {
    if (modal.kind !== "delete") return;
    deleteMutation.mutate(
      { id: modal.etab.id },
      {
        onSuccess: () => {
          toast({ title: "Établissement supprimé" });
          invalidate();
          setModal({ kind: "closed" });
        },
        onError: (err) =>
          toast({ title: "Erreur", description: err.message, variant: "destructive" }),
      }
    );
  }

  function handleActiver(etab: Etablissement) {
    activerMutation.mutate(
      { id: etab.id },
      {
        onSuccess: () => {
          toast({ title: "Licence activée", description: "Tous les comptes ont été réactivés." });
          invalidate();
        },
        onError: (err) =>
          toast({ title: "Erreur", description: err.message, variant: "destructive" }),
      }
    );
  }

  function handleDesactiver(etab: Etablissement) {
    desactiverMutation.mutate(
      { id: etab.id },
      {
        onSuccess: () => {
          toast({
            title: "Licence suspendue",
            description: "Tous les comptes ont été désactivés.",
            variant: "destructive",
          });
          invalidate();
        },
        onError: (err) =>
          toast({ title: "Erreur", description: err.message, variant: "destructive" }),
      }
    );
  }

  /* ─── Rendu ─────────────────────────────────────────────── */

  const anyPending =
    activerMutation.isPending || desactiverMutation.isPending;

  return (
    <div className="space-y-6 p-1">
      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}
          >
            Établissements
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--m15-muted)" }}>
            Gérez les établissements et leurs licences
          </p>
        </div>
        <Button
          onClick={() => setModal({ kind: "create" })}
          className="gap-2"
          style={{ background: "#00C9A7", color: "#fff" }}
        >
          <Plus className="w-4 h-4" />
          Nouvel établissement
        </Button>
      </div>

      {/* Stat pills */}
      <div className="flex gap-3">
        <StatPill value={stats.total} label="Total" color="#0080FF" icon={Building2} />
        <StatPill value={stats.actifs} label="Actifs" color="#00C9A7" icon={CheckCircle2} />
        <StatPill value={stats.suspendus} label="Suspendus" color="#FF4D6D" icon={XCircle} />
        <StatPill value={stats.expirent} label="Expirent bientôt" color="#F5C842" icon={CalendarClock} />
      </div>

      {/* Barre de recherche */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          style={{ color: "var(--m15-muted)" }}
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou ville..."
          className="w-full rounded-xl pl-9 pr-4 py-2.5 text-sm outline-none transition-all"
          style={{
            background: "var(--m15-card)",
            border: "1px solid var(--m15-border)",
            color: "var(--m15-white)",
            fontFamily: "'DM Sans', sans-serif",
          }}
          onFocus={(e) => { e.target.style.borderColor = "#00C9A7"; }}
          onBlur={(e) => { e.target.style.borderColor = "var(--m15-border)"; }}
        />
      </div>

      {/* Tableau */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--m15-card)", border: "1px solid rgba(0,201,167,0.08)" }}
      >
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(0,201,167,0.08)" }}>
                {["Établissement", "Statut", "Expiration", "Utilisateurs", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-widest"
                    style={{ color: "var(--m15-muted)" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((etab) => {
                const days = daysUntilExpiry(etab.date_expiration_licence);
                const expiringSoon = days !== null && days >= 0 && days <= 30;
                const expired = days !== null && days < 0;

                return (
                  <tr
                    key={etab.id}
                    style={{
                      borderBottom: "1px solid rgba(0,201,167,0.05)",
                      background: expiringSoon
                        ? "rgba(245,200,66,0.04)"
                        : expired
                        ? "rgba(255,77,109,0.04)"
                        : "transparent",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.background = "var(--elevate-1)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.background = expiringSoon
                        ? "rgba(245,200,66,0.04)"
                        : expired
                        ? "rgba(255,77,109,0.04)"
                        : "transparent";
                    }}
                  >
                    {/* Nom + ville + type */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                          style={{ background: "#0080FF18" }}
                        >
                          <Building2 className="w-4 h-4" style={{ color: "#0080FF" }} />
                        </div>
                        <div>
                          <div className="font-semibold" style={{ color: "var(--m15-white)" }}>
                            {etab.nom}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs" style={{ color: "var(--m15-muted)" }}>
                              {etab.ville ?? "—"}
                            </span>
                            <TypeBadge type={etab.type} />
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Statut */}
                    <td className="px-4 py-3">
                      <LicenceBadge active={etab.licence_active} />
                    </td>

                    {/* Expiration */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {etab.date_expiration_licence ? (
                          <>
                            <span style={{ color: expiringSoon || expired ? "#F5C842" : "var(--m15-muted)" }}>
                              {format(parseISO(etab.date_expiration_licence), "dd/MM/yyyy")}
                            </span>
                            {expiringSoon && (
                              <AlertTriangle className="w-3.5 h-3.5" style={{ color: "#F5C842" }} />
                            )}
                            {expired && (
                              <XCircle className="w-3.5 h-3.5" style={{ color: "#FF4D6D" }} />
                            )}
                          </>
                        ) : (
                          <span style={{ color: "var(--m15-muted)" }}>—</span>
                        )}
                      </div>
                    </td>

                    {/* Utilisateurs */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" style={{ color: "var(--m15-muted)" }} />
                        <span style={{ color: "var(--m15-white)" }}>{etab.nbUtilisateurs ?? 0}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {/* Voir */}
                        <ActionBtn
                          icon={Eye}
                          label="Voir"
                          color="#0080FF"
                          onClick={() => setModal({ kind: "detail", etab })}
                        />
                        {/* Modifier */}
                        <ActionBtn
                          icon={Pencil}
                          label="Modifier"
                          color="#00C9A7"
                          onClick={() => setModal({ kind: "edit", etab })}
                        />
                        {/* Activer / Désactiver */}
                        {etab.licence_active ? (
                          <ActionBtn
                            icon={PowerOff}
                            label="Désactiver"
                            color="#FF4D6D"
                            disabled={anyPending}
                            onClick={() => handleDesactiver(etab)}
                          />
                        ) : (
                          <ActionBtn
                            icon={Power}
                            label="Activer"
                            color="#00C9A7"
                            disabled={anyPending}
                            onClick={() => handleActiver(etab)}
                          />
                        )}
                        {/* Supprimer */}
                        <ActionBtn
                          icon={Trash2}
                          label="Supprimer"
                          color="#FF4D6D"
                          onClick={() => setModal({ kind: "delete", etab })}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center py-12 text-sm"
                    style={{ color: "var(--m15-muted)" }}
                  >
                    {search
                      ? "Aucun résultat pour cette recherche."
                      : "Aucun établissement enregistré."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal Création ──────────────────────────────────── */}
      <Dialog
        open={modal.kind === "create"}
        onOpenChange={(o) => !o && setModal({ kind: "closed" })}
      >
        <DialogContent className="sm:max-w-[540px]" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              Nouvel établissement
            </DialogTitle>
            <DialogDescription style={{ color: "var(--m15-muted)" }}>
              Remplissez les informations de l'établissement.
            </DialogDescription>
          </DialogHeader>
          <EtabForm
            onSubmit={handleCreate}
            isPending={createMutation.isPending}
            onCancel={() => setModal({ kind: "closed" })}
          />
        </DialogContent>
      </Dialog>

      {/* ── Modal Édition ───────────────────────────────────── */}
      <Dialog
        open={modal.kind === "edit"}
        onOpenChange={(o) => !o && setModal({ kind: "closed" })}
      >
        <DialogContent className="sm:max-w-[540px]" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              Modifier l'établissement
            </DialogTitle>
            <DialogDescription style={{ color: "var(--m15-muted)" }}>
              {modal.kind === "edit" ? modal.etab.nom : ""}
            </DialogDescription>
          </DialogHeader>
          {modal.kind === "edit" && (
            <EtabForm
              defaultValues={{
                nom: modal.etab.nom,
                type: (modal.etab.type as EtabFormValues["type"]) ?? "college_lycee",
                ville: modal.etab.ville ?? "",
                telephone: modal.etab.telephone ?? "",
                email: modal.etab.email ?? "",
                adresse: modal.etab.adresse ?? "",
                nombre_eleves_max: modal.etab.nombre_eleves_max ?? 500,
                date_expiration_licence: modal.etab.date_expiration_licence ?? "",
              }}
              onSubmit={handleEdit}
              isPending={updateMutation.isPending}
              onCancel={() => setModal({ kind: "closed" })}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal Détail ─────────────────────────────────────── */}
      <Dialog
        open={modal.kind === "detail"}
        onOpenChange={(o) => !o && setModal({ kind: "closed" })}
      >
        <DialogContent className="sm:max-w-[540px]" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              {modal.kind === "detail" ? modal.etab.nom : ""}
            </DialogTitle>
            <DialogDescription style={{ color: "var(--m15-muted)" }}>
              Informations complètes de l'établissement
            </DialogDescription>
          </DialogHeader>
          {modal.kind === "detail" && <EtabDetail etab={modal.etab} />}
        </DialogContent>
      </Dialog>

      {/* ── Confirmation suppression ─────────────────────────── */}
      <AlertDialog
        open={modal.kind === "delete"}
        onOpenChange={(o) => !o && setModal({ kind: "closed" })}
      >
        <AlertDialogContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <AlertDialogHeader>
            <AlertDialogTitle style={{ color: "var(--m15-white)" }}>
              Supprimer l'établissement ?
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: "var(--m15-muted)" }}>
              Cette action est irréversible.{" "}
              <strong style={{ color: "#FF4D6D" }}>
                {modal.kind === "delete" ? modal.etab.nom : ""}
              </strong>{" "}
              sera définitivement supprimé. Si des utilisateurs sont encore rattachés,
              la suppression sera bloquée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setModal({ kind: "closed" })}>
              Annuler
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              style={{ background: "#FF4D6D", color: "#fff" }}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ─── Bouton action icône ───────────────────────────────────── */

function ActionBtn({
  icon: Icon,
  label,
  color,
  onClick,
  disabled,
}: {
  icon: React.ElementType;
  label: string;
  color: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-40"
      style={{ color: "var(--m15-muted)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = `${color}18`;
        (e.currentTarget as HTMLElement).style.color = color;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
        (e.currentTarget as HTMLElement).style.color = "var(--m15-muted)";
      }}
    >
      <Icon className="w-3.5 h-3.5" />
    </button>
  );
}
