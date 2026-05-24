import { useState, useEffect } from "react";
import { Settings, AlertTriangle, Edit2, Check, X, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type TypeConfig = {
  id: string;
  type_evaluation: string;
  libelle: string;
  coefficient_defaut: number;
  actif: boolean;
};

const TYPE_COLORS: Record<string, string> = {
  composition:   "#F5C842",
  devoir:        "#0080FF",
  interrogation: "#00C9A7",
  tp:            "#A855F7",
  expose:        "#F97316",
  examen_blanc:  "#64748B",
  autre:         "#94A3B8",
};

export default function ConfigEvaluations() {
  const { toast } = useToast();
  const [types, setTypes] = useState<TypeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ libelle: string; coefficient_defaut: number; actif: boolean }>({
    libelle: "", coefficient_defaut: 1, actif: true,
  });
  const [saving, setSaving] = useState(false);

  const fetchConfig = () => {
    const token = localStorage.getItem("m15_token");
    setLoading(true);
    fetch("/api/notes/types-config", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data?.types) {
          const sorted = [...data.types].sort((a: TypeConfig, b: TypeConfig) => {
            const order = ["composition", "devoir", "interrogation", "tp", "expose", "examen_blanc", "autre"];
            return order.indexOf(a.type_evaluation) - order.indexOf(b.type_evaluation);
          });
          setTypes(sorted);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchConfig(); }, []);

  const startEdit = (t: TypeConfig) => {
    setEditingId(t.id);
    setEditValues({ libelle: t.libelle, coefficient_defaut: t.coefficient_defaut, actif: t.actif });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    setSaving(true);
    const token = localStorage.getItem("m15_token");
    try {
      const res = await fetch(`/api/notes/types-config/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          libelle: editValues.libelle,
          coefficient_defaut: editValues.coefficient_defaut,
          actif: editValues.actif,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.message ?? "Erreur lors de la mise à jour.", variant: "destructive" });
        return;
      }
      toast({ title: "Configuration mise à jour avec succès." });
      setEditingId(null);
      fetchConfig();
    } catch {
      toast({ title: "Erreur réseau.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "rgba(0,128,255,0.1)" }}>
              <Settings className="w-5 h-5" style={{ color: "#0080FF" }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "var(--m15-white)" }}>
              Types d'évaluations
            </h1>
          </div>
          <p className="text-sm" style={{ color: "var(--m15-muted)" }}>
            Ces coefficients s'appliquent par défaut à tout l'établissement
          </p>
        </div>
        <button onClick={fetchConfig}
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-all"
          style={{ background: "var(--elevate-1)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
          <RefreshCw className="w-4 h-4" />
          Actualiser
        </button>
      </div>

      {/* Avertissement */}
      <div className="flex items-start gap-3 p-4 rounded-xl"
        style={{ background: "rgba(245,200,66,0.08)", border: "1px solid rgba(245,200,66,0.2)" }}>
        <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: "#F5C842" }} />
        <div>
          <p className="text-sm font-semibold" style={{ color: "#F5C842" }}>Attention</p>
          <p className="text-sm mt-0.5" style={{ color: "var(--m15-muted)" }}>
            Modifier un coefficient par défaut n'affecte pas les évaluations déjà créées — uniquement les nouvelles saisies.
          </p>
        </div>
      </div>

      {/* Tableau */}
      <div className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid var(--m15-border)", background: "var(--m15-card)" }}>
        <div className="px-5 py-3 flex items-center justify-between"
          style={{ borderBottom: "1px solid var(--m15-border)", background: "var(--elevate-1)" }}>
          <span className="text-sm font-semibold" style={{ color: "var(--m15-muted)" }}>
            {types.length} type(s) d'évaluation
          </span>
          <span className="text-xs" style={{ color: "var(--m15-muted)" }}>
            Système ivoirien — composition = ×2 par défaut
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-3" style={{ color: "var(--m15-muted)" }} />
            <p className="text-sm" style={{ color: "var(--m15-muted)" }}>Chargement...</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--m15-border)" }}>
            {types.map(t => {
              const isEditing = editingId === t.id;
              const color = TYPE_COLORS[t.type_evaluation] ?? "#94A3B8";
              return (
                <div key={t.id} className="px-5 py-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                        <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
                          {t.type_evaluation}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
                            Libellé
                          </label>
                          <input
                            type="text"
                            value={editValues.libelle}
                            onChange={e => setEditValues(v => ({ ...v, libelle: e.target.value }))}
                            className="w-full px-3 py-2 rounded-xl text-sm outline-none"
                            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: "var(--m15-muted)" }}>
                            Coeff. par défaut
                          </label>
                          <input
                            type="number"
                            min={0.5}
                            max={10}
                            step={0.5}
                            value={editValues.coefficient_defaut}
                            onChange={e => setEditValues(v => ({ ...v, coefficient_defaut: Number(e.target.value) }))}
                            className="w-full px-3 py-2 rounded-xl text-sm outline-none text-center font-semibold"
                            style={{ background: "var(--elevate-1)", border: "1px solid var(--m15-border)", color: "var(--m15-white)" }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id={`actif-${t.id}`}
                          checked={editValues.actif}
                          onChange={e => setEditValues(v => ({ ...v, actif: e.target.checked }))}
                          className="rounded"
                        />
                        <label htmlFor={`actif-${t.id}`} className="text-sm" style={{ color: "var(--m15-muted)" }}>
                          Type actif (visible lors de la saisie)
                        </label>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => saveEdit(t.id)}
                          disabled={saving || !editValues.libelle}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
                          style={{ background: "linear-gradient(135deg, #00C9A7, #0080FF)", color: "#fff", opacity: saving ? 0.7 : 1 }}>
                          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                          Enregistrer
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                          style={{ background: "var(--elevate-1)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
                          <X className="w-4 h-4" />
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold" style={{ color: "var(--m15-white)" }}>
                            {t.libelle}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: "rgba(0,0,0,0.2)", color: "var(--m15-muted)", fontFamily: "monospace" }}>
                            {t.type_evaluation}
                          </span>
                          {!t.actif && (
                            <span className="text-xs px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(255,77,109,0.1)", color: "#FF4D6D" }}>
                              Désactivé
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color }}>
                          ×{t.coefficient_defaut}
                        </div>
                        <div className="text-xs" style={{ color: "var(--m15-muted)" }}>coeff. défaut</div>
                      </div>
                      <button
                        onClick={() => startEdit(t)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg transition-all flex-shrink-0"
                        style={{ background: "var(--elevate-1)", color: "var(--m15-muted)", border: "1px solid var(--m15-border)" }}>
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info bas de page */}
      <div className="p-4 rounded-xl text-sm"
        style={{ background: "var(--m15-card)", border: "1px solid var(--m15-border)", color: "var(--m15-muted)" }}>
        <strong style={{ color: "var(--m15-white)" }}>Rappel — Système ivoirien :</strong>{" "}
        La composition trimestrielle vaut le double d'un devoir ou d'une interrogation.
        Lors de la saisie des notes, le coefficient s'auto-remplit selon ces paramètres, mais reste modifiable par le professeur si besoin.
      </div>
    </div>
  );
}
