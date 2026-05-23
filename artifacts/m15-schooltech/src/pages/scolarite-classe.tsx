import { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Search, Download, Send, RefreshCw, UserCheck, UserX, Clock, Plus,
} from "lucide-react";
import {
  useGetScolariteClasseClasseId,
  useListerClasses,
  useListerAnneesScolaires,
  usePostScolariteInitialiserClasse,
  usePostPaiementsRelancerImpayes,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";

type ScolariteRow = {
  id: string; eleve_id: string; eleve_nom?: string; eleve_prenoms?: string;
  eleve_matricule?: string; eleve_photo?: string; classe_nom?: string;
  montant_total_du: string; montant_total_paye: string; montant_restant: string;
  inscription_payee: boolean; tranche1_payee: boolean; tranche2_payee: boolean; tranche3_payee: boolean;
  statut: "en_regle" | "partiel" | "impaye";
};

function StatutBadge({ statut }: { statut: ScolariteRow["statut"] }) {
  const map = {
    en_regle: { label: "En règle", color: "#00C9A7", bg: "rgba(0,201,167,0.15)" },
    partiel: { label: "Partiel", color: "#F5C842", bg: "rgba(245,200,66,0.15)" },
    impaye: { label: "Impayé", color: "#FF4D6D", bg: "rgba(255,77,109,0.15)" },
  };
  const s = map[statut];
  return <Badge style={{ background: s.bg, color: s.color, border: `1px solid ${s.color}44` }}>{s.label}</Badge>;
}

function TrancheBadge({ paid, label }: { paid: boolean; label: string }) {
  return (
    <div className="text-center">
      <div className="text-xs mb-1" style={{ color: "var(--m15-muted)" }}>{label}</div>
      <div className="w-5 h-5 rounded-full mx-auto flex items-center justify-center"
        style={{ background: paid ? "rgba(0,201,167,0.2)" : "rgba(255,77,109,0.15)" }}>
        {paid
          ? <UserCheck className="h-3 w-3" style={{ color: "#00C9A7" }} />
          : <UserX className="h-3 w-3" style={{ color: "#FF4D6D" }} />}
      </div>
    </div>
  );
}

function fmt(v: string) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(parseFloat(v ?? "0"))) + " F";
}

