import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';
import { Check, AlertCircle, Zap, X } from 'lucide-react';

interface PlanDef {
  tier: string;
  name: string;
  monthly: number;
  annual: number;
  tokens: string;
  tokensEquiv: string;
  highlight?: boolean;
  features: string[];
}

const PLANS: PlanDef[] = [
  {
    tier: 'pro',
    name: 'Pro',
    monthly: 15,
    annual: 150,
    tokens: '500K',
    tokensEquiv: '~100 AI chats, 50 risk scans, or 25 reports/mo',
    features: [
      'Unlimited projects',
      'Mjuzi AI assistant (500K tokens/mo)',
      'Gantt charts with dependencies & critical path',
      'Sprint/Agile + Kanban boards',
      'RAID management',
      'All export formats (CSV, PDF, XML)',
      'API access',
    ],
  },
  {
    tier: 'business',
    name: 'Business',
    monthly: 35,
    annual: 350,
    tokens: '1.5M',
    tokensEquiv: '~300 AI chats, 150 risk scans, or 75 reports/mo',
    highlight: true,
    features: [
      'Everything in Pro, plus:',
      'AI tokens: 1.5M/mo (3x Pro)',
      'EVM dashboard & AI forecasting',
      'Monte Carlo simulation',
      'Resource management & workload heatmaps',
      'Custom report builder & scheduled delivery',
      'DAG workflow automation',
      'Stakeholder portal',
    ],
  },
  {
    tier: 'consultant',
    name: 'Consultant',
    monthly: 59,
    annual: 590,
    tokens: '3M',
    tokensEquiv: '~600 AI chats, 300 risk scans, or 150 reports/mo',
    features: [
      'Everything in Business, plus:',
      'AI tokens: 3M/mo (6x Pro)',
      'Cross-project intelligence',
      'AI task prioritization & auto-reschedule',
      'Meeting intelligence & voice recording',
      'NL project creation & query engine',
      'MCP integration',
      '5GB file storage',
    ],
  },
];

interface FeatureRow {
  feature: string;
  free: boolean | string;
  pro: boolean | string;
  business: boolean | string;
  consultant: boolean | string;
}

const COMPARISON: FeatureRow[] = [
  { feature: 'Projects', free: '3', pro: 'Unlimited', business: 'Unlimited', consultant: 'Unlimited' },
  { feature: 'AI tokens/month', free: '25K', pro: '500K', business: '1.5M', consultant: '3M' },
  { feature: 'Mjuzi AI Assistant', free: true, pro: true, business: true, consultant: true },
  { feature: 'Gantt Charts & Critical Path', free: true, pro: true, business: true, consultant: true },
  { feature: 'Kanban Boards', free: true, pro: true, business: true, consultant: true },
  { feature: 'Sprint / Agile Management', free: true, pro: true, business: true, consultant: true },
  { feature: 'RAID Management', free: true, pro: true, business: true, consultant: true },
  { feature: 'Export (CSV, PDF, XML)', free: false, pro: true, business: true, consultant: true },
  { feature: 'API Access', free: false, pro: true, business: true, consultant: true },
  { feature: 'EVM Dashboard & AI Forecasting', free: false, pro: false, business: true, consultant: true },
  { feature: 'Monte Carlo Simulation', free: false, pro: false, business: true, consultant: true },
  { feature: 'Resource Management & Heatmaps', free: false, pro: false, business: true, consultant: true },
  { feature: 'Custom Report Builder', free: false, pro: false, business: true, consultant: true },
  { feature: 'DAG Workflow Automation', free: false, pro: false, business: true, consultant: true },
  { feature: 'Stakeholder Portal', free: false, pro: false, business: true, consultant: true },
  { feature: 'Cross-Project Intelligence', free: false, pro: false, business: false, consultant: true },
  { feature: 'AI Auto-Reschedule', free: false, pro: false, business: false, consultant: true },
  { feature: 'Meeting Intelligence & Voice', free: false, pro: false, business: false, consultant: true },
  { feature: 'NL Query Engine', free: false, pro: false, business: false, consultant: true },
  { feature: 'MCP Integration', free: false, pro: false, business: false, consultant: true },
  { feature: 'File Storage', free: '100MB', pro: '1GB', business: '2GB', consultant: '5GB' },
  { feature: 'Token Top-Up Packs', free: false, pro: true, business: true, consultant: true },
];

