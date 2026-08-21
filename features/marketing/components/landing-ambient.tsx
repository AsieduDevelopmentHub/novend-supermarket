import Image from "next/image";

const AMBIENT = [
  {
    src: "/marketing/commerce-till.jpg",
    className: "landing-ambient-img landing-ambient-img-a",
    alt: "",
  },
  {
    src: "/marketing/commerce-store.jpg",
    className: "landing-ambient-img landing-ambient-img-b",
    alt: "",
  },
  {
    src: "/marketing/commerce-warehouse.jpg",
    className: "landing-ambient-img landing-ambient-img-c",
    alt: "",
  },
] as const;

/** Soft commerce photography underlays — Vital-Go style, Novend subject matter. */
export function LandingAmbient({ variant = "light" }: { variant?: "light" | "dark" }) {
  return (
    <div className={`landing-ambient landing-ambient-${variant}`} aria-hidden>
      {AMBIENT.map((item) => (
        <div key={item.src} className={item.className}>
          <Image src={item.src} alt="" fill sizes="50vw" className="object-cover" priority={false} />
        </div>
      ))}
      <div className="landing-ambient-veil" />
    </div>
  );
}
