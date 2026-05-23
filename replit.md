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

## Hiérarchie de création des comptes

| Rôle créateur | Peut créer                               |
|---------------|------------------------------------------|
| dev           | directeur uniquement                     |
| directeur     | censeur, professeur, élève, parent       |
| censeur       | professeur, élève, parent                |

Le dev crée les directeurs et leur assigne un établissement.
Le directeur est responsable de créer tous les membres de son école.

## Product

Module 01 — Authentification complet :
- Login JWT avec vérification compte actif + message d'erreur FR
- Dashboards adaptatifs selon 7 rôles (dev, directeur, censeur, professeur, eleve, parent, infirmier)
- CRUD utilisateurs avec permissions hiérarchiques
- CRUD établissements (dev uniquement)
- Statistiques globales et par établissement
- Thème Bleu marine / Cyan / Or + Poppins + mode sombre/clair

Module 18 — Tableau de Bord Analytique (complet) :
- 2 tables DB : rapports_generes, snapshots_analytics
- 12 endpoints API REST sous /api/analytics/...
- KPIs établissement, analyse pédagogique (par classe/matière/prof/élève), analyse présences, infirmerie, clubs, bibliothèque
- Dashboard professeur avec ses propres moyennes et classes
- Pages : dashboard-analytique, analyse-pedagogique, analyse-presences, dashboard-professeur-analytique, rapports-exports
- Exports rapides PDF/Excel avec modal de génération personnalisée
- Graphiques Recharts (BarChart, LineChart) + tableaux détaillés
- Sections ANALYTIQUE ajoutées dans la sidebar dev/directeur/censeur/professeur

Module 16 — Infirmerie Numérique (complet) :
- 4 tables DB : dossiers_medicaux, consultations_infirmerie, stocks_infirmerie, mouvements_stocks
- 15 endpoints API REST sous /api/infirmerie/...
- Rôle infirmier : sidebar dédiée, accès complet infirmerie
- Pages : tableau de bord infirmerie, nouvelle consultation, gestion consultation, dossiers médicaux, stocks infirmerie, liste consultations, vue parent
- Notifications parents automatiques à la clôture de consultation
- Alertes de stock (seuil configurable par article)

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
