import Image from "next/image";

export interface PartnerLogosProps {
  title: string;
  logos: { name: string; imageUrl: string; url: string }[];
}

export function PartnerLogos({ title, logos }: PartnerLogosProps) {
  return (
    <section className="py-16 md:py-20 bg-surface-light">
      <div className="max-w-[1140px] mx-auto px-4">
        {title && (
          <h2 className="font-display text-2xl md:text-3xl font-bold text-text-primary text-center mb-12">
            {title}
          </h2>
        )}
        <div className="flex flex-wrap justify-center items-center gap-8 md:gap-14">
          {logos?.map((logo, i) => (
            <a
              key={i}
              href={logo.url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300"
              title={logo.name}
            >
              {logo.imageUrl ? (
                <Image
                  src={logo.imageUrl}
                  alt={logo.name}
                  width={120}
                  height={48}
                  className="h-10 md:h-12 w-auto object-contain"
                />
              ) : (
                <span className="text-sm font-semibold text-text-muted">
                  {logo.name}
                </span>
              )}
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
