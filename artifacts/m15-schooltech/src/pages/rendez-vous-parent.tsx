import { useState } from "react";
import {
  useListerRendezVous, useDemanderRendezVous, useConfirmerRendezVous,
  useAnnulerRendezVous, useTerminerRendezVous,
  getListerRendezVousQueryKey, getGetContactsDisponiblesQueryKey, getGetMesEnfantsQueryKey,
  useGetContactsDisponibles, useGetMesEnfants,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  CalendarCheck, Plus, MapPin, Check, X, CheckCheck, Loader2, User,
} from "lucide-react";

const STATUT_COLORS: Record<string, string> = {
  en_attente: "#F5C842",
  confirme:   "#00C9A7",
  annule:     "#ef4444",
  termine:    "#6b7280",
};

const STATUT_LABELS: Record<string, string> = {
  en_attente: "En attente",
  confirme:   "Confirmé",
  annule:     "Annulé",
  termine:    "Terminé",
};

export default function RendezVousParent() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [demandeOpen, setDemandeOpen] = useState(false);
  const [confirmeId, setConfirmeId] = useState<string | null>(null);
  const [filterStatut, setFilterStatut] = useState<string>("tous");

  const rdvParams = {};
  const rdvQk = getListerRendezVousQueryKey(rdvParams);
  const { data, isLoading } = useListerRendezVous(
    rdvParams,
    { query: { queryKey: rdvQk, staleTime: 30_000 } }
  );

  const rdvs = (data as any)?.rdvs ?? [];
  const filtered = filterStatut === "tous" ? rdvs : rdvs.filter((r: any) => r.statut === filterStatut);

  const annulerMut = useAnnulerRendezVous({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: rdvQk });
        toast({ title: "Rendez-vous annulé" });
      },
      onError: () => toast({ title: "Erreur", variant: "destructive" }),
    },
  });

  const confirmerMut = useConfirmerRendezVous({
    mutation: {
      onSuccess: () => {
        setConfirmeId(null);
        qc.invalidateQueries({ queryKey: rdvQk });
        toast({ title: "Rendez-vous confirmé ✓" });
      },
      onError: () => toast({ title: "Erreur", variant: "destructive" }),
    },
  });

  const terminerMut = useTerminerRendezVous({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: rdvQk });
        toast({ title: "Rendez-vous marqué comme terminé" });
      },
      onError: () => toast({ title: "Erreur", variant: "destructive" }),
    },
  });

  const peutDemander = user?.role === "parent";
  const isStaff = ["directeur","censeur","professeur"].includes(user?.role ?? "");

  /* Stats */
  const stats = { en_attente: 0, confirme: 0, termine: 0, annule: 0 };
  for (const r of rdvs) stats[r.statut as keyof typeof stats]++;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Poppins, sans-serif" }}>Rendez-vous</h1>
          <p className="text-muted-foreground text-sm">Gérez vos rendez-vous avec l'équipe pédagogique</p>
        </div>
        {peutDemander && (
          <Button
            onClick={() => setDemandeOpen(true)}
            className="gap-2"
            style={{ background: "linear-gradient(135deg, #0080FF, #00C9A7)", border: "none" }}
          >
            <Plus className="h-4 w-4" /> Demander un RDV
          </Button>
        )}
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(["en_attente","confirme","termine","annule"] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilterStatut(filterStatut === s ? "tous" : s)}
            className={cn(
              "p-3 rounded-xl text-left border transition-all",
              filterStatut === s ? "shadow-md" : "hover:bg-muted/50"
            )}
            style={filterStatut === s ? { borderColor: STATUT_COLORS[s], borderWidth: 2 } : {}}
          >
            <p className="text-2xl font-bold" style={{ color: STATUT_COLORS[s] }}>{stats[s]}</p>
            <p className="text-xs text-muted-foreground">{STATUT_LABELS[s]}</p>
          </button>
        ))}
      </div>

      {/* Filtre */}
      <div className="flex items-center gap-3">
        <Select value={filterStatut} onValueChange={setFilterStatut}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tous">Tous</SelectItem>
            <SelectItem value="en_attente">En attente</SelectItem>
            <SelectItem value="confirme">Confirmés</SelectItem>
            <SelectItem value="termine">Terminés</SelectItem>
            <SelectItem value="annule">Annulés</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} rendez-vous</span>
      </div>

      {/* Liste */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <CalendarCheck className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-30" />
          <p className="text-muted-foreground">Aucun rendez-vous{filterStatut !== "tous" ? " avec ce statut" : ""}.</p>
          {peutDemander && filterStatut === "tous" && (
            <Button variant="outline" className="mt-3" onClick={() => setDemandeOpen(true)}>
              <Plus className="h-4 w-4 mr-2" /> Demander un rendez-vous
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((rdv: any) => (
            <Card key={rdv.id} className="border-0 shadow-sm overflow-hidden">
              <div className="h-1 w-full" style={{ background: STATUT_COLORS[rdv.statut] }} />
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Date */}
                  <div className="text-center flex-shrink-0 w-14">
                    <p className="text-lg font-bold leading-none">
                      {rdv.date_rdv ? new Date(rdv.date_rdv).getDate() : "—"}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase">
                      {rdv.date_rdv ? new Date(rdv.date_rdv).toLocaleDateString("fr-FR", { month: "short" }) : ""}
                    </p>
                    <p className="text-xs font-mono mt-1">{rdv.heure_rdv}</p>
                  </div>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Badge
                        className="text-xs font-semibold border-0"
                        style={{ background: STATUT_COLORS[rdv.statut] + "20", color: STATUT_COLORS[rdv.statut] }}
                      >
                        {STATUT_LABELS[rdv.statut]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{rdv.duree_minutes} min</Badge>
                    </div>

                    <p className="font-semibold text-sm">{rdv.motif}</p>

                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <User className="h-3 w-3" />
                        Enfant : {rdv.eleve_prenoms} {rdv.eleve_nom}
                      </p>
                      {(rdv.professeur_nom || rdv.directeur_nom) && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Avec : {rdv.professeur_nom ?? rdv.directeur_nom}
                        </p>
                      )}
                      {rdv.lieu && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {rdv.lieu}
                        </p>
                      )}
                    </div>

                    {rdv.notes_rdv && (
                      <p className="text-xs mt-1 text-muted-foreground italic">"{rdv.notes_rdv}"</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 flex-shrink-0 flex-col sm:flex-row">
                    {rdv.statut === "en_attente" && isStaff && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1"
                        style={{ borderColor: "#00C9A7", color: "#00C9A7" }}
                        onClick={() => setConfirmeId(rdv.id)}
                      >
                        <Check className="h-3.5 w-3.5" /> Confirmer
                      </Button>
                    )}
                    {rdv.statut === "confirme" && isStaff && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs gap-1"
                        onClick={() => terminerMut.mutate({ id: rdv.id })}
                        disabled={terminerMut.isPending}
                      >
                        <CheckCheck className="h-3.5 w-3.5" /> Terminé
                      </Button>
                    )}
                    {["en_attente","confirme"].includes(rdv.statut) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1 text-red-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => annulerMut.mutate({ id: rdv.id })}
                        disabled={annulerMut.isPending}
                      >
                        <X className="h-3.5 w-3.5" /> Annuler
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal demande RDV */}
      {peutDemander && (
        <DemandeRdvModal
          open={demandeOpen}
          onClose={() => setDemandeOpen(false)}
          onSent={() => {
            setDemandeOpen(false);
            qc.invalidateQueries({ queryKey: rdvQk });
          }}
        />
      )}

      {/* Modal confirmer RDV */}
      {confirmeId && (
        <ConfirmerRdvModal
          open={!!confirmeId}
          onClose={() => setConfirmeId(null)}
          onConfirm={(d) => confirmerMut.mutate({ id: confirmeId!, data: d })}
          isPending={confirmerMut.isPending}
        />
      )}
    </div>
  );
}

