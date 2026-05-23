import { Router } from "express";
import { eq, and, or, desc, inArray } from "drizzle-orm";
import {
  db, messagesTable, utilisateursTable, parentsElevesTable,
  professeurClassesTable, eleveClassesTable, notificationsTable,
} from "@workspace/db";
import { authMiddleware } from "../middlewares/authMiddleware";
import { emitNouveauMessage, emitBadgeMessages, emitNotification } from "../socket/socketManager";

const router = Router();

async function enrichirMessage(m: typeof messagesTable.$inferSelect) {
  const [exp] = await db
    .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms, role: utilisateursTable.role })
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, m.expediteur_id))
    .limit(1);
  const [dest] = await db
    .select({ nom: utilisateursTable.nom, prenoms: utilisateursTable.prenoms })
    .from(utilisateursTable)
    .where(eq(utilisateursTable.id, m.destinataire_id))
    .limit(1);
  return {
    ...m,
    expediteur_nom:    exp?.nom ?? "",
    expediteur_prenoms: exp?.prenoms ?? "",
    expediteur_role:   exp?.role ?? "",
    destinataire_nom:    dest?.nom ?? "",
    destinataire_prenoms: dest?.prenoms ?? "",
  };
}

async function countNonLus(userId: string): Promise<number> {
  const rows = await db
    .select()
    .from(messagesTable)
    .where(and(
      eq(messagesTable.destinataire_id, userId),
      eq(messagesTable.lu, false),
      eq(messagesTable.archive_destinataire, false)
    ));
  return rows.length;
}

/* ── GET /api/messages/contacts ──────────────────────────────── */
router.get("/messages/contacts", authMiddleware, async (req, res) => {
  const user = req.user!;
  const etabId = user.etablissement_id ?? "";

  let contacts: typeof utilisateursTable.$inferSelect[] = [];

  if (user.role === "parent") {
    /* Professeurs des enfants + admin */
    const liens = await db.select().from(parentsElevesTable).where(eq(parentsElevesTable.utilisateur_id, user.id));
    const eleveIds = liens.map(l => l.eleve_id);

    if (eleveIds.length > 0) {
      const classeRows = await db
        .select()
        .from(eleveClassesTable)
        .where(inArray(eleveClassesTable.eleve_id, eleveIds));

      const classeIds = [...new Set(classeRows.map(c => c.classe_id))];

      if (classeIds.length > 0) {
        const profClasses = await db
          .select()
          .from(professeurClassesTable)
          .where(inArray(professeurClassesTable.classe_id, classeIds));

        const profIds = [...new Set(profClasses.map(pc => pc.professeur_id))];

        if (profIds.length > 0) {
          const profs = await db
            .select()
            .from(utilisateursTable)
            .where(and(
              eq(utilisateursTable.etablissement_id, etabId),
              inArray(utilisateursTable.id, profIds)
            ));
          contacts.push(...profs);
        }
      }
    }

    const admins = await db.select().from(utilisateursTable).where(
      and(
        eq(utilisateursTable.etablissement_id, etabId),
        or(eq(utilisateursTable.role, "directeur"), eq(utilisateursTable.role, "censeur"))
      )
    );
    contacts.push(...admins);

  } else if (user.role === "professeur") {
    /* Parents des élèves + admin */
    const parents = await db.select().from(utilisateursTable).where(
      and(eq(utilisateursTable.etablissement_id, etabId), eq(utilisateursTable.role, "parent"))
    );
    const admins = await db.select().from(utilisateursTable).where(
      and(
        eq(utilisateursTable.etablissement_id, etabId),
        or(eq(utilisateursTable.role, "directeur"), eq(utilisateursTable.role, "censeur"))
      )
    );
    contacts.push(...parents, ...admins);

  } else {
    /* Admin → tout le monde dans l'établissement */
    contacts = await db.select().from(utilisateursTable).where(
      and(eq(utilisateursTable.etablissement_id, etabId), eq(utilisateursTable.actif, true))
    );
    contacts = contacts.filter(c => c.id !== user.id);
  }

  /* Dédoublonner */
  const seen = new Set<string>();
  const unique = contacts.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return c.id !== user.id;
  });

  const mapped = unique.map(c => ({ id: c.id, nom: c.nom, prenoms: c.prenoms, role: c.role, photo_url: null }));
  res.json({ contacts: mapped });
});

