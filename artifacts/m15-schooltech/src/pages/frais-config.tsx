import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Settings, Plus, Trash2, RefreshCw } from "lucide-react";
import {
  useGetScolariteFraisListe,
  usePostScolariteFraisConfigurer,
  usePutScolariteFraisId,
  useListerAnneesScolaires,
  getGetScolariteFraisListeQueryKey,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const NIVEAUX = ["6eme", "5eme", "4eme", "3eme", "2nde", "1ere", "terminale"];

type FraisConfig = {
  id: string; niveau: string; frais_inscription: string; frais_scolarite_annuel: string;
  frais_tranche1: string; frais_tranche2: string; frais_tranche3: string;
  date_limite_tranche1?: string; date_limite_tranche2?: string; date_limite_tranche3?: string;
  autres_frais?: Array<{ nom: string; montant: number }>;
  annee_scolaire_id: string;
};

type AutreFrais = { nom: string; montant: string };

function fmt(v: string) {
  const n = parseFloat(v ?? "0");
  return isNaN(n) ? "0" : new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

function num(v: string) { return parseFloat(v) || 0; }

export default function FraisConfig() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [anneeScolaireId, setAnneeScolaireId] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [niveau, setNiveau] = useState("6eme");
  const [fraisInscription, setFraisInscription] = useState("0");
  const [fraisAnnuel, setFraisAnnuel] = useState("0");
  const [t1, setT1] = useState("0");
  const [t2, setT2] = useState("0");
  const [t3, setT3] = useState("0");
  const [limT1, setLimT1] = useState("");
  const [limT2, setLimT2] = useState("");
  const [limT3, setLimT3] = useState("");
  const [autresFrais, setAutresFrais] = useState<AutreFrais[]>([]);

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as { annees?: Array<{ id: string; libelle: string; active?: boolean }> } | undefined)?.annees ?? [];

  const params = anneeScolaireId ? { annee_scolaire_id: anneeScolaireId } : {};
  const { data: configsData, isLoading, refetch } = useGetScolariteFraisListe(params);
  const configs: FraisConfig[] = (configsData as { data?: FraisConfig[] } | undefined)?.data ?? [];

  const configurer = usePostScolariteFraisConfigurer();
  const modifier = usePutScolariteFraisId();

  const totalAutres = autresFrais.reduce((s, f) => s + num(f.montant), 0);
  const sommeTransches = num(t1) + num(t2) + num(t3);
  const matchAnnuel = Math.abs(sommeTransches - num(fraisAnnuel)) < 0.01;

  function openNew() {
    setEditingId(null); setNiveau("6eme");
    setFraisInscription("0"); setFraisAnnuel("0");
    setT1("0"); setT2("0"); setT3("0");
    setLimT1(""); setLimT2(""); setLimT3("");
    setAutresFrais([]); setOpen(true);
  }

  function openEdit(c: FraisConfig) {
    setEditingId(c.id); setNiveau(c.niveau);
    setFraisInscription(c.frais_inscription ?? "0");
    setFraisAnnuel(c.frais_scolarite_annuel ?? "0");
    setT1(c.frais_tranche1 ?? "0"); setT2(c.frais_tranche2 ?? "0"); setT3(c.frais_tranche3 ?? "0");
    setLimT1(c.date_limite_tranche1 ?? ""); setLimT2(c.date_limite_tranche2 ?? ""); setLimT3(c.date_limite_tranche3 ?? "");
    setAutresFrais((c.autres_frais ?? []).map(f => ({ nom: f.nom, montant: String(f.montant) })));
    setOpen(true);
  }

  function autoCalcAnnuel() {
    const total = num(t1) + num(t2) + num(t3);
    setFraisAnnuel(String(total));
  }

  function submit() {
    if (!anneeScolaireId) { toast({ title: "Sélectionnez une année scolaire", variant: "destructive" }); return; }
    if (!matchAnnuel) { toast({ title: "T1+T2+T3 doit être égal au total annuel", variant: "destructive" }); return; }

    const payload = {
      annee_scolaire_id: anneeScolaireId, niveau,
      frais_inscription: num(fraisInscription), frais_scolarite_annuel: num(fraisAnnuel),
      frais_tranche1: num(t1), frais_tranche2: num(t2), frais_tranche3: num(t3),
      date_limite_tranche1: limT1 || undefined, date_limite_tranche2: limT2 || undefined, date_limite_tranche3: limT3 || undefined,
      autres_frais: autresFrais.filter(f => f.nom).map(f => ({ nom: f.nom, montant: num(f.montant) })),
    };

    const qkey = getGetScolariteFraisListeQueryKey(params);

    if (editingId) {
      modifier.mutate(
        { id: editingId, data: payload } as Parameters<typeof modifier.mutate>[0],
        {
          onSuccess: () => { toast({ title: "Configuration modifiée" }); setOpen(false); qc.invalidateQueries({ queryKey: qkey }); },
          onError: (e: unknown) => toast({ title: (e as { message?: string })?.message ?? "Erreur", variant: "destructive" }),
        }
      );
    } else {
      configurer.mutate(
        { data: payload } as Parameters<typeof configurer.mutate>[0],
        {
          onSuccess: () => { toast({ title: "Configuration enregistrée" }); setOpen(false); qc.invalidateQueries({ queryKey: qkey }); },
          onError: (e: unknown) => toast({ title: (e as { message?: string })?.message ?? "Erreur", variant: "destructive" }),
        }
      );
    }
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--m15-navy)" }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)", fontSize: 24, fontWeight: 700 }}>
            Configuration des frais
          </h1>
          <p style={{ color: "var(--m15-muted)", fontSize: 14 }}>Frais par niveau et par année scolaire</p>
        </div>
        <div className="flex gap-2">
          <Select value={anneeScolaireId} onValueChange={setAnneeScolaireId}>
            <SelectTrigger className="w-48" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Sélectionner une année" />
            </SelectTrigger>
            <SelectContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              {annees.map(a => <SelectItem key={a.id} value={a.id} style={{ color: "var(--m15-white)" }}>{a.libelle}{a.active ? " ✓" : ""}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button style={{ background: "#00C9A7", color: "white" }} onClick={openNew} disabled={!anneeScolaireId}>
            <Plus className="h-4 w-4 mr-1" /> Configurer un niveau
          </Button>
          <Button variant="outline" size="icon" onClick={() => refetch()}
            style={{ borderColor: "var(--m15-border)", color: "var(--m15-white)" }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!anneeScolaireId ? (
        <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <CardContent className="py-12 text-center">
            <Settings className="h-12 w-12 mx-auto mb-3" style={{ color: "var(--m15-muted)" }} />
            <p style={{ color: "var(--m15-muted)" }}>Sélectionnez une année scolaire pour voir les configurations</p>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-3">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--m15-card)" }} />)}
        </div>
      ) : (
        <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                  {["Niveau", "Inscription", "Tranche 1", "Tranche 2", "Tranche 3", "Total annuel", "Autres frais", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--m15-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NIVEAUX.map(niv => {
                  const c = configs.find(x => x.niveau === niv);
                  return (
                    <tr key={niv} style={{ borderBottom: "1px solid rgba(0,201,167,0.07)" }}>
                      <td className="px-4 py-3">
                        <Badge style={{ background: "rgba(0,128,255,0.15)", color: "#0080FF", border: "1px solid rgba(0,128,255,0.3)" }}>
                          {niv}
                        </Badge>
                      </td>
                      {c ? (
                        <>
                          <td className="px-4 py-3 text-sm" style={{ color: "var(--m15-white)" }}>{fmt(c.frais_inscription)} F</td>
                          <td className="px-4 py-3 text-sm" style={{ color: "var(--m15-white)" }}>{fmt(c.frais_tranche1)} F</td>
                          <td className="px-4 py-3 text-sm" style={{ color: "var(--m15-white)" }}>{fmt(c.frais_tranche2)} F</td>
                          <td className="px-4 py-3 text-sm" style={{ color: "var(--m15-white)" }}>{fmt(c.frais_tranche3)} F</td>
                          <td className="px-4 py-3 text-sm font-semibold" style={{ color: "#00C9A7" }}>{fmt(c.frais_scolarite_annuel)} F</td>
                          <td className="px-4 py-3 text-sm" style={{ color: "var(--m15-muted)" }}>
                            {(c.autres_frais ?? []).length > 0 ? `${(c.autres_frais ?? []).length} élément(s)` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant="ghost" style={{ color: "#F5C842" }} onClick={() => openEdit(c)}>
                              <Settings className="h-4 w-4 mr-1" /> Modifier
                            </Button>
                          </td>
                        </>
                      ) : (
                        <>
                          {[...Array(6)].map((_, i) => <td key={i} className="px-4 py-3 text-sm" style={{ color: "var(--m15-muted)" }}>—</td>)}
                          <td className="px-4 py-3">
                            <Button size="sm" variant="ghost" style={{ color: "#00C9A7" }} onClick={() => { setNiveau(niv); openNew(); }}>
                              <Plus className="h-4 w-4 mr-1" /> Configurer
                            </Button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Modal configuration */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto"
          style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
          <DialogHeader>
            <DialogTitle style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              {editingId ? "Modifier" : "Configurer"} les frais — {niveau}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label style={{ color: "var(--m15-white)" }}>Niveau</Label>
              <Select value={niveau} onValueChange={setNiveau} disabled={!!editingId}>
                <SelectTrigger style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
                  {NIVEAUX.map(n => <SelectItem key={n} value={n} style={{ color: "var(--m15-white)" }}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label style={{ color: "var(--m15-white)" }}>Frais d'inscription (FCFA)</Label>
              <Input type="number" value={fraisInscription} onChange={e => setFraisInscription(e.target.value)}
                style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: "Tranche 1", val: t1, set: setT1, lim: limT1, setLim: setLimT1 },
                { label: "Tranche 2", val: t2, set: setT2, lim: limT2, setLim: setLimT2 },
                { label: "Tranche 3", val: t3, set: setT3, lim: limT3, setLim: setLimT3 },
              ].map(({ label, val, set, lim, setLim }) => (
                <div key={label} className="space-y-1">
                  <Label className="text-xs" style={{ color: "var(--m15-white)" }}>{label}</Label>
                  <Input type="number" value={val} onChange={e => set(e.target.value)} placeholder="Montant"
                    style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", fontSize: 13 }} />
                  <Input type="date" value={lim ?? ""} onChange={e => setLim(e.target.value)} placeholder="Date limite"
                    style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", fontSize: 12 }} />
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label style={{ color: "var(--m15-white)" }}>Total annuel (FCFA)</Label>
                <Button size="sm" variant="ghost" style={{ color: "#00C9A7", fontSize: 12 }} onClick={autoCalcAnnuel}>
                  Auto-calculer (T1+T2+T3)
                </Button>
              </div>
              <Input type="number" value={fraisAnnuel} onChange={e => setFraisAnnuel(e.target.value)}
                style={{
                  background: "var(--m15-card2)", color: "var(--m15-white)",
                  border: `1px solid ${matchAnnuel || !fraisAnnuel ? "var(--m15-border)" : "#FF4D6D"}`,
                }} />
              {!matchAnnuel && parseFloat(fraisAnnuel) > 0 && (
                <p style={{ color: "#FF4D6D", fontSize: 12 }}>
                  T1+T2+T3 = {fmt(String(sommeTransches))} F ≠ {fmt(fraisAnnuel)} F
                </p>
              )}
            </div>

            {/* Autres frais */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label style={{ color: "var(--m15-white)" }}>Autres frais</Label>
                <Button size="sm" variant="ghost" style={{ color: "#00C9A7" }}
                  onClick={() => setAutresFrais([...autresFrais, { nom: "", montant: "0" }])}>
                  <Plus className="h-3 w-3 mr-1" /> Ajouter
                </Button>
              </div>
              {autresFrais.map((f, i) => (
                <div key={i} className="flex gap-2">
                  <Input value={f.nom} onChange={e => setAutresFrais(autresFrais.map((x, j) => j === i ? { ...x, nom: e.target.value } : x))}
                    placeholder="Libellé (ex: Tenue)"
                    style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", flex: 2 }} />
                  <Input type="number" value={f.montant} onChange={e => setAutresFrais(autresFrais.map((x, j) => j === i ? { ...x, montant: e.target.value } : x))}
                    placeholder="Montant"
                    style={{ background: "var(--m15-card2)", border: "1px solid var(--m15-border)", color: "var(--m15-white)", flex: 1 }} />
                  <Button size="icon" variant="ghost" style={{ color: "#FF4D6D" }}
                    onClick={() => setAutresFrais(autresFrais.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {autresFrais.length > 0 && (
                <p style={{ color: "var(--m15-muted)", fontSize: 12 }}>Total autres frais : {fmt(String(totalAutres))} FCFA</p>
              )}
            </div>

            <Button className="w-full" style={{ background: "#00C9A7", color: "white" }}
              onClick={submit} disabled={configurer.isPending || modifier.isPending}>
              {(configurer.isPending || modifier.isPending) ? "Enregistrement..." : "Enregistrer la configuration"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