/* ── Modal demande ──────────────────────────────────────────── */
function DemandeRdvModal({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const { toast } = useToast();
  const [interlocuteurId, setInterlocuteurId] = useState("");
  const [interlocuteurRole, setInterlocuteurRole] = useState<"professeur"|"directeur">("professeur");
  const [eleveId, setEleveId] = useState("");
  const [motif, setMotif] = useState("");
  const [dateRdv, setDateRdv] = useState("");
  const [heureRdv, setHeureRdv] = useState("09:00");
  const [duree, setDuree] = useState("30");

  const contactsQk = getGetContactsDisponiblesQueryKey();
  const { data: contactsData } = useGetContactsDisponibles({ query: { queryKey: contactsQk, enabled: open } });
  const enfantsQk = getGetMesEnfantsQueryKey();
  const { data: enfantsData } = useGetMesEnfants({ query: { queryKey: enfantsQk, enabled: open } });

  const contacts = (contactsData as any)?.contacts ?? [];
  const enfants = (enfantsData as any)?.enfants ?? [];

  const filteredContacts = contacts.filter((c: any) =>
    interlocuteurRole === "professeur" ? c.role === "professeur" : ["directeur","censeur"].includes(c.role)
  );

  const mut = useDemanderRendezVous({
    mutation: {
      onSuccess: () => {
        setInterlocuteurId(""); setEleveId(""); setMotif(""); setDateRdv(""); setHeureRdv("09:00"); setDuree("30");
        onSent();
        toast({ title: "Demande de rendez-vous envoyée ✓" });
      },
      onError: (e: any) => toast({ title: e?.message ?? "Erreur", variant: "destructive" }),
    },
  });

  const payload: Record<string, string | number> = {
    eleve_id: eleveId,
    motif: motif.trim(),
    date_rdv: dateRdv,
    heure_rdv: heureRdv,
    duree_minutes: Number(duree),
  };
  if (interlocuteurRole === "professeur") payload.professeur_id = interlocuteurId;
  else payload.directeur_id = interlocuteurId;

  const canSubmit = eleveId && interlocuteurId && motif.trim() && dateRdv && heureRdv;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarCheck className="h-5 w-5" style={{ color: "#0080FF" }} />
            Demander un rendez-vous
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Enfant */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Concernant</label>
            <Select value={eleveId} onValueChange={setEleveId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir l'enfant" />
              </SelectTrigger>
              <SelectContent>
                {enfants.map((e: any) => (
                  <SelectItem key={e.eleve_id} value={e.eleve_id}>
                    {e.prenoms} {e.nom} — {e.classe_nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Type interlocuteur */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Rencontrer</label>
            <div className="flex gap-2">
              {(["professeur","directeur"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => { setInterlocuteurRole(r); setInterlocuteurId(""); }}
                  className={cn(
                    "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                    interlocuteurRole === r ? "text-[var(--m15-white)] border-transparent" : "hover:bg-muted"
                  )}
                  style={interlocuteurRole === r ? { background: "linear-gradient(135deg, #0A1628, #0080FF)" } : {}}
                >
                  {r === "professeur" ? "Un professeur" : "La direction"}
                </button>
              ))}
            </div>
          </div>

          {/* Interlocuteur */}
          <div>
            <Select value={interlocuteurId} onValueChange={setInterlocuteurId}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir la personne" />
              </SelectTrigger>
              <SelectContent>
                {filteredContacts.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.prenoms} {c.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motif */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Motif</label>
            <Textarea
              placeholder="Raison du rendez-vous…"
              value={motif}
              onChange={e => setMotif(e.target.value)}
              className="min-h-[80px]"
            />
          </div>

          {/* Date + Heure */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Date souhaitée</label>
              <Input type="date" value={dateRdv} onChange={e => setDateRdv(e.target.value)} min={new Date().toISOString().slice(0,10)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Heure</label>
              <Input type="time" value={heureRdv} onChange={e => setHeureRdv(e.target.value)} />
            </div>
          </div>

          {/* Durée */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">Durée</label>
            <Select value={duree} onValueChange={setDuree}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="15">15 minutes</SelectItem>
                <SelectItem value="30">30 minutes</SelectItem>
                <SelectItem value="45">45 minutes</SelectItem>
                <SelectItem value="60">1 heure</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={!canSubmit || mut.isPending}
            onClick={() => mut.mutate({ data: payload as any })}
            style={{ background: "linear-gradient(135deg, #0080FF, #00C9A7)", border: "none" }}
          >
            {mut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarCheck className="h-4 w-4 mr-2" />}
            Envoyer la demande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ── Modal confirmation ─────────────────────────────────────── */
function ConfirmerRdvModal({ open, onClose, onConfirm, isPending }: {
  open: boolean; onClose: () => void;
  onConfirm: (data: { lieu?: string; notes_rdv?: string }) => void; isPending: boolean;
}) {
  const [lieu, setLieu] = useState("");
  const [notes, setNotes] = useState("");
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Confirmer le rendez-vous</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Lieu (optionnel)</label>
            <Input placeholder="Salle de direction, Salle 12…" value={lieu} onChange={e => setLieu(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Notes (optionnel)</label>
            <Textarea placeholder="Instructions ou précisions…" value={notes} onChange={e => setNotes(e.target.value)} className="min-h-[80px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button
            disabled={isPending}
            onClick={() => onConfirm({ lieu: lieu || undefined, notes_rdv: notes || undefined })}
            style={{ background: "#00C9A7", border: "none" }}
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Confirmer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
