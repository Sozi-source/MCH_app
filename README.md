# mamaTOTO — Mama na Mtoto Child Health Companion

> A React Native / Expo app for Kenyan mothers to track child growth, vaccines, nutrition, and get AI-powered health guidance — grounded in WHO and Kenya MoH guidelines.

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

---

## Overview

**mamaTOTO** (Swahili: "Mama and Child") is a mobile-first health companion built for Kenyan mothers. It helps track:

- Child **growth** (weight/height) with WHO z-score analysis and visual growth charts
- Kenya **KEPI vaccine** schedule with due/given/missed tracking
- **Nutrition** guidance (WHO IYCF feeding stages, food group diversity checker, AI meal suggestions)
- **AI chat** via Zuri — a culturally-sensitive maternal health assistant powered by Groq (LLaMA 3.3 70B)
- **Health reports** summarising growth trends and vaccine coverage

The app supports **English and Kiswahili** and is targeted at community health workers and mothers in Kenya.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native via **Expo** (Expo Router v3, file-based routing) |
| Language | **TypeScript** |
| Backend / Auth / DB | **Supabase** (PostgreSQL, Auth, RLS) |
| AI Chat | **Groq API** — LLaMA 3.3 70B Versatile |
| Z-Score Calculation | **Groq API** (WHO growth standards via LLM) |
| State Management | **Zustand** |
| Navigation | **Expo Router** (file-based, tab + stack) |
| Styling | React Native `StyleSheet` + custom theme tokens |
| Charts | Custom SVG charts via `react-native-svg` |
| Icons | `@expo/vector-icons` (Ionicons) |
| i18n | Custom translation module (`src/lib/i18n.ts`) |

---

## Project Structure

```
mamaTOTO/
├── src/
│   ├── app/
│   │   ├── _layout.tsx           # Root layout — auth guard, session hydration
│   │   ├── index.tsx             # Entry redirect → /(auth)/login
│   │   ├── reports.tsx           # Health reports screen (growth + vaccine summary)
│   │   ├── (auth)/
│   │   │   ├── _layout.tsx
│   │   │   ├── login.tsx         # Email/password login
│   │   │   └── register.tsx      # Account creation
│   │   ├── (tabs)/
│   │   │   ├── _layout.tsx       # Bottom tab bar (6 tabs)
│   │   │   ├── index.tsx         # Home dashboard
│   │   │   ├── children.tsx      # Children list + selector
│   │   │   ├── growth.tsx        # Growth tracker (measurements + WHO charts)
│   │   │   ├── vaccines.tsx      # KEPI vaccine schedule
│   │   │   ├── nutrition.tsx     # Feeding guide + food group checker
│   │   │   ├── chat.tsx          # Zuri AI chat
│   │   │   └── settings.tsx      # Profile + language settings
│   │   └── children/
│   │       ├── _layout.tsx
│   │       ├── add.tsx           # Add child form
│   │       └── [id].tsx          # Child detail view
│   ├── components/
│   │   └── GrowthCharts.tsx      # WHO reference SVG growth charts
│   ├── hooks/
│   │   ├── use-color-scheme.ts
│   │   └── useT.ts               # Translation hook
│   ├── lib/
│   │   ├── i18n.ts               # English/Swahili translations
│   │   ├── nutritionData.ts      # WHO/Kenya MoH feeding data + z-score thresholds
│   │   ├── supabase.ts           # Supabase client (with web localStorage support)
│   │   ├── theme.ts              # Color palette + border radius tokens
│   │   └── zscore.ts             # Z-score calculation + Groq API wrapper
│   ├── store/
│   │   ├── authStore.ts          # Session + user state
│   │   ├── childStore.ts         # Children list + growth records
│   │   ├── settingsStore.ts      # Language preference (persisted to Supabase)
│   │   └── vaccineStore.ts       # KEPI schedule + immunization records
│   └── types/
│       └── index.ts              # Shared TypeScript types
├── .env                          # Environment variables (not committed)
├── app.json                      # Expo config
├── babel.config.js
├── eas.json                      # EAS Build config
├── metro.config.js
├── package.json
└── tsconfig.json
```

---

## Screens & Features

### Auth Screens

#### `(auth)/login.tsx`
- Email/password sign-in via Supabase Auth
- Password visibility toggle
- Navigates to `/(auth)/register` for new users

#### `(auth)/register.tsx`
- Full name, email, password (min 8 chars) registration
- Stores `full_name` in Supabase `user_metadata`

