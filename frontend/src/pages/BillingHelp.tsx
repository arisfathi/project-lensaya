import type { ComponentType } from "react";
import { CreditCard, Shield, Clock, RefreshCw, Calendar, AlertCircle, XCircle, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { Footer } from "../components/Footer";
import { Header } from "../components/Header";
import { buildAppUrl } from "../lib/platform";
import { useSeoMeta } from "../lib/seo";

type FaqItem = { question: string; answer: string };
type Section = { title: string; description: string; icon: ComponentType<{ className?: string }>; faqs: FaqItem[] };

const sections: Section[] = [
  {
    title: "Billing basics",
    description: "How billing works on Lensaya",
    icon: CreditCard,
    faqs: [
      {
        question: "How does billing work?",
        answer:
          "Lensaya uses Stripe for secure payment processing. When you subscribe to a paid plan, you’ll be charged automatically at the start of each billing period (monthly or yearly). We never store your full card details.",
      },
      {
        question: "What payment methods do you accept?",
        answer:
          "We accept major credit and debit cards (Visa, Mastercard, American Express, Discover). All payments are processed through Stripe.",
      },
      {
        question: "Can I get a receipt or invoice?",
        answer:
          "Yes. Receipts and invoices are available in your billing center and Stripe portal after each successful payment.",
      },
    ],
  },
  {
    title: "Free trials",
    description: "Everything about trial periods",
    icon: Clock,
    faqs: [
      {
        question: "How does the free trial work?",
        answer:
          "Paid plans can include a free trial period. During your trial you’ll have full access to the plan’s features. You can cancel anytime during the trial and you won’t be charged.",
      },
      {
        question: "What happens when my trial ends?",
        answer:
          "If you have an active payment method, your subscription will continue automatically. If not, your account may downgrade to the Free plan until you add a payment method.",
      },
    ],
  },
  {
    title: "Changing plans",
    description: "Upgrades, downgrades, and changes",
    icon: RefreshCw,
    faqs: [
      {
        question: "Can I change my plan?",
        answer:
          "Yes. You can upgrade or downgrade from your dashboard at any time. Upgrades typically apply immediately after successful payment, while downgrades usually take effect at the end of your current billing period.",
      },
      {
        question: "Do you prorate upgrades?",
        answer:
          "When supported, upgrades charge the prorated difference so you only pay for the time remaining in the billing cycle. The exact behavior depends on your subscription configuration in Stripe.",
      },
    ],
  },
  {
    title: "Cancellations & refunds",
    description: "Cancel anytime",
    icon: XCircle,
    faqs: [
      {
        question: "Can I cancel at any time?",
        answer:
          "Yes. You can cancel from your billing center. If you cancel at period end, your plan stays active until your current billing period ends.",
      },
      {
        question: "Do you offer refunds?",
        answer:
          "Refund policies depend on your subscription terms. If you believe you were charged in error, contact support and we’ll help investigate.",
      },
    ],
  },
  {
    title: "Payment issues",
    description: "Troubleshooting failed payments",
    icon: AlertCircle,
    faqs: [
      {
        question: "What happens if my payment fails?",
        answer:
          "If a payment fails, Stripe may retry automatically. During this time your account may show a Past Due status. Update your payment method in the billing portal to restore normal billing.",
      },
    ],
  },
  {
    title: "Billing cycles",
    description: "Monthly vs yearly billing",
    icon: Calendar,
    faqs: [
      {
        question: "What’s the difference between monthly and yearly billing?",
        answer:
          "Monthly billing charges every month, while yearly billing charges once per year. Annual plans usually include a discount compared to monthly billing.",
      },
    ],
  },
  {
    title: "Security & privacy",
    description: "How we protect your information",
    icon: Shield,
    faqs: [
      {
        question: "Is my payment information secure?",
        answer:
          "Yes. Stripe is a PCI-certified payment processor. Lensaya does not store your full card number — Stripe securely handles card details.",
      },
      {
        question: "Do you store my credit card number?",
        answer:
          "No. We only store basic subscription metadata (plan, status, renewal dates) for product access control and billing state.",
      },
    ],
  },
];

function FaqDetails({ item }: { item: FaqItem }) {
  return (
    <details className="group rounded-2xl border border-slate-200/70 bg-white/90 px-5 py-4 shadow-[0_18px_50px_rgba(15,23,42,0.05)]">
      <summary className="cursor-pointer list-none select-none text-sm font-semibold text-slate-900">
        <span className="flex items-center justify-between gap-4">
          {item.question}
          <span className="text-slate-400 transition-transform group-open:rotate-180">⌄</span>
        </span>
      </summary>
      <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
    </details>
  );
}

export default function BillingHelp() {
  useSeoMeta({
    title: "Billing & Subscriptions | Lensaya",
    description: "Everything you need to know about billing, trials, invoices, and subscription changes on Lensaya.",
    canonicalUrl: buildAppUrl("/help/billing"),
  });

  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="brand-shell">
        <section className="mx-auto max-w-7xl px-4 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-16 lg:px-8">
          <div className="brand-panel relative overflow-hidden rounded-[32px] border border-white/70 p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] sm:p-10 lg:p-12">
            <div className="absolute right-[-8%] top-[-18%] h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl" />
            <div className="absolute bottom-[-20%] left-[-10%] h-72 w-72 rounded-full bg-sky-400/10 blur-3xl" />

            <div className="relative max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                <CreditCard className="h-3.5 w-3.5" />
                Billing & subscriptions
              </div>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Billing help, simplified
              </h1>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
                Find answers for trials, plan changes, invoices, and payment issues.
              </p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/dashboard/transactions"
                  className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-cyan-500 to-sky-500 px-4 py-2 text-white shadow-sm transition-all hover:from-cyan-400 hover:to-sky-400 hover:shadow-md"
                >
                  Open Billing Center
                </Link>
                <a
                  href="mailto:support@lensaya.com"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  <Mail className="h-4 w-4" />
                  Contact support
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-14 sm:px-6 lg:px-8">
          <div className="space-y-10">
            {sections.map((section) => {
              const Icon = section.icon;
              return (
                <div key={section.title} className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-cyan-100 bg-cyan-50">
                      <Icon className="h-5 w-5 text-cyan-700" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-950">{section.title}</h2>
                      <p className="mt-1 text-sm text-slate-600">{section.description}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {section.faqs.map((faq) => (
                      <FaqDetails key={faq.question} item={faq} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-[24px] border border-slate-200/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)]">
            <h3 className="text-lg font-semibold text-slate-900">Looking for more help articles?</h3>
            <p className="mt-1 text-sm text-slate-600">
              Browse the full Help Center for onboarding, portfolio setup, and workflow guidance.
            </p>
            <div className="mt-4">
              <Link to="/help-center" className="text-sm font-semibold text-cyan-700 hover:text-cyan-800">
                Go to Help Center →
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
