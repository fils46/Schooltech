# M15-SchoolTech

Plateforme de gestion scolaire pour collèges et lycées en Côte d'Ivoire, développée par M15 Tech.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/m15-schooltech run dev` — run the frontend (port 21136)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (already provisioned)
- Required env: `JWT_SECRET` — Secret JWT (set to M15SchoolTech_JWT_2026)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite + Tailwind CSS + shadcn/ui (Poppins font, dark mode)
- API: Express 5 + jsonwebtoken + bcrypt
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — Source de vérité du contrat API
- `lib/db/src/schema/` — Schémas Drizzle (etablissements, utilisateurs, resetTokens)
- `artifacts/api-server/src/routes/` — Routes Express (auth, utilisateurs, etablissements, stats)
- `artifacts/api-server/src/middlewares/authMiddleware.ts` — Middleware JWT + RBAC
- `artifacts/api-server/src/lib/auth.ts` — JWT sign/verify, password helpers
- `artifacts/m15-schooltech/src/` — Frontend React
  - `context/AuthContext.tsx` — Auth state (localStorage)
  - `components/layout/DashboardLayout.tsx` — Shell avec sidebar par rôle
  - `pages/` — login, dashboard, etablissements, utilisateurs, forgot-password, reset-password, premier-login

## Architecture decisions

- JWT 24h + refresh token 7j, stockés dans localStorage sous `m15_token` / `m15_user`
- Isolation multi-tenant : chaque requête filtrée par `etablissement_id` sauf role=dev
- Désactivation établissement → suspension cascade de tous ses utilisateurs (un seul UPDATE)
- Premier login → `premier_login=true` en DB, forçage changement de mot de passe côté frontend
- Envoi email Resend désactivé (fonctionnalité désactivée à la demande de l'utilisateur)

## Product

Module 01 — Authentification complet :
- Login JWT avec vérification compte actif + message d'erreur FR
- Dashboards adaptatifs selon 6 rôles (dev, directeur, censeur, professeur, eleve, parent)
- CRUD utilisateurs avec permissions hiérarchiques
- CRUD établissements (dev uniquement)
- Statistiques globales et par établissement
- Thème Bleu marine / Cyan / Or + Poppins + mode sombre/clair

## User preferences

- Emails de réinitialisation désactivés (pas de Resend pour l'instant)
- Commentaires et messages d'erreur en français

## Comptes de démonstration

| Email | Mot de passe | Rôle |
|-------|-------------|------|
| dev@m15-schooltech.ci | Dev@M15Tech2026 | dev |

## Gotchas

- Toujours relancer `pnpm --filter @workspace/api-spec run codegen` après modification de `openapi.yaml`
- Le compte dev a `premier_login=false` pour éviter la redirection de changement de mot de passe
- Les mots de passe temporaires générés (8-10 chars) sont retournés dans la réponse `POST /utilisateurs/creer`
- Drizzle push: en cas de conflit de colonnes, utiliser `pnpm --filter @workspace/db run push-force`

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
