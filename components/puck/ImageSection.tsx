import Image from "next/image";

export interface ImageSectionProps {
  imageUrl: string;
  alt: string;
  caption: string;
  fullWidth: boolean;
}

export function ImageSection({ imageUrl, alt, caption, fullWidth = false }: ImageSectionProps) {
  return (
    <section className={`py-8 ${fullWidth ? "" : "max-w-[1140px] mx-auto px-4"}`}>
      <div className={`relative overflow-hidden ${fullWidth ? "" : "rounded-2xl"}`}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={alt || ""}
            width={1400}
            height={600}
            className="w-full h-auto object-cover"
            sizes="100vw"
          />
        ) : (
          <div className="aspect-[21/9] bg-surface-light flex items-center justify-center text-text-light">
            Lägg till en bild
          </div>
        )}
      </div>
      {caption && (
        <p className="text-center text-sm text-text-muted mt-3 max-w-[1140px] mx-auto px-4">
          {caption}
        </p>
      )}
    </section>
  );
}
