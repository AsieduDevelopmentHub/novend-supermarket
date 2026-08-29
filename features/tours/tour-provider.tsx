"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { driver, type Driver } from "driver.js";
import { api } from "@/convex/_generated/api";
import type { AppRole } from "@/config/navigation";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  getTourDefinition,
  resolveStepAnchor,
  tourForPath,
  toursForAccess,
  type TourDefinition,
  type TourId,
} from "./tour-registry";

type TourProgress = {
  tourId: string;
  version: number;
  status: "in_progress" | "completed" | "skipped";
  lastStepId: string | null;
  updatedAt: number;
  dirty?: boolean;
};

type ProductToursContextValue = {
  availableTours: TourDefinition[];
  progress: TourProgress[];
  activeTourId: TourId | null;
  startTour: (tourId: TourId) => void;
  restartTour: (tourId: TourId) => void;
};

const ProductToursContext = createContext<ProductToursContextValue | null>(null);

function cacheKey(identityKey: string) {
  return `novend.tours.v1:${identityKey}`;
}

function readProgress(identityKey: string): TourProgress[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(cacheKey(identityKey)) || "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as TourProgress[]) : [];
  } catch {
    return [];
  }
}

function writeProgress(identityKey: string, rows: TourProgress[]) {
  try {
    window.localStorage.setItem(cacheKey(identityKey), JSON.stringify(rows));
  } catch {
    // Tour state is optional and must not block the shell.
  }
}

