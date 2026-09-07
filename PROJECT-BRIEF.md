# PROJECT BRIEF — Workman Services ERP (Prototype Build)

## 1. Executive Summary

Workman Services ERP is a single, unified prototype build of a modern workshop-management and field-service platform designed for bike repair and general electromechanical repair service businesses. The system brings together core workforce administration (HRM), a HubSpot-style CRM operations board (visual pipelines, customer records, and dynamic job cards), three interconnected client applications (a mobile app for field technicians, a dedicated vertical app for bike repair workshops, and an adapted workshop app for general repair workflows reusing shared components), real-time 30-second GPS technician tracking over WebSockets, automated geofence-based workshop attendance with a manual fallback, and cost-controlled Mapbox address autofill. Built as a comprehensive prototype to be delivered within a strict one-month timeline, all modules and applications function as one cohesive ecosystem rather than a staged or phased rollout.

---

## 2. Tech Stack Actually Used

The prototype stack aligns the existing codebase with the target mobile and spatial infrastructure:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT INTERFACES                                    │
│                                                                                        │
│  ┌─────────────────────────────┐  ┌─────────────────────────────────────────────────┐  │
│  │ Web ERP & Admin Dashboard   │  │ Cross-Platform Mobile Applications              │  │
│  │ - Next.js 14 (App Router)   │  │ - React Native (Expo SDK 51, TypeScript)        │  │
│  │ - TypeScript, Tailwind CSS  │  │ - 1. Technician App (Field Jobs & GPS)          │  │
│  │ - Lucide Icons, Leaflet 1.9 │  │ - 2. Bike Workshop App (Intake to Handover)     │  │
│  │ - HubSpot-Style Pipelines   │  │ - 3. Repair Workshop App (Reused Bay Patterns)  │  │
│  └──────────────┬──────────────┘  └────────────────────────┬────────────────────────┘  │
└─────────────────┼──────────────────────────────────────────┼───────────────────────────┘
                  │                                          │
                  ▼                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND APPLICATION LAYER                                 │
