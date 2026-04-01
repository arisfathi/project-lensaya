import { Facebook, Instagram, MessageCircle, Music2, Phone } from "lucide-react";
import { Avatar } from "../../../components/ui/Avatar";
import { toFacebookUrl, toInstagramUrl, toTiktokUrl, toWhatsAppUrl } from "../utils";
import type { PublicProfile } from "../types";

type ContactSectionProps = {
  profile: PublicProfile | null;
  avatarImage: string;
  selectedService: string;
  selectedPackageId?: string;
  themeColor: string;
  themeColorSoft: string;
  onTrackEvent: (payload: {
    eventType: "PROFILE_CLICK" | "WHATSAPP_CLICK";
    serviceId?: string;
    packageId?: string;
    metadata?: Record<string, unknown>;
  }) => void;
};

export function ContactSection({
  profile,
  avatarImage,
  selectedService,
  selectedPackageId,
  themeColor,
  themeColorSoft,
  onTrackEvent,
}: ContactSectionProps) {
  const instagramUrl = toInstagramUrl(profile?.socialLinks.instagram);
  const facebookUrl = toFacebookUrl(profile?.socialLinks.facebook);
  const tiktokUrl = toTiktokUrl(profile?.socialLinks.tiktok);
  const whatsappUrl = toWhatsAppUrl(profile?.whatsappNumber, "Hi, I would like to enquire about your photography services.");

  return (
    <section id="contact" className="py-12 sm:py-16 bg-[var(--theme-section-bg)]">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-[var(--theme-color-border)] p-8 sm:p-12">
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <Avatar
              src={avatarImage || null}
              name={profile?.studioName || "Photographer"}
              size={128}
              className="flex-shrink-0"
              imageClassName="border-4 border-[var(--theme-color-soft)]"
            />

            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">{profile?.studioName || "Photographer"}</h3>
              <p className="text-slate-600 mb-6">{profile?.bio || "Professional photographer profile on Lensaya."}</p>

              <div className="flex flex-wrap justify-center sm:justify-start gap-3">
                {instagramUrl ? (
                  <a
                    href={instagramUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      onTrackEvent({
                        eventType: "PROFILE_CLICK",
                        serviceId: selectedService || undefined,
                        metadata: { origin: "contact_instagram" },
                      })
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-pink-50 text-pink-600 rounded-lg hover:bg-pink-100 transition-colors"
                  >
                    <Instagram className="w-5 h-5" />
                    <span>Instagram</span>
                  </a>
                ) : null}
                {facebookUrl ? (
                  <a
                    href={facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      onTrackEvent({
                        eventType: "PROFILE_CLICK",
                        serviceId: selectedService || undefined,
                        metadata: { origin: "contact_facebook" },
                      })
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                  >
                    <Facebook className="w-5 h-5" />
                    <span>Facebook</span>
                  </a>
                ) : null}
                {tiktokUrl ? (
                  <a
                    href={tiktokUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() =>
                      onTrackEvent({
                        eventType: "PROFILE_CLICK",
                        serviceId: selectedService || undefined,
                        metadata: { origin: "contact_tiktok" },
                      })
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-800 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    <Music2 className="w-5 h-5" />
                    <span>TikTok</span>
                  </a>
                ) : null}
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    onTrackEvent({
                      eventType: "WHATSAPP_CLICK",
                      serviceId: selectedService || undefined,
                      packageId: selectedPackageId,
                      metadata: { origin: "contact_whatsapp" },
                    })
                  }
                  className="flex items-center gap-2 px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span>WhatsApp</span>
                </a>
                {profile?.phone ? (
                  <a
                    href={`tel:${profile.phone}`}
                    onClick={() =>
                      onTrackEvent({
                        eventType: "PROFILE_CLICK",
                        serviceId: selectedService || undefined,
                        metadata: { origin: "contact_phone" },
                      })
                    }
                    className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
                    style={{ backgroundColor: themeColorSoft, color: themeColor }}
                  >
                    <Phone className="w-5 h-5" />
                    <span>Call</span>
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
