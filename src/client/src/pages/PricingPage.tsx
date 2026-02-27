import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { apiService } from '../services/api';

const tiers = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Get started with basic project management',
    features: [
      'Up to 3 projects',
      'Basic scheduling',
      'Task management',
      'Team collaboration',
      'Basic reports',
    ],
    tierKey: 'free',
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/mo',
    description: 'AI-powered features for serious project managers',
    features: [
      'Unlimited projects',
      'AI scheduling & risk detection',
      'Monte Carlo simulations',
      'Meeting intelligence',
      'Natural language queries',
      'EVM forecasting',
      'Auto-rescheduling',
      'Priority support',
    ],
    tierKey: 'pro',
    highlighted: true,
    badge: '14-day free trial',
  },
  {
    name: 'Business',
    price: '$49',
    period: '/mo',
    description: 'Advanced features for teams and organizations',
    features: [
      'Everything in Pro',
      'Portfolio management',
      'Advanced analytics',
      'Custom workflows',
      'Resource optimization',
      'API access',
      'Dedicated support',
      'Custom integrations',
    ],
    tierKey: 'business',
    disabled: true,
  },
];

export const PricingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const handleSubscribe = async (tierKey: string) => {
    if (!isAuthenticated) {
      window.location.href = '/register';
      return;
    }

    if (tierKey === 'pro') {
      setLoadingTier('pro');
      try {
        const { url } = await apiService.createCheckoutSession();
        window.location.href = url;
      } catch (err) {
        console.error('Failed to create checkout session:', err);
        setLoadingTier(null);
      }
    }
  };

  const handleManageBilling = async () => {
    try {
      const { url } = await apiService.createPortalSession();
      window.location.href = url;
    } catch (err) {
      console.error('Failed to create portal session:', err);
    }
  };

  const getCtaButton = (tier: typeof tiers[0]) => {
    if (tier.disabled) {
      return (
        <span className="block w-full text-center py-2.5 px-4 text-sm font-medium rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed">
          Coming Soon
        </span>
      );
    }

    const currentTier = user?.subscriptionTier || 'free';

    if (isAuthenticated && currentTier === tier.tierKey) {
      if (tier.tierKey === 'free') {
        return (
          <span className="block w-full text-center py-2.5 px-4 text-sm font-medium rounded-lg bg-gray-100 text-gray-500">
            Current Plan
          </span>
        );
      }
      return (
        <button onClick={handleManageBilling}
          className="block w-full text-center py-2.5 px-4 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">
          Manage Subscription
        </button>
      );
    }

    if (tier.tierKey === 'free') {
      return (
        <Link to={isAuthenticated ? '/dashboard' : '/register'}
          className={`block w-full text-center py-2.5 px-4 text-sm font-medium rounded-lg transition-colors ${
            tier.highlighted ? 'bg-white text-indigo-600 hover:bg-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}>
          {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
        </Link>
      );
    }

    return (
      <button onClick={() => handleSubscribe(tier.tierKey)} disabled={loadingTier === tier.tierKey}
        className={`block w-full text-center py-2.5 px-4 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
          tier.highlighted ? 'bg-white text-indigo-600 hover:bg-indigo-50' : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}>
        {loadingTier === tier.tierKey ? (
          <span className="flex items-center justify-center">
            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
            Loading...
          </span>
        ) : (
          'Start Free Trial'
        )}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900">Kovarti PM Assistant</span>
            </Link>
            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <Link to="/dashboard" className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors">
                  Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">Sign In</Link>
                  <Link to="/register" className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Pricing */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl font-bold text-gray-900">Pricing</h1>
            <p className="mt-4 text-lg text-gray-600">Choose the plan that's right for you</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {tiers.map((tier) => (
              <div key={tier.name}
                className={`rounded-2xl p-8 ${
                  tier.highlighted
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-600 ring-offset-2 shadow-xl'
                    : 'bg-white border border-gray-200 shadow-sm'
                } ${tier.disabled ? 'opacity-75' : ''}`}>
                {tier.badge && (
                  <span className="inline-block px-3 py-1 text-xs font-medium bg-indigo-500 text-white rounded-full mb-4">
                    {tier.badge}
                  </span>
                )}
                <h3 className={`text-lg font-semibold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>{tier.name}</h3>
                <div className="mt-4 flex items-baseline">
                  <span className={`text-4xl font-bold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>{tier.price}</span>
                  <span className={`ml-1 text-sm ${tier.highlighted ? 'text-indigo-200' : 'text-gray-500'}`}>{tier.period}</span>
                </div>
                <p className={`mt-2 text-sm ${tier.highlighted ? 'text-indigo-200' : 'text-gray-500'}`}>{tier.description}</p>
                <ul className="mt-6 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center text-sm">
                      <svg className={`w-4 h-4 mr-2 flex-shrink-0 ${tier.highlighted ? 'text-indigo-300' : 'text-indigo-500'}`}
                        fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className={tier.highlighted ? 'text-indigo-100' : 'text-gray-600'}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">{getCtaButton(tier)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center space-x-6 text-sm text-gray-500">
            <Link to="/terms" className="hover:text-gray-900">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-gray-900">Privacy Policy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
