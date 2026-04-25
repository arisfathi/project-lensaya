import { useEffect, useMemo, useState } from 'react';
import { Check, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { publicApi } from '../lib/api';
import { formatCurrencyAmount } from '../lib/currency';
import { buildPlanHighlightsFromLimits } from '../lib/pricingLimits';
import { usePricingContent } from '../hooks/usePricingContent';
import { resolvePlanCopy, resolvePricingSectionCopy } from '../lib/pricingContent';

type BillingPlanId = 'FREE' | 'PRO' | 'STUDIO';

type BillingPlan = {
  id: BillingPlanId;
  name: string;
  displayName?: string;
  tagline?: string | null;
  subtitle?: string | null;
  badgeText?: string | null;
  ctaText?: string | null;
  monthlyPriceDisplay?: string | null;
  yearlyPriceDisplay?: string | null;
  sortOrder?: number;
  isVisible?: boolean;
  isActive?: boolean;
  isMostPopular?: boolean;
  price: number;
  monthlyPrice?: number;
  pricing?: {
    monthly: number;
    yearly: number;
  };
  currency: string;
  trialDays?: number;
  limits: Record<string, number | boolean>;
};

type PricingCard = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  priceLabel: string;
  period: string;
  features: string[];
  highlighted: boolean;
  cta: string;
  note: string;
  badgeText?: string | null;
};

const planOrder: BillingPlanId[] = ['FREE', 'PRO', 'STUDIO'];

export function Pricing() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pricingContent = usePricingContent();

  useEffect(() => {
    let mounted = true;

    const loadPlans = async () => {
      setLoading(true);
      try {
        const result = await publicApi.plans();
        if (!mounted) return;

        const ordered = result.plans
          .slice()
          .filter((plan) => plan.isVisible !== false && plan.isActive !== false)
          .sort((a, b) => {
            const aSort = Number(a.sortOrder ?? planOrder.indexOf(a.id as BillingPlanId));
            const bSort = Number(b.sortOrder ?? planOrder.indexOf(b.id as BillingPlanId));
            return aSort - bSort;
          });

        setPlans(ordered as BillingPlan[]);
        setErrorMessage(null);
      } catch {
        if (!mounted) return;
        setPlans([]);
        setErrorMessage('Unable to load subscriptions plan right now.');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadPlans();

    return () => {
      mounted = false;
    };
  }, []);

  const cards = useMemo<PricingCard[]>(() => {
    if (loading) {
      return Array.from({ length: 3 }, (_, index) => ({
        id: `loading-${index}`,
        name: 'Loading',
        tagline: 'Loading...',
        description: 'Loading pricing details...',
        priceLabel: '...',
        period: 'per month',
        features: ['Loading plan details', 'Loading limits', 'Loading features'],
        highlighted: index === 1,
        cta: 'View Plans',
        note: 'Loading pricing details...',
      }));
    }

    return plans.map((plan) => {
      const monthlyPrice = Number(plan.pricing?.monthly ?? plan.monthlyPrice ?? plan.price ?? 0);
      const copy = resolvePlanCopy(plan);

      return {
        id: plan.id,
        name: plan.displayName || plan.name,
        tagline: copy.tagline,
        description: copy.description,
        priceLabel: formatCurrencyAmount(monthlyPrice, plan.currency),
        period: plan.id === 'FREE' ? 'forever' : 'per month',
        features: buildPlanHighlightsFromLimits(plan),
        highlighted: Boolean(plan.isMostPopular ?? plan.id === 'PRO'),
        cta: copy.cta,
        note:
          plan.id === 'FREE'
            ? 'No credit card required'
            : plan.trialDays && plan.trialDays > 0
              ? `${plan.trialDays}-day trial available`
              : 'Upgrade when you are ready',
        badgeText: copy.badge,
      };
    });
  }, [loading, plans]);

  const sectionCopy = useMemo(() => resolvePricingSectionCopy(pricingContent), [pricingContent]);

  return (
    <section id="pricing" className="scroll-mt-24 bg-cyan-50 py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center sm:mb-16">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-500">Pricing</p>
          <h2 className="mb-6 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">{sectionCopy.title}</h2>
          <p className="mx-auto max-w-3xl text-lg text-slate-600 sm:text-xl">
            {sectionCopy.subtitle}
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3 sm:gap-8">
          {cards.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border-2 p-8 transition-all ${
                plan.highlighted
                  ? 'z-10 scale-105 border-cyan-500 bg-white shadow-2xl'
                  : 'border-gray-200 bg-white hover:border-cyan-200 hover:shadow-lg'
              }`}
            >
              <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                <div
                  className={`flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold shadow-sm ${
                    plan.highlighted
                      ? 'bg-linear-to-r from-cyan-500 to-cyan-600 text-white shadow-lg'
                      : 'border border-cyan-200 bg-cyan-50 text-cyan-700'
                  }`}
                >
                  {plan.highlighted ? <Zap className="h-4 w-4" /> : null}
                  {plan.badgeText}
                </div>
              </div>

              <div className="mb-6">
                <h3 className="mb-2 text-2xl font-bold text-slate-900">{plan.name}</h3>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-cyan-700">{plan.tagline}</p>
                <p className="mb-4 text-sm text-slate-600">{plan.description}</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-slate-900 sm:text-5xl">{plan.priceLabel}</span>
                  <span className="text-slate-600">/ {plan.period}</span>
                </div>
                <p className="mt-3 text-sm text-slate-500">{plan.note}</p>
              </div>

              <Link
                to={plan.id === 'FREE' ? '/signup' : '/pricing'}
                className={`mb-6 block w-full rounded-lg py-3.5 text-center font-semibold transition-all ${
                  plan.highlighted
                    ? 'bg-cyan-500 text-white shadow-lg shadow-cyan-500/30 hover:bg-cyan-600'
                    : 'bg-gray-100 text-slate-900 hover:bg-gray-200'
                }`}
              >
                {plan.cta}
              </Link>

              <div className="space-y-3 border-t border-gray-200 pt-6">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-cyan-500" />
                    <span className="text-sm text-slate-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-slate-600">
            Need the full comparison or yearly billing details?{' '}
            <Link to="/pricing" className="font-medium text-cyan-500 transition-colors hover:text-cyan-600">
              See full pricing {'->'}
            </Link>
          </p>
          {!loading && errorMessage ? <p className="mt-3 text-sm text-red-600">{errorMessage}</p> : null}
        </div>
      </div>
    </section>
  );
}

export default Pricing;








