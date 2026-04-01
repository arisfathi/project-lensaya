import { MessageCircle } from "lucide-react";
import type { RefObject } from "react";
import { formatDateLabel, formatPackagePrice, formatTimeLabel } from "../utils";
import type { BookingInquiryForm, PublicPackage } from "../types";

type BookingInquirySectionProps = {
  bookingInquirySectionRef: RefObject<HTMLElement | null>;
  selectedServiceName: string;
  selectedPackage: PublicPackage | null;
  selectedDate: string | null;
  bookingInquiryForm: BookingInquiryForm;
  bookingInquiryFeedback: { type: "success" | "error"; message: string } | null;
  bookingInquirySubmitting: boolean;
  onFieldChange: <K extends keyof BookingInquiryForm>(field: K, value: BookingInquiryForm[K]) => void;
  onSubmit: () => void;
};

export function BookingInquirySection({
  bookingInquirySectionRef,
  selectedServiceName,
  selectedPackage,
  selectedDate,
  bookingInquiryForm,
  bookingInquiryFeedback,
  bookingInquirySubmitting,
  onFieldChange,
  onSubmit,
}: BookingInquirySectionProps) {
  return (
    <section id="booking-inquiry" ref={bookingInquirySectionRef} className="py-12 sm:py-16 bg-[var(--theme-section-bg)]">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 mb-8 text-center">Booking Summary</h2>
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-sm border border-[var(--theme-color-border)] p-6 sm:p-8">
          <div className="space-y-4 mb-6">
            <div className="flex justify-between items-center pb-4 border-b border-[var(--theme-color-border)]">
              <span className="text-slate-600">Service:</span>
              <span className="font-semibold text-slate-900">{selectedServiceName || "Not selected"}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-[var(--theme-color-border)]">
              <span className="text-slate-600">Package:</span>
              <span className="font-semibold text-slate-900">{selectedPackage?.name || "Not selected"}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-[var(--theme-color-border)]">
              <span className="text-slate-600">Date:</span>
              <span className="font-semibold text-slate-900">{selectedDate ? formatDateLabel(selectedDate) : "Not selected"}</span>
            </div>
            <div className="flex justify-between items-center pb-4 border-b border-[var(--theme-color-border)]">
              <span className="text-slate-600">Preferred Time:</span>
              <span className="font-semibold text-slate-900">
                {bookingInquiryForm.preferredTime ? formatTimeLabel(bookingInquiryForm.preferredTime) : "Not selected"}
              </span>
            </div>
            {selectedPackage ? (
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Total:</span>
                <span className="text-2xl font-bold text-[var(--theme-color)]">{formatPackagePrice(selectedPackage)}</span>
              </div>
            ) : null}
          </div>
          <div className="border-t border-[var(--theme-color-border)] pt-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Details: </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label htmlFor="inquiry-name" className="block text-sm font-medium text-slate-700 mb-1">
                  Your Name
                </label>
                <input
                  id="inquiry-name"
                  type="text"
                  value={bookingInquiryForm.name}
                  onChange={(event) => onFieldChange("name", event.target.value)}
                  placeholder="Lensaya"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-color)] focus:border-[var(--theme-color)] outline-none transition-all"
                />
              </div>
              <div>
                <label htmlFor="inquiry-email" className="block text-sm font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  id="inquiry-email"
                  type="email"
                  value={bookingInquiryForm.email}
                  onChange={(event) => onFieldChange("email", event.target.value)}
                  placeholder="lensaya@example.com"
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-color)] focus:border-[var(--theme-color)] outline-none transition-all"
                />
              </div>
            </div>
            <div className="mb-4">
              <label htmlFor="inquiry-phone" className="block text-sm font-medium text-slate-700 mb-1">
                Phone Number
              </label>
              <input
                id="inquiry-phone"
                type="text"
                value={bookingInquiryForm.phone}
                onChange={(event) => onFieldChange("phone", event.target.value)}
                placeholder="+60123456789"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-color)] focus:border-[var(--theme-color)] outline-none transition-all"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="inquiry-time" className="block text-sm font-medium text-slate-700 mb-1">
                Preferred Time
              </label>
              <input
                id="inquiry-time"
                type="time"
                value={bookingInquiryForm.preferredTime}
                onChange={(event) => onFieldChange("preferredTime", event.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-color)] focus:border-[var(--theme-color)] outline-none transition-all"
              />
            </div>
            <div className="mb-4">
              <label htmlFor="inquiry-source" className="block text-sm font-medium text-slate-700 mb-1">
                Where did you hear about us?
              </label>
              <select
                id="inquiry-source"
                value={bookingInquiryForm.source}
                onChange={(event) => onFieldChange("source", event.target.value as BookingInquiryForm["source"])}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-color)] focus:border-[var(--theme-color)] outline-none transition-all"
                required
              >
                <option value="">Select one</option>
                <option value="WEBSITE">lensaya.com</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="FACEBOOK">Facebook</option>
                <option value="TIKTOK">TikTok</option>
                <option value="DIRECT">Direct</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="mb-5">
              <label htmlFor="inquiry-message" className="block text-sm font-medium text-slate-700 mb-1">
                Message (optional)
              </label>
              <textarea
                id="inquiry-message"
                rows={4}
                value={bookingInquiryForm.message}
                onChange={(event) => onFieldChange("message", event.target.value)}
                placeholder="Tell the photographer more about your event."
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--theme-color)] focus:border-[var(--theme-color)] outline-none transition-all resize-none"
              />
            </div>
            {bookingInquiryFeedback ? (
              <div
                className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                  bookingInquiryFeedback.type === "success"
                    ? "border-green-200 bg-green-50 text-green-700"
                    : "border-red-200 bg-red-50 text-red-700"
                }`}
              >
                {bookingInquiryFeedback.message}
              </div>
            ) : null}
            <button
              type="button"
              onClick={onSubmit}
              disabled={bookingInquirySubmitting}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-[var(--theme-color)] text-white rounded-lg hover:opacity-90 transition-opacity text-lg font-medium disabled:opacity-60"
            >
              <MessageCircle className="w-5 h-5" />
              {bookingInquirySubmitting ? "Submitting Inquiry..." : "Get Quote"}
            </button>
            <p className="mt-3 text-sm text-slate-600 text-center">
              After submitting, we will create a booking lead and open WhatsApp so you can continue with the photographer.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
