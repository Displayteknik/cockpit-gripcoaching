"use client";

import { Phone, Mail, MapPin, Clock } from "lucide-react";
import { CONTACT } from "@/lib/contact";
import { LeadForm } from "@/components/ui/LeadForm";

export interface ContactLayoutProps {
  showMap: boolean;
  mapEmbedUrl: string;
}

export function ContactLayout({ showMap = true, mapEmbedUrl }: ContactLayoutProps) {
  const defaultMapUrl =
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1714.5!2d14.5!3d63.3!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zKrokomsporten+MTM!5e0!3m2!1ssv!2sse";

  const cards = [
    { icon: MapPin, title: "Besöksadress", content: `${CONTACT.address1}\n${CONTACT.address2}` },
    { icon: Phone, title: "Telefon", content: CONTACT.phoneDisplay, href: CONTACT.phoneHref },
    { icon: Mail, title: "E-post", content: CONTACT.emailDisplay, href: CONTACT.emailHref },
    {
      icon: Clock,
      title: "Öppettider",
      content: "Måndag–Fredag: 08:00–17:00\nLördag: Efter avtal\nSöndag: Stängt",
    },
  ] as const;

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-[1140px] mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Contact cards */}
          <div className="space-y-4">
            {cards.map((card, i) => (
              <div
                key={i}
                className="flex gap-4 p-5 rounded-xl bg-surface-light hover:bg-surface-muted transition-colors"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center flex-shrink-0">
                  <card.icon className="w-5 h-5 text-brand-blue" />
                </div>
                <div>
                  <h3 className="font-display font-semibold text-text-primary mb-1">
                    {card.title}
                  </h3>
                  {"href" in card && card.href ? (
                    <a href={card.href} className="text-sm text-brand-blue hover:underline">
                      {card.content}
                    </a>
                  ) : (
                    <p className="text-sm text-text-muted whitespace-pre-line">{card.content}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Lead-formulär (ersätter det döda Netlify-formuläret) */}
          <LeadForm source="kontakt" />
        </div>

        {/* Map */}
        {showMap && (
          <div className="mt-12 rounded-2xl overflow-hidden border border-gray-100 shadow-sm">
            <iframe
              src={mapEmbedUrl || defaultMapUrl}
              width="100%"
              height="400"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="HM Motor Krokom karta"
            />
          </div>
        )}
      </div>
    </section>
  );
}
