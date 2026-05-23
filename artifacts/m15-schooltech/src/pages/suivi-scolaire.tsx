import { useState, useEffect } from "react";
import {
  useGetMesEnfants, useGetNotesEnfant, useGetBulletinsEnfant,
  useGetAbsencesEnfant, useGetCahierTextesEnfant, useGetEmploiTempsEnfant,
  getGetMesEnfantsQueryKey, getGetNotesEnfantQueryKey, getGetBulletinsEnfantQueryKey,
  getGetAbsencesEnfantQueryKey, getGetCahierTextesEnfantQueryKey, getGetEmploiTempsEnfantQueryKey,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { BookOpen, BarChart2, FileText, UserMinus, Calendar, Award } from "lucide-react";
import { cn } from "@/lib/utils";

const JOURS_ORDER = ["lundi","mardi","mercredi","jeudi","vendredi","samedi"];

function getMoyenneColor(m: number | null) {
  if (m == null) return "#6b7280";
  if (m >= 14) return "#00C9A7";
  if (m >= 10) return "#0080FF";
  if (m >= 8) return "#F5C842";
  return "#ef4444";
}

export default function SuiviScolaire() {
  const [eleveId, setEleveId] = useState<string>("");
  const [trimestre, setTrimestre] = useState<string>("1");

  const enfantsQk = getGetMesEnfantsQueryKey();
  const { data: enfantsData, isLoading: loadingEnfants } = useGetMesEnfants({
    query: { queryKey: enfantsQk, staleTime: 60_000 },
  });

  const enfants = (enfantsData as any)?.enfants ?? [];

  /* Sélectionner le premier enfant automatiquement */
  useEffect(() => {
    if (enfants.length > 0 && !eleveId) {
      setEleveId(enfants[0].eleve_id);
    }
  }, [enfants, eleveId]);

  const notesParams = { trimestre };
  const notesQk = getGetNotesEnfantQueryKey(eleveId, notesParams);
  const { data: notesData, isLoading: loadingNotes } = useGetNotesEnfant(
    eleveId, notesParams,
    { query: { queryKey: notesQk, enabled: !!eleveId, staleTime: 60_000 } }
  );

  const bulletinsQk = getGetBulletinsEnfantQueryKey(eleveId);
  const { data: bulletinsData } = useGetBulletinsEnfant(
    eleveId,
    { query: { queryKey: bulletinsQk, enabled: !!eleveId, staleTime: 60_000 } }
  );

  const absencesParams = {};
  const absencesQk = getGetAbsencesEnfantQueryKey(eleveId, absencesParams);
  const { data: absencesData } = useGetAbsencesEnfant(
    eleveId, absencesParams,
    { query: { queryKey: absencesQk, enabled: !!eleveId, staleTime: 60_000 } }
  );

  const cahierParams = {};
  const cahierQk = getGetCahierTextesEnfantQueryKey(eleveId, cahierParams);
  const { data: cahierData } = useGetCahierTextesEnfant(
    eleveId, cahierParams,
    { query: { queryKey: cahierQk, enabled: !!eleveId, staleTime: 60_000 } }
  );

  const edtQk = getGetEmploiTempsEnfantQueryKey(eleveId);
  const { data: edtData } = useGetEmploiTempsEnfant(
    eleveId,
    { query: { queryKey: edtQk, enabled: !!eleveId, staleTime: 60_000 } }
  );

  const notes = (notesData as any) ?? {};
  const bulletins = (bulletinsData as any)?.bulletins ?? [];
  const absences = (absencesData as any)?.absences ?? [];
  const resume = (absencesData as any)?.resume ?? {};
  const seances = (cahierData as any)?.seances ?? [];
  const devoirs = (cahierData as any)?.devoirs_a_venir ?? [];
  const creneaux = (edtData as any)?.creneaux ?? [];

  /* EDT groupé par jour */
  const edtParJour: Record<string, any[]> = {};
  for (const c of creneaux) {
    const j = c.jour ?? "?";
    if (!edtParJour[j]) edtParJour[j] = [];
    edtParJour[j].push(c);
  }
  const joursAvecCours = JOURS_ORDER.filter(j => edtParJour[j]?.length > 0);

  if (loadingEnfants) {
    return <div className="p-6 space-y-4"><Skeleton className="h-12 w-64" /><Skeleton className="h-96" /></div>;
  }

  if (!enfants.length) {
    return (
      <div className="p-8 text-center">
        <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">Aucun enfant associé à votre compte.</p>
      </div>
    );
  }

  const enfantActif = enfants.find((e: any) => e.eleve_id === eleveId) ?? enfants[0];

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Sélecteur enfant + trimestre */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Poppins, sans-serif" }}>Suivi scolaire</h1>
          <p className="text-muted-foreground text-sm">Notes, bulletins, absences, emploi du temps</p>
        </div>
        <div className="sm:ml-auto flex gap-2">
          {enfants.length > 1 && (
            <Select value={eleveId} onValueChange={setEleveId}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Choisir un enfant" />
              </SelectTrigger>
              <SelectContent>
                {enfants.map((e: any) => (
                  <SelectItem key={e.eleve_id} value={e.eleve_id}>
                    {e.prenoms} {e.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={trimestre} onValueChange={setTrimestre}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1er Trimestre</SelectItem>
              <SelectItem value="2">2ème Trimestre</SelectItem>
              <SelectItem value="3">3ème Trimestre</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Fiche résumée */}
      {enfantActif && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback style={{ background: "var(--m15-navy)", color: "#00C9A7" }} className="font-bold">
                {enfantActif.nom[0]}{enfantActif.prenoms[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{enfantActif.prenoms} {enfantActif.nom}</p>
              <p className="text-sm text-muted-foreground">{enfantActif.classe_nom} · {enfantActif.annee_scolaire}</p>
            </div>
            {notes.moyenne_generale != null && (
              <div className="ml-auto text-right">
                <p className="text-2xl font-bold" style={{ color: getMoyenneColor(notes.moyenne_generale) }}>
                  {Number(notes.moyenne_generale).toFixed(2)}<span className="text-sm text-muted-foreground">/20</span>
                </p>
                {notes.rang && <p className="text-xs text-muted-foreground">Rang {notes.rang}</p>}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="notes" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="notes" className="text-xs sm:text-sm">
            <BarChart2 className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Notes</span>
          </TabsTrigger>
          <TabsTrigger value="bulletins" className="text-xs sm:text-sm">
            <FileText className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Bulletins</span>
          </TabsTrigger>
          <TabsTrigger value="absences" className="text-xs sm:text-sm">
            <UserMinus className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Absences</span>
          </TabsTrigger>
          <TabsTrigger value="cahier" className="text-xs sm:text-sm">
            <BookOpen className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">Cahier</span>
          </TabsTrigger>
          <TabsTrigger value="edt" className="text-xs sm:text-sm">
            <Calendar className="h-3.5 w-3.5 sm:mr-1.5" /><span className="hidden sm:inline">EDT</span>
          </TabsTrigger>
        </TabsList>

        {/* ── Notes ── */}
        <TabsContent value="notes">
          {loadingNotes ? (
            <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20" />)}</div>
          ) : notes.matieres?.length === 0 ? (
            <EmptyState icon={<BarChart2 />} msg="Aucune note pour ce trimestre." />
          ) : (
            <div className="space-y-3">
              {(notes.matieres ?? []).map((m: any, i: number) => (
                <Card key={i} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold">{m.matiere}</p>
                        <p className="text-xs text-muted-foreground">Coef. {m.coefficient}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold" style={{ color: getMoyenneColor(m.moyenne) }}>
                          {m.moyenne != null ? `${Number(m.moyenne).toFixed(2)}/20` : "—"}
                        </p>
                      </div>
                    </div>
                    {m.moyenne != null && (
                      <Progress value={(m.moyenne / 20) * 100} className="h-1.5" />
                    )}
                    {m.notes?.length > 0 && (
                      <div className="flex gap-2 flex-wrap mt-2">
                        {m.notes.map((n: any, j: number) => (
                          <Badge key={j} variant="outline" className="text-xs">
                            {n.intitule} : {Number(n.note).toFixed(1)}/{Number(n.note_sur).toFixed(0)}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Bulletins ── */}
        <TabsContent value="bulletins">
          {bulletins.length === 0 ? (
            <EmptyState icon={<FileText />} msg="Aucun bulletin disponible." />
          ) : (
            <div className="space-y-3">
              {bulletins.map((b: any) => (
                <Card key={b.id} className="border-0 shadow-sm">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="p-3 rounded-lg" style={{ background: "#0080FF15" }}>
                      <Award className="h-5 w-5" style={{ color: "#0080FF" }} />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">Trimestre {b.trimestre} — {b.annee_scolaire}</p>
                      {b.moyenne_generale != null && (
                        <p className="text-sm text-muted-foreground">
                          Moyenne : <span className="font-semibold" style={{ color: getMoyenneColor(b.moyenne_generale) }}>
                            {Number(b.moyenne_generale).toFixed(2)}/20
                          </span>
                          {b.rang ? ` · Rang ${b.rang}` : ""}
                        </p>
                      )}
                    </div>
                    <a href={`/bulletins/${b.id}`}>
                      <Button size="sm" variant="outline">Voir</Button>
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Absences ── */}
        <TabsContent value="absences">
          <div className="grid grid-cols-3 gap-3 mb-4">
            <Card className="border-0 shadow-sm text-center">
              <CardContent className="p-3">
                <p className="text-2xl font-bold">{resume.total ?? 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm text-center">
              <CardContent className="p-3">
                <p className="text-2xl font-bold text-green-500">{resume.justifiees ?? 0}</p>
                <p className="text-xs text-muted-foreground">Justifiées</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm text-center">
              <CardContent className="p-3">
                <p className="text-2xl font-bold text-red-500">{resume.non_justifiees ?? 0}</p>
                <p className="text-xs text-muted-foreground">Non justifiées</p>
              </CardContent>
            </Card>
          </div>
          {absences.length === 0 ? (
            <EmptyState icon={<UserMinus />} msg="Aucune absence enregistrée." />
          ) : (
            <div className="space-y-2">
              {absences.map((a: any) => (
                <div key={a.id} className="flex items-center gap-3 p-3 rounded-lg border">
                  <div className={cn(
                    "h-2.5 w-2.5 rounded-full flex-shrink-0",
                    a.statut === "justifiee" ? "bg-green-500" :
                    a.statut === "en_attente" ? "bg-yellow-500" : "bg-red-500"
                  )} />
                  <div className="flex-1">
                    <p className="text-sm font-medium">{a.matiere}</p>
                    <p className="text-xs text-muted-foreground">{a.date_absence} · {a.type}</p>
                  </div>
                  <Badge variant="outline" className="text-xs capitalize">{a.statut?.replace("_"," ")}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Cahier de textes ── */}
        <TabsContent value="cahier">
          {devoirs.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
                <BookOpen className="h-4 w-4" style={{ color: "#F5C842" }} /> Devoirs à rendre
              </h3>
              <div className="space-y-2">
                {devoirs.map((d: any) => (
                  <div key={d.id} className="flex items-center gap-3 p-3 rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-900/10">
                    <div>
                      <p className="text-sm font-medium">{d.matiere}</p>
                      <p className="text-xs text-muted-foreground">Pour le {d.date_remise_devoir}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {seances.length === 0 ? (
            <EmptyState icon={<BookOpen />} msg="Aucune séance dans le cahier de textes." />
          ) : (
            <div className="space-y-2">
              {seances.slice().reverse().map((s: any) => (
                <Card key={s.id} className="border-0 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="secondary" className="text-xs">{s.matiere}</Badge>
                      <span className="text-xs text-muted-foreground">{s.date_seance}</span>
                    </div>
                    {s.contenu_lecon && <p className="text-sm mt-1">{s.contenu_lecon}</p>}
                    {s.devoir_a_rendre && (
                      <p className="text-xs mt-1 text-amber-600 font-medium">
                        Devoir à rendre{s.date_remise_devoir ? ` le ${s.date_remise_devoir}` : ""}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Emploi du temps ── */}
        <TabsContent value="edt">
          {creneaux.length === 0 ? (
            <EmptyState icon={<Calendar />} msg="Aucun emploi du temps configuré." />
          ) : (
            <div className="space-y-4">
              {joursAvecCours.map(jour => (
                <div key={jour}>
                  <h3 className="text-sm font-semibold mb-2 capitalize">{jour}</h3>
                  <div className="space-y-1">
                    {edtParJour[jour].map((c: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border">
                        <div className="h-8 w-1 rounded-full" style={{ background: c.couleur ?? "#0080FF" }} />
                        <div>
                          <p className="text-sm font-medium">{c.matiere}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EmptyState({ icon, msg }: { icon: React.ReactNode; msg: string }) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <div className="h-10 w-10 mx-auto mb-3 opacity-30">{icon}</div>
      <p className="text-sm">{msg}</p>
    </div>
  );
}
