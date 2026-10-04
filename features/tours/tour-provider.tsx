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
import { useMutation } from "convex/react";
import { useAuthedQuery } from "@/hooks/use-authed-query";
import { driver, type Driver } from "driver.js";
import { api } from "@/convex/_generated/api";
import type { AppRole } from "@/config/navigation";
import { useConnectivity } from "@/hooks/use-connectivity";
import {
  loadTourProgress,
  mergeTourProgress,
  saveTourProgress,
  type StoredTourProgress,
} from "@/lib/offline/tour-progress-cache";
import {
  getTourDefinition,
  hasTourProgress,
  onboardingQueue,
  popoverSideForStep,
  queryTourable,
  resolveStepAnchor,
  tourForPath,
  toursForAccess,
  type TourDefinition,
  type TourId,
} from "./tour-registry";

type TourProgress = StoredTourProgress;

type ProductToursContextValue = {
  availableTours: TourDefinition[];
  progress: TourProgress[];
  activeTourId: TourId | null;
  startTour: (tourId: TourId) => void;
  restartTour: (tourId: TourId) => void;
};

const ProductToursContext = createContext<ProductToursContextValue | null>(null);

const PENDING_TOUR_KEY = "novend.pendingTour";
const JOURNEY_KEY = "novend.onboardingJourney";
const SINGLE_TOUR_KEY = "novend.tourSingle";
const ANCHOR_WAIT_MS = 3200;
const ROUTE_SETTLE_MS = 900;

type JourneyState = { remaining: TourId[] };

function writeProgress(rows: TourProgress[]) {
  void saveTourProgress(rows).catch(() => {
    // Tour state is optional and must not block the shell.
  });
}

function readJourney(): JourneyState | null {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(JOURNEY_KEY) || "null") as unknown;
    if (!parsed || typeof parsed !== "object" || !("remaining" in parsed)) return null;
    const remaining = (parsed as JourneyState).remaining;
    if (!Array.isArray(remaining)) return null;
    return { remaining: remaining.filter((id): id is TourId => typeof id === "string") };
  } catch {
    return null;
  }
}

function writeJourney(state: JourneyState | null) {
  if (!state) {
    window.sessionStorage.removeItem(JOURNEY_KEY);
    return;
  }
  window.sessionStorage.setItem(JOURNEY_KEY, JSON.stringify(state));
}

function isSingleTourMode() {
  return window.sessionStorage.getItem(SINGLE_TOUR_KEY) === "1";
}

function setSingleTourMode(enabled: boolean) {
  if (enabled) window.sessionStorage.setItem(SINGLE_TOUR_KEY, "1");
  else window.sessionStorage.removeItem(SINGLE_TOUR_KEY);
}

function waitForTourable(selector: string, timeoutMs: number): Promise<Element | null> {
  return new Promise((resolve) => {
    const existing = queryTourable(selector);
    if (existing instanceof Element) {
      resolve(existing);
      return;
    }
    const started = Date.now();
    const tick = () => {
      const node = queryTourable(selector);
      if (node instanceof Element) {
        resolve(node);
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        resolve(null);
        return;
      }
      window.setTimeout(tick, 80);
    };
    window.setTimeout(tick, 80);
  });
}

function scrollStepIntoView(element: Element) {
  element.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" });
}

function injectSkipButton(footer: HTMLElement, onSkip: () => void) {
  if (footer.querySelector("[data-tour-skip]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.tourSkip = "true";
  button.className = "driver-popover-skip-btn";
  button.textContent = "Skip tour";
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onSkip();
  });
  footer.insertBefore(button, footer.firstChild);
}

