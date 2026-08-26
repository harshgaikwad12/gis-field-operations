"use client";

import { useEffect, useRef, useState } from "react";

export interface MapMeterItem {
  id: number;
  meter_id: string;
  consumer_name?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  zone_name?: string | null;
  area_name?: string | null;
  field_area_name?: string | null;
}

export interface MapConsumerItem {
  id: number;
  consumer_id: string;
  consumer_name: string;
  meter_id: string;
  address?: string | null;
  pending_amount?: number | null;
  days_pending?: number | null;
}

export interface UserGpsLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export interface RouteStop {
  order: number;
  meter_id: string;
  consumer_name?: string;
  consumer_id?: string;
  latitude: number;
  longitude: number;
  distanceFromPrevKm: number;
  pending_amount?: number | null;
}

export interface GeneratedRoute {
  stops: RouteStop[];
  totalDistanceKm: number;
  estTravelTimeMins: number;
  geometry?: [number, number][];
}

interface GisMapProps {
  meters: MapMeterItem[];
  consumers?: MapConsumerItem[];
  title?: string;
  subtitle?: string;
  height?: string;
  selectedZoneFilter?: string;
  externalSearch?: string;
  externalFilter?: string;
  userLocation?: UserGpsLocation | null;
  onLocateUser?: () => void;
  showFilters?: boolean;
  showGps?: boolean;
  showInternalSearch?: boolean;
  enableRouting?: boolean;
  onRecordVisit?: (consumer: MapConsumerItem, meter: MapMeterItem) => void;
  activeRoute?: GeneratedRoute | null;
  onRouteGenerated?: (route: GeneratedRoute | null) => void;
}

