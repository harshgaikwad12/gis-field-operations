# 🗺️ Complete Developer Guide: GIS Map Engine & Road Routing (TSP)
### *Step-by-Step Blueprint to Replicate in Any Web Application from Scratch*

This guide explains **how the GIS Map Engine and Road Routing & TSP work**, **how to use them**, and **how to implement them in a new application from scratch**.

---

## 🔑 Quick Summary: Are API Keys Required?

| Component | Service Used | API Key Required? | Cost |
| :--- | :--- | :--- | :--- |
| **Map Base Layers** | Google Maps Tile Server | **NO** (Uses direct XYZ raster tile endpoint) | **100% Free** |
| **Alternative Basemap** | OpenStreetMap (OSM) | **NO** (Standard OSM tile URL) | **100% Free** |
| **Street Road Routing** | OSRM (Open Source Routing Machine) | **NO** (Public REST API) | **100% Free** |
| **TSP Route Sequence** | Custom In-Browser Algorithm | **NO** (Pure TypeScript math) | **100% Free** |

> 💡 **Key Takeaway**: You do **NOT** need a credit card, Google Cloud billing account, or any API keys to implement this exact setup in any project!

---

## 📦 1. Required Libraries & Dependencies

In your new application (React, Next.js, Vite, or Vue), install:

```bash
npm install leaflet
npm install -D @types/leaflet
```

### Add Leaflet CSS:
Leaflet requires its CSS stylesheet. Add this in your root `index.html` `<head>` or dynamically in React:
```html
<link
  rel="stylesheet"
  href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
/>
```

---

## 🧠 2. How It Works (The Core Architecture)

The system is composed of two independent layers working seamlessly together:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        LAYER 1: GIS MAP ENGINE                         │
│                                                                        │
│   Leaflet.js container + Google Streets/Satellite XYZ Tiles            │
│   + Custom SVG Pins (Meters, Defaulters, Live GPS Pulsing Blue Dot)    │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                    LAYER 2: ROUTING & TSP ENGINE                       │
│                                                                        │
│   1. Officer GPS + List of Target Stops                                │
│   2. Step A: TSP Solver (Sorts stops using Haversine Nearest Neighbor)  │
│   3. Step B: OSRM API (Fetches real asphalt curves & turn steps)       │
│   4. Leaflet Polyline: Draws glowing blue navigation line on map       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ 3. Implementation: Part by Part

### PART 1: The Math Behind TSP (Traveling Salesperson)

When a field officer has 15 different houses to visit, visiting them in random order wastes hours in traffic. The TSP solver finds the shortest path starting from the officer's live location.

#### A. Haversine Distance Formula (Calculates real km between two GPS points)
```typescript
// haversine.ts
export function getHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in kilometers
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in kilometers
}
```

#### B. Nearest-Neighbor TSP Solver
Sorts stops so each next stop is the closest unvisited location:
```typescript
// tspSolver.ts
import { getHaversineDistanceKm } from "./haversine";

export interface StopTarget {
  id: string | number;
  name: string;
  latitude: number;
  longitude: number;
}

export interface OrderedStop extends StopTarget {
  order: number;
  distanceFromPrevKm: number;
}

export function solveOptimalRoute(
  startLat: number,
  startLon: number,
  targets: StopTarget[]
): {
  orderedStops: OrderedStop[];
  totalDistanceKm: number;
  estTravelTimeMins: number;
} {
  if (targets.length === 0) {
    return { orderedStops: [], totalDistanceKm: 0, estTravelTimeMins: 0 };
  }

  const unvisited = [...targets];
  const orderedStops: OrderedStop[] = [];
  let currentLat = startLat;
  let currentLon = startLon;
  let totalDistance = 0;
  let order = 1;

  while (unvisited.length > 0) {
    let nearestIndex = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = getHaversineDistanceKm(
        currentLat,
        currentLon,
        unvisited[i].latitude,
        unvisited[i].longitude
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestIndex = i;
      }
    }

    const nextStop = unvisited.splice(nearestIndex, 1)[0];
    totalDistance += minDistance;

    orderedStops.push({
      ...nextStop,
      order,
      distanceFromPrevKm: minDistance,
    });

    currentLat = nextStop.latitude;
    currentLon = nextStop.longitude;
    order++;
  }

  // Estimate: average speed 25 km/h + 8 minutes spent per customer stop
  const drivingTimeMins = (totalDistance / 25) * 60;
  const stopTimeMins = orderedStops.length * 8;
  const estTravelTimeMins = Math.round(drivingTimeMins + stopTimeMins);

  return {
    orderedStops,
    totalDistanceKm: totalDistance,
    estTravelTimeMins: Math.max(5, estTravelTimeMins),
  };
}
```

