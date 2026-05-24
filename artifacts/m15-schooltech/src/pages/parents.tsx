import { useState } from "react";
import {
  useListerUtilisateurs,
  useActiverUtilisateur,
  useDesactiverUtilisateur,
  useReinitialiserMotDePasse,
  getListerUtilisateursQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { KeyRound, UserCircle, Search } from "lucide-react";
import { format } from "date-fns";

export default function Parents() {
  const [search, setSearch] = useState("");
  const [resetTarget, setResetTarget] = useState<{ id: string; nom: string } | null>(null);
  const [resetPassword, setResetPassword] = useState<string | null>(null);

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rawData, isLoading } = useListerUtilisateurs(
    { etablissement_id: user?.role !== "dev" ? user?.etablissement_id ?? undefined : undefined, role: "parent" },
  );

  const { mutate: activer }   = useActiverUtilisateur();
  const { mutate: desactiver } = useDesactiverUtilisateur();
  const { mutate: reinitMdp, isPending: reinitPending } = useReinitialiserMotDePasse();

  const utilisateurs = (rawData ?? []).filter((u: { nom: string; prenoms?: string | null; email: string }) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.nom.toLowerCase().includes(q) ||
      (u.prenoms ?? "").toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListerUtilisateursQueryKey() });

  const handleToggle = (id: string, actif: boolean) => {
    if (actif) {
      desactiver({ id }, { onSuccess: invalidate, onError: () => toast({ title: "Erreur", variant: "destructive" }) });
    } else {
      activer({ id }, { onSuccess: invalidate, onError: () => toast({ title: "Erreur", variant: "destructive" }) });
    }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--m15-white)] flex items-center gap-2">
            <UserCircle className="h-7 w-7 text-[var(--m15-cyan)]" />
            Parents
          </h1>
          <p className="text-[var(--m15-muted)] text-sm mt-1">
            {utilisateurs.length} parent(s) enregistré(s)
          </p>
        </div>
      </div>

      {/* Recherche */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--m15-muted)]" />
        <Input
          placeholder="Rechercher un parent…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)]"
        />
      </div>

      {/* Tableau */}
      <div className="rounded-xl border border-[var(--m15-border)] overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-[var(--m15-border)]">
              <TableHead className="text-[var(--m15-muted)]">Nom</TableHead>
              <TableHead className="text-[var(--m15-muted)]">Email</TableHead>
              <TableHead className="text-[var(--m15-muted)]">Téléphone</TableHead>
              <TableHead className="text-[var(--m15-muted)]">Inscrit le</TableHead>
              <TableHead className="text-[var(--m15-muted)]">Statut</TableHead>
              <TableHead className="text-[var(--m15-muted)] text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i} className="border-[var(--m15-border)]">
                  {Array.from({ length: 6 }).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-24" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : utilisateurs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-[var(--m15-muted)] py-10">
                  Aucun parent trouvé
                </TableCell>
              </TableRow>
            ) : (
              utilisateurs.map(u => (
                <TableRow key={u.id} className="border-[var(--m15-border)]">
                  <TableCell className="text-[var(--m15-white)] font-medium">
                    {u.prenoms} {u.nom}
                  </TableCell>
                  <TableCell className="text-[var(--m15-muted)]">{u.email}</TableCell>
                  <TableCell className="text-[var(--m15-muted)]">{u.telephone ?? "—"}</TableCell>
                  <TableCell className="text-[var(--m15-muted)]">
                    {u.created_at ? format(new Date(u.created_at), "dd/MM/yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={u.actif ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
                      {u.actif ? "Actif" : "Inactif"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <Switch
                        checked={!!u.actif}
                        onCheckedChange={() => handleToggle(u.id, !!u.actif)}
                        title={u.actif ? "Désactiver" : "Activer"}
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-[var(--m15-border)] text-[var(--m15-muted)] hover:text-[var(--m15-white)]"
                        onClick={() => { setResetPassword(null); setResetTarget({ id: u.id, nom: `${u.prenoms} ${u.nom}` }); }}
                      >
                        <KeyRound className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Modale réinitialisation mot de passe */}
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
              <p className="text-[var(--m15-muted)] text-xs">Communiquez ce mot de passe à l'utilisateur. Il devra le changer à sa prochaine connexion.</p>
              <Button className="w-full" onClick={() => { setResetTarget(null); setResetPassword(null); }}>Fermer</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[var(--m15-muted)] text-sm">
                Réinitialiser le mot de passe de <span className="text-[var(--m15-white)] font-medium">{resetTarget?.nom}</span> ?
                Un mot de passe temporaire sera généré.
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
