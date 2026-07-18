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
  storage: string;
  viewerInvites: string;
  highlight?: boolean;
  perSeat?: boolean;
  minSeats?: number;
  features: string[];
}

const PLANS: PlanDef[] = [
  {
    tier: 'trial',
    name: 'Free Trial',
    monthly: 0,
    annual: 0,
    tokens: '25K',
    tokensEquiv: 'Enough to explore all AI features',
    storage: '100MB',
    viewerInvites: '0',
    features: [
      'Up to 3 projects',
      '14-day full access',
      'Mjuzi AI assistant (25K tokens)',
      'Gantt, Kanban, Sprint boards',
      'RAID management',
      'No credit card required',
    ],
  },
  {
    tier: 'consultant',
    name: 'Consultant',
    monthly: 19,
    annual: 190,
    tokens: '500K',
    tokensEquiv: '~100 AI chats, 50 risk scans, or 25 reports/mo',
    storage: '1GB',
    viewerInvites: '5',
    features: [
      'Unlimited projects',
      'All PM features included',
      'Mjuzi AI assistant (500K tokens/mo)',
      'Gantt, Kanban, Sprint boards',
      'RAID management & risk scans',
      'All exports (CSV, PDF, XML)',
      'API access & integrations',
      '5 free viewer invites for clients',
    ],
  },
  {
    tier: 'sme',
    name: 'SME',
    monthly: 33,
    annual: 330,
    tokens: '500K',
    tokensEquiv: '500K AI tokens per seat, pooled across your team',
    storage: '5GB',
    viewerInvites: 'Unlimited',
    highlight: true,
    perSeat: true,
    minSeats: 3,
    features: [
      'Everything in Consultant, plus:',
      '500K AI tokens per seat (pooled)',
      '5GB file storage',
      'Unlimited viewer invites',
      'EVM dashboard & Monte Carlo',
      'Resource management & heatmaps',
      'Custom report builder',
      'DAG workflow automation',
    ],
  },
  {
    tier: 'enterprise',
    name: 'Enterprise',
    monthly: 79,
    annual: 790,
    tokens: '5M',
    tokensEquiv: '~1000 AI chats, 500 risk scans, or 250 reports/mo',
    storage: '10GB',
    viewerInvites: 'Unlimited',
    features: [
      'Everything in SME, plus:',
      'AI tokens: 5M/mo (10x Consultant)',
      '10GB file storage',
      'Unlimited viewer invites',
      'Cross-project intelligence',
      'AI auto-reschedule & prioritization',
      'Meeting intelligence & voice',
      'MCP integration',
    ],
  },
];

interface FeatureRow {
  feature: string;
  trial: boolean | string;
  consultant: boolean | string;
  sme: boolean | string;
  enterprise: boolean | string;
}

const COMPARISON: FeatureRow[] = [
  { feature: 'Projects', trial: '3', consultant: 'Unlimited', sme: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'AI tokens/month', trial: '25K', consultant: '500K', sme: '500K/seat', enterprise: '5M' },
  { feature: 'File Storage', trial: '100MB', consultant: '1GB', sme: '5GB', enterprise: '10GB' },
  { feature: 'Viewer Invites', trial: '0', consultant: '5', sme: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'Duration', trial: '14 days', consultant: 'Unlimited', sme: 'Unlimited', enterprise: 'Unlimited' },
  { feature: 'Mjuzi AI Assistant', trial: true, consultant: true, sme: true, enterprise: true },
  { feature: 'Gantt Charts & Critical Path', trial: true, consultant: true, sme: true, enterprise: true },
  { feature: 'Kanban Boards', trial: true, consultant: true, sme: true, enterprise: true },
  { feature: 'Sprint / Agile Management', trial: true, consultant: true, sme: true, enterprise: true },
  { feature: 'RAID Management', trial: true, consultant: true, sme: true, enterprise: true },
  { feature: 'Export (CSV, PDF, XML)', trial: false, consultant: true, sme: true, enterprise: true },
  { feature: 'API Access', trial: false, consultant: true, sme: true, enterprise: true },
  { feature: 'EVM Dashboard & AI Forecasting', trial: false, consultant: true, sme: true, enterprise: true },
  { feature: 'Monte Carlo Simulation', trial: false, consultant: true, sme: true, enterprise: true },
  { feature: 'Resource Management & Heatmaps', trial: false, consultant: true, sme: true, enterprise: true },
  { feature: 'Custom Report Builder', trial: false, consultant: true, sme: true, enterprise: true },
  { feature: 'DAG Workflow Automation', trial: false, consultant: true, sme: true, enterprise: true },
  { feature: 'Stakeholder Portal', trial: false, consultant: true, sme: true, enterprise: true },
  { feature: 'Cross-Project Intelligence', trial: false, consultant: true, sme: true, enterprise: true },
  { feature: 'AI Auto-Reschedule', trial: false, consultant: true, sme: true, enterprise: true },
  { feature: 'Meeting Intelligence & Voice', trial: false, consultant: true, sme: true, enterprise: true },
  { feature: 'NL Query Engine', trial: false, consultant: true, sme: true, enterprise: true },
  { feature: 'MCP Integration', trial: false, consultant: true, sme: true, enterprise: true },
  { feature: 'Token Top-Up Packs', trial: false, consultant: true, sme: true, enterprise: true },
];

