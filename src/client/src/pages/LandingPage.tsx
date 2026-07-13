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

/* Animated mockup previews for feature cards */
function SchedulingMockup() {
  return (
    <svg viewBox="0 0 320 180" className="w-full h-full">
      <rect width="320" height="180" fill="#1e293b" />
      {/* Header */}
      <text x="16" y="24" fill="#94a3b8" fontSize="10" fontFamily="system-ui">Project Timeline</text>
      {/* Task labels */}
      <text x="16" y="50" fill="#cbd5e1" fontSize="9" fontFamily="system-ui">Design</text>
      <text x="16" y="74" fill="#cbd5e1" fontSize="9" fontFamily="system-ui">Backend</text>
      <text x="16" y="98" fill="#cbd5e1" fontSize="9" fontFamily="system-ui">Frontend</text>
      <text x="16" y="122" fill="#cbd5e1" fontSize="9" fontFamily="system-ui">Testing</text>
      <text x="16" y="146" fill="#cbd5e1" fontSize="9" fontFamily="system-ui">Deploy</text>
      {/* Gantt bars with staggered animation */}
      <rect x="80" y="40" width="0" height="14" rx="3" fill="#f59e0b" opacity="0.9">
        <animate attributeName="width" from="0" to="80" dur="0.6s" begin="0.2s" fill="freeze" />
      </rect>
      <rect x="120" y="64" width="0" height="14" rx="3" fill="#f97316" opacity="0.9">
        <animate attributeName="width" from="0" to="120" dur="0.7s" begin="0.5s" fill="freeze" />
      </rect>
      <rect x="160" y="88" width="0" height="14" rx="3" fill="#fb923c" opacity="0.9">
        <animate attributeName="width" from="0" to="100" dur="0.6s" begin="0.9s" fill="freeze" />
      </rect>
      <rect x="220" y="112" width="0" height="14" rx="3" fill="#fbbf24" opacity="0.9">
        <animate attributeName="width" from="0" to="60" dur="0.5s" begin="1.3s" fill="freeze" />
      </rect>
      <rect x="270" y="136" width="0" height="14" rx="3" fill="#fcd34d" opacity="0.9">
        <animate attributeName="width" from="0" to="30" dur="0.4s" begin="1.6s" fill="freeze" />
      </rect>
      {/* Dependency arrows */}
      <path d="M160 54 L160 64" stroke="#64748b" strokeWidth="1" fill="none" strokeDasharray="3,2" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="0.8s" fill="freeze" />
      </path>
      <path d="M240 78 L240 88" stroke="#64748b" strokeWidth="1" fill="none" strokeDasharray="3,2" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="1.2s" fill="freeze" />
      </path>
      {/* AI sparkle */}
      <text x="280" y="24" fill="#fbbf24" fontSize="11" opacity="0">✦ AI
        <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="0.1s" fill="freeze" />
        <animateTransform attributeName="transform" type="scale" values="0.8;1.1;1" dur="0.5s" begin="0.1s" fill="freeze" />
      </text>
    </svg>
  );
}

function MonteCarloMockup() {
  const bars = [8, 15, 28, 45, 60, 80, 95, 78, 55, 35, 20, 10, 5];
  return (
    <svg viewBox="0 0 320 180" className="w-full h-full">
      <rect width="320" height="180" fill="#1e293b" />
      <text x="16" y="24" fill="#94a3b8" fontSize="10" fontFamily="system-ui">Completion Probability</text>
      {/* Histogram bars */}
      {bars.map((h, i) => (
        <rect key={i} x={30 + i * 21} y={160 - h} width="16" rx="2" fill="#10b981" opacity="0.8" height="0">
          <animate attributeName="height" from="0" to={String(h)} dur="0.4s" begin={`${0.1 + i * 0.08}s`} fill="freeze" />
          <animate attributeName="y" from="160" to={String(160 - h)} dur="0.4s" begin={`${0.1 + i * 0.08}s`} fill="freeze" />
        </rect>
      ))}
      {/* P50/P80/P95 lines */}
      <line x1="135" y1="30" x2="135" y2="160" stroke="#fbbf24" strokeWidth="1" strokeDasharray="4,3" opacity="0">
        <animate attributeName="opacity" from="0" to="0.8" dur="0.3s" begin="1.2s" fill="freeze" />
      </line>
      <text x="137" y="38" fill="#fbbf24" fontSize="8" fontFamily="system-ui" opacity="0">P50
        <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="1.2s" fill="freeze" />
      </text>
      <line x1="198" y1="30" x2="198" y2="160" stroke="#f97316" strokeWidth="1" strokeDasharray="4,3" opacity="0">
        <animate attributeName="opacity" from="0" to="0.8" dur="0.3s" begin="1.5s" fill="freeze" />
      </line>
      <text x="200" y="38" fill="#f97316" fontSize="8" fontFamily="system-ui" opacity="0">P80
        <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="1.5s" fill="freeze" />
      </text>
      <line x1="240" y1="30" x2="240" y2="160" stroke="#ef4444" strokeWidth="1" strokeDasharray="4,3" opacity="0">
        <animate attributeName="opacity" from="0" to="0.8" dur="0.3s" begin="1.8s" fill="freeze" />
      </line>
      <text x="242" y="38" fill="#ef4444" fontSize="8" fontFamily="system-ui" opacity="0">P95
        <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="1.8s" fill="freeze" />
      </text>
    </svg>
  );
}

