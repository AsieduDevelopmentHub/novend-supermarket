import {
  BarChart3,
  Boxes,
  Building2,
  FileBarChart,
  ScanBarcode,
  ShoppingCart,
} from "lucide-react";
import { landingCopy } from "@/features/marketing/content";

const ICONS = [ShoppingCart, Boxes, ScanBarcode, Building2, FileBarChart, BarChart3] as const;

/** Six premium feature cards with Candy Blue accent. */
export function LandingFeatures() {
  return (
    <section
      id="features"
      className="scroll-mt-24 border-t border-border bg-background px-4 py-20 sm:px-6 sm:py-28 lg:px-8"
    >
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="mx-auto max-w-2xl text-center">
          <p className="text-primary text-sm font-semibold tracking-wide">
            {landingCopy.features.eyebrow}
          </p>
          <h2 className="text-foreground mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {landingCopy.features.title}
          </h2>
          <p className="text-muted-foreground mt-4 text-base text-pretty sm:text-lg">
            {landingCopy.features.subtitle}
          </p>
        </div>

        <ul className="landing-perspective mt-12 grid gap-5 sm:mt-16 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
          {landingCopy.features.cards.map((card, index) => {
            const Icon = ICONS[index] ?? ShoppingCart;
            return (
              <li
                key={card.title}
                data-depth-card
                className="landing-feature-card landing-shadow-card border-border bg-card group rounded-[1.25rem] border p-6 transition-[box-shadow,transform] duration-300 hover:-translate-y-1 sm:p-7"
              >
                <div className="bg-primary/10 text-primary mb-4 flex h-11 w-11 items-center justify-center rounded-xl">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="text-foreground text-lg font-semibold tracking-tight">{card.title}</h3>
                <p className="text-muted-foreground mt-2 text-sm leading-relaxed">{card.detail}</p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
