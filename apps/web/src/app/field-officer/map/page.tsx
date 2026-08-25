"use client";

import { useEffect, useMemo, useState } from "react";

import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import {
  GisMap,
  formatDistanceString,
  getHaversineDistanceKm,
  solveOptimalRoute,
  type GeneratedRoute,
  type MapConsumerItem,
  type MapMeterItem,
  type RouteStop,
  type UserGpsLocation,
} from "@/components/gis/GisMap";
import { AppLayout } from "@/components/layout/AppLayout";
import { useAuth } from "@/context/AuthContext";
import {
  getFieldOfficerDashboard,
  recordFieldVisit,
  type FieldOfficerConsumer,
  type FieldOfficerDashboardResponse,
  type FieldOfficerMeter,
} from "@/lib/api";

export default function FieldOfficerMapPage() {
  return (
    <ProtectedRoute allowedRoles={["FIELD_OFFICER", "SUPER_ADMIN"]}>
      <FieldOfficerMapContent />
    </ProtectedRoute>
  );
}

// Direction step generator for turn-by-turn simulation
interface TurnDirectionStep {
  type: "start" | "turn_left" | "turn_right" | "straight" | "stop" | "same_building" | "finish";
  instruction: string;
  distanceText?: string;
  stop?: RouteStop;
}

// Helper to provide realistic local Chowk / Road / Gali names across Nagpur & Mumbai Wards
function getStreetLandmark(lat: number, lon: number) {
  if (lat > 20.5) {
    if (lat < 21.135) {
      return {
        road: "Wardha Road / Central Bazar Rd",
        chowk: "Lokmat Square Chowk",
        landmark: "Ramdaspeth Central Clinic",
        gali: "Panchsheel Cinema Gali",
      };
    } else if (lat < 21.145) {
      return {
        road: "West High Court (WHC) Road",
        chowk: "Dharampeth Coffee House Chowk",
        landmark: "Traffic Park Precinct",
        gali: "Zenda Chowk Dharampeth Gali",
      };
    } else if (lat < 21.155) {
      return {
        road: "Sitabuldi Main Road",
        chowk: "Variety Square Chowk",
        landmark: "Sitabuldi Metro Station / Fort",
        gali: "Modi No. 3 Market Gali",
      };
    } else {
      return {
        road: "Residency Road",
        chowk: "Sadar Liberty Cinema Chowk",
        landmark: "Civil Lines High Court Complex",
        gali: "Mount Road Sadar Gali",
      };
    }
  }

  if (lat < 18.923) {
    return {
      road: "Colaba Causeway Main Rd",
      chowk: "Regal Cinema Circle Chowk",
      landmark: "Gateway Heritage Precinct",
      gali: "Colaba Market Gali",
    };
  } else if (lat < 18.935) {
    return {
      road: "Madam Cama Marg",
      chowk: "Mantralaya Junction Chowk",
      landmark: "Nariman Point Business Tower",
      gali: "Free Press Journal Gali",
    };
  } else if (lat < 18.96) {
    return {
      road: "Maharshi Karve Road",
      chowk: "Churchgate Station Chowk",
      landmark: "Marine Drive Promenade",
      gali: "Cross Maidan Lane",
    };
  } else {
    return {
      road: "Dr. B.A. Road",
      chowk: "Shivaji Park Junction Chowk",
      landmark: "Dadar Heritage Complex",
      gali: "Cadell Road Gali",
    };
  }
}

