import { Construction } from "lucide-react";
import { useLocation } from "wouter";

const moduleLabels: Record<string, string> = {
  "/licences": "Gestion des Licences",
  "/statistiques": "Statistiques",
  "/censeurs": "Gestion des Censeurs",
  "/classes": "Gestion des Classes",
  "/paiements": "Paiements",
  "/rapports": "Rapports",
  "/professeurs": "Gestion des Professeurs",
  "/eleves": "Gestion des Élèves",
  "/emploi-du-temps": "Emploi du Temps",
  "/absences": "Absences",
  "/mes-classes": "Mes Classes",
  "/evaluations": "Évaluations",
  "/cahier-de-textes": "Cahier de Textes",
  "/appel": "Appel",
  "/messages": "Messages",
  "/notes": "Notes",
  "/bibliotheque": "Bibliothèque",
  "/mon-enfant": "Mon Enfant",
};

export default function EnConstruction() {
  const [location] = useLocation();
  const label = moduleLabels[location] ?? "Ce module";

  return (
    <div
      className="flex flex-col items-center justify-center min-h-[60vh] text-center p-8"
      data-testid="page-en-construction"
    >
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-secondary/20 mb-6">
        <Construction className="w-10 h-10 text-secondary" />
      </div>
      <h1 className="text-2xl font-bold mb-2">{label}</h1>
      <p className="text-muted-foreground max-w-sm">
        Ce module est en cours de développement et sera disponible prochainement dans une prochaine version de M15-SchoolTech.
      </p>
      <div className="mt-6 px-4 py-2 bg-secondary/10 border border-secondary/20 rounded-full text-sm font-medium text-secondary">
        Module 02 — À venir
      </div>
    </div>
  );
}
