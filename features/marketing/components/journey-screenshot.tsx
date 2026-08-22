import Image from "next/image";

/** Pixel-sharp product screenshot — local PNGs at native 1920×1080, no crop or 3D blur. */
export function JourneyScreenshot({
  alt,
  src,
  priority = false,
  className = "h-full w-full object-contain object-left-top",
}: {
  alt: string;
  src: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      width={1920}
      height={1080}
      quality={100}
      unoptimized
      priority={priority}
      className={className}
      sizes="(max-width: 1024px) 100vw, 640px"
      draggable={false}
    />
  );
}
