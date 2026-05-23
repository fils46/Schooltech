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
      (socket as Socket & { userId?: string; etablissementId?: string }).userId = payload.id;
      (socket as Socket & { userId?: string; etablissementId?: string }).etablissementId = payload.etablissement_id ?? "";
      next();
    } catch {
      next(new Error("Token invalide."));
    }
  });

  io.on("connection", (socket: Socket) => {
    const s = socket as Socket & { userId?: string; etablissementId?: string };
    const userId = s.userId;
    if (!userId) return;

    socket.join(`user_${userId}`);
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
