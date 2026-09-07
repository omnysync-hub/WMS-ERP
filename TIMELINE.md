# PROJECT TIMELINE & MILESTONES — Workman Services ERP (1-Month Prototype)

## 1. Timeline Structure & Program Overview

This document outlines the strict **4-week (1-month)** delivery schedule for the complete Workman Services ERP prototype build. 

There is no phased or staged delivery schedule — all eight scope pillars (HRM, HubSpot-style CRM boards, Technician Mobile App, Bike Workshop App, Repair Workshop App, Real-Time GPS Tracking, Geofence Attendance with Manual Fallback, and Mapbox Address Autofill) are delivered within this single monthly timeframe.

```
┌───────────────────────────────────────────────────────────────────────────────────────┐
│                       1-MONTH PROTOTYPE EXECUTION TIMELINE                            │
├───────────────────┬───────────────────┬───────────────────┬───────────────────────────┤
│      WEEK 1       │      WEEK 2       │      WEEK 3       │          WEEK 4           │
├───────────────────┼───────────────────┼───────────────────┼───────────────────────────┤
│ • HRM Directory & │ • Technician App  │ • Shared Workshop │ • Repair Workshop App     │
│   Attendance Data │   (React Native)  │   Component Bay   │   (Adapted Patterns)      │
│ • CRM Pipeline &  │ • Geofence Engine │ • Bike Workshop   │ • End-to-End Cross-System │
│   HubSpot Boards  │   (ST_DWithin +   │   App (Intake,    │   Integration             │
│ • Location Engine   Manual Fallback)    Checklist, Bay,   │ • Comprehensive Testing,  │
│   & Socket.io     │ • Mapbox Search &   Spares, Handover) │   Mapbox Budget Audit &   │
│   Gateway (30s)   │   Geocode-on-View │                   │   Client Handover Demo    │
└───────────────────┴───────────────────┴───────────────────┴───────────────────────────┘
```

---

## 2. Upfront Reality Check: What Will NOT Fit Inside One Month

To prevent discovering schedule bottlenecks at the end of the month, the following technical items are explicitly identified as **unachievable within a 1-month window** and are scoped out or adapted accordingly:

| Constraint Area | Realistic 1-Month Limitation | Pragmatic Prototype Approach |
|---|---|---|
| **Public Store Submission** | Apple App Store & Google Play Store developer account approval, App Review cycles, and compliance sign-offs require 2 to 4 weeks independently. | Deploy mobile apps directly to test devices using **Expo Go**, internal **TestFlight**, or direct **Android APK sideloading**. |
| **Aggressive OS Background Battery Killing** | Modern smartphone OS (especially Samsung OneUI, Xiaomi MIUI) aggressively kill background processes sending 30s pings unless complex native foreground notification services and battery optimization exceptions are manually configured. | Use standard foreground service notifications for active shift tracking; verify tracking while app is active or minimized with location permissions set to "Always Allow". |
| **Complex Offline Synchronization** | Building a full multi-master offline sync engine with conflict resolution (e.g. offline edits merging after 4 hours without internet) takes 2+ months alone. | Build mobile apps with an **online-first architecture** with optimistic UI updates and transient local caching for network drops. |
| **Indoor GPS Precision Without Drift** | Satellite GPS cannot penetrate dense concrete or corrugated metal workshop roofs. Expecting automatic geofences to work with sub-meter accuracy indoors is physically impossible without BLE beacons. | The **manual "I'm Here" fallback button** is included in the core scope from Day 1 to bypass indoor drift reliably. |
| **Multi-Company SaaS Tenant Isolation** | Multi-database routing, custom subdomain provisioning, and separate Stripe billing per company cannot fit inside 30 days. | Build a clean modular schema with workspace/role identification ready for multi-tenant extraction post-prototype. |

---

## 3. Weekly Milestone Breakdown

### Week 1: HRM Foundation, CRM Board Interface & Real-Time Tracking Backend
**Goal:** Stand up the core web application, administrative models, HubSpot-inspired drag-and-drop CRM boards, and the WebSocket ingestion pipeline for 30-second GPS telemetry.

