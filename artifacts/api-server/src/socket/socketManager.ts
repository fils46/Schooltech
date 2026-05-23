import { Server as SocketServer, type Socket } from "socket.io";
import type { Server as HttpServer } from "http";
import { verifyToken } from "../lib/auth";
import { logger } from "../lib/logger";
import {
  db, notificationsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

let io: SocketServer | null = null;

export function initSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    path: "/api/socket.io",
  });

  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth["token"] as string | undefined;
    if (!token) {
      next(new Error("Token manquant."));
      return;
    }
    try {
      const payload = verifyToken(token);
      const s = socket as Socket & { userId?: string; etablissementId?: string; role?: string };
      s.userId = payload.id;
      s.etablissementId = payload.etablissement_id ?? "";
      s.role = payload.role;
      next();
    } catch {
      next(new Error("Token invalide."));
    }
  });

  io.on("connection", (socket: Socket) => {
    const s = socket as Socket & { userId?: string; etablissementId?: string; role?: string };
    const userId = s.userId;
    if (!userId) return;

    socket.join(`user_${userId}`);

    /* Auto-join role room + etab room */
    if (s.etablissementId) {
      socket.join(`etab_${s.etablissementId}`);
      if (s.role) {
        socket.join(`role_${s.role}_${s.etablissementId}`);
      }
    }
    logger.info({ userId }, "Socket connecté");

    socket.on("rejoindre_etablissement", (etabId: string) => {
      socket.join(`etab_${etabId}`);
    });

    socket.on("marquer_lu", async (notificationId: string) => {
      if (!userId) return;
      await db
        .update(notificationsTable)
        .set({ lu: true, date_lecture: new Date(), updated_at: new Date() })
        .where(
          and(
            eq(notificationsTable.id, notificationId),
            eq(notificationsTable.destinataire_id, userId)
          )
        );
    });

    socket.on("rejoindre_conseil", async (conseilId: string) => {
      if (!userId) return;
      socket.join(`conseil_${conseilId}`);
      logger.info({ userId, conseilId }, "Rejoint salle conseil");
    });

    socket.on("quitter_conseil", (conseilId: string) => {
      socket.leave(`conseil_${conseilId}`);
    });

    socket.on("disconnect", () => {
      logger.info({ userId }, "Socket déconnecté");
    });
  });

  return io;
}

export function getIo(): SocketServer | null {
  return io;
}

export function emitToConseil(conseilId: string, event: string, data: unknown) {
  if (!io) return;
  io.to(`conseil_${conseilId}`).emit(event, data);
}

export function emitNouveauMessage(destinataireId: string, data: {
  id: string;
  expediteur_nom: string;
  sujet: string;
  apercu: string;
  created_at: string;
}) {
  if (!io) return;
  io.to(`user_${destinataireId}`).emit("nouveau_message", data);
}

export function emitBadgeMessages(destinataireId: string, count: number) {
  if (!io) return;
  io.to(`user_${destinataireId}`).emit("badge_messages", { count });
}

export function emitNouvelleAnnonce(
  etablissementId: string,
  destinataires: string[],
  data: { id: string; titre: string; type: string; auteur: string }
) {
  if (!io) return;
  if (destinataires.includes("tous")) {
    io.to(`etab_${etablissementId}`).emit("nouvelle_annonce", data);
  } else {
    for (const role of destinataires) {
      io.to(`role_${role}_${etablissementId}`).emit("nouvelle_annonce", data);
    }
  }
}

export function emitToEtablissement(etablissementId: string, event: string, data: unknown) {
  if (!io) return;
  io.to(`etab_${etablissementId}`).emit(event, data);
}

export async function emitNotification(destinataireId: string, data: {
  id: string;
  type: string;
  titre: string;
  contenu: string;
  lien?: string | null;
  created_at: Date;
}) {
  if (!io) return;
  io.to(`user_${destinataireId}`).emit("notification", data);

  const count = await db
    .select()
    .from(notificationsTable)
    .where(and(
      eq(notificationsTable.destinataire_id, destinataireId),
      eq(notificationsTable.lu, false)
    ));
  io.to(`user_${destinataireId}`).emit("badge_count", count.length);
}
