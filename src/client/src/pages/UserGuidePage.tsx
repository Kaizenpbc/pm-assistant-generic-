import React from 'react';
import {
  Rocket,
  FolderKanban,
  TrendingUp,
  FileText,
  Layers,
  Brain,
  Dice5,
  Workflow,
  MessageSquare,
  BookOpen,
  Search,
  CreditCard,
  Activity,
} from 'lucide-react';

interface Section {
  id: string;
  title: string;
  icon: React.ElementType;
  description: string;
  items: string[];
}

const sections: Section[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: Rocket,
    description:
      'Create your account, sign in, and get oriented with the dashboard.',
    items: [
      'Sign up with email and verify your account',
      'Log in and explore the main dashboard',
      'View project summaries, upcoming deadlines, and key metrics at a glance',
      'Use the sidebar to navigate between features',
    ],
  },
  {
    id: 'managing-projects',
    title: 'Managing Projects',
    icon: FolderKanban,
    description:
      'Create and manage projects with multiple visualization options.',
    items: [
      'Create new projects with name, dates, and budget',
      'Switch between Gantt, Kanban, Table, and Calendar views',
      'Add, edit, and delete tasks with dependencies',
      'Assign resources and track progress percentages',
      'Drag-and-drop tasks in Kanban and Gantt views',
    ],
  },
  {
    id: 'earned-value',
    title: 'Earned Value & Forecasting',
    icon: TrendingUp,
    description:
      'Track project health with Earned Value Management metrics and automated forecasting.',
    items: [
      'Monitor CPI, SPI, EAC, and other EVM indicators',
      'View S-curve charts comparing planned vs. actual progress',
      'Use auto-reschedule to adjust timelines based on current performance',
      'Identify cost and schedule variances early',
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    icon: FileText,
    description:
      'Generate comprehensive reports for stakeholders and decision-making.',
    items: [
      'Status reports with executive summaries',
      'Risk assessment reports with mitigation plans',
      'Budget tracking and variance analysis',
      'Resource utilization and allocation reports',
    ],
  },
  {
    id: 'portfolio',
    title: 'Portfolio View',
    icon: Layers,
    description:
      'Get a bird\u2019s-eye view across all your projects.',
    items: [
      'Cross-project Gantt chart for timeline comparison',
      'Portfolio health dashboard with red/amber/green indicators',
      'Aggregate budget and resource utilization',
      'Filter and sort projects by status, priority, or health',
    ],
  },
  {
    id: 'intelligence',
    title: 'Intelligence',
    icon: Brain,
    description:
      'AI-powered scenario modeling and risk analysis tools.',
    items: [
      'Scenario modeling to compare what-if plans',
      'Risk heatmap for visual risk prioritization',
      'Budget analysis with trend detection',
      'Anomaly detection to flag unusual project patterns',
    ],
  },
  {
    id: 'monte-carlo',
    title: 'Monte Carlo Simulation',
    icon: Dice5,
    description:
      'Run probabilistic simulations to forecast project outcomes.',
    items: [
      'Configure and run simulations with custom parameters',
      'View confidence levels for completion dates and budgets',
      'Sensitivity analysis to identify highest-impact variables',
      'Export simulation results for stakeholder presentations',
    ],
  },
  {
    id: 'workflows',
    title: 'Workflows',
    icon: Workflow,
    description:
      'Automate repetitive actions with trigger-based rules.',
    items: [
      'Create automation rules with triggers and actions',
      'Trigger on task status changes, date thresholds, or budget alerts',
      'Actions include notifications, status updates, and assignments',
      'Enable or disable rules without deleting them',
    ],
  },
  {
    id: 'meetings',
    title: 'Meeting Intelligence',
    icon: MessageSquare,
    description:
      'Upload meeting transcripts and let AI extract key information.',
    items: [
      'Upload or paste meeting transcripts',
      'AI extracts action items, decisions, and risks',
      'Link extracted items directly to project tasks',
      'Search and review past meeting notes',
    ],
  },
  {
    id: 'lessons-learned',
    title: 'Lessons Learned',
    icon: BookOpen,
    description:
      'Capture project insights and discover patterns across your portfolio.',
    items: [
      'Record lessons with category, impact, and recommendations',
      'AI pattern analysis to surface recurring themes',
      'Filter by project, category, or time period',
      'Share insights across teams to prevent repeated mistakes',
    ],
  },
  {
    id: 'ask-ai',
    title: 'Ask AI',
    icon: Search,
    description:
      'Query your project data using natural language.',
    items: [
      'Ask questions like "Which projects are over budget?"',
      'AI generates charts and tables from your data',
      'Get contextual recommendations and insights',
      'Export AI-generated visualizations',
    ],
  },
  {
    id: 'agent-activity',
    title: 'Agent Activity',
    icon: Activity,
    description:
      'See what each AI agent decided for your project and why.',
    items: [
      'View the "Agent Activity" tab on any project detail page',
      'Each agent run logs its decision: alert created, skipped, or error',
      'Filter by agent (Auto-Reschedule, Budget, Monte Carlo, Meeting)',
      'Summaries explain why an alert was or wasn\'t created (e.g., thresholds, metrics)',
      'Paginated log with timestamps for full audit trail',
    ],
  },
  {
    id: 'account-billing',
    title: 'Account & Billing',
    icon: CreditCard,
    description:
      'Manage your subscription, billing, and account settings.',
    items: [
      'View current plan and usage',
      'Upgrade, downgrade, or cancel your subscription',
      '14-day free trial on paid tiers',
      'Manage payment methods via Stripe portal',
    ],
  },
];

export const UserGuideContent: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">User Guide</h1>
      <p className="text-gray-500 mb-8">
        Everything you need to know to get the most out of Kovarti PM Assistant.
      </p>

      {/* Table of Contents */}
      <nav className="bg-gray-50 rounded-xl p-6 mb-10 border border-gray-200">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
          Contents
        </h2>
        <ol className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-sm text-indigo-600 hover:text-indigo-800 hover:underline"
              >
                {i + 1}. {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Sections */}
      <div className="space-y-10">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <section key={s.id} id={s.id} className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-indigo-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {s.title}
                </h2>
              </div>
              <p className="text-gray-600 mb-3">{s.description}</p>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-600">
                {s.items.map((item, idx) => (
                  <li key={idx}>{item}</li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export const UserGuidePage: React.FC = () => {
  return (
    <div className="p-6 md:p-10">
      <UserGuideContent />
    </div>
  );
};
