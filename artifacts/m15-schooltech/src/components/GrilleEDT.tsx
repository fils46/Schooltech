import { Calendar } from "lucide-react";

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"] as const;
type Jour = typeof JOURS[number];

const JOURS_LABELS: Record<Jour, string> = {
  lundi: "Lundi",
  mardi: "Mardi",
  mercredi: "Mercredi",
  jeudi: "Jeudi",
  vendredi: "Vendredi",
  samedi: "Samedi",
};

const JOUR_SEMAINE = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];

function couleurMatiere(matiere: string): string {
  const palette = [
    "#00C9A7", "#0080FF", "#FFB800", "#FF4D6D", "#7B61FF",
    "#00B4D8", "#F97316", "#22C55E", "#E879F9", "#64748B",
  ];
  let h = 0;
  for (let i = 0; i < matiere.length; i++) h = (h * 31 + matiere.charCodeAt(i)) & 0xffffffff;
  return palette[Math.abs(h) % palette.length]!;
}

interface GrilleEDTProps {
  grille: Record<Jour, Record<string, unknown>[]>;
  creneaux: Record<string, unknown>[];
  mode?: "eleve" | "professeur";
  vide?: string;
}

export function GrilleEDT({ grille, creneaux, mode = "eleve", vide }: GrilleEDTProps) {
  const jourActuel = JOUR_SEMAINE[new Date().getDay()] as string;

  if (creneaux.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Calendar className="w-12 h-12 mb-3" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
        <p className="font-medium" style={{ color: "var(--m15-muted)" }}>
          {vide ?? "Aucun emploi du temps disponible"}
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--m15-muted)", opacity: 0.6 }}>
          L'emploi du temps n'a pas encore été publié
        </p>
      </div>
    );
  }

  const tousLesCours = JOURS.flatMap(j => grille[j] ?? []);
  if (tousLesCours.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Calendar className="w-12 h-12 mb-3" style={{ color: "var(--m15-muted)", opacity: 0.4 }} />
        <p className="font-medium" style={{ color: "var(--m15-muted)" }}>
          {vide ?? "Emploi du temps vide"}
        </p>
        <p className="text-sm mt-1" style={{ color: "var(--m15-muted)", opacity: 0.6 }}>
          Aucun cours planifié pour le moment
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        <div
          className="grid rounded-xl overflow-hidden mb-2"
          style={{ gridTemplateColumns: "120px repeat(6, 1fr)", gap: "1px", background: "var(--m15-border)" }}
        >
          <div
            className="py-3 px-3 text-xs font-semibold"
            style={{ background: "var(--m15-card)", color: "var(--m15-muted)" }}
          >
            Créneau
          </div>
          {JOURS.map(jour => {
            const isToday = jour === jourActuel;
            return (
              <div
                key={jour}
                className="py-3 text-center text-sm font-bold"
                style={{
                  background: isToday ? "rgba(0,201,167,0.12)" : "var(--m15-card)",
                  color: isToday ? "#00C9A7" : "var(--m15-white)",
                  fontFamily: "'Syne', sans-serif",
                }}
              >
                {JOURS_LABELS[jour]}
                {isToday && (
                  <span
                    className="block text-xs font-normal mt-0.5"
                    style={{ color: "#00C9A7", opacity: 0.8 }}
                  >
                    Aujourd'hui
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-1">
          {creneaux.map((creneau: Record<string, unknown>) => (
            <div
              key={String(creneau.id)}
              className="grid"
              style={{ gridTemplateColumns: "120px repeat(6, 1fr)", gap: "4px" }}
            >
              <div
                className="flex flex-col justify-center px-3 py-2 rounded-xl text-xs font-medium"
                style={{ background: "var(--m15-card)", color: "var(--m15-muted)", minHeight: "80px" }}
              >
                <span className="font-bold text-sm" style={{ color: "var(--m15-white)" }}>
                  {String(creneau.libelle)}
                </span>
                <span style={{ opacity: 0.7 }}>
                  {String(creneau.heure_debut)} - {String(creneau.heure_fin)}
                </span>
              </div>

              {JOURS.map(jour => {
                const cours = grille[jour]?.find(
                  (c: Record<string, unknown>) => c.creneau_id === creneau.id
                ) as Record<string, string> | undefined;
                const couleur =
                  cours?.couleur || (cours?.matiere ? couleurMatiere(cours.matiere) : "#00C9A7");
                const isToday = jour === jourActuel;

                return (
                  <div
                    key={jour}
                    className="rounded-xl overflow-hidden"
                    style={{
                      minHeight: "80px",
                      background: cours
                        ? `${couleur}14`
                        : isToday
                          ? "rgba(0,201,167,0.04)"
                          : "var(--m15-card)",
                      border: cours
                        ? `1px solid ${couleur}40`
                        : isToday
                          ? "1px solid rgba(0,201,167,0.15)"
                          : "1px solid var(--m15-border)",
                    }}
                  >
                    {cours ? (
                      <div className="h-full p-2 flex flex-col gap-1">
                        <span className="text-xs font-bold truncate" style={{ color: couleur }}>
                          {cours.matiere}
                        </span>
                        {mode === "eleve" ? (
                          <span
                            className="text-xs truncate"
                            style={{ color: "var(--m15-white)", opacity: 0.9 }}
                          >
                            {cours.professeur_nom}
                          </span>
                        ) : (
                          <span
                            className="text-xs truncate"
                            style={{ color: "var(--m15-white)", opacity: 0.9 }}
                          >
                            {cours.classe_nom}
                          </span>
                        )}
                        {cours.salle_nom && (
                          <span className="text-xs truncate" style={{ color: "var(--m15-muted)" }}>
                            {cours.salle_nom}
                          </span>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