/* ── GET /api/messages/non-lus/count ────────────────────────── */
router.get("/messages/non-lus/count", authMiddleware, async (req, res) => {
  const count = await countNonLus(req.user!.id);
  res.json({ count });
});

/* ── GET /api/messages/reception ────────────────────────────── */
router.get("/messages/reception", authMiddleware, async (req, res) => {
  const user = req.user!;
  const { lu } = req.query as Record<string, string>;

  const conditions = [
    eq(messagesTable.destinataire_id, user.id),
    eq(messagesTable.archive_destinataire, false),
  ];
  if (lu === "true")  conditions.push(eq(messagesTable.lu, true));
  if (lu === "false") conditions.push(eq(messagesTable.lu, false));

  const messages = await db
    .select()
    .from(messagesTable)
    .where(and(...conditions))
    .orderBy(desc(messagesTable.created_at));

  const enriched = await Promise.all(messages.filter(m => !m.parent_message_id).map(enrichirMessage));
  res.json({ messages: enriched, total: enriched.length });
});

/* ── GET /api/messages/envoi ────────────────────────────────── */
router.get("/messages/envoi", authMiddleware, async (req, res) => {
  const user = req.user!;
  const messages = await db
    .select()
    .from(messagesTable)
    .where(and(
      eq(messagesTable.expediteur_id, user.id),
      eq(messagesTable.archive_expediteur, false)
    ))
    .orderBy(desc(messagesTable.created_at));

  const enriched = await Promise.all(messages.filter(m => !m.parent_message_id).map(enrichirMessage));
  res.json({ messages: enriched, total: enriched.length });
});

/* ── POST /api/messages/envoyer ─────────────────────────────── */
router.post("/messages/envoyer", authMiddleware, async (req, res) => {
  const user = req.user!;
  const { destinataire_id, sujet, contenu, piece_jointe_url, piece_jointe_nom, parent_message_id } =
    req.body as {
      destinataire_id: string; sujet: string; contenu: string;
      piece_jointe_url?: string; piece_jointe_nom?: string; parent_message_id?: string;
    };

  if (!destinataire_id || !sujet?.trim() || !contenu?.trim()) {
    res.status(400).json({ message: "destinataire_id, sujet et contenu requis." }); return;
  }

  const [dest] = await db.select().from(utilisateursTable).where(eq(utilisateursTable.id, destinataire_id)).limit(1);
  if (!dest) { res.status(404).json({ message: "Destinataire introuvable." }); return; }

  if (dest.etablissement_id !== user.etablissement_id && user.role !== "dev") {
    res.status(403).json({ message: "Vous ne pouvez pas écrire à cet utilisateur." }); return;
  }

  const [msg] = await db
    .insert(messagesTable)
    .values({
      etablissement_id: user.etablissement_id ?? "",
      expediteur_id: user.id,
      destinataire_id,
      sujet: sujet.trim(),
      contenu: contenu.trim(),
      piece_jointe_url: piece_jointe_url ?? null,
      piece_jointe_nom: piece_jointe_nom ?? null,
      parent_message_id: parent_message_id ?? null,
    })
    .returning();

  const enriched = await enrichirMessage(msg);

  /* Socket.io */
  emitNouveauMessage(destinataire_id, {
    id: msg.id,
    expediteur_nom: `${enriched.expediteur_prenoms} ${enriched.expediteur_nom}`,
    sujet: msg.sujet,
    apercu: contenu.slice(0, 80),
    created_at: msg.created_at.toISOString(),
  });
  emitBadgeMessages(destinataire_id, await countNonLus(destinataire_id));

  /* Notification push */
  await emitNotification(destinataire_id, {
    id: `msg_${msg.id}`,
    type: "message",
    titre: "Nouveau message",
    contenu: `${enriched.expediteur_prenoms} ${enriched.expediteur_nom} : ${sujet}`,
    lien: `/messagerie`,
    created_at: new Date(),
  });

  /* Enregistrement DB notification */
  await db.insert(notificationsTable).values({
    etablissement_id: dest.etablissement_id ?? "",
    destinataire_id,
    type: "message",
    titre: "Nouveau message",
    contenu: `${enriched.expediteur_prenoms} ${enriched.expediteur_nom} : ${sujet}`,
    lien: "/messagerie",
  }).catch(() => {});

  res.status(201).json({ message: enriched });
});