- **Day 1: Project Setup & Database Foundations**
  - Configure PostgreSQL database with PostGIS spatial extensions; initialize Prisma ORM schema.
  - Establish data models: `Staff/Employee`, `Customer`, `Job`, `JobItem`, `GeofenceZone`, and `AttendanceRecord`.
  - Configure Next.js 14 App Router project, Tailwind CSS, Lucide icons, and core layout.
- **Day 2: HRM Module (Workforce & Shifts)**
  - Build staff directory: technician profiles, trade skills, assigned workshop, contact information.
  - Implement attendance logs, shift definitions, and working hours calculation endpoints.
- **Day 3: CRM-Style Interface (HubSpot UX Model)**
  - Build visual Kanban job pipeline board modeled on HubSpot deals pipeline (columns: `New Intake`, `Assigned`, `In Progress`, `Paused`, `Completed`).
  - Implement drag-and-drop status transitions with immediate visual feedback.
  - Build Customer Record and dynamic Job Card drawer displaying history, issue notes, and timeline.
- **Day 4: Real-Time WebSocket Infrastructure**
  - Set up Socket.io WebSocket server gateway alongside Next.js backend.
  - Define telemetry payload contracts for 30-second GPS pings (`techId`, `latitude`, `longitude`, `heading`, `accuracy`, `timestamp`).
  - Implement lightweight in-memory/Redis coordinate cache to avoid writing raw pings to the relational database.
- **Day 5: Admin Dispatch Map Foundation**
  - Create persistent map dashboard on `/dispatch` using Mapbox GL JS / Leaflet.
  - Wire WebSocket listener to move technician markers smoothly across the dispatch map.

**Week 1 Gate Milestone:** Admin can create staff, view/drag job cards on a HubSpot-style pipeline, and view simulated mobile GPS markers moving in real-time on the dispatch map over WebSockets.

---

### Week 2: Technician Mobile App, Geofence Attendance & Mapbox Address Autofill
**Goal:** Deliver the functional technician mobile application, server-side geofence check-in/out with indoor manual fallback, and cost-controlled Mapbox address services.

- **Day 6: Technician Mobile App Setup & Authentication**
  - Initialize React Native (Expo SDK 51) mobile workspace with TypeScript.
  - Implement technician authentication, secure credential storage, and shift status bar.
  - Build assigned jobs list filtered into categorized views (`Assigned`, `Active`, `Paused`, `Done`).
- **Day 7: Job Execution Lifecycle & Actions**
  - Implement one-tap **Accept Job** action (transitions status to `InProgress` and stamps start GPS coordinates).
  - Implement **Pause Job** dialog with mandatory reason entry and units counter.
  - Implement **Complete Job** workflow with photo capture and digital signature pad.
- **Day 8: Geofence Attendance Engine & Fallback**
  - Define workshop geofence perimeters in database (lat/long center point + radius in meters).
  - Implement server-side spatial distance calculation (PostGIS `ST_DWithin` or haversine) triggered on incoming GPS pings to auto-record check-in and check-out.
  - Build dedicated **"I'm Here" manual check-in button** on the mobile app with captured GPS accuracy metadata to override indoor satellite drift.
- **Day 9: Mapbox Search Box Autocomplete (Session Tokens)**
  - Implement Mapbox Search Box API on customer and job address input forms.
  - Integrate Mapbox Session Tokens: ensure an entire address typing session groups all keystrokes into a single billable API request.
- **Day 10: Geocode-on-View Implementation & Mobile Push**
  - Wire Mapbox Reverse Geocoding to trigger **only when a dispatcher or technician explicitly opens a job card**, storing raw coordinates for free in all other states.
  - Configure Firebase Cloud Messaging (FCM) to trigger mobile notifications when jobs are assigned.

**Week 2 Gate Milestone:** Field technician logs into mobile app, receives job push, accepts job on-site; automated geofencing checks them in when entering workshop zone; address search functions with session tokens; zero reverse geocoding occurs until a job is opened.

---

