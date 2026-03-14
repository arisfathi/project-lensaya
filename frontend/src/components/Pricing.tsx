import { useEffect, useMemo, useState } from 'react';
import { Check, Zap } from 'lucide-react';
import { Link } from 'react-router-dom';
import { billingApi, getApiErrorMessage } from '../lib/api';

type BillingPlanId = 'FREE' | 'PRO' | 'STUDIO';

type BillingPlan = {
  id: BillingPlanId;
  name: string;
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
  description: string;
  priceLabel: string;
  period: string;
  features: string[];
  highlighted: boolean;
  cta: string;
  note: string;
};

const planOrder: BillingPlanId[] = ['FREE', 'PRO', 'STUDIO'];
const planCopy: Record<BillingPlanId, { description: string; cta: string }> = {
  FREE: {
    description: 'Perfect for getting started',
    cta: 'Get Started Free',
  },
  PRO: {
    description: 'For professional photographers',
    cta: 'Start Pro',
  },
  STUDIO: {
    description: 'For high-volume studios',
    cta: 'See Studio',
  },
};

const resolveLimitValue = (plan: BillingPlan, keys: string[]) => {
  for (const key of keys) {
    if (key in plan.limits) {
      return plan.limits[key];
    }
  }
  return null;
};

const formatLimitValue = (value: number | boolean | null, fallback: string) => {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value ? 'Included' : 'Not included';
  if (value < 0) return 'Unlimited';
  return `${value}`;
};

const formatPrice = (price: number, currency = 'USD') => {
  try {
    const hasDecimals = !Number.isInteger(price);
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: hasDecimals ? 2 : 0,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return '$' + price;
  }
};

const buildHighlights = (plan: BillingPlan) => [
  `${formatLimitValue(resolveLimitValue(plan, ['portfolioPhotos', 'portfolioImages']), 'Portfolio')} portfolio images`,
  `${formatLimitValue(resolveLimitValue(plan, ['services']), 'Core')} services`,
  `${formatLimitValue(resolveLimitValue(plan, ['packagesPerService', 'packages']), 'Flexible')} packages per service`,
  plan.id === 'FREE'
    ? 'Lensaya subdomain included'
    : formatLimitValue(resolveLimitValue(plan, ['customDomain']), 'Included') === 'Included'
      ? 'Custom domain included'
      : 'Lensaya subdomain included',
  plan.id === 'FREE'
    ? 'Essential analytics'
    : formatLimitValue(resolveLimitValue(plan, ['analyticsTools']), 'Included') === 'Included'
      ? 'Advanced analytics'
      : 'Essential analytics',
];

export function Pricing() {
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadPlans = async () => {
      setLoading(true);
      try {
        const result = await billingApi.plans();
        if (!mounted) return;

        const ordered = result.plans
          .slice()
          .sort((a, b) => planOrder.indexOf(a.id as BillingPlanId) - planOrder.indexOf(b.id as BillingPlanId));

        setPlans(ordered as BillingPlan[]);
        setErrorMessage(null);
      } catch (error) {
        if (!mounted) return;
        setErrorMessage(getApiErrorMessage(error, 'Unable to load pricing right now.'));
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

      return {
        id: plan.id,
        name: plan.name,
        description: planCopy[plan.id].description,
        priceLabel: formatPrice(monthlyPrice, plan.currency),
        period: plan.id === 'FREE' ? 'forever' : 'per month',
        features: buildHighlights(plan),
        highlighted: plan.id === 'PRO',
        cta: planCopy[plan.id].cta,
        note:
          plan.id === 'FREE'
            ? 'No credit card required'
            : plan.trialDays && plan.trialDays > 0
              ? `${plan.trialDays}-day trial available`
              : 'Upgrade when you are ready',
      };
    });
  }, [loading, plans]);

  return (
    <section id="pricing" className="scroll-mt-24 bg-cyan-50 py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-12 text-center sm:mb-16">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-cyan-500">Pricing</p>
          <h2 className="mb-6 text-3xl font-bold text-slate-900 sm:text-4xl lg:text-5xl">
            Plans for every photographer
          </h2>
          <p className="mx-auto max-w-3xl text-lg text-slate-600 sm:text-xl">
            Start free and upgrade as you grow. All plans include the core Lensaya portfolio experience.
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
              {plan.highlighted ? (
                <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
                  <div className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-1.5 text-sm font-semibold text-white shadow-lg">
                    <Zap className="h-4 w-4" />
                    Most Popular
                  </div>
                </div>
              ) : null}

              <div className="mb-6">
                <h3 className="mb-2 text-2xl font-bold text-slate-900">{plan.name}</h3>
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
                    <Check className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-500" />
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