---

### PART 2: Real Road Geometry & Turn Instructions (OSRM API)

Instead of drawing straight lines between stops, call the free **OSRM public API** to get real road coordinates and turn-by-turn directions.

> ⚠️ **CRITICAL NOTE**: OSRM expects coordinates in **`longitude,latitude`** format (X, Y), whereas Leaflet expects **`latitude,longitude`** (Y, X). You must invert them when calling and receiving!

```typescript
// osrmRouting.ts
export interface RoadRouteResult {
  geometry: [number, number][]; // [lat, lon] coordinates for Leaflet
  totalDistanceKm: number;
  durationMins: number;
  turnInstructions: string[];
}

export async function fetchRoadRoute(
  waypoints: Array<[number, number]>, // Input: Array of [latitude, longitude]
  mode: "driving" | "walking" = "driving"
): Promise<RoadRouteResult | null> {
  try {
    if (waypoints.length < 2) return null;

    // 1. Format coordinates as "lon,lat;lon,lat;..."
    const coordsString = waypoints
      .map(([lat, lon]) => `${lon.toFixed(5)},${lat.toFixed(5)}`)
      .join(";");

    const profile = mode === "walking" ? "walking" : "driving";
    const url = `https://router.project-osrm.org/route/v1/${profile}/${coordsString}?overview=full&geometries=geojson&steps=true`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      return null;
    }

    const route = data.routes[0];

    // 2. Invert OSRM [lon, lat] back to Leaflet [lat, lon]
    const leafletGeometry: [number, number][] = route.geometry.coordinates.map(
      ([lon, lat]: [number, number]) => [lat, lon]
    );

    // 3. Extract Turn-by-Turn Maneuver Instructions
    const instructions: string[] = [];
    if (route.legs && Array.isArray(route.legs)) {
      route.legs.forEach((leg: any) => {
        if (leg.steps && Array.isArray(leg.steps)) {
          leg.steps.forEach((s: any) => {
            if (s.maneuver && s.name) {
              const modifier = s.maneuver.modifier ? ` ${s.maneuver.modifier}` : "";
              instructions.push(`${s.maneuver.type}${modifier} onto ${s.name}`);
            }
          });
        }
      });
    }

    return {
      geometry: leafletGeometry,
      totalDistanceKm: route.distance / 1000,
      durationMins: Math.round(route.duration / 60),
      turnInstructions: instructions,
    };
  } catch (error) {
    console.error("OSRM Route Fetch Failed:", error);
    return null;
  }
}
```

---

### PART 3: The Complete React / Next.js GIS Map Component

Here is the complete, drop-in React component you can copy into your new project:

```tsx
// GisMap.tsx
"use client";

import { useEffect, useRef, useState } from "react";

export interface GisLocation {
  id: string | number;
  title: string;
  latitude: number;
  longitude: number;
  amount?: number;
}

interface GisMapProps {
  locations: GisLocation[];
  userLocation?: { latitude: number; longitude: number } | null;
  height?: string;
}

