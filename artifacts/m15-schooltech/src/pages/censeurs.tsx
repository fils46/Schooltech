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
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2, UserCog, Search, Phone, Mail, Calendar, Shield, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const censeurSchema = z.object({
  nom: z.string().min(1, "Requis"),
  prenoms: z.string().optional(),
  email: z.string().email("Email invalide"),
  telephone: z.string().optional(),
});
type CenseurForm = z.infer<typeof censeurSchema>;

export default function Censeurs() {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: utilisateurs, isLoading } = useListerUtilisateurs(
    { role: "censeur" },
    { query: { queryKey: getListerUtilisateursQueryKey({ role: "censeur" }) } }
  );

  const createMutation = useCreerUtilisateur();
  const activerMutation = useActiverUtilisateur();
  const desactiverMutation = useDesactiverUtilisateur();

  const form = useForm<CenseurForm>({
    resolver: zodResolver(censeurSchema),
    defaultValues: { nom: "", prenoms: "", email: "", telephone: "" },
  });

  const onSubmit = (data: CenseurForm) => {
    createMutation.mutate({
      data: {
        ...data,
        role: "censeur",
        etablissement_id: user?.etablissement_id ?? null,
      },
    }, {
      onSuccess: (res) => {
        qc.invalidateQueries({ queryKey: getListerUtilisateursQueryKey({ role: "censeur" }) });
        setNewPassword(res.passwordTemporaire);
        form.reset();
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
        qc.invalidateQueries({ queryKey: getListerUtilisateursQueryKey({ role: "censeur" }) });
        toast({ title: "Statut mis à jour" });
      },
      onError: (err) => {
        toast({ title: "Erreur", description: err.message, variant: "destructive" });
      },
    });
  };

  const filtered = (utilisateurs ?? []).filter(u =>
    search === "" ||
    `${u.nom} ${u.prenoms ?? ""} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const actifCount = (utilisateurs ?? []).filter(u => u.actif).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Censeurs
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--m15-muted)" }}>
            {utilisateurs?.length ?? 0} censeur{(utilisateurs?.length ?? 0) !== 1 ? "s" : ""} enregistré{(utilisateurs?.length ?? 0) !== 1 ? "s" : ""} · {actifCount} actif{actifCount !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{ background: "#00C9A7", color: "#0A1628", fontFamily: "'Syne', sans-serif" }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#00b396"}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "#00C9A7"}
        >
          <Plus className="w-4 h-4" /> Ajouter un censeur
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(0,201,167,0.12)" }}>
            <Shield className="w-5 h-5" style={{ color: "#00C9A7" }} />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              {isLoading ? "–" : utilisateurs?.length ?? 0}
            </p>
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>Total censeurs</p>
          </div>
        </div>
        <div className="rounded-2xl p-5 flex items-center gap-4"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: "rgba(0,128,255,0.12)" }}>
            <CheckCircle2 className="w-5 h-5" style={{ color: "#0080FF" }} />
          </div>
          <div>
            <p className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              {isLoading ? "–" : actifCount}
            </p>
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>Comptes actifs</p>
          </div>
        </div>
      </div>

      {/* Barre de recherche */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <Search className="w-4 h-4 flex-shrink-0" style={{ color: "var(--m15-muted)" }} />
        <input
          type="search"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un censeur..."
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: "var(--m15-white)", fontFamily: "'DM Sans', sans-serif" }}
        />
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-2xl" />
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 rounded-2xl"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <UserCog className="w-12 h-12 mb-4" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
            <p className="font-semibold" style={{ color: "var(--m15-white)" }}>
              {search ? "Aucun résultat" : "Aucun censeur enregistré"}
            </p>
            <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
              {search ? "Modifiez votre recherche" : "Cliquez sur « Ajouter un censeur » pour commencer"}
            </p>
          </div>
        ) : (
          filtered.map((u) => (
            <div key={u.id}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl transition-all"
              style={{
                background: "var(--m15-card)",
                border: "1px solid var(--m15-border)",
                opacity: u.actif ? 1 : 0.6,
              }}
            >
              {/* Avatar */}
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{
                  background: u.actif ? "linear-gradient(135deg, #00C9A7, #0080FF)" : "var(--elevate-2)",
                  color: "#fff",
                  fontFamily: "'Syne', sans-serif",
                }}>
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
                      Ajouté le {format(new Date(u.created_at), "d MMM yyyy", { locale: fr })}
                    </span>
                  )}
                </div>
              </div>

              {/* Badge statut + toggle */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <span className="px-2.5 py-1 rounded-full text-xs font-semibold"
                  style={{
                    background: u.actif ? "rgba(0,201,167,0.12)" : "rgba(255,77,109,0.10)",
                    color: u.actif ? "#00C9A7" : "#FF4D6D",
                  }}>
                  {u.actif ? "Actif" : "Suspendu"}
                </span>
                {(activerMutation.isPending || desactiverMutation.isPending) ? (
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--m15-muted)" }} />
                ) : (
                  <Switch
                    checked={u.actif}
                    onCheckedChange={() => handleToggle(u.id, u.actif)}
                    disabled={u.id === user?.id}
                  />
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal ajout */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setNewPassword(null); }}>
        <DialogContent className="sm:max-w-[480px]"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Ajouter un censeur
            </DialogTitle>
            <DialogDescription style={{ color: "var(--m15-muted)" }}>
              Un mot de passe temporaire sera généré automatiquement.
            </DialogDescription>
          </DialogHeader>

          {newPassword ? (
            <div className="py-6 space-y-4 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto"
                style={{ background: "rgba(0,201,167,0.12)" }}>
                <CheckCircle2 className="w-8 h-8" style={{ color: "#00C9A7" }} />
              </div>
              <p className="font-semibold text-lg" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
                Censeur créé avec succès !
              </p>
              <div className="rounded-xl p-4" style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)" }}>
                <p className="text-xs mb-2" style={{ color: "var(--m15-muted)" }}>Mot de passe temporaire :</p>
                <code className="text-xl font-mono font-bold select-all" style={{ color: "#F5C842" }}>
                  {newPassword}
                </code>
              </div>
              <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                Communiquez ce mot de passe au censeur. Il devra le changer à sa première connexion.
              </p>
              <button
                onClick={() => { setOpen(false); setNewPassword(null); }}
                className="w-full py-2.5 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "#00C9A7", color: "#0A1628" }}>
                Fermer
              </button>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label style={{ color: "var(--m15-muted)", fontSize: "12px" }}>NOM *</Label>
                  <Input {...form.register("nom")}
                    style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
                  {form.formState.errors.nom && (
                    <p className="text-xs" style={{ color: "#FF4D6D" }}>{form.formState.errors.nom.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label style={{ color: "var(--m15-muted)", fontSize: "12px" }}>PRÉNOMS</Label>
                  <Input {...form.register("prenoms")}
                    style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label style={{ color: "var(--m15-muted)", fontSize: "12px" }}>EMAIL *</Label>
                <Input type="email" {...form.register("email")}
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
                {form.formState.errors.email && (
                  <p className="text-xs" style={{ color: "#FF4D6D" }}>{form.formState.errors.email.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label style={{ color: "var(--m15-muted)", fontSize: "12px" }}>TÉLÉPHONE</Label>
                <Input {...form.register("telephone")}
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
                  Annuler
                </button>
                <button type="submit" disabled={createMutation.isPending}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: "#00C9A7", color: "#0A1628" }}>
                  {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Enregistrer
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