export function ProductTourProvider({
  children,
  enabled,
  identityKey,
  role,
  isPlatformAdmin,
  initialProgress,
}: {
  children: ReactNode;
  enabled: boolean;
  identityKey: string | null;
  role: AppRole | null;
  isPlatformAdmin: boolean;
  initialProgress?: TourProgress[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const online = useConnectivity();
  const liveProgress = useAuthedQuery(api.tours.listOwn, enabled && online ? {} : "skip");
  const typedLiveProgress = liveProgress as TourProgress[] | undefined;
  const saveOwn = useMutation(api.tours.saveOwn);
  const restartOwn = useMutation(api.tours.restartOwn);
  const progressRef = useRef<TourProgress[]>([]);
  const [progress, setProgress] = useState<TourProgress[]>([]);
  const [hydratedKey, setHydratedKey] = useState<string | null>(null);
  const initialProgressRef = useRef(initialProgress);
  const hydrated = hydratedKey === identityKey;
  const tourSeedKey = (initialProgress ?? [])
    .map((row) => `${row.tourId}:${row.version}:${row.status}:${row.updatedAt}`)
    .sort()
    .join("|");
  const activeDriver = useRef<Driver | null>(null);
  const [activeTourId, setActiveTourId] = useState<TourId | null>(null);
  const attemptedPath = useRef<string | null>(null);
  const driveGeneration = useRef(0);
  const availableTours = useMemo(
    () => toursForAccess(role, isPlatformAdmin),
    [isPlatformAdmin, role],
  );

  useEffect(() => {
    initialProgressRef.current = initialProgress;
  }, [initialProgress]);

  useEffect(() => {
    if (!identityKey) return;
    let cancelled = false;
    void loadTourProgress(identityKey).then((local) => {
      if (cancelled) return;
      const merged = mergeTourProgress(local, initialProgressRef.current ?? []);
      progressRef.current = merged;
      setProgress(merged);
      writeProgress(merged);
      setHydratedKey(identityKey);
    });
    return () => {
      cancelled = true;
    };
  }, [identityKey]);

  useEffect(() => {
    if (!identityKey || !tourSeedKey || !hydrated) return;
    const seed = initialProgressRef.current ?? [];
    if (seed.length === 0) return;
    const merged = mergeTourProgress(progressRef.current, seed);
    progressRef.current = merged;
    setProgress(merged);
    writeProgress(merged);
  }, [hydrated, identityKey, tourSeedKey]);

  useEffect(() => {
    if (!identityKey || !typedLiveProgress) return;
    const local = progressRef.current;
    const dirty = local.filter((row) => row.dirty);
    const merged = mergeTourProgress(local, typedLiveProgress);
    progressRef.current = merged;
    queueMicrotask(() => setProgress(merged));
    writeProgress(merged);
    for (const row of dirty) {
      void saveOwn({
        tourId: row.tourId,
        version: row.version,
        status: row.status,
        lastStepId: row.lastStepId ?? undefined,
      })
        .then(() => {
          const current = progressRef.current.map((item) =>
            item.tourId === row.tourId ? { ...item, dirty: false } : item,
          );
          progressRef.current = current;
          writeProgress(current);
        })
        .catch(() => {
          // Keep dirty state for the next reconnect.
        });
    }
  }, [identityKey, saveOwn, typedLiveProgress]);

  const persist = useCallback(
    (tour: TourDefinition, status: TourProgress["status"], lastStepId?: string) => {
      if (!identityKey) return;
      const current = progressRef.current;
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
      writeProgress(next);
      if (online) {
        void saveOwn({
          tourId: tour.id,
          version: tour.version,
          status,
          lastStepId,
        }).catch(() => {
          const failed = progressRef.current.map((item) =>
            item.tourId === tour.id ? { ...item, dirty: true } : item,
          );
          progressRef.current = failed;
          writeProgress(failed);
        });
      }
    },
    [identityKey, online, saveOwn],
  );

  const persistSkipped = useCallback(
    (tourId: TourId, lastStepId?: string) => {
      const tour = getTourDefinition(tourId);
      if (tour) persist(tour, "skipped", lastStepId);
    },
    [persist],
  );

  const nextJourneyTour = useCallback((): TourDefinition | null => {
    if (isSingleTourMode()) return null;
    const remaining = readJourney()?.remaining ?? [];
    for (const id of remaining) {
      const tour = getTourDefinition(id);
      if (!tour || !availableTours.some((item) => item.id === id)) continue;
      const saved = progressRef.current.find((row) => row.tourId === id);
      if (
        saved &&
        saved.version >= tour.version &&
        (saved.status === "completed" || saved.status === "skipped")
      ) {
        continue;
      }
      return tour;
    }
    return null;
  }, [availableTours]);

  const advanceJourney = useCallback(() => {
    const next = nextJourneyTour();
    const remaining = readJourney()?.remaining ?? [];
    if (!next) {
      writeJourney(null);
      return;
    }
    writeJourney({ remaining: remaining.filter((id) => id !== next.id) });
    window.sessionStorage.setItem(PENDING_TOUR_KEY, next.id);
    router.push(next.path);
  }, [nextJourneyTour, router]);

  const skipRemainingJourney = useCallback(
    (currentId: TourId) => {
      const remaining = readJourney()?.remaining ?? [];
      for (const id of remaining) {
        if (id !== currentId) persistSkipped(id);
      }
      writeJourney(null);
      setSingleTourMode(false);
    },
    [persistSkipped],
  );

  const driveTour = useCallback(
    async (tour: TourDefinition, force = false) => {
      if (activeDriver.current?.isActive()) return;
      const saved = progressRef.current.find((row) => row.tourId === tour.id);
      if (
        !force &&
        saved &&
        saved.version >= tour.version &&
        (saved.status === "completed" || saved.status === "skipped")
      ) {
        return;
      }

      const generation = (driveGeneration.current += 1);
      const resolved = await Promise.all(
        tour.steps.map(async (step) => {
          const selector = resolveStepAnchor(step);
          const element = await waitForTourable(selector, ANCHOR_WAIT_MS);
          return { step, selector, element };
        }),
      );
      if (generation !== driveGeneration.current) return;
      if (!resolved.some((item) => item.element)) {
        if (!isSingleTourMode() && readJourney()) advanceJourney();
        return;
      }

      let settled = false;
      const instance = driver({
        animate: true,
        smoothScroll: true,
        allowClose: true,
        allowScroll: true,
        skipMissingElement: true,
        waitForElement: ANCHOR_WAIT_MS,
        showProgress: true,
        progressText: "{{current}} of {{total}}",
        nextBtnText: "Next",
        prevBtnText: "Back",
        doneBtnText: "Finish",
        popoverClass: "novend-product-tour",
        overlayColor: "#0f172a",
        overlayOpacity: 0.55,
        stagePadding: 8,
        steps: resolved.map(({ step, selector, element }) => ({
          element: element ?? selector,
          data: { stepId: step.id },
          popover: {
            title: step.title,
            description: step.description,
            side: popoverSideForStep(step, element),
            align: "start",
          },
        })),
        onHighlightStarted: (element) => {
          if (element instanceof Element) scrollStepIntoView(element);
        },
        onPopoverRender: (popover) => {
          const footer = popover.footerButtons ?? popover.footer;
          if (!(footer instanceof HTMLElement)) return;
          injectSkipButton(footer, () => {
            const stepId =
              typeof instance.getActiveStep()?.data?.stepId === "string"
                ? String(instance.getActiveStep()?.data?.stepId)
                : undefined;
            settled = true;
            persist(tour, "skipped", stepId);
            if (!isSingleTourMode()) skipRemainingJourney(tour.id);
            else writeJourney(null);
            instance.destroy();
          });
        },
        onNextClick: (_element, step, options) => {
          const stepId = typeof step.data?.stepId === "string" ? step.data.stepId : undefined;
          if (options.driver.isLastStep()) {
            settled = true;
            persist(tour, "completed", stepId);
            options.driver.destroy();
            if (!isSingleTourMode()) advanceJourney();
            else writeJourney(null);
          } else {
            persist(tour, "in_progress", stepId);
            options.driver.moveNext();
          }
        },
        onCloseClick: (_element, step, options) => {
          const stepId = typeof step.data?.stepId === "string" ? step.data.stepId : undefined;
          settled = true;
          persist(tour, "skipped", stepId);
          if (!isSingleTourMode()) skipRemainingJourney(tour.id);
          else writeJourney(null);
          options.driver.destroy();
        },
        onDestroyed: (_element, step) => {
          if (!settled) {
            const stepId = typeof step.data?.stepId === "string" ? step.data.stepId : undefined;
            persist(tour, "skipped", stepId);
            if (!isSingleTourMode()) skipRemainingJourney(tour.id);
          }
          activeDriver.current = null;
          setActiveTourId(null);
        },
      });
      activeDriver.current = instance;
      setActiveTourId(tour.id);
      const resumeIndex =
        saved?.status === "in_progress" && saved.lastStepId
          ? Math.max(0, tour.steps.findIndex((step) => step.id === saved.lastStepId) + 1)
          : 0;
      persist(tour, "in_progress", tour.steps[resumeIndex]?.id);
      instance.drive(Math.min(resumeIndex, tour.steps.length - 1));
    },
    [advanceJourney, persist, skipRemainingJourney],
  );

  const startTour = useCallback(
    (tourId: TourId) => {
      const tour = getTourDefinition(tourId);
      if (!tour || !availableTours.some((item) => item.id === tourId)) return;
      setSingleTourMode(true);
      writeJourney(null);
      if (pathname !== tour.path && !pathname.startsWith(`${tour.path}/`)) {
        window.sessionStorage.setItem(PENDING_TOUR_KEY, tourId);
        router.push(tour.path);
        return;
      }
      window.setTimeout(() => {
        void driveTour(tour, true);
      }, 250);
    },
    [availableTours, driveTour, pathname, router],
  );

  const restartTour = useCallback(
    (tourId: TourId) => {
      const tour = getTourDefinition(tourId);
      if (!tour || !identityKey) return;
      const next = progressRef.current.filter((row) => row.tourId !== tourId);
      progressRef.current = next;
      setProgress(next);
      writeProgress(next);
      if (online) void restartOwn({ tourId, version: tour.version });
      startTour(tourId);
    },
    [identityKey, online, restartOwn, startTour],
  );

  useEffect(() => {
    if (!enabled || !identityKey || !hydrated || attemptedPath.current === pathname) return;

    // Offline shells keep saved progress but must not auto-start onboarding
    // every time the till opens without a live session (felt like “tours always”).
    if (!online) return;
    // Wait for cloud progress before deciding “never seen” — otherwise a slow
    // listOwn query looks empty and restarts the walkthrough after every login.
    if (typedLiveProgress === undefined && !initialProgressRef.current?.length) return;

    attemptedPath.current = pathname;

    const pending = window.sessionStorage.getItem(PENDING_TOUR_KEY) as TourId | null;
    const pendingTour = pending ? getTourDefinition(pending) : undefined;
    if (
      pendingTour &&
      (pathname === pendingTour.path || pathname.startsWith(`${pendingTour.path}/`))
    ) {
      window.sessionStorage.removeItem(PENDING_TOUR_KEY);
      const timer = window.setTimeout(() => {
        void driveTour(pendingTour, true);
      }, ROUTE_SETTLE_MS);
      return () => window.clearTimeout(timer);
    }

    if (!hasTourProgress(progressRef.current, availableTours) && !isSingleTourMode()) {
      const onPlatformRoute = pathname.startsWith("/platform");
      // While the Super Admin console is open, only the platform walkthrough may
      // auto-start. Dual-role admins must not be yanked to /dashboard for "shell".
      const queue =
        onPlatformRoute && isPlatformAdmin
          ? onboardingQueue(null, true)
          : onboardingQueue(role, isPlatformAdmin);
      const [firstId, ...rest] = queue;
      const first = firstId ? getTourDefinition(firstId) : undefined;
      if (first) {
        writeJourney({ remaining: rest });
        if (pathname === first.path || pathname.startsWith(`${first.path}/`)) {
          const timer = window.setTimeout(() => {
            void driveTour(first);
          }, 1200);
          return () => window.clearTimeout(timer);
        }
        // Never navigate a platform session onto a tenant POS path.
        if (onPlatformRoute && isPlatformAdmin && !first.path.startsWith("/platform")) {
          return;
        }
        window.sessionStorage.setItem(PENDING_TOUR_KEY, first.id);
        router.push(first.path);
        return;
      }
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
    const timer = window.setTimeout(() => {
      void driveTour(candidate);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [
    availableTours,
    driveTour,
    enabled,
    hydrated,
    identityKey,
    isPlatformAdmin,
    online,
    pathname,
    role,
    router,
    typedLiveProgress,
  ]);

  useEffect(
    () => () => {
      driveGeneration.current += 1;
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