// Fetch Real Road Geometry & Turn Instructions from OSRM
async function fetchOsrmRoadRoute(
  coordinates: Array<[number, number]>,
  mode: "drive" | "walk" = "drive",
): Promise<{
  geometry: [number, number][];
  totalDistanceKm: number;
  durationMins: number;
  steps: TurnDirectionStep[];
} | null> {
  try {
    if (coordinates.length < 2) return null;
    const profile = mode === "walk" ? "walking" : "driving";
    const coordsStr = coordinates.map(([lat, lon]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join(";");
    const url = `https://router.project-osrm.org/route/v1/${profile}/${coordsStr}?overview=full&geometries=geojson&steps=true`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) return null;

    const route = data.routes[0];
    const geoPoints: [number, number][] = route.geometry.coordinates.map(
      ([lon, lat]: [number, number]) => [lat, lon],
    );

    const steps: TurnDirectionStep[] = [];
    steps.push({
      type: "start",
      instruction: "🔵 Start navigation from your Live Location",
    });

    let stopCounter = 1;
    if (route.legs && Array.isArray(route.legs)) {
      route.legs.forEach((leg: any) => {
        if (leg.steps && Array.isArray(leg.steps)) {
          leg.steps.forEach((s: any) => {
            const m = s.maneuver || {};
            const streetName = s.name && s.name.trim() ? s.name : "Local Street / Gali";
            const distM = Math.round(s.distance || 0);

            if (distM < 10 && m.type !== "arrive") return;

            let turnType: "turn_left" | "turn_right" | "straight" | "stop" = "straight";
            let instruction = `Proceed along ${streetName}`;

            if (m.type === "turn") {
              if (m.modifier?.includes("left")) {
                turnType = "turn_left";
                instruction = `Turn left onto ${streetName}`;
              } else if (m.modifier?.includes("right")) {
                turnType = "turn_right";
                instruction = `Turn right onto ${streetName}`;
              }
            } else if (m.type === "end of road") {
              turnType = m.modifier?.includes("left") ? "turn_left" : "turn_right";
              instruction = `At end of road, turn ${m.modifier ?? "right"} onto ${streetName}`;
            } else if (m.type === "roundabout" || m.type === "rotary") {
              instruction = `Take roundabout onto ${streetName}`;
            } else if (m.type === "arrive") {
              turnType = "stop";
              instruction = `Arrive at Stop #${stopCounter} (${streetName})`;
              stopCounter++;
            }

            steps.push({
              type: turnType,
              instruction,
              distanceText:
                distM > 0 ? (distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${distM} m`) : undefined,
            });
          });
        }
      });
    }

    steps.push({
      type: "finish",
      instruction: "🏁 All assigned ward recovery stops completed!",
    });

    return {
      geometry: geoPoints,
      totalDistanceKm: (route.distance || 0) / 1000,
      durationMins: Math.max(1, Math.round((route.duration || 0) / 60)),
      steps,
    };
  } catch (err) {
    console.warn("OSRM road routing fallback:", err);
    return null;
  }
}

function generateLocalTurnDirections(
  startLat: number,
  startLon: number,
  stops: RouteStop[],
): TurnDirectionStep[] {
  if (stops.length === 0) return [];

  const steps: TurnDirectionStep[] = [];
  steps.push({
    type: "start",
    instruction: "🔵 Start navigation from your Live Location",
  });

  stops.forEach((stop, idx) => {
    const prevStop = idx === 0 ? null : stops[idx - 1];
    const prevLat = prevStop ? prevStop.latitude : startLat;
    const prevLon = prevStop ? prevStop.longitude : startLon;

    const legKm = stop.distanceFromPrevKm;
    const legMeters = Math.round(legKm * 1000);

    if (prevStop && (prevStop.meter_id === stop.meter_id || legMeters < 20)) {
      steps.push({
        type: "same_building",
        instruction: `🏢 Next bill in same premises: Stop #${stop.order} &bull; ${stop.consumer_name ?? "Consumer"} (Meter: ${stop.meter_id})`,
        distanceText: "Same premises (0 m)",
        stop: stop,
      });
      return;
    }

    const landmark = getStreetLandmark(stop.latitude, stop.longitude);
    const dLat = stop.latitude - prevLat;
    const dLon = stop.longitude - prevLon;

    let turnText = `Proceed straight along ${landmark.road} towards`;
    let turnType: "turn_left" | "turn_right" | "straight" = "straight";

    if (Math.abs(dLon) > Math.abs(dLat)) {
      if (dLon > 0) {
        turnText = `Turn right at ${landmark.chowk} onto ${landmark.road} towards`;
        turnType = "turn_right";
      } else {
        turnText = `Turn left at ${landmark.chowk} onto ${landmark.road} towards`;
        turnType = "turn_left";
      }
    } else {
      if (dLat > 0) {
        turnText = `Head north along ${landmark.road} past ${landmark.landmark} towards`;
        turnType = "straight";
      } else {
        turnText = `Head south along ${landmark.road} via ${landmark.gali} towards`;
        turnType = "straight";
      }
    }

    steps.push({
      type: turnType,
      instruction: `${turnText} Stop #${stop.order} (Meter: ${stop.meter_id})`,
      distanceText: formatDistanceString(stop.distanceFromPrevKm),
    });

    steps.push({
      type: "stop",
      instruction: `Arrive at Stop #${stop.order}: ${stop.consumer_name ?? "Consumer"} (Meter: ${stop.meter_id})`,
      distanceText: stop.pending_amount ? `Outstanding: ₹${stop.pending_amount.toLocaleString()}` : undefined,
      stop: stop,
    });
  });

  steps.push({
    type: "finish",
    instruction: "🏁 All assigned ward recovery stops completed!",
  });

  return steps;
}

function FieldOfficerMapContent() {
  const { accessToken } = useAuth();
  const [data, setData] = useState<FieldOfficerDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live GPS Location State
  const [userLocation, setUserLocation] = useState<UserGpsLocation | null>(null);
  const [gpsActive, setGpsActive] = useState<boolean>(false);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");

  // Amazon-Style Multi-Tier Filter State
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFilterCategory, setSelectedFilterCategory] = useState<
    "days" | "amount" | "status"
  >("days");

  const [daysFilter, setDaysFilter] = useState<
    "ALL" | "LT15" | "15TO30" | "GT30" | "GT60" | "GT120"
  >("ALL");

  const [amountFilter, setAmountFilter] = useState<
    "ALL" | "LT500" | "GT500" | "GT5000" | "GT10000"
  >("ALL");

  const [statusFilter, setStatusFilter] = useState<"ALL" | "UNVISITED" | "VISITED">("ALL");

  // Sidebar Layout State (Google Maps Split View)
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [navTab, setNavTab] = useState<"details" | "turns">("details");
  const [transportMode, setTransportMode] = useState<"walk" | "drive">("drive");
  const [currentRoute, setCurrentRoute] = useState<GeneratedRoute | null>(null);
  const [routeCalculating, setRouteCalculating] = useState(false);
  const [activeTurnSteps, setActiveTurnSteps] = useState<TurnDirectionStep[]>([]);

  // On-the-Spot Visit Modal State
  const [visitingConsumer, setVisitingConsumer] = useState<FieldOfficerConsumer | null>(null);
  const [visitingMeter, setVisitingMeter] = useState<FieldOfficerMeter | null>(null);
  const [visitStatus, setVisitStatus] = useState<string>("PAYMENT_RECOVERED");
  const [amountCollected, setAmountCollected] = useState<string>("");
  const [visitNotes, setVisitNotes] = useState<string>("");
  const [submittingVisit, setSubmittingVisit] = useState(false);
  const [visitFeedback, setVisitFeedback] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Visited consumer IDs in session
  const [visitedConsumerIds, setVisitedConsumerIds] = useState<Set<string>>(new Set());

  const fetchDashboard = () => {
    if (!accessToken) return;
    setLoading(true);
    getFieldOfficerDashboard(accessToken)
      .then(setData)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  };

  // Background live GPS watch
  useEffect(() => {
    fetchDashboard();

    if (typeof window !== "undefined" && navigator.geolocation) {
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setUserLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
          });
          setGpsActive(true);
        },
        (err) => {
          console.warn("GPS notice:", err.message);
        },
        {
          enableHighAccuracy: true,
          timeout: 20000,
          maximumAge: 3000,
        },
      );

      return () => {
        navigator.geolocation.clearWatch(watchId);
      };
    }
  }, [accessToken]);

  // Draggable pin repositioning listener
  useEffect(() => {
    const handleLocationChange = (e: any) => {
      if (e.detail && e.detail.latitude && e.detail.longitude) {
        setUserLocation({
          latitude: e.detail.latitude,
          longitude: e.detail.longitude,
        });
        setGpsActive(true);
      }
    };

    window.addEventListener("gis-officer-location-changed", handleLocationChange);
    return () => {
      window.removeEventListener("gis-officer-location-changed", handleLocationChange);
    };
  }, []);

  // Meters Map for quick lookup
  const meterByMeterId = useMemo(() => {
    const map = new Map<string, FieldOfficerMeter>();
    if (data?.meters) {
      data.meters.forEach((m) => {
        if (m.meter_id) map.set(m.meter_id, m);
      });
    }
    return map;
  }, [data]);

  // Ward Starting Centroid Coordinates
  const wardStartLocation: UserGpsLocation = useMemo(() => {
    if (data?.meters && data.meters.length > 0) {
      const valid = data.meters.filter((m) => m.latitude != null && m.longitude != null);
      if (valid.length > 0) {
        return {
          latitude: valid[0].latitude!,
          longitude: valid[0].longitude!,
        };
      }
    }
    return { latitude: 21.1458, longitude: 79.0882 };
  }, [data]);

  const effectiveOfficerLocation: UserGpsLocation = useMemo(() => {
    if (userLocation) return userLocation;
    return wardStartLocation;
  }, [userLocation, wardStartLocation]);

  // Filtered Consumers based on Amazon-style filters & search
  const filteredConsumers = useMemo(() => {
    if (!data?.consumers) return [];

    return data.consumers.filter((c: FieldOfficerConsumer) => {
      const cleanSearch = searchQuery.trim().toLowerCase();
      if (cleanSearch) {
        const matchesName = (c.consumer_name || "").toLowerCase().includes(cleanSearch);
        const matchesId = (c.consumer_id || "").toLowerCase().includes(cleanSearch);
        const matchesMeter = (c.meter_id || "").toLowerCase().includes(cleanSearch);
        const meter = meterByMeterId.get(c.meter_id);
        const matchesAddress = (meter?.consumer_name || "").toLowerCase().includes(cleanSearch);
        const matchesLat = meter?.latitude ? String(meter.latitude).includes(cleanSearch) : false;
        const matchesLon = meter?.longitude ? String(meter.longitude).includes(cleanSearch) : false;

        if (!matchesName && !matchesId && !matchesMeter && !matchesAddress && !matchesLat && !matchesLon) {
          return false;
        }
      }

      const days = c.days_pending ?? 0;
      if (daysFilter === "LT15" && days >= 15) return false;
      if (daysFilter === "15TO30" && (days < 15 || days > 30)) return false;
      if (daysFilter === "GT30" && days <= 30) return false;
      if (daysFilter === "GT60" && days <= 60) return false;
      if (daysFilter === "GT120" && days <= 120) return false;

      const amount = c.pending_amount ?? 0;
      if (amountFilter === "LT500" && amount >= 500) return false;
      if (amountFilter === "GT500" && amount <= 500) return false;
      if (amountFilter === "GT5000" && amount <= 5000) return false;
      if (amountFilter === "GT10000" && amount <= 10000) return false;

      const isVisited = visitedConsumerIds.has(c.consumer_id);
      if (statusFilter === "UNVISITED" && isVisited) return false;
      if (statusFilter === "VISITED" && !isVisited) return false;

      return true;
    });
  }, [data, searchQuery, daysFilter, amountFilter, statusFilter, visitedConsumerIds, meterByMeterId]);

  // Sorting & Pagination State (Scale to 1,000+ entries)
  const [sortBy, setSortBy] = useState<"distance" | "amount" | "days">("distance");
  const [routeBatchSize, setRouteBatchSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const pageSize = 20;

  // Filtered & Sorted Consumers
  const sortedAndFilteredConsumers = useMemo(() => {
    const list = [...filteredConsumers];

    list.sort((a, b) => {
      if (sortBy === "amount") {
        return (b.pending_amount || 0) - (a.pending_amount || 0);
      }
      if (sortBy === "days") {
        return (b.days_pending || 0) - (a.days_pending || 0);
      }
      // Default: distance from officer GPS
      const mA = meterByMeterId.get(a.meter_id);
      const mB = meterByMeterId.get(b.meter_id);
      const distA =
        mA?.latitude && mA?.longitude
          ? getHaversineDistanceKm(
              effectiveOfficerLocation.latitude,
              effectiveOfficerLocation.longitude,
              mA.latitude,
              mA.longitude,
            )
          : 999999;
      const distB =
        mB?.latitude && mB?.longitude
          ? getHaversineDistanceKm(
              effectiveOfficerLocation.latitude,
              effectiveOfficerLocation.longitude,
              mB.latitude,
              mB.longitude,
            )
          : 999999;
      return distA - distB;
    });

    return list;
  }, [filteredConsumers, sortBy, meterByMeterId, effectiveOfficerLocation]);

  // Paginated Slice for the Left Panel (Instant 60fps rendering even with 10,000 items)
  const totalPages = Math.max(1, Math.ceil(sortedAndFilteredConsumers.length / pageSize));
  const paginatedConsumers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedAndFilteredConsumers.slice(start, start + pageSize);
  }, [sortedAndFilteredConsumers, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, daysFilter, amountFilter, statusFilter, sortBy]);

  // Total Pending Amount for Filtered Set
  const totalPendingAmount = useMemo(() => {
    return filteredConsumers.reduce((sum, c) => sum + (c.pending_amount || 0), 0);
  }, [filteredConsumers]);

  // Meters corresponding to filtered consumers
  const activeMeters = useMemo(() => {
    if (!data?.meters) return [];
    if (filteredConsumers.length === 0 && (daysFilter !== "ALL" || amountFilter !== "ALL" || searchQuery)) {
      return [];
    }
    const matchingMeterIds = new Set(filteredConsumers.map((c) => c.meter_id));
    if (matchingMeterIds.size > 0) {
      return data.meters.filter((m) => matchingMeterIds.has(m.meter_id));
    }
    return data.meters;
  }, [data, filteredConsumers, daysFilter, amountFilter, searchQuery]);

  // Shortest Path Route Optimizer (Smart Batch TSP for 1,000+ entries)
  const handleOptimizeRoute = async () => {
    if (!data || sortedAndFilteredConsumers.length === 0) return;

    setRouteCalculating(true);
    try {
      const startLat = effectiveOfficerLocation.latitude;
      const startLon = effectiveOfficerLocation.longitude;

      // Take top N (e.g. 25 or 50) priority stops according to current sorting
      const routeTargets = sortedAndFilteredConsumers.slice(0, Math.min(routeBatchSize, 40));

      const targets = routeTargets
        .map((c) => {
          const m = meterByMeterId.get(c.meter_id);
          if (!m || m.latitude == null || m.longitude == null) return null;
          return {
            meter_id: c.meter_id,
            consumer_name: c.consumer_name,
            consumer_id: c.consumer_id,
            latitude: m.latitude,
            longitude: m.longitude,
            pending_amount: c.pending_amount,
          };
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);

      const solved = solveOptimalRoute(startLat, startLon, targets);

      const orderedCoords: [number, number][] = [
        [startLat, startLon],
        ...solved.stops.map((s) => [s.latitude, s.longitude] as [number, number]),
      ];

      const osrmResult = await fetchOsrmRoadRoute(orderedCoords, transportMode);

      if (osrmResult && osrmResult.geometry && osrmResult.geometry.length > 0) {
        solved.geometry = osrmResult.geometry;
        solved.totalDistanceKm = osrmResult.totalDistanceKm;
        solved.estTravelTimeMins = osrmResult.durationMins;
        setActiveTurnSteps(osrmResult.steps);
      } else {
        const speedKmH = transportMode === "walk" ? 5 : 25;
        solved.estTravelTimeMins = Math.max(1, Math.round((solved.totalDistanceKm / speedKmH) * 60));
        setActiveTurnSteps(generateLocalTurnDirections(startLat, startLon, solved.stops));
      }

      setCurrentRoute(solved);
      setSidebarOpen(true);
    } finally {
      setRouteCalculating(false);
    }
  };

  // Focus marker smoothly on map
  const handleFocusStop = (stop: RouteStop | { latitude: number; longitude: number; meter_id?: string }) => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("gis-focus-marker", {
          detail: {
            latitude: stop.latitude,
            longitude: stop.longitude,
            meter_id: stop.meter_id,
          },
        }),
      );
    }
  };

  // Spot Field Visit Modal
  const handleOpenVisit = (
    consumer: MapConsumerItem | FieldOfficerConsumer,
    meter?: MapMeterItem | FieldOfficerMeter,
  ) => {
    const foConsumer: FieldOfficerConsumer = {
      id: consumer.id,
      consumer_id: consumer.consumer_id,
      consumer_name: consumer.consumer_name,
      meter_id: consumer.meter_id,
      address: (consumer as any).address ?? null,
      pending_amount: consumer.pending_amount ?? undefined,
      days_pending: consumer.days_pending ?? undefined,
    };
    setVisitingConsumer(foConsumer);
    setVisitingMeter(meter ? (meter as FieldOfficerMeter) : meterByMeterId.get(consumer.meter_id) || null);
    setAmountCollected(consumer.pending_amount ? String(consumer.pending_amount) : "");
  };

  const handleRecordVisitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!visitingConsumer || !accessToken) return;

    setSubmittingVisit(true);
    setVisitFeedback(null);

    try {
      const collectedNum = amountCollected ? parseFloat(amountCollected) : 0;
      await recordFieldVisit(accessToken, {
        consumer_id: visitingConsumer.consumer_id,
        meter_id: visitingConsumer.meter_id,
        status: visitStatus,
        amount_collected: collectedNum,
        notes: visitNotes,
        latitude: effectiveOfficerLocation.latitude,
        longitude: effectiveOfficerLocation.longitude,
      });

      setVisitFeedback({
        type: "success",
        text: `Visit recorded: ₹${collectedNum.toLocaleString()} collected for ${visitingConsumer.consumer_name}.`,
      });

      setVisitedConsumerIds((prev) => new Set(prev).add(visitingConsumer.consumer_id));
      setVisitingConsumer(null);
      setVisitingMeter(null);
      setAmountCollected("");
      setVisitNotes("");
      fetchDashboard();
    } catch (err: any) {
      setVisitFeedback({
        type: "error",
        text: err.message || "Failed to record field visit.",
      });
    } finally {
      setSubmittingVisit(false);
    }
  };

  const activeFiltersCount =
    (daysFilter !== "ALL" ? 1 : 0) +
    (amountFilter !== "ALL" ? 1 : 0) +
    (statusFilter !== "ALL" ? 1 : 0);

  if (loading && !data) {
    return (
      <AppLayout title="Field GIS Navigation" subtitle="Loading Map...">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="text-center">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-3 border-slate-200 border-t-slate-900" />
            <p className="text-sm font-semibold text-slate-600">Loading Ward GIS Map...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (error && !data) {
    return (
      <AppLayout title="Field GIS Navigation" subtitle="Field Operations">
        <div className="flex min-h-[70vh] items-center justify-center">
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <p className="text-2xl">⚠️</p>
            <p className="mt-2 text-sm font-semibold text-red-700">{error}</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!data) return null;

  return (
    <AppLayout
      title="Field GIS Navigation"
      subtitle={`${data.zone_name} › ${data.area_name} › ${data.field_area_name}`}
      fullWidth={true}
    >
      {/* 1. COMPACT UNIFIED TOP TOOLBAR (Mobile Responsive) */}
      <div className="mb-2 flex flex-col md:flex-row md:items-center justify-between gap-2 rounded-2xl bg-white px-3.5 py-2 border border-slate-200 shadow-xs shrink-0">
        {/* Top Row on Mobile: Ward Scope + GPS & Panel Toggle */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 text-xs text-white shadow-xs">
              🗺️
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h2 className="text-xs font-bold text-slate-900 leading-tight">
                  {data.field_area_name}
                </h2>
                <span className="flex items-center gap-1 rounded-md bg-emerald-50 px-1.5 py-0.2 text-[9px] font-bold text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {gpsActive ? "Live GPS" : "Ready"}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Officer: <strong>{data.officer_name}</strong> &bull; Ward: <strong>{data.field_area_code}</strong>
              </p>
            </div>
          </div>

          {/* Mobile-only toggle */}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden flex items-center gap-1 rounded-xl bg-slate-900 text-white px-2.5 py-1 text-xs font-bold shadow-xs"
          >
            <span>🧭</span>
            <span>{sidebarOpen ? "Map" : `Stops (${sortedAndFilteredConsumers.length})`}</span>
          </button>
        </div>

        {/* Center: Live Search Box */}
        <div className="flex flex-1 max-w-full md:max-w-xs items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs transition focus-within:bg-white focus-within:border-slate-400">
          <span className="text-slate-400 text-xs">🔍</span>
          <input
            type="text"
            placeholder="Search Meter, Consumer, Lat/Lon..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent text-xs text-slate-900 placeholder-slate-400 outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Right Controls: Filter, Drive/Walk, Optimize, Panel Toggle */}
        <div className="flex flex-wrap items-center justify-end gap-1.5 text-xs">
          {/* Filter Trigger */}
          <button
            type="button"
            onClick={() => setShowFilterModal(true)}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 font-semibold transition border shadow-xs text-xs ${
              activeFiltersCount > 0
                ? "bg-amber-50 text-amber-900 border-amber-300 font-bold"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
            }`}
          >
            <span>⚡ Filters</span>
            {activeFiltersCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {/* Drive vs Walk Mode */}
          <div className="flex items-center rounded-xl bg-slate-100 p-0.5 text-[11px] font-bold border border-slate-200/80">
            <button
              type="button"
              onClick={() => setTransportMode("drive")}
              className={`rounded-lg px-2 py-0.5 transition ${
                transportMode === "drive"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              🚗 Drive
            </button>
            <button
              type="button"
              onClick={() => setTransportMode("walk")}
              className={`rounded-lg px-2 py-0.5 transition ${
                transportMode === "walk"
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              🚶 Walk
            </button>
          </div>

          {/* Optimize Button */}
          <button
            type="button"
            onClick={handleOptimizeRoute}
            disabled={routeCalculating}
            className="flex items-center gap-1 rounded-xl bg-amber-400 px-3 py-1 text-xs font-extrabold text-slate-950 shadow-xs hover:bg-amber-500 transition disabled:opacity-50"
          >
            <span>⚡</span>
            <span>{routeCalculating ? "Routing..." : "OPTIMIZE"}</span>
          </button>

          {/* Desktop Sidebar Toggle Button */}
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`hidden md:flex items-center gap-1 rounded-xl px-2.5 py-1 font-semibold transition shadow-xs text-xs ${
              sidebarOpen
                ? "bg-slate-900 text-white"
                : "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
            }`}
          >
            <span>🧭</span>
            <span>{sidebarOpen ? "Hide Panel" : "Show Stops"}</span>
            <span className="rounded-full bg-white/20 px-1 py-0.2 text-[9px] font-bold">
              {sortedAndFilteredConsumers.length}
            </span>
          </button>
        </div>
      </div>

      {/* Visit Toast Feedback */}
      {visitFeedback && (
        <div
          className={`mb-2 flex items-center justify-between rounded-xl p-2.5 text-xs font-semibold shadow-xs shrink-0 ${
            visitFeedback.type === "success"
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border border-red-200 bg-red-50 text-red-800"
          }`}
        >
          <span>{visitFeedback.text}</span>
          <button
            type="button"
            onClick={() => setVisitFeedback(null)}
            className="text-slate-400 hover:text-slate-700"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. FULL-SCREEN 100% VIEWPORT: GOOGLE MAPS SPLIT DOCK WITH STICKY SIDEBAR */}
      <div className="relative flex-1 flex w-full gap-2 min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm p-1">
        {/* Mobile Backdrop when sidebar is open */}
        {sidebarOpen && (
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/40 backdrop-blur-2xs md:hidden"
          />
        )}

        {/* A. GOOGLE MAPS LEFT SIDEBAR PANEL (Sticky on Desktop, Slide-Over Sheet on Mobile) */}
        {sidebarOpen && (
          <div className="fixed md:static inset-y-12 left-2 z-40 w-[88vw] max-w-[360px] md:w-[360px] md:max-w-[380px] shrink-0 flex flex-col rounded-2xl md:rounded-xl bg-white border border-slate-200/80 shadow-2xl md:shadow-sm h-[calc(100vh-130px)] md:h-full overflow-hidden transition-all">
            {/* Panel Header */}
            <div className="p-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    Assigned Field Stops
                  </h3>
                  <p className="text-[10px] text-slate-500">
                    {sortedAndFilteredConsumers.length} Targets &bull; Target: <strong>₹{totalPendingAmount.toLocaleString()}</strong>
                  </p>
                </div>

                <div className="flex items-center gap-1.5">
                  {/* Tabs */}
                  <div className="flex rounded-lg bg-slate-200/70 p-0.5 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => setNavTab("details")}
                      className={`rounded-md px-2 py-0.5 transition ${
                        navTab === "details"
                          ? "bg-white text-slate-950 shadow-xs"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      STOPS
                    </button>
                    <button
                      type="button"
                      onClick={() => setNavTab("turns")}
                      className={`rounded-md px-2 py-0.5 transition ${
                        navTab === "turns"
                          ? "bg-white text-slate-950 shadow-xs"
                          : "text-slate-500 hover:text-slate-900"
                      }`}
                    >
                      TURNS
                    </button>
                  </div>

                  {/* Close button on Mobile */}
                  <button
                    type="button"
                    onClick={() => setSidebarOpen(false)}
                    className="md:hidden flex h-6 w-6 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500 hover:bg-slate-200"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Sorting & Batch Size Filter Bar (Handles 1,000+ entries) */}
              <div className="mt-2 flex items-center justify-between gap-1.5 pt-1.5 border-t border-slate-200/60 text-[10px]">
                <div className="flex items-center gap-1 text-slate-500 font-semibold">
                  <span>Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-800 outline-none"
                  >
                    <option value="distance">📍 Nearest</option>
                    <option value="amount">💰 Highest ₹</option>
                    <option value="days">⏱️ Overdue</option>
                  </select>
                </div>

                <div className="flex items-center gap-1 text-slate-500 font-semibold">
                  <span>Batch:</span>
                  <select
                    value={routeBatchSize}
                    onChange={(e) => setRouteBatchSize(Number(e.target.value))}
                    className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-800 outline-none"
                    title="Number of stops to optimize in route"
                  >
                    <option value={15}>Top 15</option>
                    <option value={25}>Top 25</option>
                    <option value={40}>Top 40</option>
                  </select>
                </div>
              </div>

              {/* Route Summary KPI Strip (if calculated) */}
              {currentRoute && currentRoute.stops.length > 0 && (
                <div className="mt-2 flex items-center justify-between rounded-lg bg-blue-50/80 px-2.5 py-1 border border-blue-100 text-[11px]">
                  <div>
                    <span className="text-blue-900 font-extrabold">{currentRoute.totalDistanceKm.toFixed(1)} km</span>
                    <span className="text-blue-500 text-[9px] ml-1">ROAD</span>
                  </div>
                  <div>
                    <span className="text-blue-900 font-extrabold">{Math.max(1, Math.abs(currentRoute.estTravelTimeMins))} mins</span>
                    <span className="text-blue-500 text-[9px] ml-1">EST</span>
                  </div>
                  <div>
                    <span className="text-emerald-700 font-extrabold">{currentRoute.stops.length} Stops</span>
                  </div>
                </div>
              )}
            </div>

            {/* Panel Body: Scrollable Stops or Turns List */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
              {navTab === "details" ? (
                sortedAndFilteredConsumers.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <p className="text-2xl">📭</p>
                    <p className="mt-1 font-semibold text-slate-600">No matching consumers.</p>
                  </div>
                ) : (
                  paginatedConsumers.map((c, idx) => {
                    const globalIdx = (currentPage - 1) * pageSize + idx;
                    const meter = meterByMeterId.get(c.meter_id);
                    const isVisited = visitedConsumerIds.has(c.consumer_id);

                    let distanceStr = "";
                    if (meter?.latitude && meter?.longitude) {
                      const d = getHaversineDistanceKm(
                        effectiveOfficerLocation.latitude,
                        effectiveOfficerLocation.longitude,
                        meter.latitude,
                        meter.longitude,
                      );
                      distanceStr = formatDistanceString(d);
                    }

                    return (
                      <div
                        key={c.consumer_id}
                        onClick={() => {
                          if (meter?.latitude && meter?.longitude) {
                            handleFocusStop({
                              latitude: meter.latitude,
                              longitude: meter.longitude,
                              meter_id: meter.meter_id,
                            });
                          }
                        }}
                        className={`group relative flex items-center justify-between gap-2 rounded-xl p-2 border transition cursor-pointer hover:shadow-xs ${
                          isVisited
                            ? "border-emerald-200 bg-emerald-50/50"
                            : "border-slate-200/80 bg-white hover:border-blue-300"
                        }`}
                      >
                        {/* Left: Number + Details */}
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white shadow-xs">
                            {globalIdx + 1}
                          </span>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-900 truncate leading-tight group-hover:text-blue-600 transition">
                              {c.consumer_name}
                            </h4>
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono mt-0.5">
                              <span>{c.meter_id}</span>
                              <span>&bull;</span>
                              <span className={c.days_pending && c.days_pending > 60 ? "text-red-600 font-bold" : "text-slate-500"}>
                                ⏱️ {c.days_pending ?? 0}d
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Right: Amount + Quick Log Visit */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-extrabold text-red-600 font-mono">
                              ₹{c.pending_amount?.toLocaleString() ?? "0"}
                            </div>
                            {distanceStr && (
                              <div className="text-[9px] font-semibold text-blue-600">
                                📍 {distanceStr}
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenVisit(c, meter);
                            }}
                            className={`rounded-lg px-2 py-1 text-[10px] font-bold transition shadow-xs ${
                              isVisited
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-900 text-white hover:bg-slate-800"
                            }`}
                            title="Log field visit / payment collection"
                          >
                            {isVisited ? "✓" : "📝"}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )
              ) : (
                /* Turn-by-Turn Maneuvers */
                activeTurnSteps.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    <p className="text-2xl">🧭</p>
                    <p className="mt-1 font-semibold text-slate-600">No route generated.</p>
                    <p className="text-[10px] text-slate-400">Click ⚡ OPTIMIZE in the top bar.</p>
                  </div>
                ) : (
                  activeTurnSteps.map((step, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        if (step.stop) handleFocusStop(step.stop);
                      }}
                      className={`flex items-start gap-2 rounded-xl p-2 border text-xs transition cursor-pointer hover:shadow-2xs ${
                        step.type === "start"
                          ? "border-blue-200 bg-blue-50 text-blue-900"
                          : step.type === "finish"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900 font-bold"
                          : step.type === "same_building"
                          ? "border-amber-200 bg-amber-50/60 text-slate-900"
                          : step.type === "stop"
                          ? "border-red-200 bg-red-50/50 text-slate-900 font-bold"
                          : "border-slate-200 bg-white text-slate-800 hover:border-blue-300"
                      }`}
                    >
                      <div className="text-xs mt-0.5">
                        {step.type === "start" && "🔵"}
                        {step.type === "turn_left" && "⬅️"}
                        {step.type === "turn_right" && "➡️"}
                        {step.type === "straight" && "⬆️"}
                        {step.type === "same_building" && "🏢"}
                        {step.type === "stop" && "📍"}
                        {step.type === "finish" && "🏁"}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="leading-tight text-[11px] font-medium truncate">{step.instruction}</p>
                        {step.distanceText && (
                          <p className="text-[9px] font-semibold text-blue-600 mt-0.5">
                            {step.distanceText}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>

            {/* Panel Footer: Pagination Strip for 1,000+ entries */}
            {navTab === "details" && totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/80 px-3 py-1.5 text-[11px] font-semibold text-slate-600">
                <span>
                  {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedAndFilteredConsumers.length)} of {sortedAndFilteredConsumers.length}
                </span>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    ◀ Prev
                  </button>
                  <span className="px-1 text-[10px] font-bold text-slate-500">
                    {currentPage}/{totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                  >
                    Next ▶
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* B. MAIN LEAFLET GOOGLE MAP CANVAS (Fills Remaining 100% Width & Height) */}
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-200/80 shadow-xs h-full relative">
          <GisMap
            meters={activeMeters}
            consumers={filteredConsumers}
            height="h-full min-h-[550px]"
            externalSearch={searchQuery}
            userLocation={effectiveOfficerLocation}
            onLocateUser={() => {}}
            showFilters={false}
            showGps={true}
            showInternalSearch={false}
            enableRouting={true}
            activeRoute={currentRoute}
            onRouteGenerated={setCurrentRoute}
            onRecordVisit={handleOpenVisit}
          />
        </div>
      </div>

      {/* 3. AMAZON-STYLE FILTER MODAL */}
      {showFilterModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="flex h-[75vh] max-h-[540px] w-full max-w-2xl flex-col rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">Filters</h3>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="text-slate-400 hover:text-slate-700 text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              <div className="w-1/3 border-r border-slate-100 bg-slate-50/70 p-3 space-y-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSelectedFilterCategory("days")}
                  className={`w-full rounded-xl px-3.5 py-3 text-left transition ${
                    selectedFilterCategory === "days"
                      ? "bg-white text-blue-600 shadow-xs font-bold border-l-3 border-blue-600"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Days Overdue
                  {daysFilter !== "ALL" && <span className="ml-1 text-amber-500 font-bold">•</span>}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedFilterCategory("amount")}
                  className={`w-full rounded-xl px-3.5 py-3 text-left transition ${
                    selectedFilterCategory === "amount"
                      ? "bg-white text-blue-600 shadow-xs font-bold border-l-3 border-blue-600"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Pending Amount
                  {amountFilter !== "ALL" && <span className="ml-1 text-amber-500 font-bold">•</span>}
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedFilterCategory("status")}
                  className={`w-full rounded-xl px-3.5 py-3 text-left transition ${
                    selectedFilterCategory === "status"
                      ? "bg-white text-blue-600 shadow-xs font-bold border-l-3 border-blue-600"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Visit Status
                  {statusFilter !== "ALL" && <span className="ml-1 text-amber-500 font-bold">•</span>}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 text-xs">
                {selectedFilterCategory === "days" && (
                  <div>
                    <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[10px] mb-3">
                      Filter by Overdue Period
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "ALL", label: "All Days (Show All)" },
                        { id: "LT15", label: "< 15 Days" },
                        { id: "15TO30", label: "15 – 30 Days" },
                        { id: "GT30", label: "> 30 Days Overdue" },
                        { id: "GT60", label: "> 60 Days (Critical)" },
                        { id: "GT120", label: "> 120 Days (Severe)" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setDaysFilter(item.id as any)}
                          className={`rounded-2xl border px-3.5 py-2 font-semibold transition ${
                            daysFilter === item.id
                              ? "border-blue-600 bg-blue-50 text-blue-700 shadow-xs font-bold ring-2 ring-blue-600/20"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedFilterCategory === "amount" && (
                  <div>
                    <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[10px] mb-3">
                      Filter by Outstanding Amount (₹)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "ALL", label: "All Amounts" },
                        { id: "LT500", label: "< ₹500" },
                        { id: "GT500", label: "> ₹500" },
                        { id: "GT5000", label: "> ₹5,000" },
                        { id: "GT10000", label: "> ₹10,000 (High Value)" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setAmountFilter(item.id as any)}
                          className={`rounded-2xl border px-3.5 py-2 font-semibold transition ${
                            amountFilter === item.id
                              ? "border-emerald-600 bg-emerald-50 text-emerald-700 shadow-xs font-bold ring-2 ring-emerald-600/20"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {selectedFilterCategory === "status" && (
                  <div>
                    <h4 className="font-bold uppercase tracking-wider text-slate-400 text-[10px] mb-3">
                      Filter by Field Visit Status
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: "ALL", label: "All Accounts" },
                        { id: "UNVISITED", label: "🔴 Unvisited Pending" },
                        { id: "VISITED", label: "🟢 Visited / Contacted" },
                      ].map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setStatusFilter(item.id as any)}
                          className={`rounded-2xl border px-3.5 py-2 font-semibold transition ${
                            statusFilter === item.id
                              ? "border-slate-900 bg-slate-900 text-white shadow-xs font-bold"
                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3.5 bg-white">
              <button
                type="button"
                onClick={() => {
                  setDaysFilter("ALL");
                  setAmountFilter("ALL");
                  setStatusFilter("ALL");
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Clear Filters
              </button>

              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                className="rounded-xl bg-amber-400 px-6 py-2 text-xs font-extrabold text-slate-950 shadow-md hover:bg-amber-500 transition"
              >
                Show {filteredConsumers.length} Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. ON-THE-SPOT VISIT MODAL */}
      {visitingConsumer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in zoom-in-95 duration-150">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Record Spot Field Visit & Collection
                </h3>
                <p className="text-xs text-slate-500">
                  Consumer: <strong>{visitingConsumer.consumer_name}</strong> ({visitingConsumer.consumer_id})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setVisitingConsumer(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRecordVisitSubmit} className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-3.5 text-xs border border-slate-100">
                <div>
                  <span className="text-slate-400">Meter ID:</span>{" "}
                  <strong className="font-mono text-slate-800">{visitingConsumer.meter_id}</strong>
                </div>
                <div>
                  <span className="text-slate-400">Outstanding:</span>{" "}
                  <strong className="text-red-600 font-bold">
                    ₹{visitingConsumer.pending_amount?.toLocaleString() ?? "0"}
                  </strong>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Visit Outcome Status *
                </label>
                <select
                  value={visitStatus}
                  onChange={(e) => setVisitStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-900 outline-none focus:border-slate-400"
                  required
                >
                  <option value="PAYMENT_RECOVERED">🟢 Payment Recovered on Spot</option>
                  <option value="PAYMENT_NOT_RECOVERED">🔴 Payment Not Recovered</option>
                  <option value="CONSUMER_CONTACTED">🔵 Consumer Contacted / Promised Date</option>
                  <option value="CONSUMER_UNAVAILABLE">🟡 Consumer Unavailable / Premises Locked</option>
                  <option value="METER_PROBLEM_IDENTIFIED">🟣 Meter Fault / Tampering Identified</option>
                  <option value="OTHER">⚪ Other Remarks</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Amount Collected (₹)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 5000.00"
                  value={amountCollected}
                  onChange={(e) => setAmountCollected(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-900 outline-none focus:border-slate-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                  Officer Remarks / Receipt Notes
                </label>
                <textarea
                  rows={3}
                  placeholder="Add details about the visit or payment receipt number..."
                  value={visitNotes}
                  onChange={(e) => setVisitNotes(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 outline-none focus:border-slate-400 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => setVisitingConsumer(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingVisit}
                  className="rounded-xl bg-[#0f172a] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                >
                  {submittingVisit ? "Saving..." : "Save Field Visit Log"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