export function GisMap({
  locations,
  userLocation,
  height = "h-[600px]",
}: GisMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);

  const [mapType, setMapType] = useState<"streets" | "satellite">("streets");
  const [activeRoute, setActiveRoute] = useState<any>(null);

  // 1. Initialize Map
  useEffect(() => {
    let isMounted = true;

    async function init() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      const L = (await import("leaflet")).default;
      if (!isMounted) return;

      if (!mapInstanceRef.current) {
        // Default center (e.g. Nagpur or your city)
        const defaultCenter: [number, number] = userLocation
          ? [userLocation.latitude, userLocation.longitude]
          : [21.1458, 79.0882];

        const map = L.map(mapContainerRef.current, {
          center: defaultCenter,
          zoom: 13,
          zoomControl: false,
        });

        // Add Google Maps Street Tile Layer
        const streetTiles = L.tileLayer(
          "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
          {
            attribution: "&copy; Google Maps",
            maxZoom: 21,
            subdomains: ["mt0", "mt1", "mt2", "mt3"],
          }
        ).addTo(map);

        const markersLayer = L.layerGroup().addTo(map);
        const routeLayer = L.layerGroup().addTo(map);

        mapInstanceRef.current = map;
        markersLayerRef.current = markersLayer;
        routeLayerRef.current = routeLayer;

        setTimeout(() => map.invalidateSize(), 200);
      }
    }

    init();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // 2. Switch Street vs Satellite Tiles
  const toggleMapType = async () => {
    if (!mapInstanceRef.current) return;
    const L = (await import("leaflet")).default;
    const nextType = mapType === "streets" ? "satellite" : "streets";

    // Remove existing tile layers
    mapInstanceRef.current.eachLayer((layer: any) => {
      if (layer._url) mapInstanceRef.current.removeLayer(layer);
    });

    const tileUrl =
      nextType === "satellite"
        ? "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}" // Hybrid Satellite
        : "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"; // Standard Street

    L.tileLayer(tileUrl, { maxZoom: 21 }).addTo(mapInstanceRef.current);
    setMapType(nextType);
  };

  // 3. Render Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    async function renderMarkers() {
      const L = (await import("leaflet")).default;
      const layer = markersLayerRef.current;
      layer.clearLayers();

      const bounds: [number, number][] = [];

      // A. Render Live Officer GPS Marker (Pulsing Blue Dot)
      if (userLocation) {
        const gpsIcon = L.divIcon({
          className: "user-gps-dot",
          html: `
            <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 30px; height: 30px; background: rgba(37,99,235,0.3); border-radius: 50%; animation: pulse 2s infinite;"></div>
              <div style="position: relative; width: 14px; height: 14px; background: #2563eb; border: 2.5px solid white; border-radius: 50%; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>
            </div>
          `,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });

        L.marker([userLocation.latitude, userLocation.longitude], {
          icon: gpsIcon,
          zIndexOffset: 1000,
        })
          .bindPopup("<b>📍 Your Live Location</b>")
          .addTo(layer);

        bounds.push([userLocation.latitude, userLocation.longitude]);
      }

      // B. Render Location Targets (Meters / Houses)
      const redPin = L.divIcon({
        className: "target-pin",
        html: `<div style="background: #ef4444; width: 16px; height: 16px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      });

      locations.forEach((loc) => {
        bounds.push([loc.latitude, loc.longitude]);
        L.marker([loc.latitude, loc.longitude], { icon: redPin })
          .bindPopup(`
            <div style="font-family: sans-serif; font-size: 13px;">
              <b>${loc.title}</b><br/>
              ${loc.amount ? `Pending: ₹${loc.amount.toLocaleString()}<br/>` : ""}
              Coords: ${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}
            </div>
          `)
          .addTo(layer);
      });

      if (bounds.length > 0 && !activeRoute) {
        mapInstanceRef.current.fitBounds(bounds, { padding: [40, 40] });
      }
    }

    renderMarkers();
  }, [locations, userLocation, activeRoute]);

  // 4. Generate & Draw Route on Map
  const handleGenerateRoute = async () => {
    if (!userLocation) {
      alert("GPS location required to generate route!");
      return;
    }

    const { solveOptimalRoute } = await import("./tspSolver");
    const { fetchRoadRoute } = await import("./osrmRouting");
    const L = (await import("leaflet")).default;

    // A. Solve TSP order
    const tsp = solveOptimalRoute(
      userLocation.latitude,
      userLocation.longitude,
      locations.map((l) => ({
        id: l.id,
        name: l.title,
        latitude: l.latitude,
        longitude: l.longitude,
      }))
    );

    // B. Build coordinate array starting from user
    const waypoints: [number, number][] = [
      [userLocation.latitude, userLocation.longitude],
      ...tsp.orderedStops.map(
        (s) => [s.latitude, s.longitude] as [number, number]
      ),
    ];

    // C. Fetch real asphalt road polyline from OSRM
    const osrm = await fetchRoadRoute(waypoints, "driving");

    if (osrm && routeLayerRef.current) {
      routeLayerRef.current.clearLayers();

      // Outer track border
      L.polyline(osrm.geometry, {
        color: "#1e3a8a",
        weight: 7,
        opacity: 0.6,
      }).addTo(routeLayerRef.current);

      // Vibrant inner blue road line
      const routeLine = L.polyline(osrm.geometry, {
        color: "#2563eb",
        weight: 4,
        opacity: 0.95,
      }).addTo(routeLayerRef.current);

      mapInstanceRef.current.fitBounds(routeLine.getBounds(), {
        padding: [50, 50],
      });

      setActiveRoute(osrm);
    }
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-slate-200 shadow-md">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between bg-white px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateRoute}
            className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
          >
            🛣️ Generate Smart Route
          </button>
          <button
            onClick={toggleMapType}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {mapType === "streets" ? "🛰️ Satellite" : "🗺️ Street"}
          </button>
        </div>

        {activeRoute && (
          <div className="text-xs font-bold text-emerald-700">
            ✅ {activeRoute.totalDistanceKm.toFixed(1)} km &bull; ~{activeRoute.durationMins} mins
          </div>
        )}
      </div>

      {/* Map Viewport Container */}
      <div ref={mapContainerRef} className={`w-full ${height}`} />
    </div>
  );
}
```

---

## 🚀 4. How to Use in Any Page

In any page or screen:

```tsx
import { GisMap } from "./GisMap";

export default function MyFieldOperationsScreen() {
  const myLocations = [
    { id: 1, title: "Meter #101 - Mr. Sharma", latitude: 21.1458, longitude: 79.0882, amount: 2400 },
    { id: 2, title: "Meter #102 - Mrs. Patil", latitude: 21.1520, longitude: 79.0920, amount: 5100 },
    { id: 3, title: "Meter #103 - Dr. Verma", latitude: 21.1390, longitude: 79.0820, amount: 1200 },
  ];

  // Officer live GPS or fallback base
  const officerGps = { latitude: 21.1400, longitude: 79.0850 };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Field Operations GIS Map</h1>
      <GisMap locations={myLocations} userLocation={officerGps} height="h-[550px]" />
    </div>
  );
}
```

---

## 🎯 5. Tile URL Cheat Sheet (All Free & Keyless)

| Style | Tile URL |
| :--- | :--- |
| **Google Maps Streets** | `https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}` |
| **Google Maps Satellite (Hybrid)** | `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}` |
| **Google Maps Terrain** | `https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}` |
| **OpenStreetMap Standard** | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| **CartoDB Dark Mode** | `https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png` |

---

## 💡 Troubleshooting & Gotchas

1. **Gray Tiles or Tiles Not Loading?**
   * Call `map.invalidateSize()` after mount or when resizing a container.
2. **Next.js SSR Error: `window is not defined`?**
   * Use dynamic import: `const L = (await import("leaflet")).default;` inside `useEffect()`, or `dynamic(() => import("./GisMap"), { ssr: false })`.
3. **OSRM Route Returns Straight Line?**
   * Make sure coordinates sent to OSRM are `${longitude},${latitude}` (X, Y) and mapped back to `${latitude},${longitude}` (Y, X) for Leaflet!
