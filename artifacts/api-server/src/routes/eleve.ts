import { Router } from "express";
import { eq, and, desc, lt, gte, count, sql } from "drizzle-orm";
import {
  db, utilisateursTable, elevesTable, eleveClassesTable, classesTable,
  notesTable, absencesTable, bulletinsTable, cahierTextesTable,
  notificationsTable, clubsTable,
} from "@workspace/db";
import { authMiddleware, requireRole } from "../middlewares/authMiddleware";
import { verifierLicence } from "../middlewares/verifierLicence";

const router = Router();

/* ─── GET /api/eleve/dashboard ──────────────────────────────── */
router.get(
  "/eleve/dashboard",
  authMiddleware, requireRole("eleve"), verifierLicence,
  async (req, res) => {
    const user = req.user!;

    try {
      const [eleveRecord] = await db
        .select()
        .from(elevesTable)
        .where(eq(elevesTable.utilisateur_id, user.id))
        .limit(1);

      const classeInfo = eleveRecord
        ? await db
            .select({
              id: eleveClassesTable.id,
              classe_id: eleveClassesTable.classe_id,
              annee_scolaire_id: eleveClassesTable.annee_scolaire_id,
              nom_classe: classesTable.nom,
              niveau: classesTable.niveau,
            })
            .from(eleveClassesTable)
            .leftJoin(classesTable, eq(classesTable.id, eleveClassesTable.classe_id))
            .where(
              and(
                eq(eleveClassesTable.eleve_id, eleveRecord.id),
                eq(eleveClassesTable.statut, "actif"),
              )
            )
            .orderBy(desc(eleveClassesTable.created_at))
            .limit(1)
        : [];

      const classeActuelle = classeInfo[0] ?? null;
      const eleveId = eleveRecord?.id ?? null;
      const classeId = classeActuelle?.classe_id ?? null;

      const notesRecentes = eleveId
        ? await db
            .select()
            .from(notesTable)
            .where(eq(notesTable.eleve_id, eleveId))
            .orderBy(desc(notesTable.created_at))
            .limit(10)
        : [];

      const absencesRecentes = eleveId
        ? await db
            .select()
            .from(absencesTable)
            .where(eq(absencesTable.eleve_id, eleveId))
            .orderBy(desc(absencesTable.created_at))
            .limit(3)
        : [];

      const absencesNonJustifiees = eleveId
        ? await db
            .select({ nb: count() })
            .from(absencesTable)
            .where(
              and(
                eq(absencesTable.eleve_id, eleveId),
                eq(absencesTable.statut, "non_justifiee")
              )
            )
        : [{ nb: 0 }];

      const bulletins = eleveId
        ? await db
            .select()
            .from(bulletinsTable)
            .where(
              and(
                eq(bulletinsTable.eleve_id, eleveId),
                eq(bulletinsTable.publie, true),
              )
            )
            .orderBy(desc(bulletinsTable.created_at))
        : [];

      const today = new Date().toISOString().slice(0, 10);
      const sevenDays = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

      const devoirsUrgents = classeId
        ? await db
            .select()
            .from(cahierTextesTable)
            .where(
              and(
                eq(cahierTextesTable.classe_id, classeId),
                eq(cahierTextesTable.devoir_a_rendre, true),
                sql`${cahierTextesTable.date_remise_devoir} >= ${today}`,
                sql`${cahierTextesTable.date_remise_devoir} <= ${sevenDays}`,
              )
            )
            .orderBy(cahierTextesTable.date_remise_devoir)
            .limit(5)
        : [];

      const notifsNonLues = await db
        .select({ nb: count() })
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.destinataire_id, user.id),
            eq(notificationsTable.lu, false),
          )
        );

      const moyenneGenerale =
        notesRecentes.length > 0
          ? (
              notesRecentes.reduce((acc, n) => acc + Number(n.note), 0) /
              notesRecentes.length
            ).toFixed(2)
          : null;

      res.json({
        eleve: eleveRecord ?? null,
        classe: classeActuelle,
        kpis: {
          moyenne_generale: moyenneGenerale,
          absences_non_justifiees: Number(absencesNonJustifiees[0]?.nb ?? 0),
          bulletins_disponibles: bulletins.length,
          devoirs_urgents: devoirsUrgents.length,
          notifs_non_lues: Number(notifsNonLues[0]?.nb ?? 0),
        },
        notes_recentes: notesRecentes.map(n => ({
          ...n,
          note: Number(n.note),
          note_sur: Number(n.note_sur),
          coefficient: Number(n.coefficient),
        })),
        absences_recentes: absencesRecentes,
        bulletins,
        devoirs_urgents: devoirsUrgents,
      });
    } catch (err) {
      req.log.error(err, "Erreur dashboard élève");
      res.status(500).json({ message: "Erreur serveur" });
    }
  }
);

export default router;