/* ── GET /api/messages/:id ──────────────────────────────────── */
router.get("/messages/:id", authMiddleware, async (req, res) => {
  const user = req.user!;
  const id = req.params["id"] as string;

  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, id)).limit(1);
  if (!msg) { res.status(404).json({ message: "Message introuvable." }); return; }
  if (msg.expediteur_id !== user.id && msg.destinataire_id !== user.id) {
    res.status(403).json({ message: "Accès non autorisé." }); return;
  }

  /* Marquer comme lu */
  if (msg.destinataire_id === user.id && !msg.lu) {
    await db.update(messagesTable)
      .set({ lu: true, date_lecture: new Date(), updated_at: new Date() })
      .where(eq(messagesTable.id, id));
    emitBadgeMessages(user.id, await countNonLus(user.id));
  }

  /* Réponses */
  const reponses = await db
    .select()
    .from(messagesTable)
    .where(eq(messagesTable.parent_message_id, id))
    .orderBy(messagesTable.created_at);

  const [enriched, enrichedReponses] = await Promise.all([
    enrichirMessage({ ...msg, lu: true }),
    Promise.all(reponses.map(enrichirMessage)),
  ]);

  res.json({ message: enriched, reponses: enrichedReponses });
});

/* ── POST /api/messages/:id/repondre ────────────────────────── */
router.post("/messages/:id/repondre", authMiddleware, async (req, res) => {
  const user = req.user!;
  const id = req.params["id"] as string;
  const { contenu, piece_jointe_url, piece_jointe_nom } = req.body as {
    contenu: string; piece_jointe_url?: string; piece_jointe_nom?: string;
  };

  if (!contenu?.trim()) { res.status(400).json({ message: "Contenu requis." }); return; }

  const [original] = await db.select().from(messagesTable).where(eq(messagesTable.id, id)).limit(1);
  if (!original) { res.status(404).json({ message: "Message original introuvable." }); return; }

  const destinataireId = original.expediteur_id === user.id ? original.destinataire_id : original.expediteur_id;

  const [reply] = await db
    .insert(messagesTable)
    .values({
      etablissement_id: original.etablissement_id,
      expediteur_id: user.id,
      destinataire_id: destinataireId,
      sujet: `Re: ${original.sujet}`,
      contenu: contenu.trim(),
      piece_jointe_url: piece_jointe_url ?? null,
      piece_jointe_nom: piece_jointe_nom ?? null,
      parent_message_id: id,
    })
    .returning();

  const enriched = await enrichirMessage(reply);

  emitNouveauMessage(destinataireId, {
    id: reply.id,
    expediteur_nom: `${enriched.expediteur_prenoms} ${enriched.expediteur_nom}`,
    sujet: reply.sujet,
    apercu: contenu.slice(0, 80),
    created_at: reply.created_at.toISOString(),
  });
  emitBadgeMessages(destinataireId, await countNonLus(destinataireId));

  res.status(201).json({ message: enriched });
});

/* ── PUT /api/messages/:id/archiver ─────────────────────────── */
router.put("/messages/:id/archiver", authMiddleware, async (req, res) => {
  const user = req.user!;
  const id = req.params["id"] as string;

  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, id)).limit(1);
  if (!msg) { res.status(404).json({ message: "Message introuvable." }); return; }

  const update: Partial<typeof messagesTable.$inferInsert> = { updated_at: new Date() };
  if (msg.expediteur_id === user.id)    update.archive_expediteur    = true;
  if (msg.destinataire_id === user.id)  update.archive_destinataire  = true;

  await db.update(messagesTable).set(update).where(eq(messagesTable.id, id));
  res.json({ message: "Message archivé." });
});

export default router;
