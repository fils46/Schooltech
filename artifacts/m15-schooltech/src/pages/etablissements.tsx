import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useListerEtablissements, 
  useCreerEtablissement, 
  getListerEtablissementsQueryKey,
  EtablissementInputType 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Loader2, MoreHorizontal } from "lucide-react";
import { format } from "date-fns";

const etablissementSchema = z.object({
  nom: z.string().min(1, "Requis"),
  type: z.enum(["college", "lycee", "college_lycee"]),
  ville: z.string().min(1, "Requis"),
  telephone: z.string().optional(),
  email: z.string().email("Invalide").optional().or(z.literal("")),
  date_expiration_licence: z.string().optional(),
});

type EtablissementFormValues = z.infer<typeof etablissementSchema>;

export default function Etablissements() {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: etablissements, isLoading } = useListerEtablissements({
    query: { queryKey: getListerEtablissementsQueryKey() }
  });

  const createMutation = useCreerEtablissement();

  const form = useForm<EtablissementFormValues>({
    resolver: zodResolver(etablissementSchema),
    defaultValues: {
      nom: "",
      type: "college_lycee",
      ville: "",
      telephone: "",
      email: "",
      date_expiration_licence: ""
    },
  });

  const onSubmit = (data: EtablissementFormValues) => {
    createMutation.mutate({ 
      data: {
        ...data,
        type: data.type as EtablissementInputType,
        date_expiration_licence: data.date_expiration_licence ? new Date(data.date_expiration_licence).toISOString() : undefined
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListerEtablissementsQueryKey() });
        toast({ title: "Succès", description: "Établissement créé" });
        setOpen(false);
        form.reset();
      },
      onError: (err) => {
        toast({ title: "Erreur", description: err.message, variant: "destructive" });
      }
    });
  };

  const getTypeLabel = (type?: string | null) => {
    if (type === "college") return "Collège";
    if (type === "lycee") return "Lycée";
    return "Collège & Lycée";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Établissements</h1>
        
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouvel établissement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Ajouter un établissement</DialogTitle>
              <DialogDescription>
                Créez un nouvel établissement et configurez sa licence.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="nom">Nom de l'établissement *</Label>
                <Input id="nom" {...form.register("nom")} />
                {form.formState.errors.nom && <p className="text-xs text-destructive">{form.formState.errors.nom.message}</p>}
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type *</Label>
                  <Select onValueChange={(val) => form.setValue("type", val as any)} defaultValue={form.getValues("type")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="college">Collège</SelectItem>
                      <SelectItem value="lycee">Lycée</SelectItem>
                      <SelectItem value="college_lycee">Collège & Lycée</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="ville">Ville *</Label>
                  <Input id="ville" {...form.register("ville")} />
                  {form.formState.errors.ville && <p className="text-xs text-destructive">{form.formState.errors.ville.message}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="telephone">Téléphone</Label>
                  <Input id="telephone" {...form.register("telephone")} />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" {...form.register("email")} />
                  {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="date_expiration_licence">Date d'expiration de la licence</Label>
                <Input id="date_expiration_licence" type="date" {...form.register("date_expiration_licence")} />
              </div>

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
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-md border shadow-sm">
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
                <TableHead>Nom</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Ville</TableHead>
                <TableHead>Statut Licence</TableHead>
                <TableHead>Expiration</TableHead>
                <TableHead className="text-right">Utilisateurs</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {etablissements?.map((etab) => (
                <TableRow key={etab.id}>
                  <TableCell className="font-medium">{etab.nom}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="bg-accent/50 text-xs font-normal">
                      {getTypeLabel(etab.type)}
                    </Badge>
                  </TableCell>
                  <TableCell>{etab.ville}</TableCell>
                  <TableCell>
                    {etab.licence_active ? (
                      <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
                    ) : (
                      <Badge variant="destructive">Expirée</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {etab.date_expiration_licence ? format(new Date(etab.date_expiration_licence), "dd/MM/yyyy") : "-"}
                  </TableCell>
                  <TableCell className="text-right">{etab.nbUtilisateurs || 0}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {(!etablissements || etablissements.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Aucun établissement trouvé.
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
