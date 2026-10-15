"use client";

import { CheckCircle2, CircleHelp, Play, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FULLY_OFFLINE } from "@/constants/runtime";
import { useProductTours } from "@/features/tours/tour-provider";

export function HelpToursPanel() {
  const { availableTours, progress, startTour, restartTour } = useProductTours();

  return (
    <Card data-tour="settings-tours">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CircleHelp className="h-5 w-5" />
          Help &amp; product tours
        </CardTitle>
        {FULLY_OFFLINE ? (
          <p className="text-muted-foreground text-sm font-normal">
            Walkthroughs run on this till and save progress locally — no internet required.
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {availableTours.map((tour) => {
          const saved = progress.find((item) => item.tourId === tour.id);
          const finished = saved?.version === tour.version && saved.status === "completed";
          return (
            <div
              key={tour.id}
              className="border-border flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{tour.title}</p>
                  {finished ? (
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Completed
                    </Badge>
                  ) : saved?.status === "skipped" ? (
                    <Badge variant="secondary">Skipped</Badge>
                  ) : saved?.status === "in_progress" ? (
                    <Badge variant="outline">In progress</Badge>
                  ) : (
                    <Badge variant="outline">New</Badge>
                  )}
                </div>
                <p className="text-muted-foreground mt-1 text-sm">{tour.description}</p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={saved ? "outline" : "default"}
                onClick={() => (saved ? restartTour(tour.id) : startTour(tour.id))}
              >
                {saved ? (
                  <>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Replay
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start
                  </>
                )}
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
