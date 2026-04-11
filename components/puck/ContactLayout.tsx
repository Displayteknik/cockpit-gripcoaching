"use client";

import { Phone, Mail, MapPin, Clock } from "lucide-react";

export interface ContactLayoutProps {
  showMap: boolean;
  mapEmbedUrl: string;
}

export function ContactLayout({ showMap = true, mapEmbedUrl }: ContactLayoutProps) {
  const defaultMapUrl =
    "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d1714.5!2d14.5!3d63.3!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zKrokomsporten+MTM!5e0!3m2!1ssv!2sse";

  return (
    <section className="py-16 md:py-20 bg-white">
      <div className="max-w-[1140px] mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Contact cards */}
          <div className="space-y-4">
            {[
              {
                icon: MapPin,
                title: "Besöksadress",
                content: "Krokomsporten 13\n835 95 Krokom",
              },
              {
                icon: Phone,
                title: "Telefon",
                content: "0640-103 50",
                href: "tel:+46640-10350",
              },
              {
                icon: Mail,
                title: "E-post",
                content: "info@krokomsporten.se",
                href: "mailto:info@krokomsporten.se",
              },
              {
                icon: Clock,
                title: "Öppettider",
                content: "Måndag–Fredag: 08:00–17:00\nLördag: Efter avtal\nSöndag: Stängt",
              },
            ].map((card, i) => (
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
                  {card.href ? (
                    <a
                      href={card.href}
                      className="text-sm text-brand-blue hover:underline"
                    >
                      {card.content}
                    </a>
                  ) : (
                    <p className="text-sm text-text-muted whitespace-pre-line">
                      {card.content}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Contact form */}
          <form
            name="contact"
            method="POST"
            data-netlify="true"
            className="bg-surface-light rounded-2xl p-8"
          >
            <input type="hidden" name="form-name" value="contact" />
            <h3 className="font-display text-xl font-bold text-text-primary mb-6">
              Skicka ett meddelande
            </h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-text-primary mb-1">
                  Namn
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-text-primary mb-1">
                  E-post
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label htmlFor="phone" className="block text-sm font-medium text-text-primary mb-1">
                  Telefon
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label htmlFor="interest" className="block text-sm font-medium text-text-primary mb-1">
                  Intresse
                </label>
                <select
                  id="interest"
                  name="interest"
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all text-sm"
                >
                  <option value="">Välj...</option>
                  <option value="bil">Begagnad bil</option>
                  <option value="atv">Fyrhjuling / UTV</option>
                  <option value="moped">Moped / Elmoped</option>
                  <option value="slapvagn">Släpvagn</option>
                  <option value="tradgard">Trädgårdsmaskin</option>
                  <option value="service">Service / Reparation</option>
                  <option value="annat">Annat</option>
                </select>
              </div>
              <div>
                <label htmlFor="message" className="block text-sm font-medium text-text-primary mb-1">
                  Meddelande
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={4}
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 outline-none transition-all text-sm resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-brand-blue hover:bg-brand-blue-dark text-white py-3.5 rounded-lg font-semibold transition-colors"
              >
                Skicka meddelande
              </button>
            </div>
          </form>
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
