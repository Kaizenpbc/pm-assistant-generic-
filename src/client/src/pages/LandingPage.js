import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
const features = [
    {
        title: 'AI-Powered Scheduling',
        description: 'Automatically generate task breakdowns, dependencies, and optimized timelines using AI.',
        icon: (_jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) })),
        accent: 'from-blue-500 to-cyan-400',
        iconBg: 'bg-blue-500/10 text-blue-400',
        cardBg: 'bg-[#111827]/70 border-blue-500/10 backdrop-blur-sm',
    },
    {
        title: 'Monte Carlo Simulations',
        description: 'Run probabilistic analysis on your project timelines to understand completion confidence levels.',
        icon: (_jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" }) })),
        accent: 'from-blue-500 to-cyan-400',
        iconBg: 'bg-cyan-500/10 text-cyan-400',
        cardBg: 'bg-[#111827]/70 border-blue-500/10 backdrop-blur-sm',
    },
    {
        title: 'Smart Risk Detection',
        description: 'AI continuously monitors your projects and alerts you to potential delays, budget overruns, and risks.',
        icon: (_jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" }) })),
        accent: 'from-blue-500 to-cyan-400',
        iconBg: 'bg-blue-500/10 text-blue-400',
        cardBg: 'bg-[#111827]/70 border-blue-500/10 backdrop-blur-sm',
    },
    {
        title: 'Meeting Intelligence',
        description: 'Extract action items and project updates from meeting transcripts automatically.',
        icon: (_jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" }) })),
        accent: 'from-blue-500 to-cyan-400',
        iconBg: 'bg-cyan-500/10 text-cyan-400',
        cardBg: 'bg-[#111827]/70 border-blue-500/10 backdrop-blur-sm',
    },
    {
        title: 'Portfolio Dashboard',
        description: 'Manage multiple projects with a bird\'s-eye view of health, budget, and timeline status.',
        icon: (_jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" }) })),
        accent: 'from-blue-500 to-cyan-400',
        iconBg: 'bg-blue-500/10 text-blue-400',
        cardBg: 'bg-[#111827]/70 border-blue-500/10 backdrop-blur-sm',
    },
    {
        title: 'Natural Language Queries',
        description: 'Ask questions about your projects in plain English and get instant, data-driven answers.',
        icon: (_jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" }) })),
        accent: 'from-blue-500 to-cyan-400',
        iconBg: 'bg-cyan-500/10 text-cyan-400',
        cardBg: 'bg-[#111827]/70 border-blue-500/10 backdrop-blur-sm',
    },
];
const featureTooltips = {
    'Up to 3 projects': 'Create up to 3 projects to explore the full platform during your 14-day trial.',
    'Unlimited projects': 'Create and manage as many projects as you need — no caps, no restrictions.',
    'AI scheduling & risk detection': 'Mjuzi, your AI assistant, auto-detects schedule risks, suggests task reordering, and flags delays before they happen.',
    'Gantt, Kanban & calendar views': 'Multiple ways to visualize your schedule — Gantt charts with dependencies, drag-and-drop Kanban boards, and calendar overlays.',
    'RAID management': 'Track Risks, Actions, Issues, and Decisions in one place with severity levels, owners, and status tracking.',
    'All features included': 'Every paid plan includes all features — Monte Carlo, EVM, meeting intelligence, NL queries, reports, and more.',
    '500K AI tokens/month': '500,000 AI tokens per month for Mjuzi chat, risk scanning, report generation, and all AI features.',
    '5 viewer invites': 'Invite up to 5 client stakeholders as free viewer accounts to see project progress and update their RAID items.',
    '1.5M AI tokens/month': '1,500,000 AI tokens per month — 3x more than Consultant for heavier AI usage.',
    '20 viewer invites': 'Invite up to 20 client stakeholders as free viewers across all your projects.',
    'Portfolio management': 'Manage multiple projects in a unified portfolio view with cross-project health tracking and executive dashboards.',
    '5M AI tokens/month': '5,000,000 AI tokens per month — ideal for large teams with heavy AI usage.',
    'Unlimited viewer invites': 'No limit on viewer invitations — invite your entire client organization.',
    'API access & integrations': 'Full REST API and MCP integration for connecting to your existing tools and building custom automations.',
    'Priority support': 'Get faster response times and direct access to the team for technical questions and onboarding help.',
};
const pricingTiers = [
    {
        name: 'Free Trial',
        price: 'Free',
        period: '14 days',
        description: 'Explore the platform — no credit card required',
        features: [
            'Up to 3 projects',
            'AI scheduling & risk detection',
            'Gantt, Kanban & calendar views',
            'RAID management',
        ],
        cta: 'Start Free Trial',
        ctaLink: '/register',
        highlighted: false,
    },
    {
        name: 'Consultant',
        price: '$19',
        period: '/mo',
        description: 'All features for independent PMs and consultants',
        features: [
            'Unlimited projects',
            'All features included',
            '500K AI tokens/month',
            '5 viewer invites',
        ],
        cta: 'Get Started',
        ctaLink: '/register',
        highlighted: false,
    },
    {
        name: 'SME',
        price: '$39',
        period: '/mo',
        description: 'For growing teams and organizations',
        features: [
            'Unlimited projects',
            'All features included',
            '1.5M AI tokens/month',
            '20 viewer invites',
            'Portfolio management',
        ],
        cta: 'Get Started',
        ctaLink: '/register',
        highlighted: true,
        badge: 'Most Popular',
    },
    {
        name: 'Enterprise',
        price: '$79',
        period: '/mo',
        description: 'For large teams with advanced needs',
        features: [
            'Unlimited projects',
            'All features included',
            '5M AI tokens/month',
            'Unlimited viewer invites',
            'API access & integrations',
            'Priority support',
        ],
        cta: 'Get Started',
        ctaLink: '/register',
        highlighted: false,
    },
];
/* Animated mockup previews for feature cards */
function SchedulingMockup() {
    return (_jsxs("svg", { viewBox: "0 0 360 200", className: "w-full h-full", children: [_jsx("rect", { width: "360", height: "200", fill: "#1e293b" }), _jsx("text", { x: "16", y: "26", fill: "#94a3b8", fontSize: "12", fontFamily: "system-ui", children: "Project Timeline" }), _jsx("text", { x: "16", y: "54", fill: "#cbd5e1", fontSize: "11", fontFamily: "system-ui", children: "Design" }), _jsx("text", { x: "16", y: "82", fill: "#cbd5e1", fontSize: "11", fontFamily: "system-ui", children: "Backend" }), _jsx("text", { x: "16", y: "110", fill: "#cbd5e1", fontSize: "11", fontFamily: "system-ui", children: "Frontend" }), _jsx("text", { x: "16", y: "138", fill: "#cbd5e1", fontSize: "11", fontFamily: "system-ui", children: "Testing" }), _jsx("text", { x: "16", y: "166", fill: "#cbd5e1", fontSize: "11", fontFamily: "system-ui", children: "Deploy" }), _jsx("rect", { x: "90", y: "42", width: "0", height: "16", rx: "3", fill: "#3b82f6", opacity: "0.9", children: _jsx("animate", { attributeName: "width", from: "0", to: "90", dur: "0.6s", begin: "0.2s", fill: "freeze" }) }), _jsx("rect", { x: "130", y: "70", width: "0", height: "16", rx: "3", fill: "#60a5fa", opacity: "0.9", children: _jsx("animate", { attributeName: "width", from: "0", to: "130", dur: "0.7s", begin: "0.5s", fill: "freeze" }) }), _jsx("rect", { x: "175", y: "98", width: "0", height: "16", rx: "3", fill: "#06b6d4", opacity: "0.9", children: _jsx("animate", { attributeName: "width", from: "0", to: "110", dur: "0.6s", begin: "0.9s", fill: "freeze" }) }), _jsx("rect", { x: "240", y: "126", width: "0", height: "16", rx: "3", fill: "#22d3ee", opacity: "0.9", children: _jsx("animate", { attributeName: "width", from: "0", to: "70", dur: "0.5s", begin: "1.3s", fill: "freeze" }) }), _jsx("rect", { x: "295", y: "154", width: "0", height: "16", rx: "3", fill: "#67e8f9", opacity: "0.9", children: _jsx("animate", { attributeName: "width", from: "0", to: "40", dur: "0.4s", begin: "1.6s", fill: "freeze" }) }), _jsx("path", { d: "M180 58 L180 70", stroke: "#64748b", strokeWidth: "1", fill: "none", strokeDasharray: "3,2", opacity: "0", children: _jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.3s", begin: "0.8s", fill: "freeze" }) }), _jsx("path", { d: "M260 86 L260 98", stroke: "#64748b", strokeWidth: "1", fill: "none", strokeDasharray: "3,2", opacity: "0", children: _jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.3s", begin: "1.2s", fill: "freeze" }) }), _jsxs("text", { x: "310", y: "26", fill: "#22d3ee", fontSize: "12", opacity: "0", children: ["\u2726 AI", _jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.4s", begin: "0.1s", fill: "freeze" }), _jsx("animateTransform", { attributeName: "transform", type: "scale", values: "0.8;1.1;1", dur: "0.5s", begin: "0.1s", fill: "freeze" })] })] }));
}
function MonteCarloMockup() {
    const bars = [8, 15, 28, 45, 60, 80, 95, 78, 55, 35, 20, 10, 5];
    return (_jsxs("svg", { viewBox: "0 0 360 200", className: "w-full h-full", children: [_jsx("rect", { width: "360", height: "200", fill: "#1e293b" }), _jsx("text", { x: "16", y: "26", fill: "#94a3b8", fontSize: "12", fontFamily: "system-ui", children: "Completion Probability" }), bars.map((h, i) => (_jsxs("rect", { x: 35 + i * 24, y: 180 - h, width: "18", rx: "2", fill: "#06b6d4", opacity: "0.8", height: "0", children: [_jsx("animate", { attributeName: "height", from: "0", to: String(h), dur: "0.4s", begin: `${0.1 + i * 0.08}s`, fill: "freeze" }), _jsx("animate", { attributeName: "y", from: "180", to: String(180 - h), dur: "0.4s", begin: `${0.1 + i * 0.08}s`, fill: "freeze" })] }, i))), _jsx("line", { x1: "155", y1: "34", x2: "155", y2: "180", stroke: "#fbbf24", strokeWidth: "1", strokeDasharray: "4,3", opacity: "0", children: _jsx("animate", { attributeName: "opacity", from: "0", to: "0.8", dur: "0.3s", begin: "1.2s", fill: "freeze" }) }), _jsxs("text", { x: "158", y: "44", fill: "#fbbf24", fontSize: "10", fontFamily: "system-ui", opacity: "0", children: ["P50", _jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.3s", begin: "1.2s", fill: "freeze" })] }), _jsx("line", { x1: "225", y1: "34", x2: "225", y2: "180", stroke: "#f97316", strokeWidth: "1", strokeDasharray: "4,3", opacity: "0", children: _jsx("animate", { attributeName: "opacity", from: "0", to: "0.8", dur: "0.3s", begin: "1.5s", fill: "freeze" }) }), _jsxs("text", { x: "228", y: "44", fill: "#f97316", fontSize: "10", fontFamily: "system-ui", opacity: "0", children: ["P80", _jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.3s", begin: "1.5s", fill: "freeze" })] }), _jsx("line", { x1: "275", y1: "34", x2: "275", y2: "180", stroke: "#ef4444", strokeWidth: "1", strokeDasharray: "4,3", opacity: "0", children: _jsx("animate", { attributeName: "opacity", from: "0", to: "0.8", dur: "0.3s", begin: "1.8s", fill: "freeze" }) }), _jsxs("text", { x: "278", y: "44", fill: "#ef4444", fontSize: "10", fontFamily: "system-ui", opacity: "0", children: ["P95", _jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.3s", begin: "1.8s", fill: "freeze" })] })] }));
}
function RiskDetectionMockup() {
    return (_jsxs("svg", { viewBox: "0 0 360 200", className: "w-full h-full", children: [_jsx("rect", { width: "360", height: "200", fill: "#1e293b" }), _jsx("text", { x: "16", y: "26", fill: "#94a3b8", fontSize: "12", fontFamily: "system-ui", children: "Risk Scanner" }), _jsxs("rect", { x: "0", y: "34", width: "360", height: "2", fill: "#3b82f6", opacity: "0", children: [_jsx("animate", { attributeName: "opacity", values: "0;0.6;0", dur: "1.5s", begin: "0.2s" }), _jsx("animate", { attributeName: "y", from: "34", to: "190", dur: "1.5s", begin: "0.2s", fill: "freeze" })] }), [
                { y: 46, text1: 'Budget overrun — Phase 2 at 23% over', severity: '#ef4444', tag: 'HIGH' },
                { y: 86, text1: 'Resource conflict — 3 devs double-booked', severity: '#f97316', tag: 'MED' },
                { y: 126, text1: 'Dependency delay — API blocked by vendor', severity: '#ef4444', tag: 'HIGH' },
                { y: 166, text1: 'Scope creep — 12 unplanned tasks added', severity: '#eab308', tag: 'LOW' },
            ].map((risk, i) => (_jsxs("g", { opacity: "0", children: [_jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.3s", begin: `${0.6 + i * 0.5}s`, fill: "freeze" }), _jsx("rect", { x: "14", y: risk.y, width: "6", height: "24", rx: "2", fill: risk.severity }), _jsx("text", { x: "28", y: risk.y + 15, fill: "#e2e8f0", fontSize: "10", fontFamily: "system-ui", children: risk.text1 }), _jsx("rect", { x: "300", y: risk.y + 3, width: "40", height: "18", rx: "9", fill: risk.severity, opacity: "0.2" }), _jsx("text", { x: "310", y: risk.y + 15, fill: risk.severity, fontSize: "9", fontWeight: "bold", fontFamily: "system-ui", children: risk.tag })] }, i)))] }));
}
function MeetingMockup() {
    const lines = [
        { text: 'Sarah: Finalize API spec by Friday', type: 'transcript' },
        { text: '→ Action: API spec — Sarah — due Fri', type: 'action' },
        { text: 'Tom: Client approved new design', type: 'transcript' },
        { text: '→ Decision: Design direction approved', type: 'decision' },
        { text: 'Lisa: QA starts Monday, 3 engineers', type: 'transcript' },
        { text: '→ Action: QA testing — Lisa — due Mon', type: 'action' },
    ];
    return (_jsxs("svg", { viewBox: "0 0 360 200", className: "w-full h-full", children: [_jsx("rect", { width: "360", height: "200", fill: "#1e293b" }), _jsx("text", { x: "16", y: "26", fill: "#94a3b8", fontSize: "12", fontFamily: "system-ui", children: "Meeting Analysis" }), lines.map((line, i) => (_jsxs("g", { opacity: "0", children: [_jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.3s", begin: `${0.3 + i * 0.4}s`, fill: "freeze" }), line.type === 'action' ? (_jsxs(_Fragment, { children: [_jsx("rect", { x: "14", y: 38 + i * 26, width: "332", height: "22", rx: "4", fill: "#3b82f6", opacity: "0.15" }), _jsx("text", { x: "22", y: 53 + i * 26, fill: "#60a5fa", fontSize: "10", fontFamily: "system-ui", children: line.text })] })) : line.type === 'decision' ? (_jsxs(_Fragment, { children: [_jsx("rect", { x: "14", y: 38 + i * 26, width: "332", height: "22", rx: "4", fill: "#a855f7", opacity: "0.15" }), _jsx("text", { x: "22", y: 53 + i * 26, fill: "#c084fc", fontSize: "10", fontFamily: "system-ui", children: line.text })] })) : (_jsx("text", { x: "22", y: 53 + i * 26, fill: "#94a3b8", fontSize: "10", fontFamily: "system-ui", children: line.text }))] }, i)))] }));
}
function PortfolioMockup() {
    const projects = [
        { name: 'Website Redesign', health: 92, color: '#10b981', w: 250 },
        { name: 'Mobile App v2', health: 67, color: '#f97316', w: 182 },
        { name: 'Data Migration', health: 85, color: '#10b981', w: 232 },
        { name: 'API Platform', health: 45, color: '#ef4444', w: 122 },
    ];
    return (_jsxs("svg", { viewBox: "0 0 360 200", className: "w-full h-full", children: [_jsx("rect", { width: "360", height: "200", fill: "#1e293b" }), _jsx("text", { x: "16", y: "26", fill: "#94a3b8", fontSize: "12", fontFamily: "system-ui", children: "Portfolio Health" }), projects.map((p, i) => (_jsxs("g", { opacity: "0", children: [_jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.3s", begin: `${0.2 + i * 0.3}s`, fill: "freeze" }), _jsx("text", { x: "16", y: 56 + i * 42, fill: "#e2e8f0", fontSize: "11", fontFamily: "system-ui", children: p.name }), _jsx("rect", { x: "16", y: 62 + i * 42, width: "280", height: "10", rx: "5", fill: "#334155" }), _jsx("rect", { x: "16", y: 62 + i * 42, width: "0", height: "10", rx: "5", fill: p.color, children: _jsx("animate", { attributeName: "width", from: "0", to: String(p.w), dur: "0.8s", begin: `${0.4 + i * 0.3}s`, fill: "freeze" }) }), _jsxs("text", { x: "304", y: 72 + i * 42, fill: p.color, fontSize: "11", fontWeight: "bold", fontFamily: "system-ui", opacity: "0", children: [p.health, "%", _jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.3s", begin: `${0.8 + i * 0.3}s`, fill: "freeze" })] })] }, i)))] }));
}
function NLQueryMockup() {
    return (_jsxs("svg", { viewBox: "0 0 360 200", className: "w-full h-full", children: [_jsx("rect", { width: "360", height: "200", fill: "#1e293b" }), _jsxs("g", { opacity: "0", children: [_jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.3s", begin: "0.3s", fill: "freeze" }), _jsx("rect", { x: "90", y: "14", width: "254", height: "30", rx: "15", fill: "#3b82f6" }), _jsx("text", { x: "106", y: "34", fill: "white", fontSize: "11", fontFamily: "system-ui", children: "Which tasks are overdue this sprint?" })] }), _jsxs("g", { opacity: "0", children: [_jsx("animate", { attributeName: "opacity", values: "0;1;1;0", dur: "1s", begin: "0.8s", fill: "freeze" }), _jsx("circle", { cx: "28", cy: "68", r: "3.5", fill: "#64748b", children: _jsx("animate", { attributeName: "opacity", values: "0.3;1;0.3", dur: "0.6s", repeatCount: "2", begin: "0.8s" }) }), _jsx("circle", { cx: "40", cy: "68", r: "3.5", fill: "#64748b", children: _jsx("animate", { attributeName: "opacity", values: "0.3;1;0.3", dur: "0.6s", repeatCount: "2", begin: "0.9s" }) }), _jsx("circle", { cx: "52", cy: "68", r: "3.5", fill: "#64748b", children: _jsx("animate", { attributeName: "opacity", values: "0.3;1;0.3", dur: "0.6s", repeatCount: "2", begin: "1.0s" }) })] }), _jsxs("g", { opacity: "0", children: [_jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.4s", begin: "1.8s", fill: "freeze" }), _jsx("rect", { x: "16", y: "56", width: "270", height: "130", rx: "14", fill: "#334155" }), _jsx("text", { x: "30", y: "78", fill: "#e2e8f0", fontSize: "11", fontFamily: "system-ui", children: "Found 3 overdue tasks:" }), _jsx("text", { x: "30", y: "100", fill: "#f87171", fontSize: "10", fontFamily: "system-ui", children: "\u2022 API auth module \u2014 3 days overdue" }), _jsx("text", { x: "30", y: "120", fill: "#f87171", fontSize: "10", fontFamily: "system-ui", children: "\u2022 DB schema review \u2014 1 day overdue" }), _jsx("text", { x: "30", y: "140", fill: "#fbbf24", fontSize: "10", fontFamily: "system-ui", children: "\u2022 UI wireframes \u2014 due today" }), _jsx("text", { x: "30", y: "162", fill: "#94a3b8", fontSize: "10", fontFamily: "system-ui", children: "Suggest auto-reschedule?" }), _jsx("rect", { x: "30", y: "170", width: "60", height: "18", rx: "9", fill: "#3b82f6", opacity: "0", children: _jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.3s", begin: "2.4s", fill: "freeze" }) }), _jsxs("text", { x: "40", y: "183", fill: "white", fontSize: "9", fontFamily: "system-ui", opacity: "0", children: ["Yes, do it", _jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.3s", begin: "2.4s", fill: "freeze" })] })] }), _jsx("circle", { cx: "30", cy: "88", r: "12", fill: "#3b82f6", opacity: "0", children: _jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.3s", begin: "1.8s", fill: "freeze" }) }), _jsxs("text", { x: "24", y: "92", fill: "white", fontSize: "10", fontWeight: "bold", fontFamily: "system-ui", opacity: "0", children: ["M", _jsx("animate", { attributeName: "opacity", from: "0", to: "1", dur: "0.3s", begin: "1.8s", fill: "freeze" })] })] }));
}
function HeroMockup() {
    const [health, setHealth] = useState(0);
    const [bars, setBars] = useState([42, 58, 70, 84, 95, 88, 72, 54, 60, 46, 34, 24]);
    useEffect(() => {
        const target = 82;
        let v = 0;
        const ct = setInterval(() => {
            v = Math.min(target, v + 3);
            setHealth(v);
            if (v >= target)
                clearInterval(ct);
        }, 28);
        return () => clearInterval(ct);
    }, []);
    useEffect(() => {
        const bt = setInterval(() => {
            setBars(Array.from({ length: 12 }, (_, i) => {
                const base = 95 * Math.exp(-Math.pow((i - 5.2) / 3.4, 2));
                const jitter = Math.random() * 20 - 10;
                return Math.max(22, Math.min(98, Math.round(base + jitter)));
            }));
        }, 3500);
        return () => clearInterval(bt);
    }, []);
    return (_jsxs("div", { className: "relative", style: { animation: 'hfloat 6s ease-in-out infinite' }, children: [_jsx("div", { className: "absolute -inset-8 blur-xl", style: { background: 'radial-gradient(circle at 60% 40%, rgba(34,211,238,0.18), transparent 60%)' } }), _jsxs("div", { className: "relative rounded-2xl overflow-hidden shadow-2xl", style: { background: 'linear-gradient(160deg, #111a2e, #0f1626)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 30px 70px rgba(0,0,0,0.5)', padding: 18 }, children: [_jsxs("div", { className: "flex items-center gap-1.5 pb-3.5 px-1", children: [_jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-red-500" }), _jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-amber-500" }), _jsx("span", { className: "w-2.5 h-2.5 rounded-full bg-green-500" }), _jsx("span", { className: "ml-2.5 text-xs text-slate-500", style: { fontFamily: "'JetBrains Mono', monospace" }, children: "portfolio \u00B7 health" }), _jsxs("span", { className: "ml-auto inline-flex items-center gap-1.5 text-[10.5px] font-semibold text-green-400 px-2 py-0.5 rounded-full", style: { background: 'rgba(74,222,128,0.12)' }, children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-green-400", style: { animation: 'hpulse 1.6s ease-in-out infinite' } }), "Live"] })] }), _jsx("div", { className: "grid grid-cols-3 gap-2.5", children: [
                            { label: 'Health', value: `${health}%`, color: '#4ade80' },
                            { label: 'On track', value: '7/10', color: '#f8fafc' },
                            { label: 'CPI', value: '0.94', color: '#fbbf24' },
                        ].map((kpi) => (_jsxs("div", { className: "rounded-xl p-3", style: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }, children: [_jsx("p", { className: "text-[11px] text-slate-500 m-0", children: kpi.label }), _jsx("p", { className: "text-[22px] font-extrabold mt-1 m-0 tabular-nums", style: { color: kpi.color }, children: kpi.value })] }, kpi.label))) }), _jsxs("div", { className: "mt-2.5 rounded-xl p-3.5", style: { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }, children: [_jsxs("div", { className: "flex items-center justify-between mb-3", children: [_jsx("p", { className: "text-xs font-semibold text-slate-300 m-0", children: "Delivery confidence" }), _jsxs("span", { className: "inline-flex items-center gap-1.5 text-[11px] text-cyan-400", style: { fontFamily: "'JetBrains Mono', monospace" }, children: ["Monte Carlo", _jsx("span", { className: "w-1 h-1 rounded-full bg-cyan-400", style: { animation: 'hpulse 1.6s ease-in-out infinite' } })] })] }), _jsx("div", { className: "flex items-end gap-1.5 h-[88px]", children: bars.map((h, i) => (_jsx("span", { className: "flex-1 rounded-t", style: {
                                        background: 'linear-gradient(180deg, #3b82f6, #22d3ee)',
                                        height: `${h}%`,
                                        opacity: 0.4 + 0.6 * (h / 100),
                                        transition: 'height 1s cubic-bezier(0.34,1.2,0.64,1), opacity 1s ease',
                                    } }, i))) })] }), _jsxs("div", { className: "flex gap-2.5 mt-2.5 rounded-xl p-3", style: { background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.25)' }, children: [_jsxs("svg", { width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "#60a5fa", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", className: "flex-shrink-0 mt-0.5", children: [_jsx("path", { d: "M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.1h6c0-.8.4-1.6 1-2.1A7 7 0 0 0 12 2z" }), _jsx("path", { d: "M9 18h6M10 22h4" })] }), _jsxs("p", { className: "text-[12.5px] text-blue-100 m-0 leading-snug", children: [_jsx("strong", { className: "text-white", children: "AI insight:" }), " City Fiber Rollout is trending 6 days late \u2014 reforecast recommended."] })] })] })] }));
}
const featureMockups = {
    'AI-Powered Scheduling': SchedulingMockup,
    'Monte Carlo Simulations': MonteCarloMockup,
    'Smart Risk Detection': RiskDetectionMockup,
    'Meeting Intelligence': MeetingMockup,
    'Portfolio Dashboard': PortfolioMockup,
    'Natural Language Queries': NLQueryMockup,
};
function FeatureCard({ feature }) {
    const [showPreview, setShowPreview] = useState(false);
    const timeoutRef = useRef();
    const Mockup = featureMockups[feature.title];
    const handleMouseEnter = useCallback(() => {
        if (!Mockup)
            return;
        timeoutRef.current = setTimeout(() => setShowPreview(true), 400);
    }, [Mockup]);
    const handleMouseLeave = useCallback(() => {
        clearTimeout(timeoutRef.current);
        setShowPreview(false);
    }, []);
    return (_jsxs("div", { className: `group relative rounded-2xl p-6 border hover:shadow-lg hover:shadow-blue-500/10 hover:-translate-y-1 hover:z-40 transition-all duration-300 ${feature.cardBg}`, onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave, children: [_jsx("div", { className: `absolute top-0 left-6 right-6 h-1 rounded-b-full bg-gradient-to-r ${feature.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300` }), _jsx("div", { className: `w-12 h-12 ${feature.iconBg} rounded-xl flex items-center justify-center mb-4`, children: feature.icon }), _jsx("h3", { className: "text-xl font-semibold text-white mb-2", children: feature.title }), _jsx("p", { className: "text-slate-300 text-sm leading-relaxed", children: feature.description }), Mockup && showPreview && (_jsxs("div", { className: "absolute left-1/2 -translate-x-1/2 bottom-full mb-3 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10", children: [_jsx("div", { className: "absolute left-1/2 -translate-x-1/2 top-full w-3 h-3 bg-[#1e293b] rotate-45 -mt-1.5" }), _jsx(Mockup, {}), _jsx("div", { className: "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2", children: _jsx("p", { className: "text-white text-xs font-medium", children: feature.title }) })] }))] }));
}
function FeatureItem({ feature, highlighted }) {
    const [hovered, setHovered] = useState(false);
    const tooltip = featureTooltips[feature];
    return (_jsxs("li", { className: "relative flex items-start text-sm cursor-default", onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false), children: [!(tooltip && hovered) ? (_jsx("svg", { className: `w-4 h-4 mr-2.5 flex-shrink-0 mt-0.5 ${highlighted ? 'text-cyan-300' : 'text-blue-400'}`, fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z", clipRule: "evenodd" }) })) : (_jsx("div", { className: "w-4 mr-2.5 flex-shrink-0" })), _jsxs("div", { className: "flex-1", children: [_jsx("span", { className: `${highlighted ? 'text-blue-100' : 'text-slate-200'} ${tooltip && !hovered ? `border-b border-dashed ${highlighted ? 'border-cyan-300/40' : 'border-slate-500'}` : ''}`, children: feature }), tooltip && hovered && (_jsx("p", { className: `mt-1 text-xs leading-relaxed ${highlighted ? 'text-blue-200/70' : 'text-slate-400'}`, children: tooltip }))] })] }));
}
export const LandingPage = () => {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    return (_jsxs("div", { className: "min-h-screen bg-[#0a0f1a] overflow-x-hidden", children: [_jsx("style", { children: `
        @keyframes hfloat { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-7px) } }
        @keyframes hpulse { 0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(74,222,128,0.6) } 50% { opacity: .5; box-shadow: 0 0 0 5px rgba(74,222,128,0) } }
      ` }), _jsx("nav", { className: "bg-[#0a0f1a]/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-50", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "flex justify-between items-center h-16", children: [_jsxs("div", { className: "flex items-center", children: [_jsx("div", { className: "w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-400 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20", children: _jsx("svg", { className: "w-5 h-5 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" }) }) }), _jsx("span", { className: "ml-2 text-xl font-bold text-white", children: "Kovarti PM" })] }), _jsxs("div", { className: "hidden md:flex items-center space-x-4", children: [_jsx(Link, { to: "/pricing", className: "text-sm text-slate-400 hover:text-white transition-colors", children: "Pricing" }), _jsx(Link, { to: "/login", className: "text-sm text-slate-400 hover:text-white transition-colors", children: "Sign In" }), _jsx(Link, { to: "/register", className: "text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 px-4 py-2 rounded-lg transition-all shadow-md shadow-blue-500/20", children: "Get Started" })] }), _jsx("button", { onClick: () => setMobileMenuOpen(!mobileMenuOpen), className: "md:hidden p-2 text-slate-400 hover:text-white transition-colors", "aria-label": "Toggle menu", children: mobileMenuOpen ? (_jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" }) })) : (_jsx("svg", { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M4 6h16M4 12h16M4 18h16" }) })) })] }), mobileMenuOpen && (_jsxs("div", { className: "md:hidden border-t border-white/5 py-3 space-y-1", children: [_jsx(Link, { to: "/pricing", onClick: () => setMobileMenuOpen(false), className: "block px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors", children: "Pricing" }), _jsx(Link, { to: "/login", onClick: () => setMobileMenuOpen(false), className: "block px-3 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 rounded-lg transition-colors", children: "Sign In" }), _jsx(Link, { to: "/register", onClick: () => setMobileMenuOpen(false), className: "block px-3 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-cyan-400 rounded-lg text-center mt-2", children: "Get Started" })] }))] }) }), _jsx("section", { className: "relative overflow-hidden", style: { background: 'radial-gradient(1200px 600px at 50% -8%, rgba(59,130,246,0.12), transparent 60%)' }, children: _jsxs("div", { className: "max-w-[1200px] mx-auto px-4 sm:px-8 pt-16 sm:pt-[72px] pb-16 sm:pb-[90px] grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-14 items-center", style: { fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }, children: [_jsxs("div", { children: [_jsxs("span", { className: "inline-flex items-center gap-2 text-[13px] font-semibold text-blue-200 px-3.5 py-1.5 rounded-full", style: { background: 'rgba(59,130,246,0.14)', border: '1px solid rgba(59,130,246,0.3)' }, children: [_jsx("span", { className: "w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_theme(colors.cyan.400)]" }), "MS Project-grade scheduling \u2014 powered by AI"] }), _jsxs("h1", { className: "text-4xl sm:text-5xl lg:text-[60px] font-extrabold text-white mt-5 leading-[1.04] tracking-tight", children: ["Manage projects", _jsx("br", {}), _jsx("span", { className: "bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent", children: "smarter with AI" })] }), _jsx("p", { className: "text-lg text-slate-300 mt-5 leading-relaxed max-w-[520px]", children: "Plan smarter, predict risks, and deliver on time with intelligent scheduling, Monte Carlo simulations, and natural-language project insights." }), _jsxs("div", { className: "flex items-center gap-3.5 mt-8", children: [_jsx(Link, { to: "/register", className: "text-[15px] font-bold text-white bg-gradient-to-br from-blue-500 to-cyan-400 hover:from-blue-600 hover:to-cyan-500 px-7 py-3.5 rounded-xl transition-all shadow-lg shadow-blue-500/35 hover:shadow-xl hover:shadow-blue-500/40 hover:-translate-y-0.5", children: "Start Free Trial" }), _jsx("a", { href: "#pricing", className: "text-[15px] font-semibold text-white px-6 py-3.5 rounded-xl transition-all hover:-translate-y-0.5", style: { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }, children: "View Pricing" })] }), _jsx("div", { className: "flex items-center gap-5 mt-7 flex-wrap", children: ['No credit card', '14-day trial', 'Setup in minutes'].map((label) => (_jsxs("span", { className: "flex items-center gap-2 text-[13px] text-slate-500", children: [_jsx("svg", { width: "15", height: "15", viewBox: "0 0 24 24", fill: "none", stroke: "#4ade80", strokeWidth: "2.4", strokeLinecap: "round", strokeLinejoin: "round", children: _jsx("polyline", { points: "20 6 9 17 4 12" }) }), label] }, label))) })] }), _jsx("div", { className: "hidden lg:block", children: _jsx(HeroMockup, {}) })] }) }), _jsx("section", { className: "pt-28 pb-20", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "text-center mb-14", children: [_jsx("h2", { className: "text-2xl sm:text-3xl font-bold text-white", children: "Everything you need to manage projects" }), _jsx("p", { className: "mt-3 text-base text-slate-300", children: "Powerful AI features built for modern project managers" })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6", children: features.map((feature) => (_jsx(FeatureCard, { feature: feature }, feature.title))) })] }) }), _jsx("section", { id: "pricing", className: "pt-28 pb-20 border-t border-white/5 scroll-mt-16", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "text-center mb-14", children: [_jsx("h2", { className: "text-2xl sm:text-3xl font-bold text-white", children: "Simple, transparent pricing" }), _jsx("p", { className: "mt-3 text-base text-slate-300", children: "Start free, upgrade when you need more power" })] }), _jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto", children: pricingTiers.map((tier) => (_jsxs("div", { className: `rounded-2xl p-6 transition-all duration-300 ${tier.highlighted
                                    ? 'bg-gradient-to-br from-blue-600 to-cyan-500 text-white ring-4 ring-blue-400/30 ring-offset-2 ring-offset-[#0a0f1a] shadow-2xl shadow-blue-500/20'
                                    : 'bg-[#111827]/70 backdrop-blur-sm border border-white/10 hover:border-white/15'} ${tier.disabled ? 'opacity-60' : ''}`, children: [tier.badge && (_jsx("span", { className: "inline-block px-3 py-1 text-xs font-semibold bg-white/20 text-white rounded-full mb-4 backdrop-blur-sm", children: tier.badge })), _jsx("h3", { className: `text-lg font-semibold ${tier.highlighted ? 'text-white' : 'text-white'}`, children: tier.name }), _jsx("div", { className: "mt-4 flex items-baseline", children: tier.price ? (_jsxs(_Fragment, { children: [_jsx("span", { className: "text-4xl font-bold text-white", children: tier.price }), tier.period && (_jsx("span", { className: `ml-1 text-sm ${tier.highlighted ? 'text-blue-100' : 'text-slate-400'}`, children: tier.period }))] })) : (_jsx("span", { className: "text-2xl font-bold text-slate-500", children: "TBD" })) }), _jsx("p", { className: `mt-2 text-sm ${tier.highlighted ? 'text-blue-100' : 'text-slate-300'}`, children: tier.description }), _jsx("ul", { className: "mt-6 space-y-3", children: tier.features.map((feature) => (_jsx(FeatureItem, { feature: feature, highlighted: tier.highlighted }, feature))) }), _jsx("div", { className: "mt-8", children: tier.disabled ? (_jsx("span", { className: "block w-full text-center py-2.5 px-4 text-sm font-medium rounded-lg bg-white/5 text-slate-500 cursor-not-allowed", children: tier.cta })) : (_jsx(Link, { to: tier.ctaLink, className: `block w-full text-center py-2.5 px-4 text-sm font-semibold rounded-lg transition-all ${tier.highlighted
                                                ? 'bg-white text-blue-600 hover:bg-blue-50 shadow-md'
                                                : 'bg-gradient-to-r from-blue-500 to-cyan-400 text-white hover:from-blue-600 hover:to-cyan-500 shadow-md shadow-blue-500/20'}`, children: tier.cta })) })] }, tier.name))) })] }) }), _jsx("footer", { className: "border-t border-white/5 text-slate-500", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12", children: [_jsxs("div", { className: "flex flex-col md:flex-row justify-between items-center", children: [_jsxs("div", { className: "flex items-center mb-4 md:mb-0", children: [_jsx("div", { className: "w-6 h-6 bg-gradient-to-br from-blue-500 to-cyan-400 rounded flex items-center justify-center", children: _jsx("svg", { className: "w-4 h-4 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" }) }) }), _jsx("span", { className: "ml-2 text-sm font-semibold text-white", children: "Kovarti PM" })] }), _jsxs("div", { className: "flex space-x-6 text-sm", children: [_jsx(Link, { to: "/terms", className: "hover:text-white transition-colors", children: "Terms of Service" }), _jsx(Link, { to: "/privacy", className: "hover:text-white transition-colors", children: "Privacy Policy" }), _jsx(Link, { to: "/pricing", className: "hover:text-white transition-colors", children: "Pricing" })] })] }), _jsxs("div", { className: "mt-8 text-center text-xs text-slate-600", children: ["\u00A9 ", new Date().getFullYear(), " Kovarti PM. All rights reserved."] })] }) })] }));
};
