import PDFDocument from "pdfkit";

export interface PVConseilData {
  conseil: {
    classe_nom: string;
    trimestre: string;
    date_conseil: string;
    heure_debut?: string | null;
    heure_fin?: string | null;
    observations_generales?: string | null;
    president_nom: string | null;
    etablissement_nom?: string;
  };
  deliberations: Array<{
    eleve_nom: string;
    eleve_prenoms: string;
    rang?: number | null;
    moyenne_generale?: string | null;
    nb_absences: number;
    decision?: string | null;
    mention_honneur: boolean;
    observations?: string | null;
    appreciation_generale?: string | null;
  }>;
  participants: Array<{
    utilisateur_nom: string;
    utilisateur_prenoms: string;
    role_conseil: string;
    present: boolean;
  }>;
}

const DECISION_LABELS: Record<string, string> = {
  passage:       "Passage",
  redoublement:  "Redoublement",
  exclusion:     "Exclusion",
  orientation:   "Orientation",
  felicitations: "Félicitations",
  encouragements:"Encouragements",
  avertissement: "Avertissement",
  blame:         "Blâme",
};

const ROLE_LABELS: Record<string, string> = {
  president:       "Président(e)",
  professeur:      "Professeur",
  delegue_eleves:  "Délégué(e) élèves",
  delegue_parents: "Délégué(e) parents",
  censeur:         "Censeur",
  directeur:       "Directeur",
};

