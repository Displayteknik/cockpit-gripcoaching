export interface RichTextProps {
  content: string;
  maxWidth: "narrow" | "medium" | "wide";
  align: "left" | "center";
}

export function RichText({ content, maxWidth = "medium", align = "left" }: RichTextProps) {
  const widthClass =
    maxWidth === "narrow"
      ? "max-w-[640px]"
      : maxWidth === "wide"
      ? "max-w-[1140px]"
      : "max-w-[800px]";

  return (
    <section className="py-10 md:py-14">
      <div className={`${widthClass} mx-auto px-4 ${align === "center" ? "text-center" : ""}`}>
        <div
          className="prose prose-lg max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-brand-blue prose-a:no-underline hover:prose-a:underline"
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </section>
  );
}