// Phase 18: Haversine Distance Helper
export function getHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatDistanceString(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

// Phase 19: Nearest Neighbor Route Generator (TSP Solver)
export function solveOptimalRoute(
  startLat: number,
  startLon: number,
  targets: Array<{
    meter_id: string;
    consumer_name?: string;
    consumer_id?: string;
    latitude: number;
    longitude: number;
    pending_amount?: number | null;
  }>,
): GeneratedRoute {
  if (targets.length === 0) {
    return { stops: [], totalDistanceKm: 0, estTravelTimeMins: 0 };
  }

  const unvisited = [...targets];
  const orderedStops: RouteStop[] = [];
  let currentLat = startLat;
  let currentLon = startLon;
  let totalDistance = 0;
  let order = 1;

  while (unvisited.length > 0) {
    let nearestIdx = 0;
    let minDistance = Infinity;

    for (let i = 0; i < unvisited.length; i++) {
      const dist = getHaversineDistanceKm(
        currentLat,
        currentLon,
        unvisited[i].latitude,
        unvisited[i].longitude,
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestIdx = i;
      }
    }

    const nextStop = unvisited.splice(nearestIdx, 1)[0];
    totalDistance += minDistance;

    orderedStops.push({
      order,
      meter_id: nextStop.meter_id,
      consumer_name: nextStop.consumer_name,
      consumer_id: nextStop.consumer_id,
      latitude: nextStop.latitude,
      longitude: nextStop.longitude,
      distanceFromPrevKm: minDistance,
      pending_amount: nextStop.pending_amount,
    });

    currentLat = nextStop.latitude;
    currentLon = nextStop.longitude;
    order++;
  }

  // Estimate: Average urban speed 25 km/h + 10 mins per stop visit
  const drivingTimeMins = (totalDistance / 25) * 60;
  const stopTimeMins = orderedStops.length * 8;
  const estTravelTimeMins = Math.round(drivingTimeMins + stopTimeMins);

  return {
    stops: orderedStops,
    totalDistanceKm: totalDistance,
    estTravelTimeMins: Math.max(5, estTravelTimeMins),
  };
}

export function GisMap({
  meters,
  consumers = [],
  title = "",
  subtitle = "",
  height = "h-[450px]",
  selectedZoneFilter = "",
  externalSearch = "",
  externalFilter = "all",
  userLocation = null,
  onLocateUser,
  showFilters = false,
  showGps = false,
  showInternalSearch = false,
  enableRouting = false,
  onRecordVisit,
  activeRoute = null,
  onRouteGenerated,
}: GisMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const layerGroupRef = useRef<any>(null);
  const routeLayerGroupRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchTerm, setSearchTerm] = useState(externalSearch);
  const [mapType, setMapType] = useState<"streets" | "satellite">("streets");
  const [filterType, setFilterType] = useState<
    "all" | "meters" | "consumers" | "overdue30" | "overdue60" | "highamount"
  >((externalFilter as any) || "all");

  const [localRoute, setLocalRoute] = useState<GeneratedRoute | null>(activeRoute);

  const lastFittedRouteKeyRef = useRef<string | null>(null);
  const hasFittedInitialMarkersRef = useRef<boolean>(false);
  const prevSearchRef = useRef<string>(externalSearch || "");
  const prevZoneRef = useRef<string>(selectedZoneFilter || "");

  // Sync external search prop if changed
  useEffect(() => {
    if (externalSearch !== undefined) {
      setSearchTerm(externalSearch);
    }
  }, [externalSearch]);

  // Sync external filter prop if changed
  useEffect(() => {
    if (externalFilter !== undefined) {
      setFilterType(externalFilter as any);
    }
  }, [externalFilter]);

  // Sync external route prop if changed
  useEffect(() => {
    setLocalRoute(activeRoute);
  }, [activeRoute]);

  // Phase 20: Global event listener for on-the-spot visit modal trigger from Leaflet Popups
  useEffect(() => {
    const handleRecordVisitEvent = (e: any) => {
      const detail = e.detail;
      if (!detail) return;
      const consumer = consumers.find(
        (c) => c.consumer_id === detail.consumer_id || c.meter_id === detail.meter_id,
      );
      const meter = meters.find((m) => m.meter_id === detail.meter_id);
      if (consumer && meter && onRecordVisit) {
        onRecordVisit(consumer, meter);
      }
    };

    const handleFocusMarkerEvent = (e: any) => {
      const detail = e.detail;
      if (!detail || !mapInstanceRef.current) return;
      const { latitude, longitude, meter_id } = detail;
      if (latitude != null && longitude != null) {
        mapInstanceRef.current.flyTo([latitude, longitude], 17, {
          duration: 0.8,
          easeLinearity: 0.25,
        });

        if (layerGroupRef.current) {
          setTimeout(() => {
            layerGroupRef.current?.eachLayer((layer: any) => {
              if (layer.getPopup && layer.getLatLng) {
                const latlng = layer.getLatLng();
                if (
                  Math.abs(latlng.lat - latitude) < 0.0002 &&
                  Math.abs(latlng.lng - longitude) < 0.0002
                ) {
                  layer.openPopup();
                }
              }
            });
          }, 350);
        }
      }
    };

    window.addEventListener("gis-record-visit", handleRecordVisitEvent);
    window.addEventListener("gis-focus-marker", handleFocusMarkerEvent);
    return () => {
      window.removeEventListener("gis-record-visit", handleRecordVisitEvent);
      window.removeEventListener("gis-focus-marker", handleFocusMarkerEvent);
    };
  }, [consumers, meters, onRecordVisit]);

  const effectiveSearch = (externalSearch !== undefined ? externalSearch : searchTerm).trim().toLowerCase();
  const effectiveFilter = (externalFilter !== undefined ? externalFilter : filterType) as string;

  // Map consumer by meter_id for fast lookup
  const consumerByMeter = new Map<string, MapConsumerItem>();
  consumers.forEach((c) => {
    if (c.meter_id) consumerByMeter.set(c.meter_id, c);
  });

  // Filter meters based on zone filter, search term, and payment/overdue filters
  const filteredMeters = meters.filter((m) => {
    const matchesZone =
      !selectedZoneFilter ||
      (m.zone_name ?? "")
        .toLowerCase()
        .includes(selectedZoneFilter.toLowerCase());

    const linkedConsumer = consumerByMeter.get(m.meter_id);

    // Search query matching (Phase 16)
    const matchesSearch =
      !effectiveSearch ||
      (m.meter_id || "").toLowerCase().includes(effectiveSearch) ||
      (m.consumer_name || "").toLowerCase().includes(effectiveSearch) ||
      (m.address || "").toLowerCase().includes(effectiveSearch) ||
      (m.area_name || "").toLowerCase().includes(effectiveSearch) ||
      (m.field_area_name || "").toLowerCase().includes(effectiveSearch) ||
      (m.zone_name || "").toLowerCase().includes(effectiveSearch) ||
      (linkedConsumer?.consumer_id || "").toLowerCase().includes(effectiveSearch) ||
      (linkedConsumer?.consumer_name || "").toLowerCase().includes(effectiveSearch);

    // Priority & Overdue filters (Phase 17)
    let matchesFilter = true;
    if (effectiveFilter === "meters") {
      matchesFilter = !linkedConsumer;
    } else if (effectiveFilter === "consumers") {
      matchesFilter = !!linkedConsumer;
    } else if (effectiveFilter === "overdue30") {
      matchesFilter =
        !!linkedConsumer && (linkedConsumer.days_pending ?? 0) >= 30;
    } else if (effectiveFilter === "overdue60") {
      matchesFilter =
        !!linkedConsumer && (linkedConsumer.days_pending ?? 0) >= 60;
    } else if (effectiveFilter === "highamount") {
      matchesFilter =
        !!linkedConsumer && (linkedConsumer.pending_amount ?? 0) >= 5000;
    }

    return matchesZone && matchesSearch && matchesFilter;
  });

  const validMeters = filteredMeters.filter(
    (m) => m.latitude != null && m.longitude != null,
  );

  const validConsumers = consumers.filter((c) =>
    validMeters.some((m) => m.meter_id === c.meter_id),
  );

  // Initialize Leaflet Map
  useEffect(() => {
    let isMounted = true;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      const L = (await import("leaflet")).default;
      if (!isMounted) return;

      if (!mapInstanceRef.current && mapContainerRef.current) {
        // Determine initial center from available meters (e.g. Mumbai ~ 19.07, 72.87 or Nagpur ~ 21.14, 79.08)
        let initialCenter: [number, number] = [19.0760, 72.8777]; // Default Mumbai
        let initialZoom = 12;

        const validCoords = meters.filter(
          (m) => m.latitude != null && m.longitude != null,
        );
        if (validCoords.length > 0) {
          const sumLat = validCoords.reduce((acc, m) => acc + m.latitude!, 0);
          const sumLng = validCoords.reduce((acc, m) => acc + m.longitude!, 0);
          initialCenter = [
            sumLat / validCoords.length,
            sumLng / validCoords.length,
          ];
          initialZoom = 13;
        }

        const map = L.map(mapContainerRef.current, {
          center: initialCenter,
          zoom: initialZoom,
          zoomControl: false, // We render modern glassmorphic zoom buttons
          scrollWheelZoom: true,
          touchZoom: true,
          doubleClickZoom: true,
          boxZoom: true,
          keyboard: true,
          zoomSnap: 0.25, // Smooth fractional zoom
          zoomDelta: 0.5,  // Smooth button and key steps
          wheelPxPerZoomLevel: 90, // Ultra-smooth trackpad/mouse scroll handling
          wheelDebounceTime: 40,
          bounceAtZoomLimits: true,
        });

        // High-Detail Google Maps Standard Street Layer
        const streetTile = L.tileLayer(
          "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
          {
            attribution: '&copy; Google Maps contributors',
            maxZoom: 21,
            subdomains: ["mt0", "mt1", "mt2", "mt3"],
          },
        );

        streetTile.addTo(map);
        tileLayerRef.current = streetTile;

        const layerGroup = L.layerGroup().addTo(map);
        const routeLayerGroup = L.layerGroup().addTo(map);

        mapInstanceRef.current = map;
        layerGroupRef.current = layerGroup;
        routeLayerGroupRef.current = routeLayerGroup;
        setMapLoaded(true);

        // Immediate size invalidation to avoid gray tiles
        setTimeout(() => {
          map.invalidateSize();
        }, 100);
      }
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        layerGroupRef.current = null;
        routeLayerGroupRef.current = null;
        tileLayerRef.current = null;
        userMarkerRef.current = null;
      }
    };
  }, []);

  // Handle map type toggle (High-Detail Google Streets vs Google Hybrid Satellite)
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    async function switchTileLayer() {
      const L = (await import("leaflet")).default;
      const map = mapInstanceRef.current;

      if (tileLayerRef.current) {
        map.removeLayer(tileLayerRef.current);
      }

      if (mapType === "satellite") {
        tileLayerRef.current = L.tileLayer(
          "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
          {
            attribution: "&copy; Google Maps Satellite Imagery",
            maxZoom: 21,
          },
        );
      } else {
        tileLayerRef.current = L.tileLayer(
          "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
          {
            attribution: "&copy; Google Maps Standard",
            maxZoom: 21,
          },
        );
      }

      tileLayerRef.current.addTo(map);
      map.invalidateSize();
    }

    switchTileLayer();
  }, [mapType, mapLoaded]);

  // Phase 15: ResizeObserver to eliminate any gray tile gaps when sidebar toggles
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !mapContainerRef.current) return;
    const map = mapInstanceRef.current;

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });

    resizeObserver.observe(mapContainerRef.current);

    const onResize = () => map.invalidateSize();
    window.addEventListener("resize", onResize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, [mapLoaded]);

  // Ensure map tiles and dimensions resize smoothly on mount
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 120);
    return () => clearTimeout(timer);
  }, [mapLoaded]);

  // Phase 15: Render User GPS Marker
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current) return;

    async function updateUserGps() {
      const L = (await import("leaflet")).default;
      const map = mapInstanceRef.current;

      if (userMarkerRef.current) {
        map.removeLayer(userMarkerRef.current);
        userMarkerRef.current = null;
      }

      if (userLocation && userLocation.latitude && userLocation.longitude) {
        // Phase 15: Prominent Pulsing Blue Dot for Live Officer GPS
        const gpsIcon = L.divIcon({
          className: "custom-user-gps-marker",
          html: `
            <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center;">
              <div style="position: absolute; width: 34px; height: 34px; background-color: rgba(37, 99, 235, 0.28); border-radius: 50%; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="position: absolute; width: 22px; height: 22px; background-color: rgba(59, 130, 246, 0.5); border-radius: 50%;"></div>
              <div style="position: relative; width: 14px; height: 14px; background-color: #1d4ed8; border: 2.5px solid #ffffff; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.5);"></div>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        const marker = L.marker([userLocation.latitude, userLocation.longitude], {
          icon: gpsIcon,
          zIndexOffset: 1000,
          draggable: true,
        })
          .bindPopup(
            `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 6px 4px; min-width: 220px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="font-size: 14px;">🔵</span>
                <span style="font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #1e40af;">
                  Field Officer Base Location
                </span>
              </div>
              <div style="margin-top: 5px; font-size: 13px; font-weight: 700; color: #0f172a;">
                Nagpur Ward Base &bull; Sitabuldi
              </div>
              <div style="margin-top: 3px; font-size: 11px; color: #64748b;">
                GPS: <span style="font-family: monospace; font-weight: 600; color: #334155;">${userLocation.latitude.toFixed(5)}, ${userLocation.longitude.toFixed(5)}</span>
              </div>
              <div style="margin-top: 6px; display: inline-flex; align-items: center; gap: 4px; background: #eff6ff; border: 1px solid #bfdbfe; padding: 3px 8px; border-radius: 6px; font-size: 10px; font-weight: 700; color: #1d4ed8;">
                ✓ Navigation Origin Point
              </div>
              <div style="margin-top: 5px; font-size: 10px; color: #94a3b8; font-style: italic;">
                💡 Drag this blue pin anywhere to reposition your start point!
              </div>
            </div>
          `,
          )
          .addTo(map);

        marker.on("dragend", (e: any) => {
          const latlng = e.target.getLatLng();
          if (typeof window !== "undefined") {
            window.dispatchEvent(
              new CustomEvent("gis-officer-location-changed", {
                detail: {
                  latitude: latlng.lat,
                  longitude: latlng.lng,
                },
              }),
            );
          }
        });

        userMarkerRef.current = marker;
      }
    }

    updateUserGps();
  }, [userLocation, mapLoaded]);

  // Phase 18 & 19: Render Route Polyline & Sequential Stops with Red Pins
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !routeLayerGroupRef.current)
      return;

    async function drawRoute() {
      const L = (await import("leaflet")).default;
      const routeGroup = routeLayerGroupRef.current;
      const map = mapInstanceRef.current;

      routeGroup.clearLayers();

      if (!localRoute || localRoute.stops.length === 0) return;

      const latlngs: [number, number][] = [];

      // Start from user GPS if available
      if (userLocation && userLocation.latitude && userLocation.longitude) {
        latlngs.push([userLocation.latitude, userLocation.longitude]);
      }

      localRoute.stops.forEach((stop) => {
        latlngs.push([stop.latitude, stop.longitude]);

        // Red Numbered Pin Marker (📍 Red Pins 1, 2, 3...)
        const numberIcon = L.divIcon({
          className: "custom-route-marker",
          html: `
            <div style="position: relative; width: 30px; height: 36px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
              <svg width="30" height="36" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 6px rgba(0,0,0,0.45));">
                <path d="M16 0C7.163 0 0 7.163 0 16C0 26.5 16 38 16 38C16 38 32 26.5 32 16C32 7.163 24.837 0 16 0Z" fill="#ef4444"/>
                <circle cx="16" cy="15" r="11" fill="white"/>
              </svg>
              <div style="position: absolute; top: 6px; left: 0; right: 0; text-align: center; color: #b91c1c; font-size: 11px; font-weight: 900; font-family: sans-serif;">
                ${stop.order}
              </div>
            </div>
          `,
          iconSize: [30, 36],
          iconAnchor: [15, 36],
          popupAnchor: [0, -32],
        });

        const stopPopupHtml = `
          <div style="font-family: sans-serif; padding: 4px; min-width: 200px;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #dc2626;">
              📍 Stop #${stop.order} of ${localRoute.stops.length}
            </div>
            <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">
              ${stop.consumer_name ?? stop.meter_id}
            </div>
            <div style="font-size: 11px; color: #64748b; margin-top: 1px;">
              Meter: <strong>${stop.meter_id}</strong>
            </div>
            <div style="font-size: 11px; color: #2563eb; font-weight: 600; margin-top: 3px;">
              📏 Distance from prev stop: ${formatDistanceString(stop.distanceFromPrevKm)}
            </div>
            ${
              stop.pending_amount
                ? `<div style="font-size: 12px; font-weight: 800; color: #dc2626; margin-top: 3px;">Pending: ₹${stop.pending_amount.toLocaleString()}</div>`
                : ""
            }
            <button onclick="window.dispatchEvent(new CustomEvent('gis-record-visit', { detail: { consumer_id: '${stop.consumer_id ?? ""}', meter_id: '${stop.meter_id}' } }))" style="margin-top: 8px; width: 100%; background: #0f172a; color: white; border: none; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
              📝 Record Visit / Collect Payment
            </button>
          </div>
        `;

        L.marker([stop.latitude, stop.longitude], {
          icon: numberIcon,
          zIndexOffset: 600 + stop.order,
        })
          .bindPopup(stopPopupHtml)
          .addTo(routeGroup);
      });

      // Real Road Polyline (OSRM street-following coordinates or direct fallback)
      const roadCoordinates: [number, number][] =
        localRoute.geometry && localRoute.geometry.length > 0
          ? localRoute.geometry
          : latlngs;

      // Outer route casing (Google Maps style dark blue track border)
      L.polyline(roadCoordinates, {
        color: "#1e3a8a",
        weight: 8,
        opacity: 0.6,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(routeGroup);

      // Inner vibrant blue route line
      const polyline = L.polyline(roadCoordinates, {
        color: "#2563eb",
        weight: 5,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(routeGroup);

      // Fit bounds to entire route smoothly ONLY once when the route is created or changed
      if (roadCoordinates.length > 0) {
        const currentRouteKey = localRoute
          ? `${localRoute.stops.map((s) => s.meter_id).join(",")}_${localRoute.stops.length}`
          : null;
        if (currentRouteKey && lastFittedRouteKeyRef.current !== currentRouteKey) {
          map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
          lastFittedRouteKeyRef.current = currentRouteKey;
        }
      }
    }

    drawRoute();
  }, [localRoute, mapLoaded, userLocation]);

  // Phase 18: Update Data Markers & Proximity Badges
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !layerGroupRef.current) return;

    async function updateMarkers() {
      const L = (await import("leaflet")).default;
      const layerGroup = layerGroupRef.current;
      const map = mapInstanceRef.current;

      layerGroup.clearLayers();
      const bounds: [number, number][] = [];

      // Include user GPS location in bounds if available
      if (userLocation && userLocation.latitude && userLocation.longitude) {
        bounds.push([userLocation.latitude, userLocation.longitude]);
      }

      const blueIcon = L.divIcon({
        className: "custom-meter-marker",
        html: `<div style="background-color: #2563eb; width: 15px; height: 15px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.35); cursor: pointer;"></div>`,
        iconSize: [15, 15],
        iconAnchor: [7, 7],
      });

      const redIcon = L.divIcon({
        className: "custom-consumer-marker",
        html: `<div style="background-color: #ef4444; width: 17px; height: 17px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(239,68,68,0.5); cursor: pointer;"></div>`,
        iconSize: [17, 17],
        iconAnchor: [8, 8],
      });

      const yellowIcon = L.divIcon({
        className: "custom-critical-marker",
        html: `<div style="background-color: #f59e0b; width: 17px; height: 17px; border-radius: 50%; border: 2.5px solid white; box-shadow: 0 2px 6px rgba(245,158,11,0.5); cursor: pointer;"></div>`,
        iconSize: [17, 17],
        iconAnchor: [8, 8],
      });

      validMeters.forEach((m) => {
        if (m.latitude == null || m.longitude == null) return;

        const linkedConsumer = consumerByMeter.get(m.meter_id);
        const lat = m.latitude;
        const lon = m.longitude;
        bounds.push([lat, lon]);

        let icon = blueIcon;
        if (linkedConsumer) {
          icon = (linkedConsumer.days_pending ?? 0) >= 60 ? yellowIcon : redIcon;
        }

        // Calculate distance from officer GPS if available (Phase 18)
        let distanceText = "";
        if (userLocation && userLocation.latitude && userLocation.longitude) {
          const distKm = getHaversineDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            lat,
            lon,
          );
          distanceText = `<div style="font-size: 11px; font-weight: 700; color: #2563eb; margin-top: 3px;">📍 Distance: ${formatDistanceString(
            distKm,
          )} away</div>`;
        }

        const popupHtml = `
          <div style="font-family: sans-serif; padding: 4px; min-width: 200px;">
            <div style="font-size: 11px; font-weight: bold; text-transform: uppercase; color: ${
              linkedConsumer ? "#dc2626" : "#2563eb"
            };">
              ${linkedConsumer ? "🔴 Pending Consumer Match" : "⚡ Master Meter"}
            </div>
            <div style="font-size: 14px; font-weight: 800; color: #0f172a; margin-top: 2px;">
              Meter: ${m.meter_id}
            </div>
            ${
              m.consumer_name
                ? `<div style="font-size: 12px; font-weight: 600; color: #334155; margin-top: 2px;">Consumer: ${m.consumer_name}</div>`
                : ""
            }
            ${
              m.field_area_name
                ? `<div style="font-size: 11px; color: #64748b; margin-top: 2px;">Ward: ${m.field_area_name}</div>`
                : ""
            }
            ${distanceText}
            <div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">📍 ${lat.toFixed(
              4,
            )}, ${lon.toFixed(4)}</div>
            ${
              linkedConsumer?.pending_amount
                ? `<div style="font-size: 12px; font-weight: 800; color: #dc2626; margin-top: 5px; border-top: 1px solid #fee2e2; padding-top: 3px;">Pending: ₹${linkedConsumer.pending_amount.toLocaleString()} &bull; ${
                    linkedConsumer.days_pending ?? 0
                  }d overdue</div>
                  <button onclick="window.dispatchEvent(new CustomEvent('gis-record-visit', { detail: { consumer_id: '${linkedConsumer.consumer_id}', meter_id: '${m.meter_id}' } }))" style="margin-top: 8px; width: 100%; background: #0f172a; color: white; border: none; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 700; cursor: pointer;">
                    📝 Record Visit / Collect Payment
                  </button>`
                : ""
            }
          </div>
        `;

        L.marker([lat, lon], { icon }).bindPopup(popupHtml).addTo(layerGroup);
      });

      // Invalidate size in case layout rendered asynchronously
      map.invalidateSize();

      const searchChanged = prevSearchRef.current !== (effectiveSearch || "");
      const zoneChanged = prevZoneRef.current !== (selectedZoneFilter || "");
      if (searchChanged) prevSearchRef.current = effectiveSearch || "";
      if (zoneChanged) prevZoneRef.current = selectedZoneFilter || "";

      const shouldAutoFit = !hasFittedInitialMarkersRef.current || searchChanged || zoneChanged;

      // If no route active, fit bounds directly to city markers ONLY on initial load or search/zone change
      if ((!localRoute || localRoute.stops.length === 0) && shouldAutoFit) {
        if (bounds.length > 0) {
          if (bounds.length === 1) {
            map.setView(bounds[0], 16);
            // Automatically open popup on the searched marker
            setTimeout(() => {
              layerGroup.eachLayer((layer: any) => {
                if (layer.openPopup) layer.openPopup();
              });
            }, 100);
          } else {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 13 });
          }
          hasFittedInitialMarkersRef.current = true;
        } else {
          // Fallback to city center if zone is known
          const isNagpur = (selectedZoneFilter || "").toLowerCase().includes("nagpur");
          if (isNagpur) {
            map.setView([21.1458, 79.0882], 12);
          } else {
            map.setView([19.0760, 72.8777], 12);
          }
          hasFittedInitialMarkersRef.current = true;
        }
      }
    }

    updateMarkers();
  }, [
    mapLoaded,
    validMeters.length,
    consumers.length,
    selectedZoneFilter,
    effectiveSearch,
    effectiveFilter,
    userLocation,
    localRoute,
  ]);

  const handleCenterUser = () => {
    if (userLocation && mapInstanceRef.current) {
      mapInstanceRef.current.setView(
        [userLocation.latitude, userLocation.longitude],
        16,
      );
    } else if (onLocateUser) {
      onLocateUser();
    }
  };

  // Phase 19: Generate Route from current GPS & visible targets
  const handleGenerateRoute = () => {
    if (!userLocation) {
      if (onLocateUser) onLocateUser();
      alert("Please allow GPS location first to generate an optimal route from your current position.");
      return;
    }

    const targetsToRoute = validMeters
      .filter((m) => m.latitude != null && m.longitude != null)
      .map((m) => {
        const c = consumers.find((con) => con.meter_id === m.meter_id);
        return {
          meter_id: m.meter_id,
          consumer_id: c?.consumer_id,
          consumer_name: c?.consumer_name || m.consumer_name || "Consumer",
          address: c?.address || m.address || "Field Location",
          pending_amount: c?.pending_amount || 0,
          latitude: m.latitude!,
          longitude: m.longitude!,
        };
      });

    if (targetsToRoute.length === 0) {
      alert("No consumers/meters found to generate a route for.");
      return;
    }

    const route = solveOptimalRoute(
      userLocation.latitude,
      userLocation.longitude,
      targetsToRoute,
    );

    lastFittedRouteKeyRef.current = null;
    setLocalRoute(route);
    if (onRouteGenerated) onRouteGenerated(route);
  };

  const handleClearRoute = () => {
    lastFittedRouteKeyRef.current = null;
    hasFittedInitialMarkersRef.current = false;
    setLocalRoute(null);
    if (onRouteGenerated) onRouteGenerated(null);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
      {/* Map Top Toolbar */}
      {(title || enableRouting || showGps || showInternalSearch) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2.5 text-slate-800">
          {title ? (
            <div>
              <h3 className="text-sm font-bold text-slate-900">{title}</h3>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
            </div>
          ) : <div />}

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Phase 19: Generate Route Button */}
          {enableRouting && (
            localRoute ? (
              <button
                type="button"
                onClick={handleClearRoute}
                className="flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
              >
                <span>✕</span>
                <span>Clear Route</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleGenerateRoute}
                className="flex items-center gap-1.5 rounded-xl bg-[#0f172a] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 shadow-xs"
              >
                <span>🛣️</span>
                <span>Generate Route ({validMeters.length})</span>
              </button>
            )
          )}

          {/* Locate Me / GPS Button (Phase 15) */}
          {showGps && (
            <button
              type="button"
              onClick={handleCenterUser}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                userLocation
                  ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
              title="Locate me via GPS"
            >
              <span>🎯</span>
              <span>{userLocation ? "My GPS Active" : "Locate Me"}</span>
            </button>
          )}

          {/* Map Layer Toggle (Street vs Satellite) */}
          <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMapType("streets")}
              className={`rounded-lg px-2.5 py-1 transition ${
                mapType === "streets"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              🗺️ Map
            </button>
            <button
              type="button"
              onClick={() => setMapType("satellite")}
              className={`rounded-lg px-2.5 py-1 transition ${
                mapType === "satellite"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              🛰️ Satellite
            </button>
          </div>

          {/* Quick Search (Phase 16) */}
          {showInternalSearch && (
            <input
              type="text"
              placeholder="Search map..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-32 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:bg-white"
            />
          )}
        </div>
      </div>
      )}



      {/* Payment & Days Overdue Filter Chips (Phase 17) */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-xs">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
            Filter:
          </span>
          <button
            type="button"
            onClick={() => setFilterType("all")}
            className={`rounded-lg px-2 py-0.5 font-medium transition ${
              filterType === "all"
                ? "bg-slate-900 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            All ({validMeters.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("meters")}
            className={`rounded-lg px-2 py-0.5 font-medium transition ${
              filterType === "meters"
                ? "bg-blue-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            ⚡ Meters
          </button>
          <button
            type="button"
            onClick={() => setFilterType("consumers")}
            className={`rounded-lg px-2 py-0.5 font-medium transition ${
              filterType === "consumers"
                ? "bg-red-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            🔴 Pending ({validConsumers.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterType("overdue30")}
            className={`rounded-lg px-2 py-0.5 font-medium transition ${
              filterType === "overdue30"
                ? "bg-amber-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            ⚠️ &gt;30 Days Overdue
          </button>
          <button
            type="button"
            onClick={() => setFilterType("overdue60")}
            className={`rounded-lg px-2 py-0.5 font-medium transition ${
              filterType === "overdue60"
                ? "bg-orange-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            🚨 &gt;60 Days Overdue
          </button>
          <button
            type="button"
            onClick={() => setFilterType("highamount")}
            className={`rounded-lg px-2 py-0.5 font-medium transition ${
              filterType === "highamount"
                ? "bg-emerald-600 text-white"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
            }`}
          >
            💰 &gt;₹5,000 Amount
          </button>
        </div>
      )}

      {/* Map Viewport Container */}
      <div className="relative w-full flex-1 h-full min-h-0">
        <div ref={mapContainerRef} className={`w-full h-full min-h-[500px] ${height} z-0`} />

        {/* Google Maps Authentic Live Navigation HUD Banner (Top-Center) */}
        {localRoute && localRoute.stops.length > 0 && (
          <div
            onClick={() => {
              if (mapInstanceRef.current && localRoute.stops[0]) {
                mapInstanceRef.current.flyTo(
                  [localRoute.stops[0].latitude, localRoute.stops[0].longitude],
                  18,
                  { animate: true, duration: 0.8 },
                );
              }
            }}
            className="absolute top-3 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-md rounded-2xl bg-[#0f5132] text-white shadow-2xl p-3 border border-emerald-600/40 backdrop-blur-xs flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 cursor-pointer hover:bg-[#0d462b] transition"
            title="Click to focus next stop"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-700/80 text-xl font-bold border border-emerald-500/50 shadow-inner">
                {localRoute.stops[0].distanceFromPrevKm < 0.1 ? "🏢" : "⬆️"}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-200">
                    Next: Stop #{localRoute.stops[0].order}
                  </span>
                  <span className="text-[10px] font-bold text-amber-300 font-mono">
                    ₹{localRoute.stops[0].pending_amount?.toLocaleString() ?? "0"}
                  </span>
                </div>
                <h4 className="text-xs font-extrabold truncate text-white leading-tight mt-0.5">
                  {localRoute.stops[0].consumer_name ?? localRoute.stops[0].meter_id}
                </h4>
                <p className="text-[10px] text-emerald-100/90 mt-0.5 truncate">
                  Meter: {localRoute.stops[0].meter_id} &bull; {formatDistanceString(localRoute.stops[0].distanceFromPrevKm)} away
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Google Maps Bottom-Left Route ETA Badge */}
        {localRoute && localRoute.stops.length > 0 && (
          <div className="absolute bottom-3 left-3 z-20 flex items-center gap-2 rounded-xl bg-white/95 backdrop-blur-xs px-3 py-1.5 text-xs font-bold text-slate-800 shadow-md border border-slate-200/80">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span className="text-emerald-700 font-extrabold">{Math.max(1, Math.abs(localRoute.estTravelTimeMins))} mins</span>
            <span className="text-slate-400 font-normal">({localRoute.totalDistanceKm.toFixed(1)} km)</span>
            <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">&bull; Fastest Ward Route</span>
          </div>
        )}

        {/* Google Maps Floating Control Widgets (Top-Right) */}
        <div className="absolute top-3 right-3 z-20 flex flex-col gap-1.5 shadow-md">
          {/* Zoom In & Zoom Out Pill */}
          <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200/80 bg-white/95 backdrop-blur-xs shadow-sm">
            <button
              type="button"
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.zoomIn(1, { animate: true });
                }
              }}
              className="flex h-8 w-8 items-center justify-center text-sm font-black text-slate-800 hover:bg-slate-100 transition active:bg-slate-200"
              title="Zoom in (+)"
            >
              ➕
            </button>
            <div className="h-px w-full bg-slate-100" />
            <button
              type="button"
              onClick={() => {
                if (mapInstanceRef.current) {
                  mapInstanceRef.current.zoomOut(1, { animate: true });
                }
              }}
              className="flex h-8 w-8 items-center justify-center text-sm font-black text-slate-800 hover:bg-slate-100 transition active:bg-slate-200"
              title="Zoom out (-)"
            >
              ➖
            </button>
          </div>

          {/* Fit All Visible Stops & Ward Bounds */}
          <button
            type="button"
            onClick={() => {
              if (!mapInstanceRef.current || validMeters.length === 0) return;
              const coords: [number, number][] = validMeters.map((m) => [m.latitude!, m.longitude!]);
              if (userLocation) {
                coords.push([userLocation.latitude, userLocation.longitude]);
              }
              mapInstanceRef.current.fitBounds(coords, {
                padding: [45, 45],
                maxZoom: 17,
                animate: true,
              });
            }}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white/95 text-xs font-bold text-slate-800 hover:bg-slate-100 transition active:bg-slate-200 shadow-sm"
            title="Fit all stops in screen (Reset View)"
          >
            🎯
          </button>

          {/* Center User GPS */}
          {userLocation && (
            <button
              type="button"
              onClick={() => {
                if (mapInstanceRef.current && userLocation) {
                  mapInstanceRef.current.flyTo(
                    [userLocation.latitude, userLocation.longitude],
                    17,
                    { animate: true, duration: 0.8 },
                  );
                }
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-blue-200 bg-blue-50/95 text-xs font-bold text-blue-700 hover:bg-blue-100 transition active:bg-blue-200 shadow-sm"
              title="Fly to My Live GPS Location"
            >
              📍
            </button>
          )}

          {/* Map Layer Switcher (Streets vs Satellite) */}
          <button
            type="button"
            onClick={() => setMapType((prev) => (prev === "streets" ? "satellite" : "streets"))}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200/80 bg-white/95 text-xs font-bold text-slate-800 hover:bg-slate-100 transition active:bg-slate-200 shadow-sm"
            title={`Switch to ${mapType === "streets" ? "Satellite" : "Street"} View`}
          >
            {mapType === "streets" ? "🛰️" : "🗺️"}
          </button>
        </div>

        {validMeters.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50/85 backdrop-blur-xs z-10">
            <div className="p-6 text-center">
              <span className="text-3xl">🗺️</span>
              <p className="mt-2 text-sm font-bold text-slate-800">
                No Markers Match Current Filter
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Try clearing search or switching filter to &apos;All&apos;.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="flex flex-wrap items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-1.5 text-xs text-slate-500 shrink-0">
        <span>
          Showing <strong>{validMeters.length}</strong> mapped locations
        </span>
        <span className="text-[11px] font-mono text-slate-400">
          GIS Engine: Google Maps Standard &bull; OSRM Road Routing
        </span>
      </div>
    </div>
  );
}