export default function ScolariteClasse() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [classeId, setClasseId] = useState("");
  const [anneeScolaireId, setAnneeScolaireId] = useState("");
  const [search, setSearch] = useState("");
  const [statutFilter, setStatutFilter] = useState("__all__");

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as { annees?: Array<{ id: string; libelle: string }> } | undefined)?.annees ?? [];
  const { data: classesData } = useListerClasses({});
  const classes = (classesData as { classes?: Array<{ id: string; nom: string }> } | undefined)?.classes ?? [];

  const params = {
    ...(anneeScolaireId ? { annee_scolaire_id: anneeScolaireId } : {}),
    ...(statutFilter !== "__all__" ? { statut: statutFilter } : {}),
  };
  const { data: scolariteData, isLoading, refetch } = useGetScolariteClasseClasseId(
    classeId || "00000000-0000-0000-0000-000000000000",
    params,
    { query: { enabled: !!classeId, queryKey: [] } }
  );
  const rows: ScolariteRow[] = (scolariteData as { data?: ScolariteRow[] } | undefined)?.data ?? [];

  const initClasse = usePostScolariteInitialiserClasse();
  const relancer = usePostPaiementsRelancerImpayes();

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return !q || (r.eleve_nom ?? "").toLowerCase().includes(q)
      || (r.eleve_prenoms ?? "").toLowerCase().includes(q)
      || (r.eleve_matricule ?? "").toLowerCase().includes(q);
  });

  function exportCSV() {
    const header = "Nom,Prénom,Matricule,Total dû,Payé,Restant,Inscription,T1,T2,T3,Statut";
    const rows_csv = filtered.map(r =>
      [r.eleve_nom, r.eleve_prenoms, r.eleve_matricule, r.montant_total_du,
       r.montant_total_paye, r.montant_restant,
       r.inscription_payee ? "Oui" : "Non", r.tranche1_payee ? "Oui" : "Non",
       r.tranche2_payee ? "Oui" : "Non", r.tranche3_payee ? "Oui" : "Non", r.statut].join(",")
    ).join("\n");
    const blob = new Blob([header + "\n" + rows_csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `scolarite-${classeId}.csv`;
    a.click();
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--m15-navy)" }}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)", fontSize: 24, fontWeight: 700 }}>
            Scolarité par classe
          </h1>
          <p style={{ color: "var(--m15-muted)", fontSize: 14 }}>Suivi individuel des paiements</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={anneeScolaireId} onValueChange={setAnneeScolaireId}>
            <SelectTrigger className="w-44" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Année scolaire" />
            </SelectTrigger>
            <SelectContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              {annees.map(a => <SelectItem key={a.id} value={a.id} style={{ color: "var(--m15-white)" }}>{a.libelle}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={classeId} onValueChange={setClasseId}>
            <SelectTrigger className="w-40" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
              <SelectValue placeholder="Choisir une classe" />
            </SelectTrigger>
            <SelectContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
              {classes.map(c => <SelectItem key={c.id} value={c.id} style={{ color: "var(--m15-white)" }}>{c.nom}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {classeId && (
        <div className="flex flex-wrap gap-2 mb-4">
          <Button size="sm" style={{ background: "#00C9A7", color: "white" }}
            onClick={() => initClasse.mutate(
              { data: { classe_id: classeId, annee_scolaire_id: anneeScolaireId } } as Parameters<typeof initClasse.mutate>[0],
              {
                onSuccess: () => { toast({ title: "Scolarités initialisées" }); refetch(); },
                onError: (e: unknown) => toast({ title: (e as { message?: string })?.message ?? "Erreur", variant: "destructive" }),
              }
            )}
            disabled={initClasse.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            Initialiser la scolarité
          </Button>
          <Button size="sm" variant="outline"
            style={{ borderColor: "rgba(255,77,109,0.4)", color: "#FF4D6D" }}
            onClick={() => relancer.mutate(
              { data: { classe_id: classeId, annee_scolaire_id: anneeScolaireId, type_relance: "notification" } } as Parameters<typeof relancer.mutate>[0],
              { onSuccess: () => toast({ title: "Relances envoyées" }) }
            )}
            disabled={relancer.isPending}>
            <Send className="h-4 w-4 mr-1" /> Relancer les impayés
          </Button>
          <Button size="sm" variant="outline" onClick={exportCSV}
            style={{ borderColor: "var(--m15-border)", color: "var(--m15-white)" }}>
            <Download className="h-4 w-4 mr-1" /> Export CSV
          </Button>
          <Button size="sm" variant="outline" onClick={() => refetch()}
            style={{ borderColor: "var(--m15-border)", color: "var(--m15-white)" }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Filtres */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "var(--m15-muted)" }} />
          <Input placeholder="Rechercher un élève..." value={search} onChange={e => setSearch(e.target.value)}
            className="pl-9" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }} />
        </div>
        <Select value={statutFilter} onValueChange={setStatutFilter}>
          <SelectTrigger className="w-36" style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
            <SelectItem value="__all__" style={{ color: "var(--m15-white)" }}>Tous statuts</SelectItem>
            <SelectItem value="impaye" style={{ color: "#FF4D6D" }}>Impayé</SelectItem>
            <SelectItem value="partiel" style={{ color: "#F5C842" }}>Partiel</SelectItem>
            <SelectItem value="en_regle" style={{ color: "#00C9A7" }}>En règle</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        {!classeId ? (
          <CardContent className="py-12 text-center">
            <Clock className="h-10 w-10 mx-auto mb-3" style={{ color: "var(--m15-muted)" }} />
            <p style={{ color: "var(--m15-muted)" }}>Sélectionnez une classe pour voir la scolarité</p>
          </CardContent>
        ) : isLoading ? (
          <CardContent className="py-12 text-center">
            <RefreshCw className="h-8 w-8 mx-auto animate-spin" style={{ color: "#00C9A7" }} />
          </CardContent>
        ) : filtered.length === 0 ? (
          <CardContent className="py-12 text-center">
            <p style={{ color: "var(--m15-muted)" }}>Aucune scolarité trouvée. Initialisez d'abord la scolarité.</p>
          </CardContent>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                  {["Élève", "Inscription", "T1", "T2", "T3", "Total payé", "Restant", "Statut", "Actions"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "var(--m15-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id} style={{ borderBottom: "1px solid rgba(0,201,167,0.07)" }}
                    className="hover:bg-[rgba(0,201,167,0.04)] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={r.eleve_photo ?? undefined} />
                          <AvatarFallback style={{ background: "var(--m15-card2)", color: "#00C9A7", fontSize: 11 }}>
                            {(r.eleve_prenoms ?? "?")[0]}{(r.eleve_nom ?? "?")[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium text-sm" style={{ color: "var(--m15-white)" }}>
                            {r.eleve_prenoms} {r.eleve_nom}
                          </p>
                          <p className="text-xs" style={{ color: "var(--m15-muted)" }}>{r.eleve_matricule}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3"><TrancheBadge paid={r.inscription_payee} label="" /></td>
                    <td className="px-4 py-3"><TrancheBadge paid={r.tranche1_payee} label="" /></td>
                    <td className="px-4 py-3"><TrancheBadge paid={r.tranche2_payee} label="" /></td>
                    <td className="px-4 py-3"><TrancheBadge paid={r.tranche3_payee} label="" /></td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: "#00C9A7" }}>{fmt(r.montant_total_paye)}</td>
                    <td className="px-4 py-3 text-sm font-semibold" style={{ color: parseFloat(r.montant_restant) > 0 ? "#FF4D6D" : "#00C9A7" }}>
                      {fmt(r.montant_restant)}
                    </td>
                    <td className="px-4 py-3"><StatutBadge statut={r.statut} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-7 px-2"
                          style={{ color: "#00C9A7" }}
                          onClick={() => navigate(`/scolarite/eleve/${r.eleve_id}`)}>
                          Détail
                        </Button>
                        {r.statut !== "en_regle" && (
                          <Button size="sm" variant="ghost" className="h-7 px-2"
                            style={{ color: "#F5C842" }}
                            onClick={() => navigate(`/scolarite/paiement?eleve_id=${r.eleve_id}`)}>
                            Payer
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
