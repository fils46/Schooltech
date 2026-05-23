import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { useForgotPassword } from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, CheckCircle2 } from "lucide-react";

const forgotSchema = z.object({
  email: z.string().email("Adresse email invalide"),
});

export default function ForgotPassword() {
  const { toast } = useToast();
  const forgotMutation = useForgotPassword();

  const form = useForm<{ email: string }>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: { email: string }) => {
    forgotMutation.mutate({ data }, {
      onSuccess: () => {
        toast({
          title: "Email envoyé",
          description: "Si un compte existe avec cette adresse, un lien de réinitialisation a été envoyé.",
        });
      },
      onError: (err) => {
        toast({
          title: "Erreur",
          description: err.message || "Une erreur s'est produite.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md shadow-lg border-primary/10">
        <CardHeader>
          <CardTitle>Mot de passe oublié</CardTitle>
          <CardDescription>Entrez votre adresse email pour recevoir un lien de réinitialisation.</CardDescription>
        </CardHeader>
        <CardContent>
          {forgotMutation.isSuccess ? (
            <div className="flex flex-col items-center justify-center py-6 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-primary" />
              <p className="text-sm text-muted-foreground">
                Un email contenant les instructions pour réinitialiser votre mot de passe a été envoyé.
              </p>
              <Link href="/login" className="block mt-4">
                <Button variant="outline" className="w-full">
                  Retour à la connexion
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Adresse email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="nom@etablissement.edu.ci" 
                  {...form.register("email")} 
                />
                {form.formState.errors.email && (
                  <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                )}
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={forgotMutation.isPending}
              >
                {forgotMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Envoyer le lien
              </Button>

              <div className="text-center mt-4">
                <Link href="/login" className="text-sm text-muted-foreground hover:text-primary flex items-center justify-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Retour
                </Link>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
