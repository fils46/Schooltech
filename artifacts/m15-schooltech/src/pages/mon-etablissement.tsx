import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetMonEtablissement,
  useUpdateMonEtablissement,
  getGetMonEtablissementQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CarteUploadIdentite } from "@/components/etablissement/CarteUploadIdentite";
import {
  Building2, MapPin, Phone, Mail, ShieldCheck, ShieldOff,
  CalendarClock, Pencil, X, Check, AlertTriangle, Clock,
  Globe, FileText, Sparkles,
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  college: "Collège",
  lycee: "Lycée",
  college_lycee: "Collège & Lycée",
};

const LICENCE_TYPES: Record<string, string> = {
  mensuel: "Mensuelle",
  trimestriel: "Trimestrielle",
  annuel: "Annuelle",
  essai: "Essai",
};

const editSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  ville: z.string().optional(),
  telephone: z.string().optional(),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  adresse: z.string().optional(),
  email_contact: z.string().email("Email invalide").optional().or(z.literal("")),
  bp: z.string().optional(),
  site_web: z.string().optional(),
  devise: z.string().optional(),
});

type EditForm = z.infer<typeof editSchema>;

function joursRestants(date: string | null | undefined): number | null {
  if (!date) return null;
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / 86_400_000);
}

export default function MonEtablissement() {
  const { user, token } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isDirecteur = user?.role === "directeur";
  const [editing, setEditing] = useState(false);

  const { data: etab, isLoading } = useGetMonEtablissement();
  const updateMutation = useUpdateMonEtablissement();

  const form = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      nom: "", ville: "", telephone: "", email: "",
      adresse: "", email_contact: "", bp: "", site_web: "", devise: "",
    },
  });

  function startEdit() {
    if (!etab) return;
    const e = etab as unknown as {
      email_contact?: string | null;
      bp?: string | null;
      site_web?: string | null;
      devise?: string | null;
    };
    form.reset({
      nom: etab.nom ?? "",
      ville: etab.ville ?? "",
      telephone: etab.telephone ?? "",
      email: etab.email ?? "",
      adresse: etab.adresse ?? "",
      email_contact: e.email_contact ?? "",
      bp: e.bp ?? "",
      site_web: e.site_web ?? "",
      devise: e.devise ?? "",
    });
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    form.reset();
  }

  function onSubmit(data: EditForm) {
    updateMutation.mutate(
      {
        data: {
          nom: data.nom,
          ville: data.ville || null,
          telephone: data.telephone || null,
          email: data.email || null,
          adresse: data.adresse || null,
          email_contact: data.email_contact || null,
          bp: data.bp || null,
          site_web: data.site_web || null,
          devise: data.devise || null,
        } as Parameters<typeof updateMutation.mutate>[0]["data"],
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMonEtablissementQueryKey() });
          toast({ title: "Succès", description: "Établissement mis à jour." });
          setEditing(false);
        },
        onError: (err) => {
          toast({ title: "Erreur", description: err.message, variant: "destructive" });
        },
      }
    );
  }

  function refreshEtab() {
    queryClient.invalidateQueries({ queryKey: getGetMonEtablissementQueryKey() });
  }

  const jours = joursRestants(etab?.date_expiration_licence ?? etab?.licence?.date_expiration);
  const licenceActive = etab?.licence_active ?? false;
  const licenceAlerte = jours !== null && jours > 0 && jours <= 30;
  const licenceExpiree = jours !== null && jours <= 0;

  const etabExtra = etab as (typeof etab & {
    logo_url?: string | null;
    cachet_url?: string | null;
    signature_directeur_url?: string | null;
    email_contact?: string | null;
    bp?: string | null;
    site_web?: string | null;
    devise?: string | null;
  }) | undefined;

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "rgba(0,201,167,0.12)" }}
        >
          <Building2 className="w-5 h-5" style={{ color: "#00C9A7" }} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--m15-white)" }}>
            Mon établissement
          </h1>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            Informations, identité visuelle et statut de votre licence
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      ) : !etab ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <p style={{ color: "var(--m15-muted)" }}>Aucun établissement associé à votre compte.</p>
        </div>
      ) : (
        <>
          {/* ── Card infos générales ── */}
          <div
            className="rounded-2xl p-6 space-y-5"
            style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base" style={{ color: "var(--m15-white)" }}>
                Informations générales
              </h2>
              {isDirecteur && !editing && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={startEdit}
                  className="gap-1.5 text-xs"
                  style={{ borderColor: "var(--m15-border)", color: "var(--m15-white)" }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Modifier
                </Button>
              )}
            </div>

            {!editing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <InfoRow label="Nom" value={etab.nom ?? "—"} />
                <InfoRow
                  label="Type"
                  value={etab.type ? TYPE_LABELS[etab.type] ?? etab.type : "—"}
                />
                <InfoRow
                  label="Ville"
                  value={etab.ville ?? "—"}
                  icon={<MapPin className="w-3.5 h-3.5" style={{ color: "#00C9A7" }} />}
                />
                <InfoRow
                  label="Téléphone"
                  value={etab.telephone ?? "—"}
                  icon={<Phone className="w-3.5 h-3.5" style={{ color: "#00C9A7" }} />}
                />
                <InfoRow
                  label="Email de contact"
                  value={etabExtra?.email_contact ?? etab.email ?? "—"}
                  icon={<Mail className="w-3.5 h-3.5" style={{ color: "#00C9A7" }} />}
                />
                <InfoRow label="Adresse" value={etab.adresse ?? "—"} />
                {etabExtra?.bp && (
                  <InfoRow label="Boîte postale" value={`B.P. ${etabExtra.bp}`} />
                )}
                {etabExtra?.site_web && (
                  <InfoRow
                    label="Site web"
                    value={etabExtra.site_web}
                    icon={<Globe className="w-3.5 h-3.5" style={{ color: "#00C9A7" }} />}
                  />
                )}
                {etabExtra?.devise && (
                  <div className="sm:col-span-2">
                    <InfoRow
                      label="Devise"
                      value={`« ${etabExtra.devise} »`}
                      icon={<Sparkles className="w-3.5 h-3.5" style={{ color: "#F5C842" }} />}
                    />
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Nom *</Label>
                    <Input {...form.register("nom")} placeholder="Nom de l'établissement" />
                    {form.formState.errors.nom && (
                      <p className="text-xs text-red-400">{form.formState.errors.nom.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ville</Label>
                    <Input {...form.register("ville")} placeholder="Ville" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Téléphone</Label>
                    <Input {...form.register("telephone")} placeholder="+225 ..." />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email de contact</Label>
                    <Input {...form.register("email_contact")} type="email" placeholder="contact@ecole.ci" />
                    {form.formState.errors.email_contact && (
                      <p className="text-xs text-red-400">{form.formState.errors.email_contact.message}</p>
                    )}
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Adresse</Label>
                    <Input {...form.register("adresse")} placeholder="Adresse complète" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Boîte postale</Label>
                    <Input {...form.register("bp")} placeholder="Ex : 1234" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Site web</Label>
                    <Input {...form.register("site_web")} placeholder="https://monecole.ci" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Devise / Slogan</Label>
                    <Input {...form.register("devise")} placeholder="Ex : L'excellence au quotidien" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email administratif (login)</Label>
                    <Input {...form.register("email")} type="email" placeholder="admin@ecole.ci" />
                    {form.formState.errors.email && (
                      <p className="text-xs text-red-400">{form.formState.errors.email.message}</p>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={cancelEdit}
                    className="gap-1.5"
                    style={{ borderColor: "var(--m15-border)" }}
                  >
                    <X className="w-3.5 h-3.5" />
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={updateMutation.isPending}
                    className="gap-1.5"
                    style={{ background: "#00C9A7", color: "#0A1628" }}
                  >
                    <Check className="w-3.5 h-3.5" />
                    Enregistrer
                  </Button>
                </div>
              </form>
            )}
          </div>

          {/* ── Card Identité visuelle ── */}
          {isDirecteur && (
            <div
              className="rounded-2xl p-6 space-y-4"
              style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" style={{ color: "#00C9A7" }} />
                <h2 className="font-semibold text-base" style={{ color: "var(--m15-white)" }}>
                  Identité visuelle
                </h2>
              </div>
              <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                Ces éléments sont utilisés dans les en-têtes et pieds de page de tous les documents PDF générés (bulletins, procès-verbaux, etc.).
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <CarteUploadIdentite
                  label="Logo"
                  description="Logo principal (PNG/SVG recommandé)"
                  currentUrl={etabExtra?.logo_url ?? null}
                  endpoint="logo"
                  token={token}
                  onUpdated={refreshEtab}
                />
                <CarteUploadIdentite
                  label="Cachet officiel"
                  description="Cachet/tampon de l'établissement"
                  currentUrl={etabExtra?.cachet_url ?? null}
                  endpoint="cachet"
                  token={token}
                  onUpdated={refreshEtab}
                />
                <CarteUploadIdentite
                  label="Signature directeur"
                  description="Signature du directeur (PNG transparent)"
                  currentUrl={etabExtra?.signature_directeur_url ?? null}
                  endpoint="signature"
                  token={token}
                  onUpdated={refreshEtab}
                />
              </div>

              <div
                className="rounded-xl p-3 flex items-start gap-2"
                style={{ background: "rgba(0,128,255,0.06)", border: "1px solid rgba(0,128,255,0.15)" }}
              >
                <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#0080FF" }} />
                <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                  Formats acceptés : PNG, JPG, SVG, WebP — Taille max 3 Mo.
                  Les images apparaîtront sur tous les documents officiels après enregistrement.
                </p>
              </div>
            </div>
          )}

          {/* ── Card licence ── */}
          <div
            className="rounded-2xl p-6 space-y-4"
            style={{
              background: "var(--m15-card)",
              border: licenceExpiree
                ? "1px solid rgba(255,77,109,0.4)"
                : licenceAlerte
                ? "1px solid rgba(245,200,66,0.4)"
                : "1px solid var(--m15-border)",
            }}
          >
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-base" style={{ color: "var(--m15-white)" }}>
                Statut de la licence
              </h2>
              <span
                className="text-xs font-semibold px-3 py-1 rounded-full"
                style={
                  licenceActive && !licenceExpiree
                    ? { background: "rgba(0,201,167,0.12)", color: "#00C9A7" }
                    : { background: "rgba(255,77,109,0.12)", color: "#FF4D6D" }
                }
              >
                {licenceActive && !licenceExpiree ? (
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <ShieldOff className="w-3.5 h-3.5" /> {licenceExpiree ? "Expirée" : "Inactive"}
                  </span>
                )}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {etab.licence && (
                <>
                  <LicenceInfo label="Type" value={etab.licence.type ? (LICENCE_TYPES[etab.licence.type] ?? etab.licence.type) : "—"} />
                  <LicenceInfo
                    label="Début"
                    value={
                      etab.licence.date_debut
                        ? new Date(etab.licence.date_debut).toLocaleDateString("fr-FR")
                        : "—"
                    }
                  />
                  <LicenceInfo
                    label="Expiration"
                    value={
                      etab.licence.date_expiration
                        ? new Date(etab.licence.date_expiration).toLocaleDateString("fr-FR")
                        : "—"
                    }
                  />
                </>
              )}
              {!etab.licence && etab.date_expiration_licence && (
                <LicenceInfo
                  label="Expiration"
                  value={new Date(etab.date_expiration_licence).toLocaleDateString("fr-FR")}
                />
              )}
            </div>

            {jours !== null && (
              <div
                className="rounded-xl p-4 flex items-center gap-3"
                style={
                  licenceExpiree
                    ? { background: "rgba(255,77,109,0.08)", border: "1px solid rgba(255,77,109,0.2)" }
                    : licenceAlerte
                    ? { background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.2)" }
                    : { background: "rgba(0,201,167,0.06)", border: "1px solid rgba(0,201,167,0.15)" }
                }
              >
                {licenceExpiree ? (
                  <ShieldOff className="w-5 h-5 shrink-0" style={{ color: "#FF4D6D" }} />
                ) : licenceAlerte ? (
                  <AlertTriangle className="w-5 h-5 shrink-0" style={{ color: "#F5C842" }} />
                ) : (
                  <Clock className="w-5 h-5 shrink-0" style={{ color: "#00C9A7" }} />
                )}
                <div>
                  {licenceExpiree ? (
                    <p className="text-sm font-semibold" style={{ color: "#FF4D6D" }}>
                      Licence expirée. Contactez le support.
                    </p>
                  ) : licenceAlerte ? (
                    <p className="text-sm font-semibold" style={{ color: "#F5C842" }}>
                      Votre licence expire dans <strong>{jours} jour{jours > 1 ? "s" : ""}</strong>. Contactez le support.
                    </p>
                  ) : (
                    <p className="text-sm" style={{ color: "#00C9A7" }}>
                      <strong>{jours} jours</strong> restants
                    </p>
                  )}
                  <p className="text-xs mt-0.5" style={{ color: "var(--m15-muted)" }}>
                    Support :{" "}
                    <a href="mailto:support@m15-schooltech.ci" className="underline">
                      support@m15-schooltech.ci
                    </a>
                  </p>
                </div>
              </div>
            )}

            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
              Le statut et les dates de licence sont gérés par l'administration M15 Tech. Pour tout renouvellement,
              contactez{" "}
              <a href="mailto:support@m15-schooltech.ci" className="underline" style={{ color: "#00C9A7" }}>
                support@m15-schooltech.ci
              </a>
              .
            </p>
          </div>

          <div
            className="rounded-xl p-4 flex items-center gap-3"
            style={{ background: "rgba(0,128,255,0.06)", border: "1px solid rgba(0,128,255,0.15)" }}
          >
            <CalendarClock className="w-4 h-4 shrink-0" style={{ color: "#0080FF" }} />
            <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
              Pour modifier le type d'établissement ou toute configuration avancée, contactez votre administrateur M15 Tech.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function InfoRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
        {label}
      </p>
      <p className="text-sm font-medium flex items-center gap-1.5" style={{ color: "var(--m15-white)" }}>
        {icon}
        {value}
      </p>
    </div>
  );
}

function LicenceInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
        {label}
      </p>
      <p className="text-sm font-semibold" style={{ color: "var(--m15-white)" }}>
        {value}
      </p>
    </div>
  );
}