export function generatePV(data: PVConseilData): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const buffers: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    const PAGE_WIDTH = 595.28;
    const MARGIN = 50;
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

    const NAVY  = "#0A1628";
    const CYAN  = "#00C9A7";
    const GOLD  = "#F5C842";
    const DARK  = "#1A2740";
    const MUTED = "#6B7A99";
    const WHITE = "#FFFFFF";

    /* ── En-tête ─────────────────────────────────────────── */
    doc.rect(0, 0, PAGE_WIDTH, 110).fill(NAVY);

    doc.font("Helvetica-Bold").fontSize(18).fillColor(CYAN)
      .text("PROCÈS-VERBAL DU CONSEIL DE CLASSE", MARGIN, 25, { width: CONTENT_WIDTH, align: "center" });

    doc.font("Helvetica").fontSize(11).fillColor(WHITE)
      .text(
        `${data.conseil.etablissement_nom ?? "Établissement"} — Classe : ${data.conseil.classe_nom} — Trimestre ${data.conseil.trimestre}`,
        MARGIN, 52, { width: CONTENT_WIDTH, align: "center" }
      );

    const dateStr = `Date : ${data.conseil.date_conseil}${data.conseil.heure_debut ? `  |  Heure début : ${data.conseil.heure_debut}` : ""}${data.conseil.heure_fin ? `  |  Fin : ${data.conseil.heure_fin}` : ""}`;
    doc.font("Helvetica").fontSize(9).fillColor(GOLD)
      .text(dateStr, MARGIN, 76, { width: CONTENT_WIDTH, align: "center" });

    doc.font("Helvetica").fontSize(9).fillColor("#A0AEC0")
      .text(`Président(e) : ${data.conseil.president_nom ?? "—"}`, MARGIN, 93, { width: CONTENT_WIDTH, align: "center" });

    let y = 125;

    /* ── Participants ──────────────────────────────────────── */
    const presents = data.participants.filter(p => p.present);
    const absents  = data.participants.filter(p => !p.present);

    doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(DARK);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(CYAN)
      .text("PARTICIPANTS", MARGIN + 8, y + 5);
    y += 28;

    if (presents.length > 0) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("Présents :", MARGIN, y);
      y += 14;
      const presentNames = presents.map(p => `${p.utilisateur_prenoms} ${p.utilisateur_nom} (${ROLE_LABELS[p.role_conseil] ?? p.role_conseil})`).join(", ");
      doc.font("Helvetica").fontSize(9).fillColor(NAVY).text(presentNames, MARGIN, y, { width: CONTENT_WIDTH });
      y += doc.heightOfString(presentNames, { width: CONTENT_WIDTH }) + 6;
    }

    if (absents.length > 0) {
      doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text("Excusés/Absents :", MARGIN, y);
      y += 14;
      const absentNames = absents.map(p => `${p.utilisateur_prenoms} ${p.utilisateur_nom}`).join(", ");
      doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(absentNames, MARGIN, y, { width: CONTENT_WIDTH });
      y += doc.heightOfString(absentNames, { width: CONTENT_WIDTH }) + 10;
    }

    y += 4;

    /* ── Délibérations ─────────────────────────────────────── */
    doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(DARK);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(CYAN)
      .text("DÉLIBÉRATIONS", MARGIN + 8, y + 5);
    y += 28;

    if (data.deliberations.length === 0) {
      doc.font("Helvetica").fontSize(9).fillColor(MUTED)
        .text("Aucune délibération enregistrée.", MARGIN, y);
      y += 20;
    } else {
      /* En-tête tableau */
      const COL = {
        rang:    { x: MARGIN,      w: 28 },
        nom:     { x: MARGIN + 28, w: 130 },
        moy:     { x: MARGIN + 158, w: 42 },
        abs:     { x: MARGIN + 200, w: 32 },
        dec:     { x: MARGIN + 232, w: 90 },
        obs:     { x: MARGIN + 322, w: CONTENT_WIDTH - 322 + MARGIN - MARGIN },
      };
      COL.obs.w = CONTENT_WIDTH - (COL.obs.x - MARGIN);

      doc.rect(MARGIN, y, CONTENT_WIDTH, 16).fill("#1E3A5F");
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(GOLD);
      doc.text("Rg", COL.rang.x + 2, y + 4, { width: COL.rang.w });
      doc.text("Élève", COL.nom.x + 2, y + 4, { width: COL.nom.w });
      doc.text("Moy.", COL.moy.x + 2, y + 4, { width: COL.moy.w });
      doc.text("Abs.", COL.abs.x + 2, y + 4, { width: COL.abs.w });
      doc.text("Décision", COL.dec.x + 2, y + 4, { width: COL.dec.w });
      doc.text("Observations", COL.obs.x + 2, y + 4, { width: COL.obs.w });
      y += 18;

      data.deliberations.forEach((d, i) => {
        const rowH = 18;
        const bg = i % 2 === 0 ? "#F7FAFC" : WHITE;
        doc.rect(MARGIN, y, CONTENT_WIDTH, rowH).fill(bg);
        doc.font("Helvetica").fontSize(7.5).fillColor(NAVY);
        doc.text(d.rang != null ? String(d.rang) : "—", COL.rang.x + 2, y + 5, { width: COL.rang.w });
        doc.text(`${d.eleve_prenoms} ${d.eleve_nom}`, COL.nom.x + 2, y + 5, { width: COL.nom.w });
        doc.text(d.moyenne_generale != null ? Number(d.moyenne_generale).toFixed(2) : "—", COL.moy.x + 2, y + 5, { width: COL.moy.w });
        doc.text(String(d.nb_absences), COL.abs.x + 2, y + 5, { width: COL.abs.w });

        const decLabel = d.decision ? (DECISION_LABELS[d.decision] ?? d.decision) : "—";
        const decColor = d.decision === "redoublement" || d.decision === "exclusion" ? "#E53E3E" : (d.decision === "passage" ? "#276749" : NAVY);
        doc.fillColor(decColor).text(decLabel + (d.mention_honneur ? " ★" : ""), COL.dec.x + 2, y + 5, { width: COL.dec.w });
        doc.fillColor(NAVY).text(d.observations ?? d.appreciation_generale ?? "", COL.obs.x + 2, y + 5, { width: COL.obs.w });

        y += rowH;

        if (y > 750) {
          doc.addPage();
          y = MARGIN;
        }
      });
    }

    y += 12;

    /* ── Statistiques décisions ─────────────────────────────── */
    const stats: Record<string, number> = {};
    data.deliberations.forEach(d => {
      if (d.decision) stats[d.decision] = (stats[d.decision] ?? 0) + 1;
    });

    if (Object.keys(stats).length > 0) {
      doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(DARK);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(CYAN)
        .text("RÉCAPITULATIF DES DÉCISIONS", MARGIN + 8, y + 5);
      y += 28;

      let xStat = MARGIN;
      Object.entries(stats).forEach(([dec, count]) => {
        doc.rect(xStat, y, 110, 36).fill("#EBF8FF").stroke("#CBD5E0");
        doc.font("Helvetica-Bold").fontSize(16).fillColor(NAVY).text(String(count), xStat + 8, y + 4, { width: 110 });
        doc.font("Helvetica").fontSize(8).fillColor(MUTED).text(DECISION_LABELS[dec] ?? dec, xStat + 8, y + 24, { width: 94 });
        xStat += 118;
        if (xStat + 110 > PAGE_WIDTH - MARGIN) {
          xStat = MARGIN;
          y += 44;
        }
      });
      y += 44;
    }

    /* ── Observations générales ─────────────────────────────── */
    if (data.conseil.observations_generales) {
      y += 8;
      doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(DARK);
      doc.font("Helvetica-Bold").fontSize(10).fillColor(CYAN)
        .text("OBSERVATIONS GÉNÉRALES", MARGIN + 8, y + 5);
      y += 28;
      doc.font("Helvetica").fontSize(9).fillColor(NAVY)
        .text(data.conseil.observations_generales, MARGIN, y, { width: CONTENT_WIDTH });
      y += doc.heightOfString(data.conseil.observations_generales, { width: CONTENT_WIDTH }) + 10;
    }

    /* ── Zone de signature ──────────────────────────────────── */
    y = Math.max(y + 20, 680);
    if (y > 720) { doc.addPage(); y = MARGIN; }

    doc.moveTo(MARGIN, y).lineTo(PAGE_WIDTH - MARGIN, y).strokeColor("#CBD5E0").lineWidth(0.5).stroke();
    y += 16;

    doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED)
      .text("Signature du Président(e)", MARGIN, y, { width: 200 })
      .text("Signature du Directeur", PAGE_WIDTH / 2 - 50, y, { width: 200 });
    y += 50;
    doc.moveTo(MARGIN, y).lineTo(MARGIN + 160, y).strokeColor("#CBD5E0").lineWidth(0.5).stroke();
    doc.moveTo(PAGE_WIDTH / 2 - 50, y).lineTo(PAGE_WIDTH / 2 + 110, y).strokeColor("#CBD5E0").lineWidth(0.5).stroke();

    /* ── Pied de page ───────────────────────────────────────── */
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text(
        `Document généré par M15-SchoolTech — ${new Date().toLocaleDateString("fr-FR", { year: "numeric", month: "long", day: "numeric" })}`,
        MARGIN, 810, { width: CONTENT_WIDTH, align: "center" }
      );

    doc.end();
  });
}
