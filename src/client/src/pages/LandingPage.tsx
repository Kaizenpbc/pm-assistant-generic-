import React, { useState, useRef, useCallback } from 'react';
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
    accent: 'from-amber-400 to-orange-500',
    iconBg: 'bg-amber-100 text-amber-600',
    cardBg: 'bg-amber-50 border-amber-200',
    video: '/videos/ai-scheduling.mp4',
  },
  {
    title: 'Monte Carlo Simulations',
    description: 'Run probabilistic analysis on your project timelines to understand completion confidence levels.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    accent: 'from-emerald-400 to-teal-500',
    iconBg: 'bg-emerald-100 text-emerald-600',
    cardBg: 'bg-emerald-50 border-emerald-200',
    video: '/videos/monte-carlo.mp4',
  },
  {
    title: 'Smart Risk Detection',
    description: 'AI continuously monitors your projects and alerts you to potential delays, budget overruns, and risks.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    accent: 'from-rose-400 to-pink-500',
    iconBg: 'bg-rose-100 text-rose-600',
    cardBg: 'bg-rose-50 border-rose-200',
    video: '/videos/risk-detection.mp4',
  },
  {
    title: 'Meeting Intelligence',
    description: 'Extract action items and project updates from meeting transcripts automatically.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
      </svg>
    ),
    accent: 'from-violet-400 to-purple-500',
    iconBg: 'bg-violet-100 text-violet-600',
    cardBg: 'bg-violet-50 border-violet-200',
    video: '/videos/meeting-intelligence.mp4',
  },
  {
    title: 'Portfolio Dashboard',
    description: 'Manage multiple projects with a bird\'s-eye view of health, budget, and timeline status.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    accent: 'from-sky-400 to-blue-500',
    iconBg: 'bg-sky-100 text-sky-600',
    cardBg: 'bg-sky-50 border-sky-200',
    video: '/videos/portfolio-dashboard.mp4',
  },
  {
    title: 'Natural Language Queries',
    description: 'Ask questions about your projects in plain English and get instant, data-driven answers.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    accent: 'from-cyan-400 to-primary-500',
    iconBg: 'bg-cyan-100 text-cyan-600',
    cardBg: 'bg-cyan-50 border-cyan-200',
    video: '/videos/nl-queries.mp4',
  },
];

const featureTooltips: Record<string, string> = {
  'Unlimited projects': 'Create and manage as many projects as you need — no caps, no restrictions.',
  'AI scheduling & risk detection': 'Mjuzi, your AI assistant, auto-detects schedule risks, suggests task reordering, and flags delays before they happen.',
  'Monte Carlo simulations': 'Run thousands of schedule simulations to get probabilistic completion dates — know your P50, P80, and P95 delivery dates.',
  'Meeting intelligence': 'Paste or record meeting transcripts and get auto-extracted action items, decisions, and key takeaways.',
  'Natural language queries': 'Ask questions like "which tasks are overdue?" or "show me the critical path" — Mjuzi understands plain English.',
  'Full platform access': 'Gantt charts, Kanban boards, RAID logs, EVM dashboards, sprint management, stakeholder portals — everything included.',
  'Priority support': 'Get faster response times and direct access to the team for technical questions and onboarding help.',
  'Everything in Consultant': 'All features from the Consultant plan, plus enterprise-grade capabilities listed below.',
  'Portfolio management': 'Manage multiple projects in a unified portfolio view with cross-project health tracking and executive dashboards.',
  'Advanced analytics': 'Deep-dive reports, trend analysis, resource utilization heatmaps, and AI-powered performance forecasting.',
  'Custom workflows': 'Build automated approval chains, status transitions, and notification rules tailored to your team\'s process.',
  'API access': 'Full REST API and MCP integration for connecting to your existing tools and building custom automations.',
  'Dedicated support': 'Named account manager, onboarding assistance, and SLA-backed response times.',
};

