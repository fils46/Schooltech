export const NIVEAUX_COLLEGE = ["6ème", "5ème", "4ème", "3ème"] as const;
export const NIVEAUX_LYCEE   = ["2nde", "1ère", "Terminale"] as const;
export const NIVEAUX_ALL     = [...NIVEAUX_COLLEGE, ...NIVEAUX_LYCEE] as const;

const NIVEAUX_PAR_TYPE: Record<string, readonly string[]> = {
  "collège":         NIVEAUX_COLLEGE,
  "lycée":           NIVEAUX_LYCEE,
  "collège & lycée": NIVEAUX_ALL,
};

export function getNiveauxAutorises(typeEtab: string | null | undefined): string[] {
  if (!typeEtab) return [...NIVEAUX_ALL];
  return [...(NIVEAUX_PAR_TYPE[typeEtab] ?? NIVEAUX_ALL)];
}

export function niveauEstAutorise(niveau: string, typeEtab: string | null | undefined): boolean {
  return getNiveauxAutorises(typeEtab).includes(niveau);
}

export function getNiveauxGroupes(typeEtab: string | null | undefined) {
  const type = typeEtab ?? "";
  const groupes: Array<{ label: string; niveaux: string[] }> = [];
  if (!type || type === "collège" || type === "collège & lycée") {
    groupes.push({ label: "Collège", niveaux: [...NIVEAUX_COLLEGE] });
  }
  if (!type || type === "lycée" || type === "collège & lycée") {
    groupes.push({ label: "Lycée", niveaux: [...NIVEAUX_LYCEE] });
  }
  return groupes;
}
