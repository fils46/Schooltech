import PDFDocument from "pdfkit";
import { genererEntete, genererPiedDePage } from "./pdfHeader";

export interface EtablissementPDFInfo {
  nom: string;
  type?: string | null;
  ville?: string | null;
  telephone?: string | null;
  email_contact?: string | null;
  email?: string | null;
  adresse?: string | null;
  bp?: string | null;
  site_web?: string | null;
  devise?: string | null;
  logo_path?: string | null;
  cachet_path?: string | null;
  signature_directeur_path?: string | null;
}

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
  etablissement?: EtablissementPDFInfo | null;
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

export async function generatePV(data: PVConseilData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4", autoFirstPage: true });
    const buffers: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => buffers.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(buffers)));
    doc.on("error", reject);

    buildPV(doc, data).then(() => doc.end()).catch(reject);
  });
}

async function buildPV(doc: InstanceType<typeof PDFDocument>, data: PVConseilData): Promise<void> {
  const PAGE_WIDTH = 595.28;
  const MARGIN = 50;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

  const NAVY  = "#0A1628";
  const CYAN  = "#00C9A7";
  const GOLD  = "#F5C842";
  const DARK  = "#1A2740";
  const MUTED = "#6B7A99";

  let y: number;

  if (data.etablissement) {
    const sousTitre = `Classe : ${data.conseil.classe_nom} — Trimestre ${data.conseil.trimestre} — ${data.conseil.date_conseil}`;
    y = await genererEntete(doc, data.etablissement, "Procès-verbal du Conseil de Classe", sousTitre);
    if (data.conseil.president_nom) {
      doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
        .text(`Président(e) : ${data.conseil.president_nom}`, MARGIN, y, { width: CONTENT_WIDTH, align: "center" });
      y += 14;
    }
  } else {
    /* ── En-tête legacy ─────────────────────────────────────── */
    doc.rect(0, 0, PAGE_WIDTH, 110).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(18).fillColor(CYAN)
      .text("PROCÈS-VERBAL DU CONSEIL DE CLASSE", MARGIN, 25, { width: CONTENT_WIDTH, align: "center" });
    doc.font("Helvetica").fontSize(11).fillColor("#FFFFFF")
      .text(
        `${data.conseil.etablissement_nom ?? "Établissement"} — Classe : ${data.conseil.classe_nom} — Trimestre ${data.conseil.trimestre}`,
        MARGIN, 52, { width: CONTENT_WIDTH, align: "center" }
      );
    const dateStr = `Date : ${data.conseil.date_conseil}${data.conseil.heure_debut ? `  |  Heure début : ${data.conseil.heure_debut}` : ""}${data.conseil.heure_fin ? `  |  Fin : ${data.conseil.heure_fin}` : ""}`;
    doc.font("Helvetica").fontSize(9).fillColor(GOLD)
      .text(dateStr, MARGIN, 76, { width: CONTENT_WIDTH, align: "center" });
    doc.font("Helvetica").fontSize(9).fillColor("#A0AEC0")
      .text(`Président(e) : ${data.conseil.president_nom ?? "—"}`, MARGIN, 93, { width: CONTENT_WIDTH, align: "center" });
    y = 125;
  }

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
    /* Table header */
    const COL = {
      rang:    { x: MARGIN,        w: 30  },
      nom:     { x: MARGIN + 30,   w: 120 },
      moy:     { x: MARGIN + 150,  w: 50  },
      abs:     { x: MARGIN + 200,  w: 40  },
      dec:     { x: MARGIN + 240,  w: 80  },
      obs:     { x: MARGIN + 320,  w: CONTENT_WIDTH - 270 },
    };

    doc.rect(MARGIN, y, CONTENT_WIDTH, 16).fill("#EEF2FF");
    const headers: Array<[keyof typeof COL, string]> = [
      ["rang", "Rg"], ["nom", "Élève"], ["moy", "Moy."],
      ["abs", "Abs."], ["dec", "Décision"], ["obs", "Observations"],
    ];
    for (const [key, label] of headers) {
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(NAVY)
        .text(label, COL[key].x + 2, y + 4, { width: COL[key].w, align: key === "rang" || key === "moy" || key === "abs" ? "center" : "left" });
    }
    y += 18;

    for (let i = 0; i < data.deliberations.length; i++) {
      const d = data.deliberations[i];
      const bg = i % 2 === 0 ? "#FFFFFF" : "#F8FAFC";
      const rowH = 18;
      doc.rect(MARGIN, y, CONTENT_WIDTH, rowH).fill(bg);

      doc.font("Helvetica").fontSize(8).fillColor(NAVY)
        .text(d.rang ? String(d.rang) : "—", COL.rang.x + 2, y + 4, { width: COL.rang.w, align: "center" })
        .text(`${d.eleve_prenoms} ${d.eleve_nom}`, COL.nom.x + 2, y + 4, { width: COL.nom.w })
        .text(d.moyenne_generale ? `${d.moyenne_generale}/20` : "—", COL.moy.x + 2, y + 4, { width: COL.moy.w, align: "center" })
        .text(String(d.nb_absences), COL.abs.x + 2, y + 4, { width: COL.abs.w, align: "center" });

      const decLabel = d.decision ? (DECISION_LABELS[d.decision] ?? d.decision) : "—";
      const decColor =
        d.decision === "passage" || d.decision === "felicitations" || d.decision === "encouragements" ? "#16A34A" :
        d.decision === "redoublement" || d.decision === "exclusion" ? "#DC2626" :
        NAVY;
      doc.font("Helvetica-Bold").fontSize(7.5).fillColor(decColor)
        .text(decLabel, COL.dec.x + 2, y + 4, { width: COL.dec.w });

      if (d.mention_honneur) {
        doc.font("Helvetica-Oblique").fontSize(7).fillColor(GOLD)
          .text("★ Mention", COL.obs.x + 2, y + 4, { width: COL.obs.w });
      } else if (d.observations) {
        doc.font("Helvetica").fontSize(7).fillColor(MUTED)
          .text(d.observations.slice(0, 60), COL.obs.x + 2, y + 4, { width: COL.obs.w });
      }

      y += rowH;
    }
  }

  y += 12;

  /* ── Observations générales ─────────────────────────────── */
  if (data.conseil.observations_generales) {
    doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(DARK);
    doc.font("Helvetica-Bold").fontSize(10).fillColor(CYAN)
      .text("OBSERVATIONS GÉNÉRALES", MARGIN + 8, y + 5);
    y += 28;

    doc.font("Helvetica").fontSize(9).fillColor(NAVY)
      .text(data.conseil.observations_generales, MARGIN, y, { width: CONTENT_WIDTH });
    y += doc.heightOfString(data.conseil.observations_generales, { width: CONTENT_WIDTH }) + 10;
  }

  /* ── Signatures ─────────────────────────────────────────── */
  y += 10;
  doc.rect(MARGIN, y, CONTENT_WIDTH, 20).fill(DARK);
  doc.font("Helvetica-Bold").fontSize(10).fillColor(CYAN)
    .text("SIGNATURES", MARGIN + 8, y + 5);
  y += 28;

  const sigCols = ["Le(La) Président(e)", "Le(La) Censeur(e)", "Le(La) Directeur(trice)"];
  const sigW = CONTENT_WIDTH / 3;
  for (let i = 0; i < sigCols.length; i++) {
    const x = MARGIN + i * sigW;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(NAVY)
      .text(sigCols[i], x + 4, y, { width: sigW - 8, align: "center" });
    doc.rect(x + 4, y + 14, sigW - 8, 40).stroke("#D1D5DB");
  }

  if (data.etablissement) {
    await genererPiedDePage(doc, data.etablissement, y + 80);
  }
}