---

### Tab Screens

#### `(tabs)/index.tsx` — Home Dashboard
- Greeting with user's first name
- Multi-child selector (horizontal pill list)
- Active child card showing name, DOB, age
- Quick Access grid: Growth, Vaccines, Nutrition, AI Chat
- Tip card reminder (bring vaccine card to clinic)
- Sign-out with confirmation dialog

#### `(tabs)/children.tsx` — Children List
- FlatList of registered children with male/female avatar
- Active child badge (highlighted card)
- Tap to view child detail (`/children/[id]`)
- Add button → `/children/add`
- Empty state with CTA

#### `(tabs)/growth.tsx` — Growth Tracker
- Child selector (multi-child scroll)
- Inline date picker (custom year/month/day chip picker)
- Weight (required) + Height (optional) inputs
- Age auto-calculated from DOB and measurement date
- Calls Groq API to calculate WHO z-scores (WAZ, HAZ, WHZ)
- Z-score alert banners (SAM/MAM urgency, stunting, overweight)
- WHO Growth Charts component (Weight-for-Age and Height-for-Age)
- Growth history list with per-record z-score chips
- Sources: WHO Child Growth Standards, Kenya IMAM Guidelines 2019

#### `(tabs)/vaccines.tsx` — KEPI Vaccine Schedule
- Seeded Kenya KEPI schedule (23 vaccine doses from birth to 24 months)
- Status classification: **Given** / **Due** / **Upcoming** / **Missed**
- Stats row (tap to filter) + animated progress bar
- Filter bar by status
- Per-card actions: Mark Given (with facility + date), Mark Missed, Edit record
- Modal bottom sheet for marking/editing with inline date picker
- Animated press scale on vaccine cards

#### `(tabs)/nutrition.tsx` — Nutrition Guide
- WHO IYCF feeding stage card (auto-selected by child age)
- Rotating IYCF tip card (8-second auto-rotation, WHO/Kenya MoH sourced)
- WHO food group checklist (7 groups, Minimum Dietary Diversity scoring)
- MDD progress bar with score badge (Very Low / Low / Adequate / Excellent)
- AI meal suggestions (Groq) personalised to child age, growth data, and food groups eaten
- Exclusive breastfeeding card for under-6-month children
- Referral banner (directs to MCH clinic for therapeutic feeding)

