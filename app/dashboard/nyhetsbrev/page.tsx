import NewsletterMaker from "@/components/NewsletterMaker";

export const dynamic = "force-dynamic";

// Admin-vy: Nyhetsbrev-modulen. Grindas av proxy (admin-session). Tenant-låst i API:erna.
export default function NyhetsbrevPage() {
  return (
    <div className="max-w-6xl">
      <NewsletterMaker />
    </div>
  );
}
