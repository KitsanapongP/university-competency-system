# AGENTS.md - University Competency System

## Project Overview

This is a monorepo with a **Go backend** (Chi router) and **Next.js frontend** (React 19, Tailwind CSS v4).

- **Frontend**: `apps/frontend/` - Next.js 16.1.4, React 19.2.3
- **Backend**: `apps/backend/` - Go 1.24.4, Chi HTTP router
- **Database**: MySQL (schema in `crs_schema_final_v2.sql`)

---

## Build/Lint/Test Commands

### Frontend (`apps/frontend/`)

```bash
# Install dependencies
npm install

# Development server (http://localhost:3000)
npm run dev

# Production build
npm run build

# Start production server
npm start

# Lint (ESLint with Next.js rules)
npm run lint
```

### Backend (`apps/backend/`)

```bash
# Run development server
go run cmd/api/main.go

# Build binary
go build -o bin/api ./cmd/api

# Run all tests
go test ./...
```

---

## Architecture

### Frontend Page Structure

```
app/
├── (officer)/                    # Officer routes group
│   ├── course-management/
│   │   ├── page.jsx             # Course list page
│   │   ├── layout.jsx          # Officer layout
│   │   ├── create/
│   │   │   └── page.jsx         # Create course page
│   │   └── components/
│   └── template-management/
└── page.jsx                     # User competency page
```

### Layout Components

- **AppLayout** (`components/layout/AppLayout.jsx`): Shared layout for all pages
  - Accepts `role` prop: `"user"`, `"officer"`, `"admin"`
  - Menu items auto-configured based on role
  - Navbar styling from `Competency.css`

---

## Code Style Guidelines

### CSS Organization (Course Management Example)

```bash
# Pattern: Separate CSS files per feature/page
app/(officer)/course-management/
├── CourseLayout.css     # Shared styles (buttons, forms, modal, scrollbar)
├── CourseList.css      # List page styles (header, grid, cards, pagination)
├── CourseCreate.css    # Create page styles (steps, tree, spreadsheet)
├── page.jsx            # List page
└── create/page.jsx     # Create page
```

**CSS Class Naming Convention:**
```css
/* BEM-like with component prefix */
.course-layout       /* Block */
.course-list-header   /* Element */
.course-btn--primary  /* Modifier */
.course-form-field__input  /* Nested element */
```

### Frontend Imports

```javascript
// 1. React core
import React, { useEffect, useState } from 'react';

// 2. Next.js modules
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// 3. Third-party (alphabetical)
import { Mail, Lock } from 'lucide-react';

// 4. Internal components (relative paths)
import { AppLayout } from '../components/layout/AppLayout';

// 5. CSS (at end)
import './CourseLayout.css';
import './CourseList.css';
```

### Key Conventions

- Use `'use client'` for client components
- No emoji in code/comments
- Prefer early returns over deep nesting
- Use CSS classes over inline styles (except dynamic styles based on state)
- Export default for page components, named exports for reusable components

---

## Git Conventions

- Commit format: `type: description` (e.g., `feat: add user login`)
- Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`
- Keep commits focused and atomic
