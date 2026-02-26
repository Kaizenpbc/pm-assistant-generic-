import React from 'react';
import { Link } from 'react-router-dom';

const features = [
  {
    title: 'AI-Powered Scheduling',
    description: 'Automatically generate task breakdowns, dependencies, and optimized timelines using AI.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    title: 'Monte Carlo Simulations',
    description: 'Run probabilistic analysis on your project timelines to understand completion confidence levels.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    title: 'Smart Risk Detection',
    description: 'AI continuously monitors your projects and alerts you to potential delays, budget overruns, and risks.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
  },
  {
    title: 'Meeting Intelligence',
    description: 'Extract action items and project updates from meeting transcripts automatically.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
      </svg>
    ),
  },
  {
    title: 'Portfolio Dashboard',
    description: 'Manage multiple projects with a bird\'s-eye view of health, budget, and timeline status.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    title: 'Natural Language Queries',
    description: 'Ask questions about your projects in plain English and get instant, data-driven answers.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
  },
];

const pricingTiers = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Get started with basic project management',
    features: ['Up to 3 projects', 'Basic scheduling', 'Task management', 'Team collaboration'],
    cta: 'Get Started',
    ctaLink: '/register',
    highlighted: false,
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
      'Priority support',
    ],
    cta: 'Start Free Trial',
    ctaLink: '/register',
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
      'API access',
      'Dedicated support',
    ],
    cta: 'Coming Soon',
    ctaLink: '#',
    highlighted: false,
    disabled: true,
  },
];

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900">PM Assistant</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/pricing" className="text-sm text-gray-600 hover:text-gray-900">Pricing</Link>
              <Link to="/login" className="text-sm text-gray-600 hover:text-gray-900">Sign In</Link>
              <Link
                to="/register"
                className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg transition-colors"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-gray-900 tracking-tight">
            AI-Powered Project Management
          </h1>
          <p className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto">
            Plan smarter, predict risks, and deliver on time with intelligent scheduling,
            Monte Carlo simulations, and natural language project insights.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            <Link
              to="/register"
              className="px-8 py-3 text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-lg shadow-indigo-200"
            >
              Start Free Trial
            </Link>
            <Link
              to="/pricing"
              className="px-8 py-3 text-base font-medium text-gray-700 bg-white hover:bg-gray-50 rounded-lg transition-colors border border-gray-300"
            >
              View Pricing
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Everything you need to manage projects</h2>
            <p className="mt-4 text-lg text-gray-600">
              Powerful AI features built for modern project managers
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature) => (
              <div key={feature.title} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center text-indigo-600 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900">Simple, transparent pricing</h2>
            <p className="mt-4 text-lg text-gray-600">
              Start free, upgrade when you need more power
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl p-8 ${
                  tier.highlighted
                    ? 'bg-indigo-600 text-white ring-4 ring-indigo-600 ring-offset-2 shadow-xl'
                    : 'bg-white border border-gray-200 shadow-sm'
                } ${tier.disabled ? 'opacity-75' : ''}`}
              >
                {tier.badge && (
                  <span className="inline-block px-3 py-1 text-xs font-medium bg-indigo-500 text-white rounded-full mb-4">
                    {tier.badge}
                  </span>
                )}
                <h3 className={`text-lg font-semibold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>
                  {tier.name}
                </h3>
                <div className="mt-4 flex items-baseline">
                  <span className={`text-4xl font-bold ${tier.highlighted ? 'text-white' : 'text-gray-900'}`}>
                    {tier.price}
                  </span>
                  <span className={`ml-1 text-sm ${tier.highlighted ? 'text-indigo-200' : 'text-gray-500'}`}>
                    {tier.period}
                  </span>
                </div>
                <p className={`mt-2 text-sm ${tier.highlighted ? 'text-indigo-200' : 'text-gray-500'}`}>
                  {tier.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center text-sm">
                      <svg
                        className={`w-4 h-4 mr-2 flex-shrink-0 ${tier.highlighted ? 'text-indigo-300' : 'text-indigo-500'}`}
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                          clipRule="evenodd"
                        />
                      </svg>
                      <span className={tier.highlighted ? 'text-indigo-100' : 'text-gray-600'}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  {tier.disabled ? (
                    <span className={`block w-full text-center py-2.5 px-4 text-sm font-medium rounded-lg ${
                      tier.highlighted ? 'bg-indigo-500 text-indigo-200' : 'bg-gray-100 text-gray-400'
                    } cursor-not-allowed`}>
                      {tier.cta}
                    </span>
                  ) : (
                    <Link
                      to={tier.ctaLink}
                      className={`block w-full text-center py-2.5 px-4 text-sm font-medium rounded-lg transition-colors ${
                        tier.highlighted
                          ? 'bg-white text-indigo-600 hover:bg-indigo-50'
                          : 'bg-indigo-600 text-white hover:bg-indigo-700'
                      }`}
                    >
                      {tier.cta}
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="w-6 h-6 bg-indigo-600 rounded flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="ml-2 text-sm font-semibold text-gray-900">PM Assistant</span>
            </div>
            <div className="flex space-x-6 text-sm text-gray-500">
              <Link to="/terms" className="hover:text-gray-900">Terms of Service</Link>
              <Link to="/privacy" className="hover:text-gray-900">Privacy Policy</Link>
              <Link to="/pricing" className="hover:text-gray-900">Pricing</Link>
            </div>
          </div>
          <div className="mt-8 text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} PM Assistant. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