export const PricingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentTier = user?.subscriptionTier || 'free';
  const isSubscribed = currentTier === 'consultant' || currentTier === 'pro' || currentTier === 'business';

  const handleSubscribe = async (tier: string) => {
    if (!isAuthenticated) {
      window.location.href = '/register';
      return;
    }
    setLoading(tier);
    setError(null);
    try {
      const { url } = await apiService.createCheckoutSession(billing, tier);
      window.location.href = url;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to start checkout. Please try again.';
      setError(msg);
      setLoading(null);
    }
  };

  const handleManageBilling = async () => {
    try {
      const { url } = await apiService.createPortalSession();
      window.location.href = url;
    } catch {
      // ignore
    }
  };

  const handleBuyTokens = async () => {
    if (!isAuthenticated) {
      window.location.href = '/register';
      return;
    }
    setLoading('topup');
    setError(null);
    try {
      const { url } = await apiService.createTopUpSession(1);
      window.location.href = url;
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.response?.data?.error || 'Failed to start checkout.';
      setError(msg);
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-800">
      {/* Navbar */}
      <nav className="border-b border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900 dark:text-white">Kovarti PM</span>
            </Link>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <Link to="/dashboard" className="text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg transition-colors">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="text-sm text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:text-white">Sign In</Link>
                  <Link to="/register" className="text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 px-4 py-2 rounded-lg transition-colors">
                    Start Free Trial
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Pricing */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Simple, transparent pricing</h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              14-day free trial on any plan. No credit card required.
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex items-center bg-gray-100 dark:bg-gray-700 rounded-full p-1">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
                  billing === 'monthly'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('annual')}
                className={`px-5 py-2 text-sm font-medium rounded-full transition-colors ${
                  billing === 'annual'
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                Annual
                <span className="ml-1.5 text-xs text-green-600 dark:text-green-400 font-semibold">Save 17%</span>
              </button>
            </div>
          </div>

          {error && (
            <div className="max-w-xl mx-auto mb-6 flex items-center gap-2 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Plan cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
            {PLANS.map((plan) => {
              const isCurrent = currentTier === plan.tier;
              const price = billing === 'monthly' ? plan.monthly : plan.annual;
              const perMonth = billing === 'annual' ? (plan.annual / 12).toFixed(2) : null;

              return (
                <div
                  key={plan.tier}
                  className={`relative rounded-2xl border-2 p-6 shadow-sm transition-all ${
                    plan.highlight
                      ? 'border-primary-500 shadow-xl shadow-primary-500/10'
                      : 'border-gray-200 dark:border-gray-700'
                  } bg-white dark:bg-gray-800`}
                >
                  {plan.highlight && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">{plan.name}</h2>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        ${price}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        /{billing === 'monthly' ? 'mo' : 'yr'}
                      </span>
                    </div>
                    {perMonth && (
                      <p className="text-xs text-green-600 dark:text-green-400 mt-1">~${perMonth}/mo</p>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      {plan.tokens} AI tokens/month
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {plan.tokensEquiv}
                    </p>
                  </div>

                  <div className="mb-6">
                    {isCurrent ? (
                      <button
                        onClick={handleManageBilling}
                        className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Current Plan
                      </button>
                    ) : (
                      <button
                        onClick={() => handleSubscribe(plan.tier)}
                        disabled={loading === plan.tier}
                        className={`w-full py-2.5 px-4 text-sm font-semibold rounded-lg transition-colors disabled:opacity-50 ${
                          plan.highlight
                            ? 'bg-primary-600 text-white hover:bg-primary-700'
                            : 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100'
                        }`}
                      >
                        {loading === plan.tier ? (
                          <span className="flex items-center justify-center">
                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                            Loading...
                          </span>
                        ) : isAuthenticated ? (
                          isSubscribed ? 'Switch Plan' : 'Subscribe'
                        ) : (
                          'Start Free Trial'
                        )}
                      </button>
                    )}
                  </div>

                  <ul className="space-y-2.5">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                        <Check className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          {/* Token top-up */}
          <div className="max-w-xl mx-auto">
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 border border-amber-200 dark:border-amber-800 rounded-2xl p-6 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Zap className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Need more AI tokens?</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Top up anytime. <strong>500K tokens for $5</strong> — added instantly to your balance.
              </p>
              <button
                onClick={handleBuyTokens}
                disabled={loading === 'topup'}
                className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-semibold rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-50"
              >
                {loading === 'topup' ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Buy Token Pack — $5
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Feature Comparison Matrix */}
          <div className="mt-20 mb-16">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-8">
              Compare plans
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b-2 border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 pr-4 font-semibold text-gray-900 dark:text-white">Feature</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-500 dark:text-gray-400 w-24">Free</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-900 dark:text-white w-24">Pro</th>
                    <th className="text-center py-3 px-3 font-semibold text-primary-600 dark:text-primary-400 w-24">Business</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-900 dark:text-white w-24">Consultant</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={row.feature} className={`border-b border-gray-100 dark:border-gray-700/50 ${i % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
                      <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{row.feature}</td>
                      {(['free', 'pro', 'business', 'consultant'] as const).map((tier) => {
                        const val = row[tier];
                        return (
                          <td key={tier} className="py-2.5 px-3 text-center">
                            {val === true ? (
                              <Check className="w-4 h-4 text-primary-500 mx-auto" />
                            ) : val === false ? (
                              <X className="w-4 h-4 text-gray-300 dark:text-gray-600 mx-auto" />
                            ) : (
                              <span className="text-gray-700 dark:text-gray-300 font-medium">{val}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Refund policy */}
          <div className="mt-12 text-center text-xs text-gray-400 dark:text-gray-500 space-y-1">
            <p>Monthly subscriptions are non-refundable. Cancel anytime.</p>
            <p>Annual subscriptions: pro-rated refund within 30 days, non-refundable after.</p>
            <p>Token top-ups are non-refundable and do not expire.</p>
            <p>Questions? <a href="mailto:support@kpbc.ca" className="text-primary-500 hover:underline">support@kpbc.ca</a></p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center space-x-6 text-sm text-gray-500 dark:text-gray-400">
            <Link to="/terms" className="hover:text-gray-900 dark:hover:text-white">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-gray-900 dark:hover:text-white">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
