import { useState } from "react";
import {
  useGetStatsCloture,
  usePromouvoirClasse,
  useNotifierParentsDecisions,
  useAnnulerPromotion,
  useGetHistoriquePromotions,
  useListerAnneesScolaires,
  getGetStatsClotureQueryKey,
  getGetHistoriquePromotionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertTriangle, GraduationCap, Bell, RotateCcw, CheckCircle, ArrowRight, Clock } from "lucide-react";

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(" ");

interface StatsClasse {
  classe_id: string;
  classe_nom: string;
  total: number;
  admis: number;
  redoublants: number;
  exclus: number;
  sortie: number;
  sans_decision: number;
  taux_reussite: number;
  promotion_effectuee: boolean;
}

interface PromotionHistorique {
  id: string;
  classe_source_nom: string;
  classe_destination_nom: string;
  annee_source: string;
  annee_destination: string;
  nb_eleves_promus: number;
  nb_eleves_redoublants: number;
  nb_eleves_exclus: number;
  nb_eleves_sortie: number;
  statut: string;
  date_promotion: string;
  effectuee_par: string;
}

export default function ValidationPromotion() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [anneeSourceId, setAnneeSourceId] = useState("");
  const [anneeDestId, setAnneeDestId] = useState("");
  const [confirmModal, setConfirmModal] = useState<StatsClasse | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [annulerModal, setAnnulerModal] = useState<string | null>(null);

  const { data: anneesData } = useListerAnneesScolaires();
  const annees = (anneesData as { data?: { annees?: Array<{ id: string; libelle: string; est_active: boolean }> } })?.data?.annees ?? [];
  const anneeActive = annees.find(a => a.est_active);
  const selectedSource = anneeSourceId || anneeActive?.id || "";

  const { data: statsData } = useGetStatsCloture(
    { annee_scolaire_id: selectedSource },
    { query: { enabled: !!selectedSource, queryKey: getGetStatsClotureQueryKey({ annee_scolaire_id: selectedSource }) } }
  );
  const stats = (statsData as { data?: { par_classe?: StatsClasse[]; totaux?: { admis: number; total: number; sans_decision: number }; promotions?: { id: string }[] } })?.data;
  const parClasse = stats?.par_classe ?? [];
  const totaux = stats?.totaux ?? { admis: 0, total: 0, sans_decision: 0 };

  const { data: histData } = useGetHistoriquePromotions(
    { annee_scolaire_id: selectedSource },
    { query: { enabled: !!selectedSource, queryKey: getGetHistoriquePromotionsQueryKey({ annee_scolaire_id: selectedSource }) } }
  );
  const historique = ((histData as { data?: PromotionHistorique[] })?.data ?? []);

  const { mutate: promouvoir, isPending: promoting } = usePromouvoirClasse({
    mutation: {
      onSuccess: () => {
        toast({ title: "Promotion effectuée avec succès !" });
        qc.invalidateQueries({ queryKey: getGetStatsClotureQueryKey({ annee_scolaire_id: selectedSource }) });
        qc.invalidateQueries({ queryKey: getGetHistoriquePromotionsQueryKey({ annee_scolaire_id: selectedSource }) });
        setConfirmModal(null);
        setConfirmAll(false);
      },
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Erreur";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    },
  });

  const { mutate: notifier, isPending: notifying } = useNotifierParentsDecisions({
    mutation: {
      onSuccess: (data: unknown) => {
        const d = (data as { data?: { nb_notifies?: number } })?.data;
        toast({ title: `${d?.nb_notifies ?? 0} parents notifiés` });
      },
      onError: () => toast({ title: "Erreur notification", variant: "destructive" }),
    },
  });

  const { mutate: annuler, isPending: annulant } = useAnnulerPromotion({
    mutation: {
      onSuccess: () => {
        toast({ title: "Promotion annulée" });
        qc.invalidateQueries({ queryKey: getGetHistoriquePromotionsQueryKey({ annee_scolaire_id: selectedSource }) });
        setAnnulerModal(null);
      },
      onError: (e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Annulation impossible";
        toast({ title: "Erreur", description: msg, variant: "destructive" });
      },
    },
  });

  const lancerPromotion = (classe: StatsClasse) => {
    if (!anneeDestId) { toast({ title: "Sélectionnez l'année destination", variant: "destructive" }); return; }
    promouvoir({
      data: {
        annee_scolaire_source_id: selectedSource,
        annee_scolaire_destination_id: anneeDestId,
        classe_source_id: classe.classe_id,
      },
    });
  };

  const lancerTout = () => {
    const eligibles = parClasse.filter(c => c.sans_decision === 0 && !c.promotion_effectuee);
    for (const classe of eligibles) {
      promouvoir({
        data: {
          annee_scolaire_source_id: selectedSource,
          annee_scolaire_destination_id: anneeDestId,
          classe_source_id: classe.classe_id,
        },
      });
    }
  };

  const classesEligibles = parClasse.filter(c => c.sans_decision === 0 && !c.promotion_effectuee);
  const toutesEligibles = classesEligibles.length > 0 && classesEligibles.length === parClasse.filter(c => !c.promotion_effectuee).length;

  return (
    <div className="min-h-screen bg-[#0A1628] text-white p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
            Validation & Promotion
          </h1>
          <p className="text-[#8B9DC3] text-sm">Finalisez l'année et promotionnez les élèves</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Select value={selectedSource} onValueChange={setAnneeSourceId}>
            <SelectTrigger className="w-44 bg-[#111E35] border-[rgba(0,201,167,0.15)] text-white">
              <SelectValue placeholder="Année source" />
            </SelectTrigger>
            <SelectContent className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
              {annees.map(a => <SelectItem key={a.id} value={a.id} className="text-white">{a.libelle}</SelectItem>)}
            </SelectContent>
          </Select>
          <ArrowRight className="w-5 h-5 text-[#8B9DC3] self-center" />
          <Select value={anneeDestId} onValueChange={setAnneeDestId}>
            <SelectTrigger className="w-44 bg-[#111E35] border-[rgba(0,201,167,0.15)] text-white">
              <SelectValue placeholder="Année destination" />
            </SelectTrigger>
            <SelectContent className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
              {annees.filter(a => a.id !== selectedSource).map(a => (
                <SelectItem key={a.id} value={a.id} className="text-white">{a.libelle}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notifications */}
      <Card className="bg-[#111E35] border-[rgba(0,201,167,0.15)] mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-[#F5C842]" />
              <h2 className="font-bold text-white">Notifications parents</h2>
              <span className="text-[#8B9DC3] text-sm">— informer avant la promotion</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline" size="sm"
                onClick={() => notifier({ data: { annee_scolaire_id: selectedSource } })}
                disabled={!selectedSource || notifying}
                className="border-[#F5C842]/50 text-[#F5C842] hover:bg-[#F5C842]/10"
              >
                <Bell className="w-4 h-4 mr-1" />
                {notifying ? "Envoi..." : "Notifier tous les parents"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Classes à promouvoir */}
      <Card className="bg-[#111E35] border-[rgba(0,201,167,0.15)] mb-6">
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-white text-lg">Promotions par classe</h2>
            {toutesEligibles && (
              <Button
                onClick={() => setConfirmAll(true)}
                disabled={!anneeDestId || promoting}
                className="bg-[#00C9A7] text-[#0A1628] font-semibold hover:bg-[#00C9A7]/80"
              >
                <GraduationCap className="w-4 h-4 mr-2" />
                Promouvoir toutes les classes
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {parClasse.map(c => (
              <div key={c.classe_id}
                className={cn(
                  "bg-[#0A1628] rounded-lg p-4 border transition-all",
                  c.promotion_effectuee ? "border-[#00C9A7]/30" :
                  c.sans_decision > 0 ? "border-[#FF4D6D]/30" : "border-[rgba(0,201,167,0.15)]"
                )}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-white">{c.classe_nom}</span>
                  {c.promotion_effectuee ? (
                    <Badge className="bg-[#00C9A7]/20 text-[#00C9A7] border border-[#00C9A7]/30 text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" /> Promue
                    </Badge>
                  ) : c.sans_decision > 0 ? (
                    <Badge className="bg-[#FF4D6D]/20 text-[#FF4D6D] border border-[#FF4D6D]/30 text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" /> {c.sans_decision} sans décision
                    </Badge>
                  ) : (
                    <Badge className="bg-[#00C9A7]/20 text-[#00C9A7] border border-[#00C9A7]/30 text-xs">
                      Prête
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs text-[#8B9DC3] mb-3">
                  <span>Admis : <b className="text-[#00C9A7]">{c.admis}</b></span>
                  <span>Redoublants : <b className="text-[#F5C842]">{c.redoublants}</b></span>
                  <span>Exclus : <b className="text-[#FF4D6D]">{c.exclus}</b></span>
                  <span>Sortie : <b className="text-[#8B9DC3]">{c.sortie}</b></span>
                </div>
                {!c.promotion_effectuee && c.sans_decision === 0 && (
                  <Button
                    size="sm" className="w-full bg-[#0080FF] hover:bg-[#0080FF]/80 text-white text-xs"
                    onClick={() => setConfirmModal(c)}
                    disabled={!anneeDestId || promoting}
                  >
                    <GraduationCap className="w-3 h-3 mr-1" /> Promouvoir cette classe
                  </Button>
                )}
                {c.sans_decision > 0 && (
                  <p className="text-[#FF4D6D] text-xs">⚠ {c.sans_decision} élève(s) sans décision — promotion bloquée</p>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Historique */}
      {historique.length > 0 && (
        <Card className="bg-[#111E35] border-[rgba(0,201,167,0.15)]">
          <CardContent className="p-4">
            <h2 className="font-bold text-white text-lg mb-4">Historique des promotions</h2>
            <div className="space-y-3">
              {historique.map(p => (
                <div key={p.id} className="bg-[#0A1628] rounded-lg p-3 flex flex-wrap items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{p.classe_source_nom}</span>
                      <ArrowRight className="w-3 h-3 text-[#8B9DC3]" />
                      <span className="text-[#00C9A7]">{p.classe_destination_nom}</span>
                    </div>
                    <div className="text-[#8B9DC3] text-xs mt-1">
                      {new Date(p.date_promotion).toLocaleDateString("fr-CI")} — par {p.effectuee_par}
                    </div>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className="text-[#00C9A7]">{p.nb_eleves_promus} promus</span>
                    <span className="text-[#F5C842]">{p.nb_eleves_redoublants} redoublants</span>
                  </div>
                  <Badge className={cn(
                    "border text-xs",
                    p.statut === "terminee" ? "bg-[#00C9A7]/20 text-[#00C9A7] border-[#00C9A7]/30" :
                    p.statut === "annulee" ? "bg-[#8B9DC3]/20 text-[#8B9DC3] border-[#8B9DC3]/30" :
                    "bg-[#F5C842]/20 text-[#F5C842] border-[#F5C842]/30"
                  )}>
                    {p.statut}
                  </Badge>
                  {p.statut === "terminee" && (
                    <Button size="sm" variant="ghost"
                      onClick={() => setAnnulerModal(p.id)}
                      className="text-[#FF4D6D] hover:bg-[#FF4D6D]/10 text-xs">
                      <RotateCcw className="w-3 h-3 mr-1" /> Annuler
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal confirmation promotion classe */}
      <Dialog open={!!confirmModal} onOpenChange={() => setConfirmModal(null)}>
        <DialogContent className="bg-[#111E35] border-[rgba(0,201,167,0.15)] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Confirmer la promotion</DialogTitle>
          </DialogHeader>
          {confirmModal && (
            <div className="space-y-3">
              <p className="text-[#8B9DC3]">
                Vous allez promouvoir <b className="text-white">{confirmModal.admis} élèves</b> de{" "}
                <b className="text-[#00C9A7]">{confirmModal.classe_nom}</b> vers la classe supérieure.
              </p>
              <div className="bg-[#0A1628] rounded p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-[#8B9DC3]">Admis :</span> <span className="text-[#00C9A7] font-bold">{confirmModal.admis}</span></div>
                <div className="flex justify-between"><span className="text-[#8B9DC3]">Redoublants :</span> <span className="text-[#F5C842] font-bold">{confirmModal.redoublants}</span></div>
                <div className="flex justify-between"><span className="text-[#8B9DC3]">Exclus :</span> <span className="text-[#FF4D6D] font-bold">{confirmModal.exclus}</span></div>
                <div className="flex justify-between"><span className="text-[#8B9DC3]">Sortie :</span> <span className="text-[#8B9DC3] font-bold">{confirmModal.sortie}</span></div>
              </div>
              <p className="text-[#FF4D6D] text-sm flex items-center gap-1">
                <AlertTriangle className="w-4 h-4" />
                Cette action est irréversible après 24h.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmModal(null)} className="text-[#8B9DC3]">Annuler</Button>
            <Button
              onClick={() => confirmModal && lancerPromotion(confirmModal)}
              disabled={promoting}
              className="bg-[#00C9A7] text-[#0A1628] font-semibold"
            >
              {promoting ? "En cours..." : "Confirmer la promotion"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal confirmation tout promouvoir */}
      <Dialog open={confirmAll} onOpenChange={setConfirmAll}>
        <DialogContent className="bg-[#111E35] border-[rgba(0,201,167,0.15)] text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Promouvoir toutes les classes</DialogTitle>
          </DialogHeader>
          <p className="text-[#8B9DC3]">
            Vous allez promouvoir <b className="text-white">{classesEligibles.length} classes</b> en une seule opération.
            Cette action est irréversible après 24h.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmAll(false)} className="text-[#8B9DC3]">Annuler</Button>
            <Button onClick={lancerTout} disabled={promoting} className="bg-[#00C9A7] text-[#0A1628] font-semibold">
              {promoting ? "En cours..." : "Tout promouvoir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal annuler promotion */}
      <Dialog open={!!annulerModal} onOpenChange={() => setAnnulerModal(null)}>
        <DialogContent className="bg-[#111E35] border-[rgba(0,201,167,0.15)] text-white">
          <DialogHeader>
            <DialogTitle className="text-white text-[#FF4D6D]">Annuler cette promotion</DialogTitle>
          </DialogHeader>
          <p className="text-[#8B9DC3]">
            L'annulation est possible uniquement dans les 24h suivant la promotion.
            Toutes les inscriptions créées seront supprimées.
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAnnulerModal(null)} className="text-[#8B9DC3]">Retour</Button>
            <Button
              onClick={() => annulerModal && annuler({ id: annulerModal })}
              disabled={annulant}
              className="bg-[#FF4D6D] text-white"
            >
              {annulant ? "Annulation..." : "Confirmer l'annulation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
