# Second Life: E-Waste Repairability and Recycling Decision Assistant

Helps people decide whether an old electronic device should be **repaired, kept, donated, mined for parts, or recycled**,
and shows verified places that can help.

- **Frontend:** React + Tailwind CSS (Vite), Leaflet + OpenStreetMap
- **Backend:** Node.js + Express, JWT auth with roles
- **Database:** PostgreSQL
- **Recommendations:** a transparent rule-based engine (`server/src/engine/recommend.js`). An image classifier is an optional, clearly-labelled hint only.

## Run it

Requirements: Node 20+, PostgreSQL 14+.

```bash
# 1. Database
createdb ewaste            # or create a user/database of your choice

# 2. API
cd server
cp .env.example .env       # edit DATABASE_URL and JWT_SECRET
npm install
npm run migrate            # creates tables (safe to re-run)
npm run seed               # categories, admin account, DEMO locations
npm test                   # recommendation engine tests
npm run dev                # http://localhost:4000

# 3. Web app (second terminal)
cd client
npm install
npm run dev                # http://localhost:5173  (proxies /api to :4000)
```

Seeded admin: `admin@example.com` / `ChangeMe!123`. **Change it.**
The three `DEMO` locations are fake. Delete them in Admin > Locations and add real, verified partners.

## Roles

| Role | Can do |
|---|---|
| Device owner | Register devices, answer the questionnaire (optional photo), see recommendations, record actions, view own impact |
| Partner | Create/edit/delete own locations. New and edited listings stay hidden until an admin verifies them |
| Administrator | Manage users, categories, all locations (verify/edit/delete), review user reports, see everyone's impact |

Self-registration can only create device owners and partners. Admins are created by seed or by another admin.

## How the recommendation works

Every option (reuse, repair, donate, parts recovery, recycle) starts at 0. Rules add or subtract points, and **each point
is recorded with a plain-language reason** that the app shows next to the result. Rules cover condition, repair cost vs.
estimated current value, age vs. typical lifespan, security-update support, liquid damage, cosmetic-only damage,
and whether you still need the device.

Safety behaviour:
- A **swollen battery** overrides scoring: result is recycle/professional handling, with no DIY instructions.
- Confidence is capped at *medium* when the repair cost is only a rough estimate or key answers are missing.
- Output is always labelled as guidance, not a diagnosis.

**Prices are placeholders.** `CATEGORY_DEFAULTS` in `recommend.js` holds rough peso figures for new price and repair cost.
Replace them with real local pricing before relying on the cost rules.

## Optional image hint

Photos are stored privately (owner/admin only) as reference. To get a category *suggestion*, set `CLASSIFIER_URL` to a
service that accepts a multipart `image` upload and returns `{"label": "laptop", "confidence": 0.87}`. The hint is shown to
the user, never fed into the recommendation, and never claims to detect internal damage. Without it, the app works
from the questionnaire alone.

## Data rules (accountability)

- Device status (registered, assessed, in progress, completed) is derived from its assessments and actions, never set directly.
- Once a device has a **completed** action, owners can no longer edit/delete the device, its assessments, or that action
  (they can add notes). Admins can correct or remove them.
- Users who own devices cannot be deleted, only deactivated. Categories in use cannot be deleted, only deactivated.
- Deleting a location keeps action history (the link is cleared).
- The last active administrator cannot be demoted, deactivated or deleted.

## Project layout

```
server/src/engine/     recommend.js (rules), imageHint.js (optional classifier)
server/src/routes/     auth, categories, devices, assessments, actions, locations, stats, admin
server/src/db/         schema.sql, migrate.js, seed.js
server/test/           engine tests
client/src/pages/      one file per screen
```

## Known limits / next steps

- Login throttling is in-memory (one server instance). Use a shared store if you scale out.
- No password reset or email verification yet.
- Photos are on local disk (`server/uploads`). Use object storage for multi-server deployments.
- The location list is not paginated, and there is no "near me" sorting yet.
- Add API integration tests and browser tests once dependencies are installed.