#### `(tabs)/chat.tsx` — Zuri AI Chat
- Chat interface with typing indicator
- System prompt: "Zuri" persona — culturally-sensitive Kenyan MCH assistant
- Knowledge grounded in 21 verified sources (WHO, UNICEF, Kenya MoH, AAP, Nelson's Pediatrics)
- Active child context injected into every message (name, age, sex)
- Quick suggestion chips (common health questions)
- Bilingual (English/Swahili) based on app language setting
- Powered by Groq LLaMA 3.3 70B

#### `(tabs)/settings.tsx` — Profile & Settings
- User avatar (initials), full name, email display
- Language toggle: English / Kiswahili (persisted to Supabase `user_settings`)
- Link to Health Reports screen
- App version info

---

### Stack Screens

#### `children/add.tsx` — Add Child
- Full name, date of birth (YYYY-MM-DD text input), sex selector
- Optional: health facility, birth weight (kg), birth height (cm)
- Resolves `parent_id` from `parents` table via `auth_user_id`

#### `children/[id].tsx` — Child Detail
- Avatar, age string, active/select toggle
- Child info card (DOB, sex, birth weight/height, facility)
- Latest growth record mini-card
- Quick links to Vaccine schedule and AI Chat for that child

#### `reports.tsx` — Health Reports
- Latest measurements card (weight, height, age in months)
- Nutritional status z-score cards (WAZ, HAZ, WHZ with colour coding)
- Growth history table (last 5 records)
- Vaccine coverage bar chart + stats pills + missed/due alert banners

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
- Growth records ordered by `created_at DESC`

### `vaccineStore`
```ts
{ schedules, immunizations, vaccineRows, loading, seeded,
  seedScheduleIfEmpty, fetchSchedules, fetchImmunizations,
  computeRows, markAsGiven, markAsMissed, updateImmunization }
```
- KEPI schedule seeded once into `vaccine_schedules` table
- `computeRows` derives status (given/due/upcoming/missed) from due dates vs. today
- Status logic: `given` if DB status = given; `missed` if overdue by >14 days; `due` if within 14 days; `upcoming` otherwise

### `settingsStore`
```ts
{ language, setLanguage, loadSettings }
```
- Language upserted to `user_settings` table on change

---

## Libraries & APIs

### Groq API (LLaMA 3.3 70B)
Used for two purposes:

1. **Z-score calculation** (`src/lib/zscore.ts`): Sends weight, height, age, sex to LLM and parses JSON response `{waz, haz, whz}`
2. **AI Chat** (`src/app/(tabs)/chat.tsx`): Full conversational interface with a 21-source system prompt
3. **Meal suggestions** (`src/app/(tabs)/nutrition.tsx`): Context-aware Kenyan meal ideas via `askGroq()`

API URL: `https://api.groq.com/openai/v1/chat/completions`
Model: `llama-3.3-70b-versatile`

### Supabase
- **Auth**: email/password, session persistence (localStorage on web, AsyncStorage on native)
- **Database**: PostgreSQL with RLS
- **Tables used**: `parents`, `children`, `growth_records`, `vaccine_schedules`, `immunizations`, `user_settings`

### react-native-svg
Used in `GrowthCharts.tsx` to render WHO reference curves (median, ±2SD, ±3SD bands) and plot child measurements as an animated SVG line chart.

---

## Environment Variables

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EXPO_PUBLIC_GROQ_API_KEY=your-groq-api-key
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
- A Supabase project with the required tables (see below)
- A Groq API key (free at console.groq.com)

---

## Database Schema (Supabase)

### `parents`
| Column | Type |
|---|---|
| id | uuid (PK) |
| auth_user_id | uuid (FK → auth.users) |
| full_name | text |
| created_at | timestamptz |

### `children`
| Column | Type |
|---|---|
| id | uuid (PK) |
| parent_id | uuid (FK → parents.id) |
| full_name | text |
| date_of_birth | date |
| sex | text ('male' / 'female') |
| birth_weight_kg | numeric (nullable) |
| birth_height_cm | numeric (nullable) |
| health_facility | text (nullable) |
| created_at | timestamptz |

### `growth_records`
| Column | Type |
|---|---|
| id | uuid (PK) |
| child_id | uuid (FK → children.id) |
| weight_kg | numeric |
| height_cm | numeric (nullable) |
| age_months | integer |
| waz | numeric (nullable) |
| haz | numeric (nullable) |
| whz | numeric (nullable) |
| date | date |
| created_at | timestamptz |

### `vaccine_schedules`
| Column | Type |
|---|---|
| id | uuid (PK) |
| vaccine_name | text |
| dose_number | integer |
| due_at_weeks | integer (nullable) |
| due_at_months | integer (nullable) |
| diseases_covered | text |
| notes | text (nullable) |
| display_order | integer |

### `immunizations`
| Column | Type |
|---|---|
| id | uuid (PK) |
| child_id | uuid (FK → children.id) |
| vaccine_name | text |
| scheduled_date | date |
| given_date | date (nullable) |
| facility | text (nullable) |
| status | text ('scheduled' / 'given' / 'missed') |
| notes | text (nullable) |

### `user_settings`
| Column | Type |
|---|---|
| user_id | uuid (PK) |
| language | text ('en' / 'sw') |

---

## Key Design Decisions

**No DateTimePicker dependency** — A custom inline date picker (year/month/day horizontal chip scrollers) was built to avoid native module conflicts across platforms.

**Groq for z-scores** — Rather than bundling large WHO LMS tables, z-scores are calculated by the LLM. This keeps the bundle small but adds a network dependency per measurement save.

**WHO data hardcoded in `nutritionData.ts`** — All feeding stages, food groups, IYCF tips, z-score thresholds, and preventive care schedules are stored as structured TypeScript constants with full source citations. This ensures offline availability of reference content.

**KEPI schedule self-seeding** — On first load, `seedScheduleIfEmpty()` checks the `vaccine_schedules` table and inserts the 23-dose Kenya KEPI schedule if empty. This means no manual database setup is needed for the vaccine schedule.

**Bilingual AI** — The Zuri chat system prompt instructs the model to respond in the user's selected app language (English or Swahili) and to switch if the mother writes in the other language.

**RLS (Row Level Security)** — The app assumes Supabase RLS is configured so users can only read/write their own data. The `parents` indirection table decouples `auth.users.id` from the `children` table's `parent_id`.

---

## Evidence-Based Sources

All nutrition, feeding, and z-score content in this app is sourced from:

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