const pricingTiers = [
  {
    name: 'Free Trial',
    price: 'Free',
    period: '14 days',
    description: 'Try every feature — no credit card required',
    features: [
      'Unlimited projects',
      'AI scheduling & risk detection',
      'Monte Carlo simulations',
      'Meeting intelligence',
      'Natural language queries',
      'Full platform access',
    ],
    cta: 'Start Free Trial',
    ctaLink: '/register',
    highlighted: false,
  },
  {
    name: 'Consultant',
    price: '$25',
    period: '/mo',
    description: 'All features for independent PMs and consultants',
    features: [
      'Unlimited projects',
      'AI scheduling & risk detection',
      'Monte Carlo simulations',
      'Meeting intelligence',
      'Natural language queries',
      'Priority support',
    ],
    cta: 'Get Started',
    ctaLink: '/register',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    name: 'Business',
    price: '',
    period: '',
    description: 'Multi-tenant, teams, and enterprise features',
    features: [
      'Everything in Consultant',
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

function FeatureCard({ feature }: { feature: typeof features[number] }) {
  const [showVideo, setShowVideo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const handleMouseEnter = useCallback(() => {
    if (!feature.video) return;
    timeoutRef.current = setTimeout(() => {
      setShowVideo(true);
      videoRef.current?.play().catch(() => {});
    }, 400);
  }, [feature.video]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setShowVideo(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, []);

  return (
    <div
      className={`group relative rounded-2xl p-6 shadow-sm dark:shadow-gray-900/30 border hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ${feature.cardBg}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`absolute top-0 left-6 right-6 h-1 rounded-b-full bg-gradient-to-r ${feature.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
      <div className={`w-12 h-12 ${feature.iconBg} rounded-xl flex items-center justify-center mb-4`}>
        {feature.icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-900 mb-2">{feature.title}</h3>
      <p className="text-slate-500 text-sm leading-relaxed">{feature.description}</p>

      {feature.video && showVideo && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-50 w-80 rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10 animate-in fade-in zoom-in-95 duration-200">
          <div className="absolute left-1/2 -translate-x-1/2 top-full w-3 h-3 bg-gray-900 rotate-45 -mt-1.5" />
          <video
            ref={videoRef}
            src={feature.video}
            muted
            playsInline
            className="w-full h-auto bg-gray-900"
            onEnded={() => setShowVideo(false)}
          >
            <track kind="captions" />
          </video>
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
            <p className="text-white text-xs font-medium">{feature.title}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureItem({ feature, highlighted }: { feature: string; highlighted: boolean }) {
  const [show, setShow] = useState(false);
  const tooltip = featureTooltips[feature];
  return (
    <li
      className="relative flex items-center text-sm cursor-default"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <svg
        className={`w-4 h-4 mr-2.5 flex-shrink-0 ${highlighted ? 'text-primary-300' : 'text-emerald-500'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
          clipRule="evenodd"
        />
      </svg>
      <span className={`${highlighted ? 'text-primary-100' : 'text-slate-600'} ${tooltip ? `border-b border-dashed ${highlighted ? 'border-primary-300/40' : 'border-slate-300'}` : ''}`}>
        {feature}
      </span>
      {tooltip && show && (
        <div className="absolute left-6 top-full mt-2 w-64 p-3 rounded-lg bg-gray-900 text-white text-xs leading-relaxed shadow-xl z-50 pointer-events-none">
          <div className="absolute left-4 bottom-full w-2 h-2 bg-gray-900 rotate-45 mb-[-4px]" />
          {tooltip}
        </div>
      )}
    </li>
  );
}

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navbar */}
      <nav className="bg-white dark:bg-gray-800/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-purple-600 rounded-lg flex items-center justify-center shadow-md shadow-primary-200">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="ml-2 text-xl font-bold text-slate-900">Kovarti PM Assistant</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/pricing" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Pricing</Link>
              <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">Sign In</Link>
              <Link
                to="/register"
                className="text-sm font-medium text-white bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 px-4 py-2 rounded-lg transition-all shadow-md shadow-primary-200"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-br from-primary-100 via-purple-50 to-pink-100 rounded-full blur-3xl opacity-60" />
          <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-sky-100 to-cyan-50 rounded-full blur-3xl opacity-40" />
          <div className="absolute top-60 left-0 w-[300px] h-[300px] bg-gradient-to-tr from-amber-100 to-orange-50 rounded-full blur-3xl opacity-40" />
        </div>

        <div className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/30 border border-primary-100 mb-8">
              <span className="w-2 h-2 rounded-full bg-primary-500 animate-pulse" />
              <span className="text-sm font-medium text-primary-700 dark:text-primary-300">AI-Powered Project Intelligence</span>
            </div>
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
              <span className="text-slate-900">Manage Projects</span>
              <br />
              <span className="bg-gradient-to-r from-primary-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                Smarter with AI
              </span>
            </h1>
            <p className="mt-6 text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
              Plan smarter, predict risks, and deliver on time with intelligent scheduling,
              Monte Carlo simulations, and natural language project insights.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Link
                to="/register"
                className="px-8 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-primary-600 to-purple-600 hover:from-primary-700 hover:to-purple-700 rounded-xl transition-all shadow-lg shadow-primary-200 hover:shadow-xl hover:shadow-primary-300 hover:-translate-y-0.5"
              >
                Start Free Trial
              </Link>
              <Link
                to="/pricing"
                className="px-8 py-3.5 text-base font-semibold text-slate-700 bg-white dark:bg-gray-800 hover:bg-slate-50 rounded-xl transition-all border border-slate-200 shadow-sm dark:shadow-gray-900/30 hover:shadow-md hover:-translate-y-0.5"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Everything you need to manage projects</h2>
            <p className="mt-4 text-lg text-slate-600">
              Powerful AI features built for modern project managers
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <FeatureCard key={feature.title} feature={feature} />
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-24 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900">Simple, transparent pricing</h2>
            <p className="mt-4 text-lg text-slate-600">
              Start free, upgrade when you need more power
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingTiers.map((tier) => (
              <div
                key={tier.name}
                className={`rounded-2xl p-8 transition-all duration-300 ${
                  tier.highlighted
                    ? 'bg-gradient-to-br from-primary-600 to-purple-700 text-white ring-4 ring-primary-400/30 ring-offset-2 shadow-2xl shadow-primary-300 scale-105'
                    : 'bg-white dark:bg-gray-800 border border-slate-200 shadow-sm dark:shadow-gray-900/30 hover:shadow-md'
                } ${tier.disabled ? 'opacity-75' : ''}`}
              >
                {tier.badge && (
                  <span className="inline-block px-3 py-1 text-xs font-semibold bg-white/20 text-white rounded-full mb-4 backdrop-blur-sm">
                    {tier.badge}
                  </span>
                )}
                <h3 className={`text-lg font-semibold ${tier.highlighted ? 'text-white' : 'text-slate-900'}`}>
                  {tier.name}
                </h3>
                <div className="mt-4 flex items-baseline">
                  {tier.price ? (
                    <>
                      <span className={`text-4xl font-bold ${tier.highlighted ? 'text-white' : 'text-slate-900'}`}>
                        {tier.price}
                      </span>
                      {tier.period && (
                        <span className={`ml-1 text-sm ${tier.highlighted ? 'text-primary-200' : 'text-slate-500'}`}>
                          {tier.period}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-2xl font-bold text-slate-400">TBD</span>
                  )}
                </div>
                <p className={`mt-2 text-sm ${tier.highlighted ? 'text-primary-200' : 'text-slate-500'}`}>
                  {tier.description}
                </p>
                <ul className="mt-6 space-y-3">
                  {tier.features.map((feature) => (
                    <FeatureItem key={feature} feature={feature} highlighted={tier.highlighted} />
                  ))}
                </ul>
                <div className="mt-8">
                  {tier.disabled ? (
                    <span className={`block w-full text-center py-2.5 px-4 text-sm font-medium rounded-lg ${
                      tier.highlighted ? 'bg-white dark:bg-gray-800/10 text-primary-200' : 'bg-slate-100 text-slate-400'
                    } cursor-not-allowed`}>
                      {tier.cta}
                    </span>
                  ) : (
                    <Link
                      to={tier.ctaLink}
                      className={`block w-full text-center py-2.5 px-4 text-sm font-semibold rounded-lg transition-all ${
                        tier.highlighted
                          ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:bg-primary-900/30 shadow-md'
                          : 'bg-gradient-to-r from-primary-600 to-purple-600 text-white hover:from-primary-700 hover:to-purple-700 shadow-md shadow-primary-100'
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
      <footer className="bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <div className="w-6 h-6 bg-gradient-to-br from-primary-500 to-purple-600 rounded flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="ml-2 text-sm font-semibold text-white">Kovarti PM Assistant</span>
            </div>
            <div className="flex space-x-6 text-sm">
              <Link to="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
              <Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
              <Link to="/pricing" className="hover:text-white transition-colors">Pricing</Link>
            </div>
          </div>
          <div className="mt-8 text-center text-xs text-slate-500">
            &copy; {new Date().getFullYear()} Kovarti PM Assistant. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};
