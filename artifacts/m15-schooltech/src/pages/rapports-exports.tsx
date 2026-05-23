import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useGetApiAnalyticsRapports,
  usePostApiAnalyticsRapportsGenerer,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { getGetApiAnalyticsRapportsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  FileDown, FilePlus, Loader2, CheckCircle, AlertCircle, Clock,
  FileText, FileSpreadsheet, RefreshCw, Zap,
} from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  resultats: "Résultats scolaires",
  absences: "Absences & Présences",
  effectifs: "Effectifs",
  activite_plateforme: "Activité plateforme",
  finances: "Finances",
  personnalise: "Personnalisé",
};

export default function RapportsExports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    titre: "",
    type: "resultats",
    format: "pdf",
    trimestre: "all",
    date_debut: "",
    date_fin: "",
  });

  const { data, isLoading, refetch } = useGetApiAnalyticsRapports();
  const rapports = ((data as any)?.data ?? []) as Array<{
    id: string;
    titre: string;
    type: string;
    format: string;
    statut: string;
    fichier_url: string | null;
    fichier_nom: string | null;
    created_at: string;
    nom_generateur: string;
    prenoms_generateur: string;
  }>;

  const { mutate: generer, isPending: isGenerating } = usePostApiAnalyticsRapportsGenerer({
    mutation: {
      onSuccess: () => {
        toast({ title: "Rapport en cours de génération", description: "Il sera disponible dans quelques instants." });
        setModalOpen(false);
        setForm({ titre: "", type: "resultats", format: "pdf", trimestre: "all", date_debut: "", date_fin: "" });
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: getGetApiAnalyticsRapportsQueryKey() });
        }, 3000);
      },
      onError: () => {
        toast({ title: "Erreur", description: "Impossible de générer le rapport.", variant: "destructive" });
      },
    },
  });

  function handleGenerer() {
    if (!form.titre || !form.type || !form.format) {
      toast({ title: "Champs manquants", description: "Titre, type et format sont requis.", variant: "destructive" });
      return;
    }
    const parametres: Record<string, unknown> = {};
    if (form.trimestre !== "all") parametres.trimestre = parseInt(form.trimestre);
    if (form.date_debut) parametres.date_debut = form.date_debut;
    if (form.date_fin) parametres.date_fin = form.date_fin;
    generer({ data: { titre: form.titre, type: form.type, format: form.format, parametres } });
  }

  function StatutBadge({ statut }: { statut: string }) {
    if (statut === "en_cours") return (
      <Badge className="flex items-center gap-1" style={{ background: "rgba(245,200,66,0.15)", color: "#F5C842", border: "1px solid rgba(245,200,66,0.4)" }}>
        <Loader2 className="w-3 h-3 animate-spin" /> En cours
      </Badge>
    );
    if (statut === "termine") return (
      <Badge className="flex items-center gap-1" style={{ background: "rgba(0,201,167,0.15)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.4)" }}>
        <CheckCircle className="w-3 h-3" /> Prêt
      </Badge>
    );
    return (
      <Badge className="flex items-center gap-1" style={{ background: "rgba(255,77,109,0.15)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.4)" }}>
        <AlertCircle className="w-3 h-3" /> Erreur
      </Badge>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
            Rapports & Exports
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--m15-muted)" }}>
            Générez et téléchargez vos rapports personnalisés
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}
            style={{ borderColor: "var(--m15-border)", color: "var(--m15-muted)" }}>
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button size="sm" onClick={() => setModalOpen(true)}
            style={{ background: "#00C9A7", color: "var(--m15-navy)", fontWeight: 600 }}>
            <FilePlus className="w-4 h-4 mr-2" />
            Nouveau rapport
          </Button>
        </div>
      </div>

      {/* Exports rapides */}
      <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5" style={{ color: "#F5C842" }} />
            <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              Exports rapides
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { label: "Liste élèves par classe", type: "effectifs", format: "excel", icon: FileSpreadsheet, color: "#00C9A7" },
              { label: "Bulletins du trimestre", type: "resultats", format: "pdf", icon: FileText, color: "#0080FF" },
              { label: "Rapport absences mensuel", type: "absences", format: "pdf", icon: FileText, color: "#F5C842" },
              { label: "Palmarès trimestriel", type: "resultats", format: "pdf", icon: FileDown, color: "#F5C842" },
              { label: "État stocks infirmerie", type: "personnalise", format: "excel", icon: FileSpreadsheet, color: "#FF4D6D" },
            ].map(item => (
              <button
                key={item.label}
                onClick={() => {
                  setForm(f => ({ ...f, titre: item.label, type: item.type, format: item.format }));
                  setModalOpen(true);
                }}
                className="flex flex-col items-center gap-2 p-4 rounded-xl text-center transition-all hover:scale-105 cursor-pointer"
                style={{ background: `${item.color}10`, border: `1px solid ${item.color}30` }}
              >
                <item.icon className="w-6 h-6" style={{ color: item.color }} />
                <span className="text-xs font-medium leading-tight" style={{ color: "var(--m15-white)" }}>{item.label}</span>
                <span className="text-xs uppercase font-bold px-2 py-0.5 rounded"
                  style={{ background: `${item.color}20`, color: item.color }}>
                  {item.format.toUpperCase()}
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Liste des rapports */}
      <Card style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
        <CardHeader>
          <CardTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
            Rapports générés ({rapports.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl" style={{ background: "var(--m15-border)" }} />
              ))}
            </div>
          ) : rapports.length === 0 ? (
            <div className="py-16 text-center">
              <FileDown className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: "var(--m15-muted)" }} />
              <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Aucun rapport généré</p>
              <p className="text-xs mt-1" style={{ color: "var(--m15-muted)" }}>Cliquez sur "Nouveau rapport" pour commencer</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--m15-border)" }}>
                    {["Titre", "Type", "Format", "Date", "Statut", "Action"].map(h => (
                      <th key={h} className="text-left py-3 px-5 font-semibold text-xs uppercase tracking-wide"
                        style={{ color: "var(--m15-muted)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rapports.map((r, i) => (
                    <tr key={r.id} style={{ borderBottom: "1px solid var(--m15-border)", background: i % 2 === 0 ? "transparent" : "rgba(0,201,167,0.02)" }}>
                      <td className="py-3 px-5">
                        <p className="font-medium" style={{ color: "var(--m15-white)" }}>{r.titre}</p>
                        <p className="text-xs" style={{ color: "var(--m15-muted)" }}>
                          {r.prenoms_generateur} {r.nom_generateur}
                        </p>
                      </td>
                      <td className="py-3 px-5">
                        <span className="text-xs px-2 py-1 rounded-full"
                          style={{ background: "rgba(0,128,255,0.15)", color: "#0080FF" }}>
                          {TYPE_LABELS[r.type] ?? r.type}
                        </span>
                      </td>
                      <td className="py-3 px-5">
                        {r.format === "pdf" ? (
                          <Badge style={{ background: "rgba(255,77,109,0.15)", color: "#FF4D6D", border: "1px solid rgba(255,77,109,0.4)" }}>
                            <FileText className="w-3 h-3 mr-1" /> PDF
                          </Badge>
                        ) : (
                          <Badge style={{ background: "rgba(0,201,167,0.15)", color: "#00C9A7", border: "1px solid rgba(0,201,167,0.4)" }}>
                            <FileSpreadsheet className="w-3 h-3 mr-1" /> Excel
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-5 text-xs" style={{ color: "var(--m15-muted)" }}>
                        {new Date(r.created_at).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="py-3 px-5">
                        <StatutBadge statut={r.statut} />
                      </td>
                      <td className="py-3 px-5">
                        {r.statut === "termine" && r.fichier_url ? (
                          <Button size="sm" variant="outline"
                            style={{ borderColor: "rgba(0,201,167,0.3)", color: "#00C9A7" }}
                            onClick={() => {
                              toast({ title: "Téléchargement", description: `Fichier: ${r.fichier_nom ?? "rapport"}` });
                            }}>
                            <FileDown className="w-4 h-4 mr-1" /> Télécharger
                          </Button>
                        ) : r.statut === "en_cours" ? (
                          <span className="text-xs flex items-center gap-1" style={{ color: "#F5C842" }}>
                            <Loader2 className="w-3 h-3 animate-spin" /> En attente…
                          </span>
                        ) : (
                          <span className="text-xs" style={{ color: "#FF4D6D" }}>Erreur</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal nouveau rapport */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "var(--m15-white)", fontFamily: "'Syne', sans-serif" }}>
              Générer un rapport
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label style={{ color: "var(--m15-muted)" }}>Titre du rapport *</Label>
              <Input
                value={form.titre}
                onChange={e => setForm(f => ({ ...f, titre: e.target.value }))}
                placeholder="Ex: Résultats Trimestre 1 — 6ème A"
                style={{ background: "var(--m15-bg)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label style={{ color: "var(--m15-muted)" }}>Type *</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger style={{ background: "var(--m15-bg)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label style={{ color: "var(--m15-muted)" }}>Format *</Label>
                <div className="flex gap-2 pt-1">
                  {["pdf", "excel"].map(fmt => (
                    <button
                      key={fmt}
                      onClick={() => setForm(f => ({ ...f, format: fmt }))}
                      className="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
                      style={{
                        background: form.format === fmt ? (fmt === "pdf" ? "rgba(255,77,109,0.2)" : "rgba(0,201,167,0.2)") : "var(--m15-bg)",
                        border: `1px solid ${form.format === fmt ? (fmt === "pdf" ? "#FF4D6D" : "#00C9A7") : "var(--m15-border)"}`,
                        color: form.format === fmt ? (fmt === "pdf" ? "#FF4D6D" : "#00C9A7") : "var(--m15-muted)",
                      }}>
                      {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label style={{ color: "var(--m15-muted)" }}>Trimestre</Label>
              <Select value={form.trimestre} onValueChange={v => setForm(f => ({ ...f, trimestre: v }))}>
                <SelectTrigger style={{ background: "var(--m15-bg)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toute l'année</SelectItem>
                  <SelectItem value="1">Trimestre 1</SelectItem>
                  <SelectItem value="2">Trimestre 2</SelectItem>
                  <SelectItem value="3">Trimestre 3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label style={{ color: "var(--m15-muted)" }}>Date début (optionnel)</Label>
                <Input
                  type="date"
                  value={form.date_debut}
                  onChange={e => setForm(f => ({ ...f, date_debut: e.target.value }))}
                  style={{ background: "var(--m15-bg)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                />
              </div>
              <div className="space-y-1.5">
                <Label style={{ color: "var(--m15-muted)" }}>Date fin (optionnel)</Label>
                <Input
                  type="date"
                  value={form.date_fin}
                  onChange={e => setForm(f => ({ ...f, date_fin: e.target.value }))}
                  style={{ background: "var(--m15-bg)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}
              style={{ borderColor: "var(--m15-border)", color: "var(--m15-muted)" }}>
              Annuler
            </Button>
            <Button onClick={handleGenerer} disabled={isGenerating}
              style={{ background: "#00C9A7", color: "var(--m15-navy)", fontWeight: 600 }}>
              {isGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Génération…</>
              ) : (
                <><FileDown className="w-4 h-4 mr-2" /> Générer</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
