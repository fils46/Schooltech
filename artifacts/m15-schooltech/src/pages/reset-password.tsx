import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { useResetPassword } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PasswordInput } from "@/components/ui/password-input";
import { Loader2 } from "lucide-react";
import { useMemo } from "react";

const resetSchema = z.object({
  newPassword: z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères"),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Les mots de passe ne correspondent pas",
  path: ["confirmPassword"]
});

type ResetFormValues = z.infer<typeof resetSchema>;

export default function ResetPassword() {
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const resetMutation = useResetPassword();

  const token = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("token") || "";
  }, []);

  const form = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  const onSubmit = (data: ResetFormValues) => {
    if (!token) {
      toast({ title: "Erreur", description: "Jeton de réinitialisation manquant.", variant: "destructive" });
      return;
    }

    resetMutation.mutate({ data: { token, newPassword: data.newPassword } }, {
      onSuccess: () => {
        toast({ title: "Succès", description: "Votre mot de passe a été réinitialisé." });
        setLocation("/login");
      },
      onError: (err) => {
        toast({ title: "Erreur", description: err.message, variant: "destructive" });
      }
    });
  };

  const passwordValue = form.watch("newPassword");
  const strength = Math.min(100, (passwordValue?.length || 0) * 10);
  const strengthColor = strength < 40 ? "bg-destructive" : strength < 80 ? "bg-secondary" : "bg-primary";

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="max-w-md w-full"><CardContent className="p-6 text-center text-destructive">Lien invalide ou expiré.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader>
          <CardTitle>Nouveau mot de passe</CardTitle>
          <CardDescription>Veuillez choisir un nouveau mot de passe sécurisé.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nouveau mot de passe</Label>
              <PasswordInput id="newPassword" {...form.register("newPassword")} />
              {form.formState.errors.newPassword && <p className="text-sm text-destructive">{form.formState.errors.newPassword.message}</p>}
              
              <div className="h-1.5 w-full bg-secondary/20 rounded-full overflow-hidden mt-2">
                <div className={`h-full transition-all duration-300 ${strengthColor}`} style={{ width: `${strength}%` }} />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmer le mot de passe</Label>
              <PasswordInput id="confirmPassword" {...form.register("confirmPassword")} />
              {form.formState.errors.confirmPassword && <p className="text-sm text-destructive">{form.formState.errors.confirmPassword.message}</p>}
            </div>

            <Button type="submit" className="w-full" disabled={resetMutation.isPending}>
              {resetMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Réinitialiser
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
