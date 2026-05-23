import { useState } from "react";
import { useGetParentDashboard, getGetParentDashboardQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AlertTriangle, MessageSquare, FileText, Clock,
  ChevronRight, CalendarDays, Award, UserCheck, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";

const JOURS = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
const today = JOURS[new Date().getDay()];

export default function ParentDashboard() {
  const { user } = useAuth();
  const [activeEnfant, setActiveEnfant] = useState(0);

  const qk = getGetParentDashboardQueryKey();
  const { data, isLoading } = useGetParentDashboard({ query: { queryKey: qk, staleTime: 60_000 } });

  const enfants = (data as any)?.enfants ?? [];
  const enfant = enfants[activeEnfant];

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!enfants.length) {
    return (
      <div className="p-8 text-center">
        <UserCheck className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Aucun enfant lié</h2>
        <p className="text-muted-foreground">Contactez l'établissement pour associer vos enfants à votre compte.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "Poppins, sans-serif" }}>
          Bonjour, {user?.prenoms} 👋
        </h1>
        <p className="text-muted-foreground text-sm">Tableau de bord parent · {today}</p>
      </div>

      {/* Sélecteur enfants (si plusieurs) */}
      {enfants.length > 1 && (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {enfants.map((e: any, i: number) => (
            <button
              key={e.eleve_id}
              onClick={() => setActiveEnfant(i)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all",
                i === activeEnfant
                  ? "text-white shadow-md"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              )}
              style={i === activeEnfant ? { background: "linear-gradient(135deg, #0080FF, #00C9A7)" } : {}}
            >
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs" style={{ background: "#0A1628", color: "#00C9A7" }}>
                  {e.nom[0]}{e.prenoms[0]}
                </AvatarFallback>
              </Avatar>
              {e.prenoms} {e.nom}
            </button>
          ))}
        </div>
      )}

      {enfant && (
        <>
          {/* Fiche enfant */}
          <Card className="border-0 shadow-md overflow-hidden">
            <div className="h-1.5" style={{ background: "linear-gradient(90deg, #0080FF, #00C9A7)" }} />
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="text-xl font-bold" style={{ background: "#0A1628", color: "#00C9A7" }}>
                    {enfant.nom[0]}{enfant.prenoms[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{enfant.prenoms} {enfant.nom}</h2>
                  <p className="text-muted-foreground text-sm">{enfant.classe_nom} · {enfant.annee_scolaire}</p>
                  {enfant.filiere_nom && (
                    <Badge variant="outline" className="mt-1 text-xs">{enfant.filiere_nom}</Badge>
                  )}
                </div>
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">Matricule</p>
                  <p className="font-mono font-semibold">{enfant.matricule}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Statistiques rapides */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard
              icon={<Award className="h-5 w-5" />}
              label="Moyenne"
              value={enfant.moyenne_generale != null ? `${Number(enfant.moyenne_generale).toFixed(2)}/20` : "—"}
              sub={enfant.rang ? `Rang ${enfant.rang}/${enfant.effectif ?? "?"}` : undefined}
              color="#0080FF"
            />
            <StatCard
              icon={<AlertTriangle className="h-5 w-5" />}
              label="Absences NJ"
              value={String(enfant.nb_absences ?? 0)}
              sub="non justifiées"
              color={enfant.nb_absences > 3 ? "#F5C842" : "#00C9A7"}
            />
            <StatCard
              icon={<MessageSquare className="h-5 w-5" />}
              label="Messages"
              value={String(enfant.nb_messages_non_lus ?? 0)}
              sub="non lus"
              color={enfant.nb_messages_non_lus > 0 ? "#F5C842" : "#00C9A7"}
              href="/messagerie"
            />
            <StatCard
              icon={<FileText className="h-5 w-5" />}
              label="Bulletins"
              value={String(enfant.bulletins_disponibles ?? 0)}
              sub="disponibles"
              color="#00C9A7"
              href="/mes-bulletins"
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cours du jour */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4" style={{ color: "#0080FF" }} />
                  Cours aujourd'hui — {today}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {enfant.cours_du_jour?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Pas de cours aujourd'hui</p>
                ) : (
                  <div className="space-y-2">
                    {(enfant.cours_du_jour ?? []).slice(0, 6).map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                        <div className="h-8 w-1 rounded-full flex-shrink-0" style={{ background: c.couleur ?? "#0080FF" }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.matiere}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Devoirs à venir */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BookOpen className="h-4 w-4" style={{ color: "#00C9A7" }} />
                  Devoirs à rendre
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {enfant.prochains_devoirs?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucun devoir à venir</p>
                ) : (
                  <div className="space-y-2">
                    {(enfant.prochains_devoirs ?? []).slice(0, 4).map((d: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/40">
                        <CalendarDays className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{d.matiere}</p>
                          {d.date_remise_devoir && (
                            <p className="text-xs text-muted-foreground">Pour le {d.date_remise_devoir}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Dernières absences */}
            <Card className="border-0 shadow-sm lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" style={{ color: "#F5C842" }} />
                  Dernières absences
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {enfant.dernieres_absences?.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Aucune absence récente ✓</p>
                ) : (
                  <div className="space-y-2">
                    {(enfant.dernieres_absences ?? []).map((a: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg border">
                        <div className={cn(
                          "h-2 w-2 rounded-full flex-shrink-0",
                          a.statut === "justifiee" ? "bg-green-500" :
                          a.statut === "en_attente" ? "bg-yellow-500" : "bg-red-500"
                        )} />
                        <div className="flex-1">
                          <p className="text-sm">{a.matiere} — {a.date_absence}</p>
                        </div>
                        <Badge variant="outline" className="text-xs capitalize">{a.statut?.replace("_"," ")}</Badge>
                      </div>
                    ))}
                  </div>
                )}
                <a href="/absences-parent">
                  <Button variant="ghost" size="sm" className="mt-2 w-full text-xs">
                    Voir toutes les absences <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, href }: {
  icon: React.ReactNode; label: string; value: string;
  sub?: string; color: string; href?: string;
}) {
  const content = (
    <Card className="border-0 shadow-sm hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="p-2 rounded-lg" style={{ background: `${color}15` }}>
            <div style={{ color }}>{icon}</div>
          </div>
          {href && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </div>
        <p className="text-2xl font-bold mt-3" style={{ color }}>{value}</p>
        <p className="text-xs font-medium mt-0.5">{label}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
  if (href) return <a href={href}>{content}</a>;
  return content;
}
