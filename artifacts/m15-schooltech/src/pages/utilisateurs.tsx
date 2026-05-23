import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useListerUtilisateurs, 
  useCreerUtilisateur, 
  useActiverUtilisateur,
  useDesactiverUtilisateur,
  useListerEtablissements,
  getListerUtilisateursQueryKey,
  getListerEtablissementsQueryKey,
  UtilisateurInputRole
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Plus, Loader2 } from "lucide-react";
import { format } from "date-fns";

const roleColors: Record<string, string> = {
  dev: "bg-purple-500",
  directeur: "bg-blue-500",
  censeur: "bg-cyan-500",
  professeur: "bg-orange-500",
  eleve: "bg-green-500",
  parent: "bg-[var(--m15-card2)]"
};

const utilisateurSchema = z.object({
  nom: z.string().min(1, "Requis"),
  prenoms: z.string().optional(),
  email: z.string().email("Invalide"),
  telephone: z.string().optional(),
  role: z.enum(["dev", "directeur", "censeur", "professeur", "eleve", "parent"]),
  etablissement_id: z.string().optional()
});

type UtilisateurFormValues = z.infer<typeof utilisateurSchema>;

export default function Utilisateurs() {
  const [open, setOpen] = useState(false);
  const [newPassword, setNewPassword] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>("all");
  
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isDev = user?.role === "dev";

  const { data: utilisateurs, isLoading } = useListerUtilisateurs(
    { role: roleFilter !== "all" ? roleFilter : undefined },
    { query: { queryKey: getListerUtilisateursQueryKey({ role: roleFilter !== "all" ? roleFilter : undefined }) } }
  );

  const { data: etablissements } = useListerEtablissements(
    { query: { queryKey: getListerEtablissementsQueryKey(), enabled: isDev } }
  );

  const createMutation = useCreerUtilisateur();
  const activerMutation = useActiverUtilisateur();
  const desactiverMutation = useDesactiverUtilisateur();

  const form = useForm<UtilisateurFormValues>({
    resolver: zodResolver(utilisateurSchema),
    defaultValues: {
      nom: "",
      prenoms: "",
      email: "",
      telephone: "",
      role: isDev ? "directeur" : "professeur",
      etablissement_id: ""
    },
  });

  const onSubmit = (data: UtilisateurFormValues) => {
    createMutation.mutate({ 
      data: {
        ...data,
        role: data.role as UtilisateurInputRole,
        etablissement_id: data.etablissement_id || null
      }
    }, {
      onSuccess: (res) => {
        queryClient.invalidateQueries({ queryKey: getListerUtilisateursQueryKey() });
        toast({ title: "Succès", description: "Utilisateur créé avec succès" });
        setNewPassword(res.passwordTemporaire);
        form.reset();
      },
      onError: (err) => {
        toast({ title: "Erreur", description: err.message, variant: "destructive" });
      }
    });
  };

  const handleToggleActif = (id: string, currentlyActif: boolean) => {
    const mutation = currentlyActif ? desactiverMutation : activerMutation;
    mutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListerUtilisateursQueryKey() });
        toast({ title: "Statut mis à jour", description: `Le compte a été ${currentlyActif ? 'désactivé' : 'activé'}.` });
      },
      onError: (err) => {
        toast({ title: "Erreur", description: err.message, variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Utilisateurs</h1>
        
        <div className="flex items-center gap-2">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrer par rôle" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les rôles</SelectItem>
              {isDev && <SelectItem value="dev">Dev</SelectItem>}
              <SelectItem value="directeur">Directeur</SelectItem>
              <SelectItem value="censeur">Censeur</SelectItem>
              <SelectItem value="professeur">Professeur</SelectItem>
              <SelectItem value="eleve">Élève</SelectItem>
              <SelectItem value="parent">Parent</SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={open} onOpenChange={(val) => {
            setOpen(val);
            if (!val) setNewPassword(null);
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Ajouter un utilisateur</DialogTitle>
                <DialogDescription>
                  Un mot de passe temporaire sera généré automatiquement.
                </DialogDescription>
              </DialogHeader>
              
              {newPassword ? (
                <div className="py-6 space-y-4 text-center">
                  <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Plus className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-medium">Utilisateur créé !</h3>
                  <div className="bg-muted p-4 rounded-md">
                    <p className="text-sm text-muted-foreground mb-2">Mot de passe temporaire :</p>
                    <code className="text-xl font-mono bg-background px-3 py-1 rounded border shadow-sm select-all">
                      {newPassword}
                    </code>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Veuillez communiquer ce mot de passe à l'utilisateur. Il devra le changer lors de sa première connexion.
                  </p>
                  <Button className="w-full mt-4" onClick={() => { setOpen(false); setNewPassword(null); }}>
                    Fermer
                  </Button>
                </div>
              ) : (
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nom">Nom *</Label>
                      <Input id="nom" {...form.register("nom")} />
                      {form.formState.errors.nom && <p className="text-xs text-destructive">{form.formState.errors.nom.message}</p>}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="prenoms">Prénoms</Label>
                      <Input id="prenoms" {...form.register("prenoms")} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email *</Label>
                    <Input id="email" type="email" {...form.register("email")} />
                    {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="telephone">Téléphone</Label>
                      <Input id="telephone" {...form.register("telephone")} />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Rôle *</Label>
                      <Select onValueChange={(val) => form.setValue("role", val as any)} defaultValue={form.getValues("role")}>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {isDev ? (
                            <SelectItem value="directeur">Directeur</SelectItem>
                          ) : (
                            <>
                              <SelectItem value="censeur">Censeur</SelectItem>
                              <SelectItem value="professeur">Professeur</SelectItem>
                              <SelectItem value="eleve">Élève</SelectItem>
                              <SelectItem value="parent">Parent</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {isDev && (
                    <div className="space-y-2">
                      <Label>Établissement</Label>
                      <Select
                        onValueChange={(val) => form.setValue("etablissement_id", val === "__none__" ? "" : val)}
                        defaultValue={form.getValues("etablissement_id") || "__none__"}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Aucun (Administrateur Global)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Aucun (Administrateur Global)</SelectItem>
                          {etablissements?.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="flex justify-end pt-4">
                    <Button type="button" variant="outline" onClick={() => setOpen(false)} className="mr-2">
                      Annuler
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending}>
                      {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                      Enregistrer
                    </Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-card rounded-md border shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom & Prénoms</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Créé le</TableHead>
                <TableHead className="text-right">Actif</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {utilisateurs?.map((u) => (
                <TableRow key={u.id} className={!u.actif ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="font-medium">{u.nom} {u.prenoms}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${roleColors[u.role] || 'bg-[var(--m15-card2)]'} hover:opacity-80 text-[var(--m15-white)] capitalize`}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.telephone || "-"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {u.created_at ? format(new Date(u.created_at), "dd/MM/yyyy") : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {activerMutation.isPending || desactiverMutation.isPending ? (
                         <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Switch 
                          checked={u.actif} 
                          onCheckedChange={() => handleToggleActif(u.id, u.actif)}
                          disabled={u.id === user?.id} // Cannot disable self
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(!utilisateurs || utilisateurs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Aucun utilisateur trouvé.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
