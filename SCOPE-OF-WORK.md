# SCOPE OF WORK — Workman Services ERP (Prototype Build)

## 1. Project Boundaries & Delivery Model

This Scope of Work (SOW) defines the functional deliverables, architectural boundaries, project assumptions, and change-control procedures for the **Workman Services ERP** prototype. 

The project is executed as a **single, unified 1-month build** delivering all required modules and applications together in one cohesive release. There are no phased rollouts or deferred core tiers — all items in the in-scope specification are delivered as part of this single prototype milestone.

---

## 2. In-Scope Deliverables (Flat List)

The prototype scope comprises eight unified operational pillars:

### 1. HRM Module (Human Resource Management)
- **Staff Directory & Profiles:** Centralized records for technicians, workshop mechanics, bay foremen, dispatchers, and administrators (contact details, role, assigned depot/workshop, active status).
- **Attendance & Shift Logs:** Daily attendance logs, shift timings, clock-in/clock-out timestamps, and working hours calculation.
- **Workforce Assignment:** Mapping of technicians to active vehicles, toolkits, and primary repair specialties.

### 2. CRM-Style Interface (HubSpot-Inspired UX)
- **Visual Pipeline & Boards:** Drag-and-drop Kanban job dispatch board modeled on modern CRM ergonomics (HubSpot) rather than tabular ERP grids. Visual job cards with priority badges, customer details, assigned technician, and SLA timers.
- **Customer Records & Directory:** Clean customer profile views displaying contact info, primary physical address, geocoded coordinates, historical repair tickets, and open balances.
- **Dynamic Job Cards:** Interactive work order view detailing intake remarks, issue description, labor rates, parts billed, discount approvals, and timeline status history.
- **Activity & Audit History:** Chronological activity feed logging all state transitions (created, assigned, accepted, paused, completed) with timestamp and actor attribution.

### 3. Technician Mobile App (Field Operations)
- **Authentication & Job Dashboard:** Technician login with instant view of active workload grouped by status (`Assigned / New`, `Accepted / Active`, `Paused`, `Done`).
- **One-Tap Job Actions:** One-touch **Accept Job** button that sets status to `InProgress` and captures starting GPS coordinates.
- **Work Lifecycle Controls:** Ability to pause work with mandatory hold notes (e.g., waiting for parts) and mark jobs complete with photo evidence.
- **Mobile Check-In/Out:** Dedicated interface to check in and out of shifts, synchronized with the attendance engine.

### 4. Bike Workshop App (Two-Wheeler Service Bay)
- **Intake & Vehicle Registration:** Fast intake form recording Bike Make/Model, Registration Number, Chassis/Engine Number, Odometer Reading, and Fuel Level indicator.
- **Walk-Around Inspection:** Visual condition and scratch/dent checklist with camera photo upload prior to service commencement.
- **Diagnosis & Bay Allocation:** Mechanic assignment, bay allocation (e.g. Bay 1, Quick Bay), and structured diagnostic checklist (engine compression, brakes, electricals, battery voltage, carburetor/EFI).
- **Parts Consumption & Requisition:** Logging of spare parts used (lubricants, spark plugs, filters, brake pads) directly consumed onto the repair ticket.
- **Quality Check & Handover:** Post-service inspection checklist, test-ride clearance sign-off, invoice presentation, and gate pass release.

### 5. Repair Workshop App (General Electromechanical & Appliances)
- **Component & Pattern Reuse:** Directly reuses the intake cards, bay scheduling, parts requisition, and handover components built for the Bike Workshop App rather than constructing a parallel system from scratch.
- **Adaptive Equipment Schemas:** Tailors intake and diagnostic checklists for general repair categories (AC units, motors, generators, home appliances) while retaining the identical underlying state machine and data contracts.

### 6. Real-Time Location Tracking
- **30-Second Mobile GPS Pings:** Background location service on technician mobile devices sending latitude, longitude, heading, and accuracy every ~30 seconds to the backend while on shift.
- **WebSocket Gateway (Socket.io):** Backend WebSocket connection streaming coordinate updates directly to active admin dashboards without database polling loops.
- **Admin Dispatch Map:** Live interactive map displaying moving technician markers with real-time status indicators (En Route, On-Site, Paused, Idle).

### 7. Geofence-Based Attendance & Fallback
- **Workshop Geofence Boundaries:** Configurable workshop and depot geofence perimeters (latitude/longitude center point + radius in meters).
- **Automated Distance Check:** Server-side spatial boundary check (PostGIS `ST_DWithin` or haversine formula) that auto-logs check-in when a technician's GPS ping enters the perimeter and auto-logs check-out upon exit.
- **Manual "I'm Here" Fallback Button:** Dedicated one-tap override on the technician app allowing manual clock-in with captured GPS coordinates and accuracy metadata, safeguarding against indoor GPS drift, basement signal loss, or metal roof attenuation.