│                                                                                        │
│  ┌──────────────────────────────────────────────────────────────────────────────────┐  │
│  │ Next.js 14 API Routes (/api/*) running on Node.js Runtime                        │  │
│  │ - REST endpoints handling jobs, customers, HRM, inventory, and attendance        │  │
│  │ - Shared business logic and validation schemas across web and mobile clients     │  │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
│                                           │                                            │
│  ┌────────────────────────────────────────┴─────────────────────────────────────────┐  │
│  │ Real-Time WebSocket Gateway (Socket.io)                                          │  │
│  │ - Receives 30s GPS pings from mobile technician devices                          │  │
│  │ - Pushes live location updates to Admin Dispatch Map (zero DB polling)           │  │
│  │ - Broadcasts instant operational state changes across connected clients          │  │
│  └────────────────────────────────────────┬─────────────────────────────────────────┘  │
└───────────────────────────────────────────┼────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              DATA PERSISTENCE & SERVICES                               │
│                                                                                        │
│  ┌──────────────────────────────────────────┐  ┌────────────────────────────────────┐  │
│  │ PostgreSQL 16 + PostGIS Spatial Engine   │  │ External Service Integrations      │  │
│  │ - Managed via Prisma ORM 5.21            │  │ - Mapbox Search Box API (Sessions) │  │
│  │ - Spatial queries (ST_DWithin/haversine) │  │ - Mapbox Geocoding API (On-View)   │  │
│  │ - (SQLite dev.db for local dev fallback) │  │ - Firebase Cloud Messaging (FCM)   │  │
│  └──────────────────────────────────────────┘  └────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

| Layer | Technology | Current Repo Implementation | Role in System |
|---|---|---|---|
| **Web ERP Frontend** | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS | Implemented in `src/app/` with full page routing and design system | HubSpot-style CRM boards, customer records, HRM directory, admin dispatch map |
| **Mobile Applications** | React Native (Expo SDK 51) / Flutter | Simulated in `/mobile` companion workspace; targets Expo project | 1. Technician App, 2. Bike Workshop App, 3. Repair Workshop App |
| **Backend REST API** | Next.js 14 Route Handlers (`/api/*`) | Implemented in `src/app/api/` (`jobs`, `hrm`, `inventory`, `accounts`, `audit`) | Core business logic, data validation, database mutations |
| **Real-Time Push** | Socket.io (WebSocket) | Local event bus (`realtimeSync.ts`) targeting Socket.io server | Sub-second GPS tracking push to admin map, instant job status updates |
| **Database & Spatial** | PostgreSQL 16 with PostGIS | Prisma ORM 5.21 with SQLite (`prisma/dev.db`) in local dev | Relational data, attendance logs, and spatial distance checks |
| **Push Notifications** | Firebase Cloud Messaging (FCM) | Client-side notification bus & topbar alerts | Device wake-up for new job assignments and urgent status alerts |
| **Mapping & Location** | Mapbox GL JS, Geocoding API, Search Box API | Leaflet 1.9 (`leaflet`, `react-leaflet`) in web prototype | Address autocomplete, geocode-on-view, and live interactive dispatch map |

---

## 3. External Services & APIs

The prototype intentionally limits third-party integrations to focused, high-leverage services:

1. **Mapbox Search Box API (with Session Tokens)**:
   - **Purpose:** Customer address autofill and manual location search on job intake and customer creation forms.
   - **Mechanism:** Implements Mapbox Session Tokens. All keystrokes typed during an address entry session are grouped under a single token UUID, billing as one single query upon selection rather than charging on every keystroke.
2. **Mapbox Geocoding API (Reverse Geocoding)**:
   - **Purpose:** Translates raw GPS latitude/longitude coordinates into human-readable street addresses on job and customer cards.
   - **Mechanism:** Applied strictly on a **geocode-on-view** basis (see Section 4).
3. **Mapbox GL JS**:
   - **Purpose:** Vector street map rendering on the admin dispatch dashboard (`/dispatch`).
   - **Why Mapbox over Google Maps:** Mapbox offers a generous free tier of **100,000 geocoding requests/month** and **50,000 map loads/month** with substantially lower overage rates compared to Google Maps Platform's $200 monthly credit that depletes rapidly under multi-user interactive map usage.
4. **Socket.io (WebSocket Server)**:
   - **Purpose:** Bi-directional real-time communication channel between mobile devices and the web dispatch console. Ingests ~30-second GPS telemetry pings from technicians and broadcasts live coordinate deltas directly to the dispatcher map.
5. **Firebase Cloud Messaging (FCM)**:
   - **Purpose:** Low-latency push notifications sent to technician smartphones to wake up the app when a new job is dispatched, assigned, or rescheduled.

---

## 4. Key Architecture Decisions & Rationale

### 1. Real-Time Push Over Database Polling
- **Decision:** Mobile devices stream GPS coordinates via a lightweight WebSocket (Socket.io) connection every ~30 seconds, and the server broadcasts coordinates directly to connected dispatcher browser sessions.
- **Rationale:** Polling HTTP endpoints every 30 seconds across dozens of technicians creates excessive database read/write load, network latency, and server exhaustion. WebSockets maintain a persistent low-overhead connection and deliver sub-second marker movement on the dispatcher map without writing every transient coordinate to disk.

### 2. Geofence-Based Attendance with Manual Fallback
- **Decision:** Each workshop center point and radius is stored in the database. When an incoming GPS ping enters the boundary, a server-side distance check (PostGIS `ST_DWithin` or haversine) automatically logs attendance clock-in; departure logs clock-out. A dedicated **"I'm Here"** manual button is provided on mobile as an explicit fallback.
- **Rationale:** Automated geofencing removes manual friction for workshop staff. However, indoor workshop environments, tin roofs, and urban canyons frequently cause GPS drift (accuracy degrading from 5m to 100m+). The manual fallback button ensures technicians are never penalized or locked out by indoor signal attenuation.

### 3. Geocode-on-View & Strict Cost-Control Pattern
- **Decision:** Never reverse-geocode raw 30-second GPS pings. Store raw numerical latitude and longitude for free in memory or database. Only trigger a Mapbox reverse geocoding API request when an operator explicitly opens a job card or customer profile that requires a street address string.
- **Rationale:** Reverse-geocoding every 30s ping for 20 technicians over an 8-hour shift would generate ~19,200 API calls daily (576,000 calls/month), rapidly blowing past free tier limits into steep overage bills. Geocode-on-view reduces API consumption to only the few dozen jobs actually inspected each day.
- **Additional Cost Safeguards:**
  - **Persistent Map Context:** The frontend initializes a single map instance and updates marker coordinates (`marker.setLngLat()`), avoiding repeated map re-initializations that consume map load quotas.
  - **Session Tokens:** Autocomplete queries bill once per search session rather than once per character typed.

### 4. Component Reuse Between Bike and Repair Workshop Apps
- **Decision:** The Repair Workshop App is built by reusing the UI patterns, intake schemas, diagnosis checklists, bay allocation states, and handover screens developed for the Bike Workshop App, rather than writing a second workshop system from scratch.
- **Rationale:** Both workshop types share an identical operational lifecycle (intake $\rightarrow$ inspection $\rightarrow$ bay assignment $\rightarrow$ parts requisition $\rightarrow$ handover). Reusing components compresses development effort to fit comfortably within the 1-month build window.

---

## 5. Open Questions (Undecided)

The following architectural and product decisions must be explicitly clarified with stakeholders rather than assumed silently:

1. **Single Multi-Tenant Platform vs. Two Separately Branded Products:**
   - *Option A:* A unified multi-tenant platform where a workshop configures its operational mode ("Bike Repair" vs. "General Appliance/Repair") via workspace settings.
   - *Option B:* Two standalone, separately branded products deployed with customized nomenclature and branding.
   - *Status:* **UNDECIDED.** (Prototype builds as a single codebase with role/mode toggles).

2. **Single Client Deployment vs. Commercial Multi-Business SaaS:**
   - *Option A:* Tailored for a single specific workshop enterprise with fixed operational workflows and internal hierarchies.
   - *Option B:* Multi-tenant SaaS architecture designed for self-onboarding and selling across hundreds of independent workshop businesses.
   - *Status:* **UNDECIDED.** (Prototype implements clean modular schemas suitable for single deployment with multi-tenant ready models).

3. **CRM Pipeline Workflow Transferability:**
   - *Question:* Can standard HubSpot-style CRM sales pipeline stages (`New`, `Contacted`, `Qualified`, `Proposal`, `Won`) carry over directly into service operations, or must the pipeline strictly enforce workshop-specific stages (`Intake`, `Diagnosis`, `Waiting for Parts`, `Repair in Progress`, `Quality Check`, `Ready for Pickup`)?
   - *Status:* **UNDECIDED.** (Prototype configures the board engine to support workshop repair stages while preserving CRM card ergonomics).