### Week 3: Bike Workshop App & Shared Component Foundation
**Goal:** Deliver the dedicated vertical tablet/mobile workstation for two-wheeler service centers and establish the reusable component patterns for general repair.

- **Day 11: Reusable Workshop UI Component Architecture**
  - Build shared, modular workshop component library:
    - Intake registration card (Equipment ID, Make, Model, Serial, Usage counter)
    - Visual condition & damage walk-around inspection checklist with photo attachments
    - Bay assignment and mechanic allocation selector
    - Spare parts and consumables requisition picker
    - Quality assurance checklist and handover gate pass sign-off
- **Day 12: Bike Workshop Intake & Walk-Around**
  - Build bike-specific intake screen: Bike Registration, Make/Model, Chassis/Engine number, Odometer reading, and Fuel gauge level.
  - Implement visual two-wheeler scratch/dent inspection diagram with touch markers and camera integration.
- **Day 13: Bike Bay Allocation & Diagnostics**
  - Implement workshop bay dispatch board (Bay 1, Bay 2, Quick Service).
  - Build motorcycle diagnostic checklist: Engine compression, front/rear brake pads, chain tension, battery voltage, carburetor/EFI scan.
- **Day 14: Parts Requisition & Consumables**
  - Wire workshop parts picker to inventory items (engine oil, oil filters, spark plugs, brake cables).
  - Consume stock directly onto the bike repair ticket with calculated material costs.
- **Day 15: Quality Inspection, Invoice & Handover**
  - Implement post-repair checklist (test-ride clearance, idle RPM test, brake check).
  - Generate final workshop bill and digital handover gate pass for customer pickup.

**Week 3 Gate Milestone:** Bike workshop technician completes a full end-to-end service cycle on tablet: intake inspection $\rightarrow$ bay assignment $\rightarrow$ diagnostics $\rightarrow$ parts requisition $\rightarrow$ test ride $\rightarrow$ handover gate pass.

---

### Week 4: Repair Workshop App, Cross-System Integration & Final Verification
**Goal:** Adapt shared workshop patterns to general electromechanical repairs, integrate all components end-to-end, verify cost controls, and deliver the final prototype.

- **Day 16: Repair Workshop App (Adapted Workflows)**
  - Adapt the shared workshop components for general electromechanical equipment (AC units, motors, generators, home appliances).
  - Implement repair-specific diagnostic attributes (voltage input, refrigerant pressure, motor winding resistance, error codes) while preserving the identical underlying intake-to-handover state machine.
- **Day 17: End-to-End System Integration**
  - Unify data flow across Web Admin, Technician Mobile App, Bike Workshop App, and Repair Workshop App.
  - Verify that jobs created in CRM boards immediately appear on technician and workshop apps; verify that mobile state changes reflect in real-time on the HubSpot-style pipeline board.
- **Day 18: Cost Control & Mapbox Quota Audit**
  - Verify Mapbox network activity in browser/mobile developer tools:
    - Confirm address autocomplete typing emits session tokens and bills once per session.
    - Confirm 30s GPS pings generate zero reverse-geocoding calls.
    - Confirm reverse-geocoding only fires when a job card is opened (`geocode-on-view`).
    - Verify persistent map instance does not re-initialize WebGL contexts on marker movement.
- **Day 19: End-to-End Testing & Hardening**
  - Test indoor GPS drift scenarios and verify the manual "I'm Here" fallback cleanly overrides geofence blocks.
  - Conduct battery and network stress testing for 30-second mobile GPS background pinging.
  - Polish UI responsiveness and fix layout edge cases across mobile and desktop views.
- **Day 20: Final Acceptance Testing, Demo & Handover**
  - Execute end-to-end demonstration covering all eight scope deliverables.
  - Package deliverables, update technical documentation, and conduct stakeholder sign-off review.

**Week 4 Gate Milestone:** Full prototype accepted and operational. All modules (HRM, CRM, Technician App, Bike App, Repair App, 30s GPS Tracking, Geofencing, Address Autofill) functioning together seamlessly within the 1-month build window.