function RiskDetectionMockup() {
  return (
    <svg viewBox="0 0 320 180" className="w-full h-full">
      <rect width="320" height="180" fill="#1e293b" />
      <text x="16" y="24" fill="#94a3b8" fontSize="10" fontFamily="system-ui">Risk Scanner</text>
      {/* Scanning line */}
      <rect x="0" y="30" width="320" height="2" fill="#3b82f6" opacity="0">
        <animate attributeName="opacity" values="0;0.6;0" dur="1.5s" begin="0.2s" />
        <animate attributeName="y" from="30" to="170" dur="1.5s" begin="0.2s" fill="freeze" />
      </rect>
      {/* Risk items appearing */}
      {[
        { y: 45, label: 'Budget overrun risk — Phase 2 spending 23% over forecast', severity: '#ef4444', tag: 'HIGH' },
        { y: 80, label: 'Resource conflict — 3 developers double-booked next sprint', severity: '#f97316', tag: 'MED' },
        { y: 115, label: 'Dependency delay — API integration blocked by vendor', severity: '#ef4444', tag: 'HIGH' },
        { y: 150, label: 'Scope creep — 12 unplanned tasks added this month', severity: '#eab308', tag: 'LOW' },
      ].map((risk, i) => (
        <g key={i} opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={`${0.6 + i * 0.5}s`} fill="freeze" />
          <rect x="14" y={risk.y} width="6" height="22" rx="2" fill={risk.severity} />
          <text x="28" y={risk.y + 10} fill="#e2e8f0" fontSize="8" fontFamily="system-ui">{risk.label.slice(0, 52)}</text>
          <text x="28" y={risk.y + 20} fill="#64748b" fontSize="7" fontFamily="system-ui">{risk.label.slice(52)}</text>
          <rect x="270" y={risk.y + 2} width="32" height="14" rx="7" fill={risk.severity} opacity="0.2" />
          <text x="278" y={risk.y + 12} fill={risk.severity} fontSize="7" fontWeight="bold" fontFamily="system-ui">{risk.tag}</text>
        </g>
      ))}
    </svg>
  );
}