export const PricingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [smeSeats, setSmeSeats] = useState(3);

  const currentTier = user?.subscriptionTier || 'trial';
  const isSubscribed = currentTier === 'consultant' || currentTier === 'sme' || currentTier === 'enterprise';

  const handleSubscribe = async (tier: string) => {
    if (!isAuthenticated) {
      window.location.href = '/register';
      return;
    }
    setLoading(tier);
    setError(null);
    try {
      const seats = tier === 'sme' ? smeSeats : undefined;
      const { url } = await apiService.createCheckoutSession(billing, tier, seats);
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
              14-day free trial. All paid plans include every feature.
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
            {PLANS.map((plan) => {
              const isCurrent = currentTier === plan.tier;
              const seats = plan.perSeat ? smeSeats : 1;
              const unitPrice = billing === 'monthly' ? plan.monthly : plan.annual;
              const price = plan.perSeat ? unitPrice * seats : unitPrice;
              const perMonth = billing === 'annual' ? ((plan.annual * seats) / 12).toFixed(2) : null;

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
                    {plan.monthly === 0 ? (
                      <div className="mt-3 flex items-baseline gap-1">
                        <span className="text-4xl font-bold text-gray-900 dark:text-white">Free</span>
                        <span className="text-sm text-gray-500 dark:text-gray-400">/14 days</span>
                      </div>
                    ) : plan.perSeat ? (
                      <>
                        <div className="mt-3 flex items-baseline gap-1">
                          <span className="text-4xl font-bold text-gray-900 dark:text-white">
                            ${unitPrice}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            /seat/{billing === 'monthly' ? 'mo' : 'yr'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {seats} seats = <span className="font-semibold text-gray-900 dark:text-white">${price}/{billing === 'monthly' ? 'mo' : 'yr'}</span>
                        </p>
                        {/* Seat selector */}
                        <div className="mt-3 flex items-center gap-3">
                          <label className="text-xs text-gray-500 dark:text-gray-400 font-medium">Seats:</label>
                          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
                            <button
                              onClick={() => setSmeSeats((s) => Math.max(plan.minSeats || 3, s - 1))}
                              className="px-2.5 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-30"
                              disabled={smeSeats <= (plan.minSeats || 3)}
                            >
                              &minus;
                            </button>
                            <span className="px-3 py-1 text-sm font-semibold text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 min-w-[2.5rem] text-center">
                              {smeSeats}
                            </span>
                            <button
                              onClick={() => setSmeSeats((s) => Math.min(50, s + 1))}
                              className="px-2.5 py-1 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            >
                              +
                            </button>
                          </div>
                          <span className="text-xs text-gray-400 dark:text-gray-500">{plan.minSeats}+ min</span>
                        </div>
                        {perMonth && (
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">~${perMonth}/mo</p>
                        )}
                      </>
                    ) : (
                      <>
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
                      </>
                    )}
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      {plan.perSeat ? `${plan.tokens} AI tokens/seat/month` : `${plan.tokens} AI tokens/month`} | {plan.storage} storage
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {plan.tokensEquiv}
                    </p>
                  </div>

                  <div className="mb-6">
                    {isCurrent ? (
                      <button
                        onClick={plan.tier !== 'trial' ? handleManageBilling : undefined}
                        className="w-full py-2.5 px-4 text-sm font-semibold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Current Plan
                      </button>
                    ) : plan.tier === 'trial' ? (
                      <Link
                        to="/register"
                        className="block w-full py-2.5 px-4 text-sm font-semibold rounded-lg text-center bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 transition-colors"
                      >
                        Start Free Trial
                      </Link>
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
                    <th className="text-center py-3 px-3 font-semibold text-gray-500 dark:text-gray-400 w-24">Trial</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-900 dark:text-white w-24">Consultant</th>
                    <th className="text-center py-3 px-3 font-semibold text-primary-600 dark:text-primary-400 w-24">SME</th>
                    <th className="text-center py-3 px-3 font-semibold text-gray-900 dark:text-white w-24">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row, i) => (
                    <tr key={row.feature} className={`border-b border-gray-100 dark:border-gray-700/50 ${i % 2 === 0 ? 'bg-gray-50/50 dark:bg-gray-800/50' : ''}`}>
                      <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{row.feature}</td>
                      {(['trial', 'consultant', 'sme', 'enterprise'] as const).map((tier) => {
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
