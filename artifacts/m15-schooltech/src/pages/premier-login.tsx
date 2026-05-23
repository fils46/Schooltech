import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useChangePassword } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const changeSchema = z.object({
  ancienPassword: z.string().min(1, "Requis"),
  nouveauPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string(),
}).refine(data => data.nouveauPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"]
});

type ChangeFormValues = z.infer<typeof changeSchema>;

export default function PremierLogin() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const changeMutation = useChangePassword();

  const form = useForm<ChangeFormValues>({
    resolver: zodResolver(changeSchema),
    defaultValues: { ancienPassword: "", nouveauPassword: "", confirmPassword: "" },
  });

  const onSubmit = (data: ChangeFormValues) => {
    changeMutation.mutate({ 
      data: { 
        ancienPassword: data.ancienPassword, 
        nouveauPassword: data.nouveauPassword 
      } 
    }, {
      onSuccess: () => {
        toast({ title: "Succès", description: "Votre mot de passe a été mis à jour." });
        setLocation("/dashboard");
      },
      onError: (err) => {
        toast({ title: "Erreur", description: err.message, variant: "destructive" });
      }
    });
  };

  const passwordValue = form.watch("nouveauPassword");
  const strength = Math.min(100, (passwordValue?.length || 0) * 10);
  const strengthColor = strength < 40 ? "bg-destructive" : strength < 80 ? "bg-secondary" : "bg-primary";

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader>
          <CardTitle>Bienvenue {user?.prenoms} {user?.nom}</CardTitle>
          <CardDescription>Pour des raisons de sécurité, veuillez modifier le mot de passe temporaire fourni par votre administrateur.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ancienPassword">Mot de passe actuel</Label>
              <Input id="ancienPassword" type="password" {...form.register("ancienPassword")} />
              {form.formState.errors.ancienPassword && <p className="text-sm text-destructive">{form.formState.errors.ancienPassword.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="nouveauPassword">Nouveau mot de passe</Label>
              <Input id="nouveauPassword" type="password" {...form.register("nouveauPassword")} />
              {form.formState.errors.nouveauPassword && <p className="text-sm text-destructive">{form.formState.errors.nouveauPassword.message}</p>}
              
              <div className="h-1.5 w-full bg-secondary/20 rounded-full overflow-hidden mt-2">
                <div className={`h-full transition-all duration-300 ${strengthColor}`} style={{ width: `${strength}%` }} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <Input id="confirmPassword" type="password" {...form.register("confirmPassword")} />
              {form.formState.errors.confirmPassword && <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>}
            </div>

            <Button type="submit" className="w-full mt-6" disabled={changeMutation.isPending}>
              {changeMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Enregistrer et continuer
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
