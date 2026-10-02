# 🌍 GIS Field Operations Management System
### *Statewide Spatial Governance, Smart Debt Recovery & Turn-by-Turn Field Navigation*

---

## 📖 1. The Story: Why This System Exists (For Everyone)

### 🏢 The Old Way (The Daily Struggle)
Meet **Ramesh**, a field officer in Nagpur working for the state electricity & utility board. Every morning:
1. Ramesh was handed a **10-page printed Excel sheet** with hundreds of consumer names, meter numbers, and pending bills.
2. He had to ride his motorcycle through winding alleys in Godhani and Koradi, constantly stopping to ask locals: *"Bhaiya, where is Sharma-ji's house?"* or *"Where is meter number MH-NGP-MTR-018?"*
3. Half his day was wasted in traffic and zig-zagging back and forth across town because the list was sorted alphabetically instead of by road proximity.
4. When he collected payments or gave disconnection notices, he wrote them in a physical diary. By evening, data entry back at the office was prone to errors, missing slips, or duplicate visits.
5. Meanwhile, in Mumbai, the **Super Admin** had zero real-time visibility into whether field officers actually visited high-default meters or if revenue was leaking.

---

### ⚡ The New Way: The GIS Field Operations Platform
With this new platform, Ramesh’s workday is transformed into an intelligent, Google Maps-style experience:
1. **Instant Morning Briefing**: Ramesh opens **[https://web-delta-one-29.vercel.app](https://web-delta-one-29.vercel.app)** on his phone. He sees his assigned ward (**Thote & Thakre Ward, Nagpur**) with all **32 pending consumers** plotted as color-coded pins.
2. **One-Tap Smart Route ("Save 2 Hours of Fuel")**: Ramesh taps **"Generate Smart Route"**. The AI calculates the exact shortest path along real asphalt roads from his current GPS location across all default meters.
3. **On-the-Spot Resolution**: Upon reaching a consumer, Ramesh taps the meter pin on his map. He can view the overdue bill (e.g. ₹ 4,250.00), record a visit note, capture payment, or issue an alert with exact GPS time-stamping.
4. **Real-Time Statewide Visibility**: The moment Ramesh hits submit, the Area Admin in Nagpur and the Super Admin in Mumbai see the live collection dashboard update instantly with 100% audit accuracy.

---

## 🏛️ 2. The 4-Tier Hierarchy (Who Uses It)

```
                       ┌─────────────────────────┐
                       │      SUPER ADMIN        │
                       │ (Statewide Maharashtra) │
                       └────────────┬────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │      ZONAL ADMIN        │
                       │      (Nagpur Zone)      │
                       └────────────┬────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │       AREA ADMIN        │
                       │   (Nagpur North Area)   │
                       └────────────┬────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │      FIELD OFFICER      │
                       │ (Godhani-Koradi Ward)   │
                       └─────────────────────────┘
```

| Role | Person in Charge | What They See & Do |
| :--- | :--- | :--- |
| **1. Super Admin** | State Director General | Statewide heatmap, total state revenue collection, macro performance metrics, creates Zonal Admins. |
| **2. Zonal Admin** | Nagpur Regional Head | Manages all areas in Nagpur Zone, monitors total zonal default amounts, assigns Area Admins. |
| **3. Area Admin** | Nagpur North Sub-Divisional Officer | Inspects specific wards, reviews officer field logs, uploads new consumer Excel sheets, allocates field officers. |
| **4. Field Officer** | On-Ground Field Agent | Mobile-first GPS map, turn-by-turn shortest road routing, one-tap visit logger, consumer search & collection. |

---

## 📍 3. Live Nagpur Case Study (Real Dataset)

The platform is seeded with real ground data from Nagpur North Sub-Division:

- **Target Ward**: `Thote & Thakre Ward (Godhani-Koradi / Mankapur)`
- **Total Master Meters Plotted**: `32 Meters` with precision latitude & longitude coordinates.
- **Total Defaulters Mapped**: `32 Consumers`
- **Total Outstanding Pipeline**: **`₹ 1,03,575.81`**
- **Average Recovery ETA**: `~3.2 hours` with optimized TSP shortest road pathing.

---

## 💻 4. Technical Architecture (For Developers & Engineers)

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                FRONTEND LAYER                                    │
│  Next.js 16 (App Router) + TypeScript + TailwindCSS + Leaflet + Lucide Icons     │
│  Hosted 24/7 on Vercel Global Edge CDN (https://web-delta-one-29.vercel.app)     │
└─────────────────────────┬────────────────────────────────────────────────────────┘
                          │ HTTPS REST API + Bearer JWT
┌─────────────────────────▼────────────────────────────────────────────────────────┐
│                                BACKEND LAYER                                     │
│  Python 3.12 + FastAPI + SQLAlchemy 2.0 ORM + Alembic Migrations + Pydantic v2  │
│  Hosted 24/7 on Render Cloud Web Service (https://gis-field-operations.onrender.com)
└─────────────────────────┬────────────────────────────────────────────────────────┘
                          │ PostgreSQL Native Wire Protocol
┌─────────────────────────▼────────────────────────────────────────────────────────┐
│                              DATABASE LAYER                                      │
│  PostgreSQL 18 + PostGIS 3.6 Spatial Extension                                  │
│  Hosted on Neon Cloud Database (AWS Singapore Region with High Availability)     │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Key Technical Innovations:
1. **PostGIS Spatial Engine**: All meters and officer coordinates use native `geometry(Point, 4326)`. Spatial queries compute distances using high-performance spherical projections.
2. **TSP Traveling Salesman Algorithm + OSRM**: Combines Nearest Neighbor with 2-opt route refinement and fetches real street curves via OSRM (Open Source Routing Machine) so routes follow actual drivable roads instead of flying lines.
3. **Role-Based Access Control (RBAC)**: Secure multi-tenant token verification. Field officers can only access consumers within their assigned ward; area admins supervise their sub-division; super admins access statewide metrics.
4. **GPS Drift Isolation**: Smart Leaflet viewport management isolates high-frequency background GPS coordinate updates from user zoom/pan actions, eliminating map flickering and auto-resetting.

---

## 🚀 5. Live Production Credentials Reference

- **Live URL**: **[https://web-delta-one-29.vercel.app](https://web-delta-one-29.vercel.app)**
- **Cloud Backend API**: **`https://gis-field-operations.onrender.com/api/v1`**

### Ready-to-Use User Accounts:

| Role | Login Email | Password | Access Level |
| :--- | :--- | :--- | :--- |
| **Field Officer** | `officer.nagpur@maharashtra.gov.in` | `FieldOfficer@12345` | Nagpur Field Route & Map |
| **Area Admin** | `area.nagpur@maharashtra.gov.in` | `AreaAdmin@12345` | Nagpur North Area Oversight |
| **Zonal Admin** | `zonal.nagpur@maharashtra.gov.in` | `ZonalAdmin@12345` | Nagpur Zone Administration |
| **Super Admin** | `superadmin@maharashtra.gov.in` | `SuperAdmin@12345` | Statewide Control Center |

---

## 🛠️ 6. How to Run Locally (For Future Maintenance)

### 1. Start the Python Backend:
```bash
cd apps/api
source ../../.venv/bin/activate
uvicorn app.main:app --reload --port 8000
```

### 2. Start the Web Frontend:
```bash
cd apps/web
npm run dev
```

Open `http://localhost:3000` in your browser.
