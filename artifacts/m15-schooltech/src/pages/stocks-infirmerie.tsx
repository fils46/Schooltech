import React, { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Package, Plus, AlertTriangle, TrendingDown, TrendingUp,
  Search, Calendar, Edit2, ArrowUpDown, Clock,
} from "lucide-react";
import {
  useGetInfirmerieStocks,
  usePostInfirmerieStocks,
  usePostInfirmerieStocksIdMouvement,
  usePutInfirmerieStocksId,
  getGetInfirmerieStocksQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const CATEGORIE_LABELS: Record<string, string> = {
  medicament: "Médicament",
  materiel: "Matériel",
  consommable: "Consommable",
};
const CATEGORIE_COLORS: Record<string, string> = {
  medicament: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  materiel: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  consommable: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
};

interface StockItem {
  id: string;
  nom: string;
  categorie: string;
  quantite: number;
  unite: string;
  seuil_alerte: number;
  date_expiration?: string | null;
  statut_stock: string;
}

function StatutBadge({ statut }: { statut: string }) {
  if (statut === "rupture") return (
    <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">Rupture</Badge>
  );
  if (statut === "alerte") return (
    <Badge variant="outline" className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">Alerte</Badge>
  );
  return (
    <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">OK</Badge>
  );
}

export default function StocksInfirmerie() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const qc = useQueryClient();

  if (user && user.role === "censeur") {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center py-20">
        <div className="text-5xl">🔒</div>
        <h2 className="text-xl font-bold text-[var(--m15-white)]">Accès refusé</h2>
        <p className="text-[var(--m15-muted)] max-w-xs">
          Le censeur n'a pas accès à la gestion des stocks infirmerie.
        </p>
        <button
          onClick={() => navigate("/infirmerie")}
          className="text-cyan-400 hover:underline text-sm"
        >
          ← Retour au tableau de bord infirmerie
        </button>
      </div>
    );
  }
  const [search, setSearch] = useState("");
  const [categorieFilter, setCategorieFilter] = useState("tous");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showMouvementDialog, setShowMouvementDialog] = useState(false);
  const [editingStock, setEditingStock] = useState<StockItem | null>(null);
  const [selectedStock, setSelectedStock] = useState<StockItem | null>(null);

  const [form, setForm] = useState({ nom: "", categorie: "medicament", quantite: 0, unite: "", seuil_alerte: 5, date_expiration: "" });
  const [mouvementForm, setMouvementForm] = useState({ type: "entree", quantite: 1, motif: "" });

  const { data } = useGetInfirmerieStocks({
    categorie: categorieFilter !== "tous" ? categorieFilter : undefined,
  });

  const stocks: StockItem[] = (data as { stocks?: StockItem[] } | undefined)?.stocks ?? [];
  const enAlerte = (data as { en_alerte?: number } | undefined)?.en_alerte ?? 0;
  const enRupture = (data as { en_rupture?: number } | undefined)?.en_rupture ?? 0;

  const filtered = stocks.filter(s =>
    s.nom.toLowerCase().includes(search.toLowerCase()),
  );

  const { mutate: addStock, isPending: isAdding } = usePostInfirmerieStocks();
  const { mutate: updateStock, isPending: isUpdating } = usePutInfirmerieStocksId();
  const { mutate: mouvement, isPending: isMouvPending } = usePostInfirmerieStocksIdMouvement();

  function handleAddOrEdit() {
    const payload = {
      nom: form.nom,
      categorie: form.categorie,
      quantite: Number(form.quantite),
      unite: form.unite,
      seuil_alerte: Number(form.seuil_alerte),
      date_expiration: form.date_expiration || undefined,
    };
    if (editingStock) {
      updateStock(
        { id: editingStock.id, data: payload },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getGetInfirmerieStocksQueryKey() });
            setShowAddDialog(false);
            setEditingStock(null);
          },
        },
      );
    } else {
      addStock(
        { data: payload },
        {
          onSuccess: () => {
            qc.invalidateQueries({ queryKey: getGetInfirmerieStocksQueryKey() });
            setShowAddDialog(false);
            setForm({ nom: "", categorie: "medicament", quantite: 0, unite: "", seuil_alerte: 5, date_expiration: "" });
          },
        },
      );
    }
  }

  function openMouvement(stock: StockItem) {
    setSelectedStock(stock);
    setMouvementForm({ type: "entree", quantite: 1, motif: "" });
    setShowMouvementDialog(true);
  }

  function handleMouvement() {
    mouvement(
      {
        id: selectedStock!.id,
        data: {
          type: mouvementForm.type as "entree" | "sortie",
          quantite: Number(mouvementForm.quantite),
          motif: mouvementForm.motif || undefined,
        },
      },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetInfirmerieStocksQueryKey() });
          setShowMouvementDialog(false);
        },
      },
    );
  }

  function openEdit(stock: StockItem) {
    setEditingStock(stock);
    setForm({
      nom: stock.nom,
      categorie: stock.categorie,
      quantite: stock.quantite,
      unite: stock.unite,
      seuil_alerte: stock.seuil_alerte,
      date_expiration: stock.date_expiration ? new Date(stock.date_expiration).toISOString().split("T")[0]! : "",
    });
    setShowAddDialog(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--m15-white)] flex items-center gap-2">
            <Package className="h-7 w-7 text-orange-400" />
            Stocks Infirmerie
          </h1>
          <p className="text-[var(--m15-muted)] text-sm mt-1">Gestion des médicaments et matériels médicaux</p>
        </div>
        <Button
          onClick={() => { setEditingStock(null); setForm({ nom: "", categorie: "medicament", quantite: 0, unite: "", seuil_alerte: 5, date_expiration: "" }); setShowAddDialog(true); }}
          className="bg-orange-600 hover:bg-orange-700 text-[var(--m15-white)] gap-2"
        >
          <Plus className="h-4 w-4" />
          Ajouter un article
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4 text-center">
            <p className="text-[var(--m15-muted)] text-xs">Total articles</p>
            <p className="text-2xl font-bold text-[var(--m15-white)]">{stocks.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4 text-center">
            <p className="text-[var(--m15-muted)] text-xs">En alerte</p>
            <p className={`text-2xl font-bold ${enAlerte > 0 ? "text-orange-400" : "text-[var(--m15-muted)]"}`}>{enAlerte}</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
          <CardContent className="p-4 text-center">
            <p className="text-[var(--m15-muted)] text-xs">En rupture</p>
            <p className={`text-2xl font-bold ${enRupture > 0 ? "text-red-400" : "text-[var(--m15-muted)]"}`}>{enRupture}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--m15-muted)]" />
          <Input
            placeholder="Rechercher un article…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
          />
        </div>
        <Select value={categorieFilter} onValueChange={setCategorieFilter}>
          <SelectTrigger className="bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)] w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
            <SelectItem value="tous" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Toutes catégories</SelectItem>
            <SelectItem value="medicament" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Médicaments</SelectItem>
            <SelectItem value="materiel" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Matériel</SelectItem>
            <SelectItem value="consommable" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Consommables</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table/liste des stocks */}
      <Card className="bg-[var(--m15-card)] border-[var(--m15-border)]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--m15-border)]">
                  <th className="text-left text-[var(--m15-muted)] font-medium px-4 py-3">Article</th>
                  <th className="text-left text-[var(--m15-muted)] font-medium px-4 py-3">Catégorie</th>
                  <th className="text-right text-[var(--m15-muted)] font-medium px-4 py-3">Quantité</th>
                  <th className="text-left text-[var(--m15-muted)] font-medium px-4 py-3">Expiration</th>
                  <th className="text-center text-[var(--m15-muted)] font-medium px-4 py-3">Statut</th>
                  <th className="text-right text-[var(--m15-muted)] font-medium px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-[var(--m15-muted)] py-10">Aucun article trouvé</td>
                  </tr>
                ) : (
                  filtered.map(s => (
                    <tr key={s.id} className="border-b border-[var(--m15-border)]/50 hover:bg-[var(--elevate-1)] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-[var(--m15-white)] font-medium">{s.nom}</p>
                        <p className="text-[var(--m15-muted)] text-xs">Seuil : {s.seuil_alerte} {s.unite}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={CATEGORIE_COLORS[s.categorie] ?? ""}>
                          {CATEGORIE_LABELS[s.categorie] ?? s.categorie}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-semibold ${s.quantite === 0 ? "text-red-400" : s.quantite <= s.seuil_alerte ? "text-orange-400" : "text-[var(--m15-white)]"}`}>
                          {s.quantite}
                        </span>
                        <span className="text-[var(--m15-muted)] text-xs ml-1">{s.unite}</span>
                      </td>
                      <td className="px-4 py-3">
                        {s.date_expiration ? (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-[var(--m15-muted)]" />
                            <span className={`text-xs ${new Date(s.date_expiration) < new Date() ? "text-red-400" : "text-[var(--m15-white)]"}`}>
                              {new Date(s.date_expiration).toLocaleDateString("fr-FR")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--m15-muted)] text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatutBadge statut={s.statut_stock} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openMouvement(s)}
                            className="text-[var(--m15-muted)] hover:text-[var(--m15-white)] h-7 px-2 gap-1"
                            title="Mouvement stock"
                          >
                            <ArrowUpDown className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openEdit(s)}
                            className="text-[var(--m15-muted)] hover:text-[var(--m15-white)] h-7 px-2"
                            title="Modifier"
                          >
                            <Edit2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog Ajouter/Modifier */}
      <Dialog open={showAddDialog} onOpenChange={open => { setShowAddDialog(open); if (!open) setEditingStock(null); }}>
        <DialogContent className="bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)] max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[var(--m15-white)]">{editingStock ? "Modifier l'article" : "Ajouter un article"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Nom *</Label>
              <Input
                value={form.nom}
                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))}
                placeholder="Paracétamol 500mg…"
                className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-[var(--m15-white)]">Catégorie *</Label>
              <Select value={form.categorie} onValueChange={v => setForm(f => ({ ...f, categorie: v }))}>
                <SelectTrigger className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                  <SelectItem value="medicament" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Médicament</SelectItem>
                  <SelectItem value="materiel" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Matériel</SelectItem>
                  <SelectItem value="consommable" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">Consommable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Quantité *</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.quantite}
                  onChange={e => setForm(f => ({ ...f, quantite: parseInt(e.target.value) || 0 }))}
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Unité *</Label>
                <Input
                  value={form.unite}
                  onChange={e => setForm(f => ({ ...f, unite: e.target.value }))}
                  placeholder="comprimés, ml…"
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Seuil d'alerte</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.seuil_alerte}
                  onChange={e => setForm(f => ({ ...f, seuil_alerte: parseInt(e.target.value) || 0 }))}
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Date d'expiration</Label>
                <Input
                  type="date"
                  value={form.date_expiration}
                  onChange={e => setForm(f => ({ ...f, date_expiration: e.target.value }))}
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} className="border-[var(--m15-border)] text-[var(--m15-white)]">
              Annuler
            </Button>
            <Button
              onClick={handleAddOrEdit}
              disabled={isAdding || isUpdating || !form.nom || !form.unite}
              className="bg-orange-600 hover:bg-orange-700 text-[var(--m15-white)]"
            >
              {isAdding || isUpdating ? "Sauvegarde…" : editingStock ? "Modifier" : "Ajouter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Mouvement */}
      <Dialog open={showMouvementDialog} onOpenChange={setShowMouvementDialog}>
        <DialogContent className="bg-[var(--m15-card)] border-[var(--m15-border)] text-[var(--m15-white)] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-[var(--m15-white)]">Mouvement de stock</DialogTitle>
          </DialogHeader>
          {selectedStock && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-[var(--elevate-2)] rounded-lg">
                <p className="text-[var(--m15-white)] font-medium">{selectedStock.nom}</p>
                <p className="text-[var(--m15-muted)] text-sm">Stock actuel : {selectedStock.quantite} {selectedStock.unite}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Type de mouvement</Label>
                <Select value={mouvementForm.type} onValueChange={v => setMouvementForm(m => ({ ...m, type: v }))}>
                  <SelectTrigger className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[var(--m15-card)] border-[var(--m15-border)]">
                    <SelectItem value="entree" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">
                      <div className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-emerald-400" /> Entrée</div>
                    </SelectItem>
                    <SelectItem value="sortie" className="text-[var(--m15-white)] focus:bg-[var(--m15-card2)]">
                      <div className="flex items-center gap-2"><TrendingDown className="h-4 w-4 text-red-400" /> Sortie</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Quantité</Label>
                <Input
                  type="number"
                  min={1}
                  value={mouvementForm.quantite}
                  onChange={e => setMouvementForm(m => ({ ...m, quantite: parseInt(e.target.value) || 1 }))}
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[var(--m15-white)]">Motif</Label>
                <Input
                  value={mouvementForm.motif}
                  onChange={e => setMouvementForm(m => ({ ...m, motif: e.target.value }))}
                  placeholder="Raison du mouvement…"
                  className="bg-[var(--m15-card2)] border-[var(--m15-border)] text-[var(--m15-white)] placeholder:text-[var(--m15-muted)]"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMouvementDialog(false)} className="border-[var(--m15-border)] text-[var(--m15-white)]">
              Annuler
            </Button>
            <Button
              onClick={handleMouvement}
              disabled={isMouvPending}
              className={mouvementForm.type === "sortie" ? "bg-red-600 hover:bg-red-700 text-[var(--m15-white)]" : "bg-emerald-600 hover:bg-emerald-700 text-[var(--m15-white)]"}
            >
              {isMouvPending ? "En cours…" : mouvementForm.type === "sortie" ? "Enregistrer la sortie" : "Enregistrer l'entrée"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
