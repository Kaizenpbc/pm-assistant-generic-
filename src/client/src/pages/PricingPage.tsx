import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';
import { Check } from 'lucide-react';

const features = [
  'Unlimited projects',
  'All AI features (Mjuzi, NL queries, auto-reschedule, meeting intelligence)',
  'EVM dashboard & AI forecasting',
  'Monte Carlo simulation',
  'Gantt charts with dependencies, critical path & baselines',
  'Sprint/Agile + Kanban boards',
  'DAG workflow automation + NL builder',
  'Resource management & workload heatmaps',
  'Stakeholder portal',
  'Custom report builder & scheduled delivery',
  'RAID management',
  'All export formats (CSV, PDF, MSPDI XML)',
  'API access & MCP integration',
  '5GB file storage',
];

export const PricingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly');
  const [loading, setLoading] = useState(false);

  const currentTier = user?.subscriptionTier || 'free';
  const isSubscribed = currentTier === 'consultant' || currentTier === 'pro' || currentTier === 'business';

  const handleSubscribe = async () => {
    if (!isAuthenticated) {
      window.location.href = '/register';
      return;
    }
    setLoading(true);
    try {
      const { url } = await apiService.createCheckoutSession(billing);
      window.location.href = url;
    } catch {
      setLoading(false);
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Simple, transparent pricing</h1>
            <p className="mt-4 text-lg text-gray-600 dark:text-gray-300">
              14-day free trial. All features included. No credit card required.
            </p>
          </div>

          {/* Billing toggle */}
          <div className="flex justify-center mb-8">
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

          {/* Plan card */}
          <div className="bg-white dark:bg-gray-800 border-2 border-primary-500 rounded-2xl shadow-xl shadow-primary-500/10 p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Consultant</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Everything you need to manage projects like a pro</p>
              </div>
              <div className="text-right">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-gray-900 dark:text-white">
                    {billing === 'monthly' ? '$25' : '$250'}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    /{billing === 'monthly' ? 'mo' : 'yr'}
                  </span>
                </div>
                {billing === 'annual' && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-1">~$20.83/mo</p>
                )}
              </div>
            </div>

            {/* CTA */}
            <div className="mb-8">
              {isSubscribed ? (
                <button
                  onClick={handleManageBilling}
                  className="w-full py-3 px-4 text-sm font-semibold rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Manage Subscription
                </button>
              ) : (
                <button
                  onClick={handleSubscribe}
                  disabled={loading}
                  className="w-full py-3 px-4 text-sm font-semibold rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Loading...
                    </span>
                  ) : isAuthenticated ? (
                    'Subscribe Now'
                  ) : (
                    'Start 14-Day Free Trial'
                  )}
                </button>
              )}
            </div>

            {/* Features */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {features.map((feature) => (
                <div key={feature} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <Check className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Refund policy */}
          <div className="mt-8 text-center text-xs text-gray-400 dark:text-gray-500 space-y-1">
            <p>Monthly subscriptions are non-refundable. Cancel anytime.</p>
            <p>Annual subscriptions: pro-rated refund within 30 days, non-refundable after.</p>
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
