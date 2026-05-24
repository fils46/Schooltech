import type PDFDocument from "pdfkit";
import { objectStorageService } from "./objectStorage";

interface EtablissementPDFInfo {
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

const NAVY = "#0A1628";
const CYAN = "#00C9A7";
const GOLD = "#F5C842";
const MUTED = "#6B7A99";
const WHITE = "#FFFFFF";

const PAGE_WIDTH = 595.28;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

async function telechargerImage(objectPath: string): Promise<Buffer | null> {
  try {
    const file = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(file);
    if (!response.body) return null;
    const chunks: Buffer[] = [];
    for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch {
    return null;
  }
}

/**
 * Dessine l'en-tête officiel M15 SchoolTech sur le document PDF.
 * Retourne la position Y après l'en-tête.
 */
export async function genererEntete(
  doc: InstanceType<typeof PDFDocument>,
  etab: EtablissementPDFInfo,
  titreDocument: string,
  sousTitre?: string,
): Promise<number> {
  const HEADER_HEIGHT = 120;

  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT).fill(NAVY);

  let logoBuffer: Buffer | null = null;
  if (etab.logo_path) {
    logoBuffer = await telechargerImage(etab.logo_path);
  }

  if (logoBuffer) {
    try {
      doc.image(logoBuffer, MARGIN, 15, { height: 55, fit: [80, 55] });
    } catch {
      logoBuffer = null;
    }
  }

  const textLeft = logoBuffer ? MARGIN + 90 : MARGIN;
  const textWidth = logoBuffer ? CONTENT_WIDTH - 90 : CONTENT_WIDTH;

  doc.font("Helvetica-Bold").fontSize(13).fillColor(WHITE)
    .text(etab.nom.toUpperCase(), textLeft, 18, { width: textWidth, align: logoBuffer ? "left" : "center" });

  const typeLabel =
    etab.type === "college" ? "Collège" :
    etab.type === "lycee" ? "Lycée" :
    etab.type === "college_lycee" ? "Collège & Lycée" :
    etab.type ?? "";

  const infoLignes: string[] = [];
  if (typeLabel) infoLignes.push(typeLabel);
  if (etab.ville) infoLignes.push(etab.ville);
  if (etab.adresse) infoLignes.push(etab.adresse);
  if (etab.bp) infoLignes.push(`B.P. ${etab.bp}`);

  if (infoLignes.length > 0) {
    doc.font("Helvetica").fontSize(8).fillColor("#A0AEC0")
      .text(infoLignes.join(" | "), textLeft, 37, { width: textWidth, align: logoBuffer ? "left" : "center" });
  }

  const contactLignes: string[] = [];
  if (etab.telephone) contactLignes.push(`Tél : ${etab.telephone}`);
  const mail = etab.email_contact ?? etab.email;
  if (mail) contactLignes.push(mail);
  if (etab.site_web) contactLignes.push(etab.site_web);

  if (contactLignes.length > 0) {
    doc.font("Helvetica").fontSize(7.5).fillColor(CYAN)
      .text(contactLignes.join("  •  "), textLeft, 52, { width: textWidth, align: logoBuffer ? "left" : "center" });
  }

  if (etab.devise) {
    doc.font("Helvetica-Oblique").fontSize(7).fillColor(GOLD)
      .text(`« ${etab.devise} »`, textLeft, 65, { width: textWidth, align: logoBuffer ? "left" : "center" });
  }

  const dividerY = HEADER_HEIGHT - 12;
  doc.moveTo(MARGIN, dividerY).lineTo(PAGE_WIDTH - MARGIN, dividerY)
    .strokeColor(CYAN).lineWidth(0.8).stroke();

  const titreY = HEADER_HEIGHT + 12;
  doc.font("Helvetica-Bold").fontSize(15).fillColor(NAVY)
    .text(titreDocument.toUpperCase(), MARGIN, titreY, { width: CONTENT_WIDTH, align: "center" });

  let y = titreY + 22;

  if (sousTitre) {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED)
      .text(sousTitre, MARGIN, y, { width: CONTENT_WIDTH, align: "center" });
    y += 16;
  }

  y += 6;
  return y;
}

/**
 * Dessine le pied de page officiel avec cachet et signature.
 * À appeler juste avant doc.end().
 */
export async function genererPiedDePage(
  doc: InstanceType<typeof PDFDocument>,
  etab: EtablissementPDFInfo,
  ySignature?: number,
): Promise<void> {
  const PAGE_HEIGHT = 841.89;
  const FOOTER_Y = PAGE_HEIGHT - 80;
  const FOOTER_HEIGHT = 70;

  doc.rect(0, FOOTER_Y - 5, PAGE_WIDTH, FOOTER_HEIGHT).fill("#F7F9FC");
  doc.moveTo(MARGIN, FOOTER_Y - 5).lineTo(PAGE_WIDTH - MARGIN, FOOTER_Y - 5)
    .strokeColor(CYAN).lineWidth(0.6).stroke();

  const sigY = ySignature ?? FOOTER_Y;
  const colW = CONTENT_WIDTH / 3;

  let cachetBuffer: Buffer | null = null;
  if (etab.cachet_path) {
    cachetBuffer = await telechargerImage(etab.cachet_path);
  }

  let signatureBuffer: Buffer | null = null;
  if (etab.signature_directeur_path) {
    signatureBuffer = await telechargerImage(etab.signature_directeur_path);
  }

  if (cachetBuffer) {
    try {
      doc.image(cachetBuffer, MARGIN, sigY, { height: 50, fit: [70, 50] });
    } catch {}
  } else {
    doc.font("Helvetica").fontSize(7).fillColor(MUTED)
      .text("[Cachet de l'établissement]", MARGIN, sigY + 15, { width: colW, align: "center" });
  }

  doc.font("Helvetica").fontSize(8).fillColor(MUTED)
    .text(`Établi par ${etab.nom}`, MARGIN + colW, sigY + 4, { width: colW, align: "center" });
  doc.font("Helvetica").fontSize(7).fillColor(MUTED)
    .text(`Généré le ${new Date().toLocaleDateString("fr-FR")}`, MARGIN + colW, sigY + 16, { width: colW, align: "center" });
  doc.font("Helvetica").fontSize(7).fillColor(MUTED)
    .text("M15 Tech — Plateforme scolaire", MARGIN + colW, sigY + 27, { width: colW, align: "center" });

  if (signatureBuffer) {
    try {
      doc.image(signatureBuffer, MARGIN + colW * 2, sigY, { height: 40, fit: [90, 40] });
    } catch {}
  }

  doc.font("Helvetica-Bold").fontSize(7.5).fillColor(NAVY)
    .text("Le Directeur", MARGIN + colW * 2, sigY + 42, { width: colW, align: "center" });
}
