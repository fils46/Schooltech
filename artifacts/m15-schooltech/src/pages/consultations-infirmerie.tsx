import React, { useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Plus, Search, Stethoscope, Users, Clock, ChevronLeft, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  useGetInfirmerieConsultations,
  getGetInfirmerieConsultationsQueryKey,
} from "@workspace/api-client-react";

const STATUT_COLORS: Record<string, string> = {
  en_cours: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  termine: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  renvoye_domicile: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  hospitalise: "bg-red-500/20 text-red-300 border-red-500/30",
};
const STATUT_LABELS: Record<string, string> = {
  en_cours: "En cours",
  termine: "Terminé",
  renvoye_domicile: "Renvoyé à domicile",
  hospitalise: "Hospitalisé",
};

interface ConsultationItem {
  id: string;
  eleve_nom?: string;
  eleve_prenoms?: string;
  eleve_photo?: string;
  classe_nom?: string;
  infirmier_nom?: string;
  motif: string;
  heure_entree: string;
  heure_sortie?: string;
  statut: string;
  parent_notifie: boolean;
}

export default function ConsultationsInfirmerie() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [page, setPage] = useState(1);
  const [statutFilter, setStatutFilter] = useState("tous");
  const [search, setSearch] = useState("");

  const { data, isLoading } = useGetInfirmerieConsultations({
    statut: statutFilter !== "tous" ? statutFilter : undefined,
    page,
    limit: 20,
  });

  const consultations: ConsultationItem[] = (data as { consultations?: ConsultationItem[] } | undefined)?.consultations ?? [];
  const total = (data as { total?: number } | undefined)?.total ?? 0;
  const totalPages = (data as { totalPages?: number } | undefined)?.totalPages ?? 1;

  const filtered = search
    ? consultations.filter(c =>
        `${c.eleve_nom ?? ""} ${c.eleve_prenoms ?? ""}`.toLowerCase().includes(search.toLowerCase()) ||
        c.motif.toLowerCase().includes(search.toLowerCase()),
      )
    : consultations;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--m15-white)] flex items-center gap-2">
            <Stethoscope className="h-7 w-7 text-rose-400" />
            Consultations
          </h1>
          <p className="text-[var(--m15-muted)] text-sm mt-1">{total} consultation(s) au total</p>
        </div>
        {user?.role === "infirmier" && (
          <Button
            onClick={() => navigate("/infirmerie/nouvelle-consultation")}
            className="bg-rose-600 hover:bg-rose-700 text-[var(--m15-white)] gap-2"
          >
            <Plus className="h-4 w-4" />
            Nouvelle consultation
          </Button>
        )}
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--m15-muted)]" />
          <Input
            placeholder="Rechercher par élève ou motif…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
          />
        </div>
        <Select value={statutFilter} onValueChange={v => { setStatutFilter(v); setPage(1); }}>
          <SelectTrigger className="bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)] w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <SelectItem value="tous" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Tous les statuts</SelectItem>
            <SelectItem value="en_cours" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">En cours</SelectItem>
            <SelectItem value="termine" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Terminé</SelectItem>
            <SelectItem value="renvoye_domicile" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Renvoyé à domicile</SelectItem>
            <SelectItem value="hospitalise" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Hospitalisé</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center text-[var(--m15-muted)] py-12">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-[var(--m15-muted)] py-12 flex flex-col items-center gap-2">
              <Stethoscope className="h-10 w-10 text-[var(--m15-muted)]" />
              <p>Aucune consultation trouvée</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {filtered.map(c => (
                <div
                  key={c.id}
                  className="flex items-center gap-4 p-4 hover:bg-[var(--elevate-1)] transition-colors cursor-pointer"
                  onClick={() => navigate(`/infirmerie/consultation/${c.id}`)}
                >
                  {c.eleve_photo ? (
                    <img src={c.eleve_photo} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-[var(--m15-card2)] flex items-center justify-center shrink-0">
                      <Users className="h-5 w-5 text-[var(--m15-muted)]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-[var(--m15-white)] font-medium truncate">
                        {c.eleve_nom} {c.eleve_prenoms}
                      </p>
                      {c.classe_nom && (
                        <span className="text-[var(--m15-muted)] text-xs shrink-0">{c.classe_nom}</span>
                      )}
                    </div>
                    <p className="text-[var(--m15-muted)] text-sm truncate">{c.motif}</p>
                    {c.infirmier_nom && (
                      <p className="text-[var(--m15-muted)] text-xs">Suivi par : {c.infirmier_nom}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge className={STATUT_COLORS[c.statut] ?? ""} variant="outline">
                      {STATUT_LABELS[c.statut] ?? c.statut}
                    </Badge>
                    <div className="flex items-center gap-1 text-[var(--m15-muted)] text-xs">
                      <Clock className="h-3 w-3" />
                      {new Date(c.heure_entree).toLocaleString("fr-FR", {
                        day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-[var(--m15-muted)] text-sm">Page {page} / {totalPages}</p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="border-[var(--m15-border)] text-[var(--m15-white)] hover:text-[var(--m15-white)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="border-[var(--m15-border)] text-[var(--m15-white)] hover:text-[var(--m15-white)]"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
