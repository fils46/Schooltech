/* ────────────────────────────────────────────────────────────────────────────
 * Templates de relance scolarité — version chaleureuse & bienveillante
 * M15-SchoolTech
 * ──────────────────────────────────────────────────────────────────────────── */

export type TrancheInfo = {
  label: string;         // ex. "1ère tranche"
  montant: number;
  dateLimite?: string | null;
};

export type RelanceContext = {
  /* Parent */
  nomParent: string;
  /* Élève */
  prenomEleve: string;
  nomEleve: string;
  /* Classe */
  classeNom: string;
  /* Établissement */
  nomEtablissement: string;
  telephoneEtablissement?: string | null;
  /* Directeur */
  nomDirecteur?: string | null;
  /* Financier */
  montantRestant: number;
  totalDu: number;
  totalPaye: number;
  /* Tranche en attente (première non payée) */
  trancheInfo?: TrancheInfo | null;
  /* Numéro de relance : 1, 2, 3+ */
  numeroRelance: 1 | 2 | 3;
};

function fmt(n: number): string {
  return new Intl.NumberFormat("fr-FR").format(Math.round(n));
}

function joursRestants(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/* ── Notifications push (courtes) ─────────────────────────────────────────── */

function pushRelance1(ctx: RelanceContext): string {
  return (
    `Bonjour ${ctx.nomParent}, nous espérons que vous allez bien 😊\n\n` +
    `Un petit rappel concernant la scolarité de ${ctx.prenomEleve}. ` +
    `Une tranche est actuellement en attente de règlement.\n\n` +
    `Vous pouvez consulter votre état de compte à tout moment depuis votre espace parent. 🎓`
  );
}

function pushRelance2(ctx: RelanceContext): string {
  const tranche = ctx.trancheInfo;
  const montantStr = tranche ? `${fmt(tranche.montant)} FCFA` : `${fmt(ctx.montantRestant)} FCFA`;
  const trancheLabel = tranche?.label ?? "une tranche";
  return (
    `Bonjour ${ctx.nomParent},\n\n` +
    `Nous revenons vers vous concernant ${trancheLabel} de ${ctx.prenomEleve}, d'un montant de ${montantStr}.\n\n` +
    `Si vous rencontrez une difficulté, notre administration reste disponible pour vous accompagner avec bienveillance. 🏫`
  );
}

function pushRelance3(ctx: RelanceContext): string {
  const tranche = ctx.trancheInfo;
  const montantStr = tranche ? `${fmt(tranche.montant)} FCFA` : `${fmt(ctx.montantRestant)} FCFA`;
  const trancheLabel = tranche?.label ?? "une tranche";
  const jours = joursRestants(tranche?.dateLimite);
  const datePart = tranche?.dateLimite
    ? ` (${tranche.dateLimite}${jours !== null ? `, dans ${jours} j` : ""})`
    : "";
  return (
    `Bonjour ${ctx.nomParent},\n\n` +
    `La date limite de règlement de ${trancheLabel} de ${ctx.prenomEleve} approche${datePart}.\n\n` +
    `Montant restant : ${montantStr}.\n\n` +
    `Nous restons disponibles en cas de besoin. 🤝`
  );
}

export function genererMessagePush(ctx: RelanceContext): string {
  switch (ctx.numeroRelance) {
    case 1: return pushRelance1(ctx);
    case 2: return pushRelance2(ctx);
    default: return pushRelance3(ctx);
  }
}

/* ── Titre de notification push ───────────────────────────────────────────── */

export function genererTitrePush(ctx: RelanceContext): string {
  switch (ctx.numeroRelance) {
    case 1: return `📚 Scolarité de ${ctx.prenomEleve} — Rappel`;
    case 2: return `⏳ Scolarité de ${ctx.prenomEleve} — 2ème rappel`;
    default: return `⚠️ Scolarité de ${ctx.prenomEleve} — Date limite proche`;
  }
}

/* ── Corps email HTML (pour intégration future avec Resend) ───────────────── */

function emailFooter(ctx: RelanceContext): string {
  const director = ctx.nomDirecteur ?? "La Direction";
  const tel = ctx.telephoneEtablissement ? `\n📞 ${ctx.telephoneEtablissement}` : "";
  return (
    `\n\nAvec nos salutations respectueuses,\n\n` +
    `${director}\nDirecteur — ${ctx.nomEtablissement}${tel}\n` +
    `📧 support@m15-schooltech.ci`
  );
}

function emailRelance1(ctx: RelanceContext): { sujet: string; corps: string } {
  const tranche = ctx.trancheInfo;
  const trancheLabel = tranche?.label ?? "une tranche";
  const montantStr = tranche ? `${fmt(tranche.montant)} FCFA` : `${fmt(ctx.montantRestant)} FCFA`;
  const dateStr = tranche?.dateLimite ? `, prévu pour le ${tranche.dateLimite},` : "";
  return {
    sujet: `Rappel scolarité — ${ctx.prenomEleve} ${ctx.nomEleve} — ${ctx.nomEtablissement}`,
    corps:
      `Bonjour ${ctx.nomParent},\n\n` +
      `Nous espérons sincèrement que vous et votre famille vous portez bien.\n\n` +
      `Nous nous permettons de revenir vers vous concernant la scolarité de votre enfant ` +
      `${ctx.prenomEleve} ${ctx.nomEleve}, actuellement en classe de ${ctx.classeNom} à ${ctx.nomEtablissement}.\n\n` +
      `À ce jour, sauf erreur de notre part, le règlement de ${trancheLabel}, d'un montant de ${montantStr}${dateStr} ` +
      `n'a pas encore été enregistré.\n\n` +
      `Nous savons que certaines périodes peuvent être plus compliquées que d'autres, et nous tenons à vous assurer ` +
      `que notre établissement reste à votre écoute afin de trouver ensemble la solution la plus adaptée.\n\n` +
      `Vous pouvez consulter votre situation ou effectuer un règlement directement depuis votre espace parent :\n` +
      `👉 https://m15-schooltech.ci/login` +
      emailFooter(ctx),
  };
}

function emailRelance2(ctx: RelanceContext): { sujet: string; corps: string } {
  const tranche = ctx.trancheInfo;
  const trancheLabel = tranche?.label ?? "une tranche";
  const montantStr = tranche ? `${fmt(tranche.montant)} FCFA` : `${fmt(ctx.montantRestant)} FCFA`;
  return {
    sujet: `2ème rappel scolarité — ${ctx.prenomEleve} ${ctx.nomEleve} — ${ctx.nomEtablissement}`,
    corps:
      `Bonjour ${ctx.nomParent},\n\n` +
      `Nous espérons que tout se passe bien pour vous et votre famille.\n\n` +
      `Nous revenons vers vous au sujet de la situation scolaire de ${ctx.prenomEleve} ${ctx.nomEleve}, ` +
      `élève en classe de ${ctx.classeNom}.\n\n` +
      `Sauf erreur de notre part, le règlement de ${trancheLabel} d'un montant de ${montantStr} ` +
      `n'a pas encore été effectué.\n\n` +
      `Voici un récapitulatif de votre situation :\n\n` +
      `• Montant total de la scolarité : ${fmt(ctx.totalDu)} FCFA\n` +
      `• Montant déjà réglé : ${fmt(ctx.totalPaye)} FCFA\n` +
      `• Montant restant : ${fmt(ctx.montantRestant)} FCFA\n\n` +
      `Si le paiement a déjà été effectué, nous vous remercions de bien vouloir nous transmettre le justificatif.\n\n` +
      `Notre souhait reste avant tout d'accompagner chaque élève dans les meilleures conditions possibles. ` +
      `Si vous traversez une difficulté particulière, notre administration pourra échanger avec vous en toute ` +
      `confidentialité et bienveillance.\n\n` +
      `Accéder à votre espace parent :\n` +
      `👉 https://m15-schooltech.ci/login` +
      emailFooter(ctx),
  };
}

function emailRelance3(ctx: RelanceContext): { sujet: string; corps: string } {
  const tranche = ctx.trancheInfo;
  const trancheLabel = tranche?.label ?? "une tranche";
  const montantStr = tranche ? `${fmt(tranche.montant)} FCFA` : `${fmt(ctx.montantRestant)} FCFA`;
  const jours = joursRestants(tranche?.dateLimite);
  const dateLine = tranche?.dateLimite
    ? `• Date limite : ${tranche.dateLimite}${jours !== null ? ` (dans ${jours} jours)` : ""}\n`
    : "";
  return {
    sujet: `⚠️ Date limite proche — Scolarité de ${ctx.prenomEleve} ${ctx.nomEleve} — ${ctx.nomEtablissement}`,
    corps:
      `Bonjour ${ctx.nomParent},\n\n` +
      `Nous vous écrivons concernant le règlement de ${trancheLabel} relative à la scolarité de ` +
      `${ctx.prenomEleve} ${ctx.nomEleve}, en classe de ${ctx.classeNom}.\n\n` +
      (tranche?.dateLimite
        ? `La date limite de paiement approche désormais et est fixée au ${tranche.dateLimite}` +
          (jours !== null ? `, soit dans ${jours} jours` : "") + `.\n\n`
        : "") +
      `Situation actuelle :\n` +
      `• Tranche concernée : ${trancheLabel}\n` +
      `• Montant dû : ${montantStr}\n` +
      dateLine +
      `\nAfin d'éviter tout désagrément administratif pour votre enfant, nous vous invitons à effectuer ` +
      `la régularisation dès que possible.\n\n` +
      `Nous comprenons néanmoins que certaines situations peuvent nécessiter un accompagnement particulier. ` +
      `Dans ce cas, nous vous encourageons à prendre contact avec notre administration ; nous étudierons ` +
      `votre situation avec attention et compréhension.\n\n` +
      (ctx.telephoneEtablissement ? `📞 ${ctx.telephoneEtablissement}\n` : "") +
      `📧 support@m15-schooltech.ci\n\n` +
      `Accéder à votre espace parent :\n` +
      `👉 https://m15-schooltech.ci/login` +
      emailFooter(ctx),
  };
}

export function genererEmail(ctx: RelanceContext): { sujet: string; corps: string } {
  switch (ctx.numeroRelance) {
    case 1: return emailRelance1(ctx);
    case 2: return emailRelance2(ctx);
    default: return emailRelance3(ctx);
  }
}

/* ── Détermine la première tranche non payée ──────────────────────────────── */

export type ScolariteFlags = {
  inscription_payee: boolean;
  tranche1_payee: boolean;
  tranche2_payee: boolean;
  tranche3_payee: boolean;
};

export type FraisConfigForRelance = {
  frais_inscription: string | null;
  frais_tranche1: string | null;
  frais_tranche2: string | null;
  frais_tranche3: string | null;
  date_limite_tranche1: string | null;
  date_limite_tranche2: string | null;
  date_limite_tranche3: string | null;
};

export function premiereTrancheImpayee(
  flags: ScolariteFlags,
  config: FraisConfigForRelance | null | undefined,
): TrancheInfo | null {
  if (!config) return null;
  const tranches: Array<{ key: keyof ScolariteFlags; label: string; montantKey: keyof FraisConfigForRelance; limKey: keyof FraisConfigForRelance }> = [
    { key: "inscription_payee", label: "les frais d'inscription", montantKey: "frais_inscription",  limKey: "date_limite_tranche1" },
    { key: "tranche1_payee",    label: "la 1ère tranche",         montantKey: "frais_tranche1",     limKey: "date_limite_tranche1" },
    { key: "tranche2_payee",    label: "la 2ème tranche",         montantKey: "frais_tranche2",     limKey: "date_limite_tranche2" },
    { key: "tranche3_payee",    label: "la 3ème tranche",         montantKey: "frais_tranche3",     limKey: "date_limite_tranche3" },
  ];
  for (const t of tranches) {
    if (!flags[t.key]) {
      return {
        label: t.label,
        montant: parseFloat(config[t.montantKey] ?? "0") || 0,
        dateLimite: config[t.limKey] as string | null ?? null,
      };
    }
  }
  return null;
}

/* ── Numéro de relance (basé sur le comptage existant) ───────────────────── */

export function niveauRelance(nbPrecedentes: number): 1 | 2 | 3 {
  if (nbPrecedentes === 0) return 1;
  if (nbPrecedentes === 1) return 2;
  return 3;
}
