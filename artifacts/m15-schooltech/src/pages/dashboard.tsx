import { useAuth } from "@/context/AuthContext";
import { useGetStatsGlobal, useListerEtablissements, getGetStatsGlobalQueryKey, getListerEtablissementsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building, Users, AlertCircle, Key, Activity } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";

function DevDashboard() {
  const { data: stats, isLoading: statsLoading } = useGetStatsGlobal({
    query: { queryKey: getGetStatsGlobalQueryKey() }
  });
  
  const { data: etablissements, isLoading: etabsLoading } = useListerEtablissements({
    query: { queryKey: getListerEtablissementsQueryKey() }
  });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Tableau de bord administrateur</h1>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Établissements</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-7 w-20" /> : (
              <div className="text-2xl font-bold">{stats?.totalEtablissements || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Utilisateurs</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-7 w-20" /> : (
              <div className="text-2xl font-bold">{stats?.totalUtilisateurs || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Licences actives</CardTitle>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-7 w-20" /> : (
              <div className="text-2xl font-bold">{stats?.etablissementsActifs || 0}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Licences expirées</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {statsLoading ? <Skeleton className="h-7 w-20" /> : (
              <div className="text-2xl font-bold text-destructive">{stats?.licencesExpirees || 0}</div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Aperçu des établissements</CardTitle>
        </CardHeader>
        <CardContent>
          {etabsLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nom</TableHead>
                  <TableHead>Ville</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Expiration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {etablissements?.slice(0, 5).map((etab) => (
                  <TableRow key={etab.id}>
                    <TableCell className="font-medium">{etab.nom}</TableCell>
                    <TableCell>{etab.ville || "-"}</TableCell>
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
                  </TableRow>
                ))}
                {!etablissements?.length && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6">
                      Aucun établissement
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DirecteurDashboard() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Tableau de bord Direction</h1>
      <Card>
        <CardHeader>
          <CardTitle>Bienvenue {user?.prenoms} {user?.nom}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Voici l'aperçu de votre établissement.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function DefaultDashboard() {
  const { user } = useAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Tableau de bord</h1>
      <Card>
        <CardHeader>
          <CardTitle>Bienvenue {user?.prenoms} {user?.nom}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Connecté en tant que {user?.role}.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();

  if (user?.role === "dev") return <DevDashboard />;
  if (user?.role === "directeur") return <DirecteurDashboard />;
  
  return <DefaultDashboard />;
}