### 8. Address Autofill & Cost-Controlled Geocoding
- **Mapbox Search Box Autocomplete:** Interactive address autocomplete on customer and job intake forms, strictly using **Mapbox Session Tokens** to bill per search session instead of per keystroke.
- **Geocode-on-View Reverse Geocoding:** Translates raw technician GPS coordinates into readable street addresses **only when a dispatcher or technician actually opens and views a specific job card**, never on raw 30s background pings.
- **Persistent Frontend Map Instance:** Single persistent WebGL/Canvas map context on the frontend that updates existing marker objects (`marker.setLngLat()`) to avoid burning map-load quotas.

---

## 3. Explicitly Out-of-Scope (Not Included in Prototype)

To protect the strict 1-month timeline, the following items are explicitly excluded from this prototype build:

1. **Customer Self-Service Portal:** No public-facing web or mobile portal for end-customers to book jobs, track mechanics live, or make direct credit card payments.
2. **AI Copilot & Automated Diagnostics:** No AI-driven automated fault detection, acoustic engine diagnostics, or predictive maintenance chatbots.
3. **Multi-Tenant SaaS Billing & Subscriptions:** No Stripe/SaaS billing integration, subscription plan metering, or multi-tenant payment separation across distinct workshop companies.
4. **Custom Accounting & Tax Engines:** No country-specific tax filing engines or payroll tax compliance processors outside standard job billing and internal double-entry ledgers.
5. **Hardware CAN-bus / OBD-II Telemetry:** No physical hardware scanner or Bluetooth OBD-II vehicle dongle integrations.
6. **Public App Store Deployment:** No public Apple App Store or Google Play Store review and publishing cycles (distribution handled via Expo Go, TestFlight internal testing, or direct APK sideloading).
7. **Any item not explicitly enumerated in Section 2 (In-Scope Deliverables).**

---

## 4. Assumptions Requiring Stakeholder Sign-Off

The delivery timeline and feasibility of this prototype rely on the following explicit assumptions:

| Category | Assumption Description |
|---|---|
| **Hardware & OS** | Technician and workshop devices run modern operating systems (Android 10+ or iOS 15+). Devices have functional GPS hardware and camera modules. |
| **Connectivity** | Field technicians maintain active mobile data packages (3G/4G/5G) capable of sending lightweight 30s JSON telemetry pings. |
| **Workshop Geofences** | Workshop locations have known fixed physical coordinates and can be bounded by a standard circular radius (e.g. 50m to 150m). |
| **Service Accounts** | Client/stakeholders provide valid API credentials for Mapbox (Pay-as-you-go account) and Firebase Cloud Messaging prior to Week 2. |
| **Language & Locale** | User interface is delivered in standard English with localized currency and number formatting (PKR). Multi-language localization (e.g. Urdu translation) is out of scope. |
| **Testing Environment** | Acceptance testing is performed on web browsers (Chrome/Firefox/Edge) and test mobile devices via Expo Go or direct APK installation. |

---

## 5. Scope Management & Triage Process (1-Month Guardrail)

Because the prototype build is strictly timeboxed to **one calendar month**, unmanaged scope expansion will cause project failure. The following change-management rules govern the entire build:

```
                          NEW FEATURE REQUEST DURING BUILD
                                         │
                                         ▼
                     ┌───────────────────────────────────────┐
                     │ Is it explicitly named in SOW Sec. 2? │
                     └──────────────────┬────────────────────┘
                                        │
                       ┌────────────────┴────────────────┐
                       ▼                                 ▼
                     [YES]                             [NO]
                       │                                 │
                       ▼                                 ▼
             Proceed with Sprint              Log in Scope Backlog
             Execution                        (Change Register)
                                                         │
                                                         ▼
                                       ┌───────────────────────────────────┐
                                       │ Does Client Want it in Prototype? │
                                       └─────────────────┬─────────────────┘
                                                         │
                                        ┌────────────────┴────────────────┐
                                        ▼                                 ▼
                                      [YES]                             [NO]
                                        │                                 │
                                        ▼                                 ▼
                          1-for-1 Swap Requirement              Defer to Post-1-Month
                          Must remove a feature of              Release (Version 1.1)
                          equal engineering hours +
                          Written Sign-Off
```

### Scope Governance Rules:
1. **Scope Freeze:** The in-scope list in Section 2 is considered frozen upon project kickoff.
2. **Change Register:** Any stakeholder request for modifications, new fields, additional workflows, or extra visual screens is logged immediately in a shared **Change Register** document.
3. **The 1-for-1 Scope Swap Rule:** If a newly requested feature is deemed critical by stakeholders for the initial prototype, it **cannot** be added additively. It can only be introduced if an in-scope feature of equivalent development effort is explicitly cut from the current milestone, accompanied by written sign-off.
4. **Default Action:** All non-critical enhancements, polish requests, and adjacent ideas are automatically deferred to the post-prototype roadmap (Version 1.1).
