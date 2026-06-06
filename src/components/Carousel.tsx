import { useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Carousel({
  images,
  height = "h-64 sm:h-80",
}: {
  images: { url: string; caption?: string | null }[];
  height?: string;
}) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "center", containScroll: "trimSnaps" },
    [Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })]
  );
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSel = () => setIdx(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSel);
    onSel();
    return () => { emblaApi.off("select", onSel); };
  }, [emblaApi]);

  if (!images || images.length === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/50 shadow-soft">
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {images.map((g, i) => (
            <div key={i} className="min-w-0 shrink-0 grow-0 basis-full relative">
              <img
                src={g.url}
                alt={g.caption ?? ""}
                className={`${height} w-full object-cover`}
                draggable={false}
              />
              {g.caption && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-sm text-white">
                  {g.caption}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      {images.length > 1 && (
        <>
          <button
            type="button"
            aria-label="prev"
            onClick={() => emblaApi?.scrollPrev()}
            className="absolute start-2 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-background/85 backdrop-blur hover:bg-background shadow-soft transition"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="next"
            onClick={() => emblaApi?.scrollNext()}
            className="absolute end-2 top-1/2 -translate-y-1/2 grid h-10 w-10 place-items-center rounded-full bg-background/85 backdrop-blur hover:bg-background shadow-soft transition"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
            {images.map((_, i) => (
              <button
                key={i}
                aria-label={`go to ${i + 1}`}
                onClick={() => emblaApi?.scrollTo(i)}
                className={`h-2 rounded-full transition-all ${i === idx ? "w-8 bg-primary" : "w-2 bg-background/70"}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
