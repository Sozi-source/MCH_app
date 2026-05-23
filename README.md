# mamaTOTO — ZuriHealth Child Health Companion

> A React Native / Expo app for Kenyan mothers and community health workers to track child growth, vaccines, nutrition, and get AI-powered health guidance — grounded in WHO and Kenya MoH guidelines.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Screens & Features](#screens--features)
- [State Management](#state-management)
- [Libraries & APIs](#libraries--apis)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Database Schema (Supabase)](#database-schema-supabase)
- [Key Design Decisions](#key-design-decisions)
- [Evidence-Based Sources](#evidence-based-sources)

---

## Overview

**mamaTOTO** (Swahili: "Mama and Child"), branded as **ZuriHealth**, is a mobile-first health companion built for Kenyan mothers and community health workers. It helps track:

- Child **growth** (weight/height/head circumference) with WHO z-score analysis and visual growth charts
- Kenya **KEPI vaccine** schedule (23 doses, birth to 24 months) with due/given/missed tracking and push notifications
- **Nutrition** guidance (WHO IYCF feeding stages, food group diversity checker, AI Kenyan meal suggestions)
- **AI chat** via Zuri — a culturally-sensitive maternal health assistant powered by Anthropic Claude
- **Milestones** — developmental milestone tracking by age group (motor, language, cognitive, social)
- **Health reports** summarising growth trends and vaccine coverage with PDF export
- **Co-parenting** — link a second parent to a child's health record by email
- **Admin panel** — analytics, user management, and platform-wide health data (admin role only)

The app supports **English and Kiswahili** and targets community health workers and mothers in Kenya.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native via **Expo** (Expo Router, file-based routing) |
| Language | **TypeScript** |
| Backend / Auth / DB | **Supabase** (PostgreSQL, Auth, RLS) |
| AI Chat | **Anthropic Claude** (`claude-sonnet-4-20250514`) |
| AI Meal Suggestions | **Groq API** — LLaMA 3.3 70B Versatile (`askGroq`) |
| Z-Score Calculation | **Groq API** — WHO growth standards via LLM |
| State Management | **Zustand** |
| Navigation | **Expo Router** (file-based, tab + stack) |
| Styling | React Native `StyleSheet` + custom theme tokens |
| Charts | Custom SVG charts via `react-native-svg` + `react-native-gifted-charts` |
| Icons | `@expo/vector-icons` (Ionicons) |
| Notifications | `expo-notifications` (vaccine due reminders + alerts) |
| PDF Export | `react-native-html-to-pdf` + `expo-sharing` |
| i18n | Custom translation module (`src/lib/i18n.ts`) |

---

## Project Structure

```
mamaTOTO/
├── src/
│   ├── app/
│   │   ├── _layout.tsx           # Root layout — auth guard, session hydration
│   │   ├── index.tsx             # Entry redirect → /(auth)/login
│   │   ├── reports.tsx           # Health reports screen (growth + vaccine summary + PDF export)
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   ├── login.tsx         # Email/password login
│   │   │   ├── register.tsx      # Account creation
│   │   │   └── forgot-password.tsx
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx       # Bottom tab bar
│   │   │   ├── index.tsx         # Home dashboard
│   │   │   ├── children.tsx      # Children list + selector
│   │   │   ├── growth.tsx        # Growth tracker (measurements + WHO charts)
│   │   │   ├── milestones.tsx    # Developmental milestone tracker
│   │   │   ├── vaccines.tsx      # KEPI vaccine schedule
│   │   │   ├── nutrition.tsx     # Feeding guide + food group checker + AI meals
│   │   │   ├── chat.tsx          # Zuri AI chat (Claude-powered)
│   │   │   └── settings.tsx      # Profile + language settings
│   │   ├── (admin)/
│   │   │   ├── _layout.tsx
│   │   │   ├── dashboard.tsx     # Admin overview
│   │   │   ├── analytics.tsx     # Platform analytics (registrations, growth, vaccines, AI chats)
│   │   │   ├── children.tsx      # Admin: all children
│   │   │   └── parents.tsx       # Admin: all parents/users
│   │   └── children/
│   │       ├── _layout.tsx
│   │       ├── add.tsx           # Add child form
│   │       └── [id].tsx          # Child detail + co-parent management
│   ├── components/
│   │   └── GrowthCharts.tsx      # WHO reference SVG growth charts
│   ├── hooks/
│   │   ├── use-color-scheme.ts
│   │   └── useT.ts               # Translation hook
│   ├── lib/
│   │   ├── i18n.ts               # English/Swahili translations
│   │   ├── notificationService.ts# Push notification scheduling (vaccine alerts + reminders)
│   │   ├── nutritionData.ts      # WHO/Kenya MoH feeding data + z-score thresholds
│   │   ├── supabase.ts           # Supabase client (with web localStorage support)
│   │   ├── theme.ts              # Color palette + border radius tokens
│   │   └── zscore.ts             # Z-score calculation + Groq API wrapper (askGroq)
│   ├── store/
│   │   ├── authStore.ts          # Session + user state
│   │   ├── childStore.ts         # Children list + growth records
│   │   ├── settingsStore.ts      # Language preference (persisted to Supabase)
│   │   └── vaccineStore.ts       # KEPI schedule + immunization records
│   └── types/
│       └── index.ts              # Shared TypeScript types (Child, GrowthRecord, Immunization, etc.)
├── assets/
│   └── images/
│       └── icon.png
├── .env                          # Environment variables (not committed)
├── app.json                      # Expo config (name: ZuriHealth, slug: mamaTOTO)
├── babel.config.js
├── eas.json                      # EAS Build config
├── metro.config.js               # Metro bundler (blocks OpenTelemetry for Hermes compat)
├── package.json
└── tsconfig.json
```

---

## Screens & Features

### Auth Screens

#### `(auth)/login.tsx`
- Email/password sign-in via Supabase Auth
- Password visibility toggle
- Links to register and forgot-password screens

#### `(auth)/register.tsx`
- Full name, email, password (min 8 chars) registration
- Stores `full_name` in Supabase `user_metadata`

#### `(auth)/forgot-password.tsx`
- Password reset via Supabase email flow

---

### Tab Screens

#### `(tabs)/index.tsx` — Home Dashboard
- Greeting with user's first name
- Multi-child selector (horizontal pill list)
- Active child card showing name, DOB, age
- Quick access grid: Growth, Vaccines, Nutrition, AI Chat
- Tip card reminder (bring vaccine card to clinic)
- Sign-out with confirmation dialog

#### `(tabs)/children.tsx` — Children List
- FlatList of registered children with male/female avatar (colour-coded by sex)
- Age label, DOB, vaccine progress bar, next visit date per card
- Growth status badge (On Track / Monitor / See Doctor)
- Active child highlight with accent bar
- Hero stats bar (total children, on-track count, upcoming visits)
- Add button → `/children/add`
- Empty state with feature preview cards

#### `(tabs)/growth.tsx` — Growth Tracker
- Child selector (multi-child scroll)
- Inline custom date picker (year/month/day chip scroller — no native module dependency)
- Weight (required) + Height (optional) + Head circumference (optional) inputs
- Age auto-calculated from DOB and measurement date
- Calls Groq API to calculate WHO z-scores (WAZ, HAZ, WHZ)
- Z-score alert banners (SAM/MAM urgency, stunting, overweight)
- WHO Growth Charts component (Weight-for-Age and Height-for-Age SVG curves)
- Growth history list with per-record z-score chips
- Sources: WHO Child Growth Standards, Kenya IMAM Guidelines 2019

#### `(tabs)/milestones.tsx` — Developmental Milestones
- Categories: Motor, Language, Cognitive, Social
- Milestones grouped by age (2m, 4m, 6m, 9m, 12m, 18m, 24m)
- Tap-to-cycle status: Not Yet → In Progress → Achieved
- Current age group highlighted with "NOW" badge
- Hero progress ring showing overall completion percentage
- Category filter cards with per-category completion bars
- Saves milestone status to Supabase `milestones` table

#### `(tabs)/vaccines.tsx` — KEPI Vaccine Schedule
- Full Kenya KEPI schedule (23 vaccine doses, birth to 24 months)
- Status: **Given** / **Due** (within 14 days) / **Upcoming** / **Missed** (overdue >14 days)
- Stats row (tap to filter by status) + animated progress bar
- Per-card actions: Mark Given (with facility + date), Mark Missed, Edit record
- Modal bottom sheet for marking/editing with inline date picker
- Push notifications: due reminders and overdue alerts via `notificationService.ts`

#### `(tabs)/nutrition.tsx` — Nutrition Guide
- WHO IYCF feeding stage card (auto-selected by child age in months)
- Meals/day, snacks, portion size, texture, and breastfeeding guidance per stage
- Expandable key facts per stage
- Rotating IYCF tip card (8-second auto-rotation, WHO/Kenya MoH sourced)
- WHO food group checklist (7 groups, Minimum Dietary Diversity scoring)
- MDD progress bar with score badge (Very Low / Low / Adequate / Excellent)
- AI meal suggestions (Groq `askGroq`) personalised to child age, growth data, and food groups eaten
- Exclusive breastfeeding card for under-6-month children
- Referral banner for SAM/MAM cases (directs to MCH clinic)

#### `(tabs)/chat.tsx` — Zuri AI Chat
- Chat interface with typing indicator and animated message bubbles
- **Powered by Anthropic Claude** (`claude-sonnet-4-20250514`)
- "Zuri" persona — culturally-sensitive Kenyan MCH assistant
- Knowledge grounded in 21 verified sources (WHO, UNICEF, Kenya MoH, AAP, Nelson's Pediatrics)
- Active child context injected into every message (name, age, sex, latest weight/height, vaccine status)
- Quick suggestion chips (common health questions)
- Bilingual (English/Swahili) based on app language setting
- Chat history saved to Supabase `ai_consultations` table

#### `(tabs)/settings.tsx` — Profile & Settings
- User avatar (initials), full name, email display
- Language toggle: English / Kiswahili (persisted to Supabase `user_settings`)
- Link to Health Reports screen
- App version info

---

### Stack Screens

#### `children/add.tsx` — Add Child
- Full name, date of birth, sex selector
- Optional: health facility, birth weight (kg), birth height (cm)
- Resolves `parent_id` from `parents` table via `auth_user_id`

#### `children/[id].tsx` — Child Detail
- Avatar, age string, active/select toggle
- Child info card (DOB, sex, birth weight/height, facility)
- **Co-parent management**: add a second parent by email (uses `find_parent_by_email` Supabase RPC), or remove existing co-parent
- Latest growth record mini-card
- Quick links to Vaccine schedule and AI Chat for that child

#### `reports.tsx` — Health Reports
- Latest measurements card (weight, height, age in months)
- Nutritional status z-score cards (WAZ, HAZ, WHZ with colour coding)
- Growth history table (last 5 records with delta indicators ▲▼)
- Vaccine coverage ring (animated) + stats pills + missed/due alert banners
- Animated section reveals (fade + slide)
- **PDF export** via `react-native-html-to-pdf` + `expo-sharing`

---

### Admin Screens (`(admin)/`)

Accessible only to users with `role = 'admin'` in the `parents` table.

#### `(admin)/dashboard.tsx`
- Platform overview for admins

#### `(admin)/analytics.tsx`
- Summary cards: total parents, total children, total AI consultations
- Registrations bar chart (last 6 months)
- Growth records bar chart (last 6 weeks)
- Vaccine completion donut (given / pending / missed percentages)
- Most active users leaderboard (by growth record count)

#### `(admin)/children.tsx`
- Admin view of all children across all parents

#### `(admin)/parents.tsx`
- Admin view of all registered parent accounts

---

## State Management

All state is managed with **Zustand** stores. No React Context is used.

### `authStore`
```ts
{ session, user, hydrated, setSession, setHydrated, signOut }
```
- Hydrated from `supabase.auth.getSession()` on app load
- Listens to `onAuthStateChange`

### `childStore`
```ts
{ children, selectedChildId, growthRecords,
  fetchChildren, addChild, selectChild,
  fetchGrowthRecords, addGrowthRecord }
```
- Children scoped to `parents.id` (resolved from `auth_user_id`)
- Growth records ordered by `date DESC`

### `vaccineStore`
```ts
{ schedules, immunizations, vaccineRows, loading, seeded,
  seedScheduleIfEmpty, fetchSchedules, fetchImmunizations,
  computeRows, markAsGiven, markAsMissed, updateImmunization }
```
- KEPI schedule seeded once into `vaccine_schedules` table on first load
- `computeRows` derives status from due dates vs. today:
  - `given` — DB status = given
  - `missed` — overdue by >14 days (or DB status = missed)
  - `due` — within 14 days of due date
  - `upcoming` — more than 14 days away
- `computeRows` also fires push notifications when child context is provided

### `settingsStore`
```ts
{ language, setLanguage, loadSettings }
```
- Language upserted to `user_settings` table on change

---

## Libraries & APIs

### Anthropic Claude (`claude-sonnet-4-20250514`)
Used for the **Zuri AI Chat** (`src/app/(tabs)/chat.tsx`):
- Full conversational interface with a 21-source system prompt
- Active child context (name, age, sex, growth data, vaccine status) injected per message
- Responds in the user's selected language (English or Swahili)
- Chat messages saved to `ai_consultations` table

### Groq API (LLaMA 3.3 70B Versatile)
Used for two purposes via `askGroq()` in `src/lib/zscore.ts`:
1. **Z-score calculation**: sends weight, height, age, sex to LLM and parses JSON `{waz, haz, whz}`
2. **AI meal suggestions** in `nutrition.tsx`: context-aware Kenyan meal ideas personalised to child age and growth data

API URL: `https://api.groq.com/openai/v1/chat/completions`
Model: `llama-3.3-70b-versatile`

### Supabase
- **Auth**: email/password, session persistence (AsyncStorage on native, localStorage on web)
- **Database**: PostgreSQL with RLS
- **RPC**: `find_parent_by_email` — used for co-parent lookup

### expo-notifications + notificationService
- Schedules local push notifications for upcoming vaccine due dates
- Fires immediate alerts for overdue (missed) vaccines
- Called automatically from `vaccineStore.computeRows()` when child context is present

### react-native-html-to-pdf + expo-sharing
- Generates a full HTML health report and converts to PDF on-device
- Shared via the native share sheet (`expo-sharing`)
- Graceful fallback if packages are not installed

### react-native-svg
Used in `GrowthCharts.tsx` to render WHO reference curves (median, ±2SD, ±3SD bands) and plot child measurements as a connected SVG line chart.

---

## Environment Variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GROQ_API_KEY=your-groq-api-key
EXPO_PUBLIC_ANTHROPIC_API_KEY=your-anthropic-api-key
```

All variables are prefixed `EXPO_PUBLIC_` to be accessible in the Expo client bundle.

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Set up environment variables
cp .env.example .env   # then fill in your keys

# 3. Start the Expo dev server
npx expo start

# 4. Run on device/emulator
# Press 'a' for Android, 'i' for iOS, 'w' for web
```

### Prerequisites
- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- A Supabase project with the required tables and RLS policies (see below)
- A Groq API key (free at console.groq.com)
- An Anthropic API key (console.anthropic.com)

---

## Database Schema (Supabase)

### `parents`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| auth_user_id | uuid (FK → auth.users) | |
| full_name | text | |
| email | text | |
| role | text | `'parent'` (default) or `'admin'` |
| created_at | timestamptz | |

### `children`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| parent_id | uuid (FK → parents.id) | Primary parent |
| second_parent_id | uuid (FK → parents.id, nullable) | Co-parent |
| full_name | text | |
| date_of_birth | date | |
| sex | text | `'male'` or `'female'` |
| birth_weight_kg | numeric (nullable) | |
| birth_height_cm | numeric (nullable) | |
| health_facility | text (nullable) | |
| child_number | integer (nullable) | |
| is_active | boolean (nullable) | |
| created_at | timestamptz | |
| updated_at | timestamptz (nullable) | |

### `growth_records`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| child_id | uuid (FK → children.id) | |
| weight_kg | numeric | |
| height_cm | numeric (nullable) | |
| head_circ_cm | numeric (nullable) | |
| age_months | integer | |
| waz | numeric (nullable) | Weight-for-Age Z-score |
| haz | numeric (nullable) | Height-for-Age Z-score |
| whz | numeric (nullable) | Weight-for-Height Z-score |
| weight_status | text (nullable) | e.g. `'normal'`, `'sam'`, `'mam'`, `'stunted'` |
| height_status | text (nullable) | |
| wh_status | text (nullable) | |
| notes | text (nullable) | |
| date | date | |
| created_at | timestamptz | |

### `vaccine_schedules`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| vaccine_name | text | |
| dose_number | integer | |
| due_at_weeks | integer (nullable) | |
| due_at_months | integer (nullable) | |
| diseases_covered | text | |
| notes | text (nullable) | |
| display_order | integer | |

### `immunizations`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| child_id | uuid (FK → children.id) | |
| vaccine_name | text | |
| scheduled_date | date | |
| given_date | date (nullable) | |
| batch_number | text (nullable) | |
| facility | text (nullable) | |
| status | text | `'scheduled'`, `'given'`, or `'missed'` |
| notes | text (nullable) | |

### `milestones`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| child_id | uuid (FK → children.id) | |
| milestone_key | text | Unique milestone identifier |
| status | text | `'not_yet'`, `'in_progress'`, or `'achieved'` |
| achieved_date | date (nullable) | |
| updated_at | timestamptz | |

### `ai_consultations`
| Column | Type | Notes |
|---|---|---|
| id | uuid (PK) | |
| parent_id | uuid (FK → parents.id) | |
| child_id | uuid (FK → children.id, nullable) | |
| messages | jsonb | Full chat history |
| created_at | timestamptz | |

### `user_settings`
| Column | Type | Notes |
|---|---|---|
| user_id | uuid (PK) | |
| language | text | `'en'` or `'sw'` |

### RPC Functions
| Function | Purpose |
|---|---|
| `find_parent_by_email(search_email)` | Co-parent lookup — returns parent record by email |

---

## Key Design Decisions

**Claude for AI Chat, Groq for z-scores and meals** — The Zuri chat assistant uses Anthropic Claude for nuanced, multi-turn health conversations with strong safety and instruction-following. Groq (LLaMA 3.3 70B) is used for the faster, more structured tasks: z-score JSON extraction and one-shot meal suggestions.

**No DateTimePicker dependency** — A custom inline date picker (year/month/day horizontal chip scrollers) was built to avoid native module conflicts across platforms.

**Groq for z-scores** — Rather than bundling large WHO LMS lookup tables, z-scores are calculated via the LLM. This keeps the bundle small but adds a network dependency per measurement save.

**WHO data hardcoded in `nutritionData.ts`** — All feeding stages, food groups, IYCF tips, z-score thresholds, and preventive care schedules are stored as structured TypeScript constants with full source citations. This ensures offline availability of reference content.

**KEPI schedule self-seeding** — On first load, `seedScheduleIfEmpty()` checks the `vaccine_schedules` table and inserts the 23-dose Kenya KEPI schedule if empty. No manual database setup is needed for the vaccine schedule.

**Notifications auto-triggered from store** — `vaccineStore.computeRows()` accepts an optional `child` parameter. When provided, it automatically calls `notifyVaccineAlerts()` and `scheduleVaccineDueReminders()` from `notificationService.ts`, keeping notification logic co-located with status computation.

**Co-parenting via RPC** — The `find_parent_by_email` Supabase RPC allows looking up a registered parent by email without exposing the full `parents` table to client queries, respecting RLS.

**Role-based admin access** — The `parents` table has a `role` column (`'parent'` / `'admin'`). Admin routes under `(admin)/` are only accessible to admin users. Analytics queries exclude admin accounts from parent counts.

**Bilingual AI** — The Zuri system prompt instructs Claude to respond in the user's selected app language (English or Swahili) and to switch if the mother writes in the other language.

**RLS (Row Level Security)** — The app assumes Supabase RLS is configured so users can only read/write their own data. The `parents` indirection table decouples `auth.users.id` from the `children` table's `parent_id`.

---

## Evidence-Based Sources

All nutrition, feeding, and growth content in this app is sourced from:

- WHO IYCF Guidelines (2003)
- WHO Complementary Feeding Counselling Guide (2004)
- WHO Child Growth Standards (2006)
- UNICEF IYCF Counselling Cards
- Kenya MCH Handbook (MoH)
- Kenya National Nutrition Action Plan (NNAP)
- Kenya IMAM Guidelines (2019)
- Kenya KEPI Immunization Schedule (MoH)
- Nelson Textbook of Pediatrics, 21st Edition
- Krause's Food & Nutrition Care Process, 14th Edition
- AAP Breastfeeding Guidelines
- Lancet Breastfeeding Series (2016)

---

*Built with ❤️ for Kenyan mothers and children.*