function MeetingMockup() {
  const lines = [
    { text: 'Sarah: We need to finalize the API spec by Friday', type: 'transcript' },
    { text: '→ Action: Finalize API spec — assigned Sarah — due Fri', type: 'action' },
    { text: 'Tom: The client approved the new design direction', type: 'transcript' },
    { text: '→ Decision: New design direction approved by client', type: 'decision' },
    { text: 'Lisa: Testing starts next Monday with 3 QA engineers', type: 'transcript' },
    { text: '→ Action: Begin QA testing — assigned Lisa — due Mon', type: 'action' },
  ];
  return (
    <svg viewBox="0 0 320 180" className="w-full h-full">
      <rect width="320" height="180" fill="#1e293b" />
      <text x="16" y="24" fill="#94a3b8" fontSize="10" fontFamily="system-ui">Meeting Analysis</text>
      {lines.map((line, i) => (
        <g key={i} opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={`${0.3 + i * 0.4}s`} fill="freeze" />
          {line.type === 'action' ? (
            <>
              <rect x="14" y={34 + i * 22} width="296" height="18" rx="4" fill="#3b82f6" opacity="0.15" />
              <text x="20" y={47 + i * 22} fill="#60a5fa" fontSize="8" fontFamily="system-ui">{line.text}</text>
            </>
          ) : line.type === 'decision' ? (
            <>
              <rect x="14" y={34 + i * 22} width="296" height="18" rx="4" fill="#a855f7" opacity="0.15" />
              <text x="20" y={47 + i * 22} fill="#c084fc" fontSize="8" fontFamily="system-ui">{line.text}</text>
            </>
          ) : (
            <text x="20" y={47 + i * 22} fill="#94a3b8" fontSize="8" fontFamily="system-ui">{line.text}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

function PortfolioMockup() {
  const projects = [
    { name: 'Website Redesign', health: 92, color: '#10b981', w: 240 },
    { name: 'Mobile App v2', health: 67, color: '#f97316', w: 175 },
    { name: 'Data Migration', health: 85, color: '#10b981', w: 222 },
    { name: 'API Platform', health: 45, color: '#ef4444', w: 118 },
  ];
  return (
    <svg viewBox="0 0 320 180" className="w-full h-full">
      <rect width="320" height="180" fill="#1e293b" />
      <text x="16" y="24" fill="#94a3b8" fontSize="10" fontFamily="system-ui">Portfolio Health</text>
      {projects.map((p, i) => (
        <g key={i} opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={`${0.2 + i * 0.3}s`} fill="freeze" />
          <text x="16" y={50 + i * 38} fill="#e2e8f0" fontSize="9" fontFamily="system-ui">{p.name}</text>
          <rect x="16" y={55 + i * 38} width="260" height="8" rx="4" fill="#334155" />
          <rect x="16" y={55 + i * 38} width="0" height="8" rx="4" fill={p.color}>
            <animate attributeName="width" from="0" to={String(p.w)} dur="0.8s" begin={`${0.4 + i * 0.3}s`} fill="freeze" />
          </rect>
          <text x="282" y={63 + i * 38} fill={p.color} fontSize="9" fontWeight="bold" fontFamily="system-ui" opacity="0">
            {p.health}%
            <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={`${0.8 + i * 0.3}s`} fill="freeze" />
          </text>
        </g>
      ))}
    </svg>
  );
}

function NLQueryMockup() {
  return (
    <svg viewBox="0 0 320 180" className="w-full h-full">
      <rect width="320" height="180" fill="#1e293b" />
      {/* User query bubble */}
      <g opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="0.3s" fill="freeze" />
        <rect x="80" y="16" width="224" height="28" rx="14" fill="#3b82f6" />
        <text x="94" y="34" fill="white" fontSize="9" fontFamily="system-ui">Which tasks are overdue this sprint?</text>
      </g>
      {/* Typing indicator */}
      <g opacity="0">
        <animate attributeName="opacity" values="0;1;1;0" dur="1s" begin="0.8s" fill="freeze" />
        <circle cx="28" cy="64" r="3" fill="#64748b"><animate attributeName="opacity" values="0.3;1;0.3" dur="0.6s" repeatCount="2" begin="0.8s" /></circle>
        <circle cx="38" cy="64" r="3" fill="#64748b"><animate attributeName="opacity" values="0.3;1;0.3" dur="0.6s" repeatCount="2" begin="0.9s" /></circle>
        <circle cx="48" cy="64" r="3" fill="#64748b"><animate attributeName="opacity" values="0.3;1;0.3" dur="0.6s" repeatCount="2" begin="1.0s" /></circle>
      </g>
      {/* AI response */}
      <g opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.4s" begin="1.8s" fill="freeze" />
        <rect x="16" y="54" width="240" height="112" rx="14" fill="#334155" />
        <text x="28" y="72" fill="#e2e8f0" fontSize="9" fontFamily="system-ui">Found 3 overdue tasks:</text>
        <text x="28" y="90" fill="#f87171" fontSize="8" fontFamily="system-ui">• API auth module — 3 days overdue</text>
        <text x="28" y="106" fill="#f87171" fontSize="8" fontFamily="system-ui">• Database schema review — 1 day overdue</text>
        <text x="28" y="122" fill="#fbbf24" fontSize="8" fontFamily="system-ui">• UI wireframes — due today</text>
        <text x="28" y="142" fill="#94a3b8" fontSize="8" fontFamily="system-ui">Suggest auto-reschedule?</text>
        <rect x="28" y="148" width="50" height="14" rx="7" fill="#3b82f6" opacity="0">
          <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="2.4s" fill="freeze" />
        </rect>
        <text x="38" y="158" fill="white" fontSize="7" fontFamily="system-ui" opacity="0">Yes, do it
          <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="2.4s" fill="freeze" />
        </text>
      </g>
      {/* Mjuzi avatar */}
      <circle cx="28" cy="80" r="10" fill="#8b5cf6" opacity="0">
        <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="1.8s" fill="freeze" />
      </circle>
      <text x="23" y="84" fill="white" fontSize="8" fontWeight="bold" fontFamily="system-ui" opacity="0">M
        <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin="1.8s" fill="freeze" />
      </text>
    </svg>
  );
}

const featureMockups: Record<string, React.FC> = {
  'AI-Powered Scheduling': SchedulingMockup,
  'Monte Carlo Simulations': MonteCarloMockup,
  'Smart Risk Detection': RiskDetectionMockup,
  'Meeting Intelligence': MeetingMockup,
  'Portfolio Dashboard': PortfolioMockup,
  'Natural Language Queries': NLQueryMockup,
};

function FeatureCard({ feature }: { feature: typeof features[number] }) {
  const [showPreview, setShowPreview] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const Mockup = featureMockups[feature.title];

  const handleMouseEnter = useCallback(() => {
    if (!Mockup) return;
    timeoutRef.current = setTimeout(() => setShowPreview(true), 400);
  }, [Mockup]);

  const handleMouseLeave = useCallback(() => {
    clearTimeout(timeoutRef.current);
    setShowPreview(false);
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

      {Mockup && showPreview && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-3 z-50 w-80 rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10">
          <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-3 h-3 bg-[#1e293b] rotate-45 mb-[-6px]" />
          <Mockup />
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
