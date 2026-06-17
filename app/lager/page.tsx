import { TopBar } from "@/components/layout/TopBar";
import { Navigation } from "@/components/layout/Navigation";
import { Footer } from "@/components/layout/Footer";
import { MobileStickyButton } from "@/components/layout/MobileStickyButton";
import { PageHeader } from "@/components/puck/PageHeader";
import { CTASection } from "@/components/puck/CTASection";
import { BlocketFeed } from "@/components/BlocketFeed";

export default function LagerPage() {
  return (
    <>
      <TopBar />
      <Navigation />
      <main className="flex-1">
        <PageHeader
          title="Hela lagret"
          subtitle="Alla våra fordon, direkt från lagret och alltid uppdaterat."
          variant="dark"
        />
        {/* Hela feeden (/cars). Blockets widget har egna filter (nya/begagnade, märke, pris). */}
        <BlocketFeed />
        <CTASection
          title="Hittar du inte rätt?"
          subtitle="Ring oss så hjälper vi dig"
          showPhone={true}
          showEmail={true}
          variant="blue"
        />
      </main>
      <Footer />
      <MobileStickyButton />
    </>
  );
}