export function ProductTourProvider({
  children,
  enabled,
  identityKey,
  role,
  isPlatformAdmin,
}: {
  children: ReactNode;
  enabled: boolean;
  identityKey: string | null;
  role: AppRole | null;
  isPlatformAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const online = useConnectivity();
  const liveProgress = useQuery(api.tours.listOwn, enabled && online ? {} : "skip");
  const typedLiveProgress = liveProgress as TourProgress[] | undefined;
  const saveOwn = useMutation(api.tours.saveOwn);
  const restartOwn = useMutation(api.tours.restartOwn);
  const progressRef = useRef<TourProgress[]>([]);
  const [progress, setProgress] = useState<TourProgress[]>([]);
  const activeDriver = useRef<Driver | null>(null);
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const attemptedPath = useRef<string | null>(null);
  const availableTours = useMemo(
    () => toursForAccess(role, isPlatformAdmin),
    [isPlatformAdmin, role],
  );

  useEffect(() => {
    if (!identityKey) return;
    progressRef.current = readProgress(identityKey);
    queueMicrotask(() => setProgress(progressRef.current));
  }, [identityKey]);

  useEffect(() => {
    if (!identityKey || !typedLiveProgress) return;
    const local = readProgress(identityKey);
    const dirty = local.filter((row) => row.dirty);
    const merged: TourProgress[] = typedLiveProgress.map((row) => ({
      ...row,
      dirty: false,
    }));
    for (const row of dirty) {
      const server = merged.find((item) => item.tourId === row.tourId);
      if (!server || row.updatedAt > server.updatedAt) {
        const index = merged.findIndex((item) => item.tourId === row.tourId);
        if (index >= 0) merged[index] = row;
        else merged.push(row);
      }
    }
    progressRef.current = merged;
    queueMicrotask(() => setProgress(merged));
    writeProgress(identityKey, merged);
    for (const row of dirty) {
      void saveOwn({
        tourId: row.tourId,
        version: row.version,
        status: row.status,
        lastStepId: row.lastStepId ?? undefined,
      })
        .then(() => {
          if (!identityKey) return;
          const current = readProgress(identityKey);
          writeProgress(
            identityKey,
            current.map((item) =>
              item.tourId === row.tourId ? { ...item, dirty: false } : item,
            ),
          );
        })
        .catch(() => {
          // Keep dirty state for the next reconnect.
        });
    }
  }, [identityKey, saveOwn, typedLiveProgress]);

  const persist = useCallback(
    (tour: TourDefinition, status: TourProgress["status"], lastStepId?: string) => {
      if (!identityKey) return;
      const current = readProgress(identityKey);
      const row: TourProgress = {
        tourId: tour.id,
        version: tour.version,
        status,
        lastStepId: lastStepId ?? null,
        updatedAt: Date.now(),
        dirty: !online,
      };
      const next = [...current.filter((item) => item.tourId !== tour.id), row];
      progressRef.current = next;
      setProgress(next);
      writeProgress(identityKey, next);
      if (online) {
        void saveOwn({
          tourId: tour.id,
          version: tour.version,
          status,
          lastStepId,
        }).catch(() => {
          writeProgress(
            identityKey,
            readProgress(identityKey).map((item) =>
              item.tourId === tour.id ? { ...item, dirty: true } : item,
            ),
          );
        });
      }
    },
    [identityKey, online, saveOwn],
  );

  const driveTour = useCallback((tour: TourDefinition, force = false) => {
    if (activeDriver.current?.isActive()) return;
    const selectors = tour.steps.map((step) => resolveStepAnchor(step));
    if (!selectors.some((selector) => document.querySelector(selector))) return;
    const saved = progressRef.current.find((row) => row.tourId === tour.id);
    if (
      !force &&
      saved &&
      saved.version >= tour.version &&
      (saved.status === "completed" || saved.status === "skipped")
    ) {
      return;
    }
    let settled = false;
    const instance = driver({
      animate: true,
      smoothScroll: true,
      allowClose: true,
      allowScroll: true,
      skipMissingElement: true,
      waitForElement: 1800,
      showProgress: true,
      progressText: "{{current}} of {{total}}",
      nextBtnText: "Next",
      prevBtnText: "Back",
      doneBtnText: "Finish",
      popoverClass: "novend-product-tour",
      steps: tour.steps.map((step, index) => ({
        element: selectors[index],
        data: { stepId: step.id },
        popover: {
          title: step.title,
          description: step.description,
          side: step.side ?? "bottom",
          align: "start",
        },
      })),
      onNextClick: (_element, step, options) => {
        const stepId = typeof step.data?.stepId === "string" ? step.data.stepId : undefined;
        if (options.driver.isLastStep()) {
          settled = true;
          persist(tour, "completed", stepId);
          options.driver.destroy();
        } else {
          persist(tour, "in_progress", stepId);
          options.driver.moveNext();
        }
      },
      onCloseClick: (_element, step, options) => {
        const stepId = typeof step.data?.stepId === "string" ? step.data.stepId : undefined;
        settled = true;
        persist(tour, "skipped", stepId);
        options.driver.destroy();
      },
      onDestroyed: (_element, step) => {
        if (!settled) {
          const stepId = typeof step.data?.stepId === "string" ? step.data.stepId : undefined;
          persist(tour, "skipped", stepId);
        }
        activeDriver.current = null;
        setActiveTourId(null);
      },
    });
    activeDriver.current = instance;
    setActiveTourId(tour.id);
    const resumeIndex =
      saved?.status === "in_progress" && saved.lastStepId
        ? Math.max(
            0,
            tour.steps.findIndex((step) => step.id === saved.lastStepId) + 1,
          )
        : 0;
    persist(tour, "in_progress", tour.steps[resumeIndex]?.id);
    instance.drive(Math.min(resumeIndex, tour.steps.length - 1));
  }, [persist]);

  const startTour = useCallback((tourId: TourId) => {
    const tour = getTourDefinition(tourId);
    if (!tour || !availableTours.some((item) => item.id === tourId)) return;
    if (pathname !== tour.path && !pathname.startsWith(`${tour.path}/`)) {
      window.sessionStorage.setItem("novend.pendingTour", tourId);
      router.push(tour.path);
      return;
    }
    window.setTimeout(() => driveTour(tour, true), 250);
  }, [availableTours, driveTour, pathname, router]);

  const restartTour = useCallback((tourId: TourId) => {
    const tour = getTourDefinition(tourId);
    if (!tour || !identityKey) return;
    writeProgress(
      identityKey,
      readProgress(identityKey).filter((row) => row.tourId !== tourId),
    );
    const next = readProgress(identityKey);
    progressRef.current = next;
    setProgress(next);
    if (online) void restartOwn({ tourId, version: tour.version });
    startTour(tourId);
  }, [identityKey, online, restartOwn, startTour]);

  useEffect(() => {
    if (!enabled || !identityKey || attemptedPath.current === pathname) return;
    attemptedPath.current = pathname;
    const pending = window.sessionStorage.getItem("novend.pendingTour") as TourId | null;
    const pendingTour = pending ? getTourDefinition(pending) : undefined;
    if (
      pendingTour &&
      (pathname === pendingTour.path || pathname.startsWith(`${pendingTour.path}/`))
    ) {
      window.sessionStorage.removeItem("novend.pendingTour");
      const timer = window.setTimeout(() => driveTour(pendingTour, true), 700);
      return () => window.clearTimeout(timer);
    }
    const contextual = tourForPath(pathname, role, isPlatformAdmin);
    const shell = getTourDefinition("shell");
    const candidate =
      pathname === "/dashboard" &&
      role &&
      shell &&
      availableTours.some((tour) => tour.id === "shell")
        ? shell
        : contextual;
    if (!candidate) return;
    const timer = window.setTimeout(() => driveTour(candidate), 1200);
    return () => window.clearTimeout(timer);
  }, [availableTours, driveTour, enabled, identityKey, isPlatformAdmin, pathname, role]);

  useEffect(
    () => () => {
      activeDriver.current?.destroy();
    },
    [],
  );

  const value: ProductToursContextValue = {
    availableTours,
    progress,
    activeTourId,
    startTour,
    restartTour,
  };

  return <ProductToursContext.Provider value={value}>{children}</ProductToursContext.Provider>;
}

export function useProductTours() {
  const context = useContext(ProductToursContext);
  if (!context) throw new Error("useProductTours must be used inside ProductTourProvider");
  return context;
}
