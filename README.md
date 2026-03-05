This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

1. Clone the repository
```bash
git clone https://github.com/V33rapat/university-competency-system.git
cd university-competency-system
```

2. Install Golang Follow is document: https://go.dev/doc/install

3. . Install frontend dependencies
```bash
cd apps/frontend
npm install
```

Environment Variables
Create a .env file in the backend directory with the following:
(Wait, I'm making it.)

Run the development server:
  1. Run backend
  ```bash
  cd apps/backend
  go run ./cmd/api
  ```

  2. Run Frontend
  ```bash
  cd ../frontend
  npm run dev
  # or
  yarn dev
  # or
  pnpm dev
  # or
  bun dev
  ```

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

```
university-competency-system
├─ apps
│  ├─ backend
│  │  ├─ cmd
│  │  │  └─ api
│  │  │     └─ main.go
│  │  ├─ go.mod
│  │  ├─ go.sum
│  │  ├─ internal
│  │  │  ├─ app
│  │  │  │  ├─ auth
│  │  │  │  │  ├─ context.go
│  │  │  │  │  └─ jwt.go
│  │  │  │  ├─ config
│  │  │  │  │  └─ config.go
│  │  │  │  ├─ db
│  │  │  │  │  └─ mysql.go
│  │  │  │  └─ http
│  │  │  │     ├─ handler
│  │  │  │     │  └─ health_handler.go
│  │  │  │     ├─ middleware
│  │  │  │     │  ├─ auth_required.go
│  │  │  │     │  ├─ cors.go
│  │  │  │     │  ├─ logger.go
│  │  │  │     │  ├─ rbac.go
│  │  │  │     │  └─ request_id.go
│  │  │  │     └─ router
│  │  │  │        └─ router.go
│  │  │  └─ module
│  │  │     └─ auth
│  │  │        ├─ auth_handler.go
│  │  │        ├─ auth_model.go
│  │  │        ├─ auth_repository.go
│  │  │        └─ auth_service.go
│  │  ├─ pkg
│  │  │  └─ response
│  │  │     └─ response.go
│  │  └─ README.md
│  └─ frontend
│     ├─ app
│     │  ├─ Competency.css
│     │  ├─ favicon.ico
│     │  ├─ globals.css
│     │  ├─ layout.jsx
│     │  └─ page.jsx
│     ├─ components
│     │  ├─ ColorBends.jsx
│     │  └─ competency
│     │     ├─ ActivityDetailPanel.jsx
│     │     ├─ CompetencyFilters.jsx
│     │     ├─ CompetencyLayout.jsx
│     │     ├─ CompetencyRadarChart.jsx
│     │     ├─ CompetencyStats.jsx
│     │     └─ GapAnalysis.jsx
│     ├─ config
│     │  └─ theme.js
│     ├─ data
│     │  └─ competencyData.js
│     ├─ eslint.config.mjs
│     ├─ jsconfig.json
│     ├─ lib
│     │  └─ utils.js
│     ├─ next.config.mjs
│     ├─ next.config.ts
│     ├─ package-lock.json
│     ├─ package.json
│     ├─ postcss.config.mjs
│     └─ public
│        ├─ file.svg
│        ├─ globe.svg
│        ├─ next.svg
│        ├─ vercel.svg
│        └─ window.svg
├─ kku_competency_database_v1.sql
└─ README.md

```
```
university-competency-system
├─ apps
│  ├─ backend
│  │  ├─ cmd
│  │  │  └─ api
│  │  │     └─ main.go
│  │  ├─ config
│  │  │  └─ config.go
│  │  ├─ controllers
│  │  │  ├─ auth_controller.go
│  │  │  └─ health_controller.go
│  │  ├─ db
│  │  │  └─ mysql.go
│  │  ├─ go.mod
│  │  ├─ go.sum
│  │  ├─ middleware
│  │  │  ├─ auth_required.go
│  │  │  ├─ cors.go
│  │  │  ├─ logger.go
│  │  │  ├─ rbac.go
│  │  │  └─ request_id.go
│  │  ├─ models
│  │  │  └─ auth_model.go
│  │  ├─ README.md
│  │  ├─ repositories
│  │  │  └─ auth_repository.go
│  │  ├─ routes
│  │  │  └─ routes.go
│  │  ├─ services
│  │  │  └─ auth_service.go
│  │  └─ utils
│  │     ├─ auth_context.go
│  │     ├─ jwt.go
│  │     └─ response.go
│  └─ frontend
│     ├─ app
│     │  ├─ Competency.css
│     │  ├─ favicon.ico
│     │  ├─ globals.css
│     │  ├─ layout.jsx
│     │  └─ page.jsx
│     ├─ components
│     │  ├─ ColorBends.jsx
│     │  └─ competency
│     │     ├─ ActivityDetailPanel.jsx
│     │     ├─ CompetencyFilters.jsx
│     │     ├─ CompetencyLayout.jsx
│     │     ├─ CompetencyRadarChart.jsx
│     │     ├─ CompetencyStats.jsx
│     │     └─ GapAnalysis.jsx
│     ├─ config
│     │  └─ theme.js
│     ├─ data
│     │  └─ competencyData.js
│     ├─ eslint.config.mjs
│     ├─ jsconfig.json
│     ├─ lib
│     │  └─ utils.js
│     ├─ next.config.mjs
│     ├─ next.config.ts
│     ├─ package-lock.json
│     ├─ package.json
│     ├─ postcss.config.mjs
│     └─ public
│        ├─ file.svg
│        ├─ globe.svg
│        ├─ next.svg
│        ├─ vercel.svg
│        └─ window.svg
├─ kku_competency_database_v1.sql
└─ README.md

```
