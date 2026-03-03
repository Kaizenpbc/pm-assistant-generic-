import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const LAUNCH_DATE = new Date('2026-06-01T00:00:00Z');

function useCountdown(target: Date) {
  const calc = () => {
    const diff = Math.max(0, target.getTime() - Date.now());
    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
      minutes: Math.floor((diff / (1000 * 60)) % 60),
      seconds: Math.floor((diff / 1000) % 60),
    };
  };
  const [time, setTime] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  return time;
}

const features = [
  {
    title: 'AI-Powered Scheduling',
    description: 'Generate task breakdowns, dependencies, and optimized timelines in seconds.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
    color: 'from-amber-400 to-orange-500',
  },
  {
    title: 'Monte Carlo Simulations',
    description: 'Probabilistic risk analysis that tells you exactly how confident to be in your timeline.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    color: 'from-emerald-400 to-teal-500',
  },
  {
    title: 'Smart Risk Detection',
    description: 'AI monitors your projects 24/7 and alerts you before delays become disasters.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    color: 'from-rose-400 to-pink-500',
  },
  {
    title: 'Meeting Intelligence',
    description: 'Paste a transcript, get action items and project updates extracted instantly.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
      </svg>
    ),
    color: 'from-violet-400 to-purple-500',
  },
  {
    title: 'Portfolio Dashboard',
    description: 'One view. Every project. Health scores, budgets, and timelines at a glance.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zm10 0a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    color: 'from-sky-400 to-blue-500',
  },
  {
    title: 'Natural Language Queries',
    description: 'Ask "Which projects are at risk this quarter?" and get answers — not a dashboard.',
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
      </svg>
    ),
    color: 'from-cyan-400 to-indigo-500',
  },
];

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-20 h-20 sm:w-24 sm:h-24 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center backdrop-blur-sm">
        <span className="text-3xl sm:text-4xl font-bold text-white tabular-nums">
          {String(value).padStart(2, '0')}
        </span>
      </div>
      <span className="mt-2 text-xs font-medium text-indigo-300 uppercase tracking-widest">{label}</span>
    </div>
  );
}

export const PrelaunchLandingPage: React.FC = () => {
  const countdown = useCountdown(LAUNCH_DATE);
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/v1/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus('success');
        setMessage(data.message);
        setEmail('');
      } else {
        setStatus('error');
        setMessage(data.error || 'Something went wrong.');
      }
    } catch {
      setStatus('error');
      setMessage('Could not connect. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[700px] bg-indigo-600/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/3 left-0 w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 right-0 w-[400px] h-[400px] bg-cyan-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-violet-600/10 rounded-full blur-[100px]" />
      </div>

      {/* Announcement bar */}
      <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 py-2.5 px-4 text-center text-sm font-medium text-white">
        <span className="mr-2">🎉</span>
        Join the waitlist now and get <span className="font-bold underline underline-offset-2">25% off</span> when we launch — limited spots available.
        <span className="ml-2">🚀</span>
      </div>

      {/* Nav */}
      <nav className="border-b border-white/5 backdrop-blur-md bg-slate-950/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-900">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="text-lg font-bold">Kovarti</span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          {/* Coming Soon */}
          <div className="mb-8">
            <div className="inline-flex flex-col sm:flex-row items-center gap-3">
              <div className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-indigo-500/15 border border-indigo-500/40">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-lg font-bold text-indigo-300 tracking-wide uppercase">Coming Soon</span>
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse" />
              </div>
              <span className="text-base font-semibold text-slate-400 tracking-widest uppercase">Summer 2026</span>
            </div>
          </div>

          <h1 className="text-5xl sm:text-7xl font-extrabold tracking-tight leading-none">
            <span className="text-white">Project Management</span>
            <br />
            <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-purple-400 bg-clip-text text-transparent">
              Finally Gets AI.
            </span>
          </h1>

          <p className="mt-8 text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Intelligent scheduling. Risk prediction. Monte Carlo simulations. Meeting intelligence.
            <br className="hidden sm:block" />
            <span className="text-slate-300 font-medium">The PM tool that thinks before you ask.</span>
          </p>

          {/* Countdown */}
          <div className="mt-14">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-6">Launching in</p>
            <div className="flex justify-center gap-4 sm:gap-6">
              <CountdownUnit value={countdown.days} label="Days" />
              <CountdownUnit value={countdown.hours} label="Hours" />
              <CountdownUnit value={countdown.minutes} label="Minutes" />
              <CountdownUnit value={countdown.seconds} label="Seconds" />
            </div>
          </div>

        </div>
      </section>

      {/* Social proof strip */}
      <section className="py-10 border-y border-white/5">
        <div className="max-w-4xl mx-auto px-4 flex flex-wrap justify-center gap-8 sm:gap-16 text-center">
          {[
            { label: 'AI features built-in', value: '15+' },
            { label: 'Risk detection models', value: '3' },
            { label: 'Avg. time saved per PM', value: '6 hrs/wk' },
            { label: 'Accuracy on delay forecasts', value: '94%' },
          ].map(stat => (
            <div key={stat.label}>
              <div className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">{stat.value}</div>
              <div className="text-xs text-slate-500 mt-1 uppercase tracking-wide">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">What's coming</h2>
            <p className="mt-4 text-lg text-slate-300">Every feature you've wished your PM tool had.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(feature => (
              <div
                key={feature.title}
                className="group relative bg-slate-900 hover:bg-slate-800 border border-slate-700/50 hover:border-slate-600 rounded-2xl p-6 transition-all duration-300"
              >
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${feature.color} p-0.5 mb-4`}>
                  <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center text-white">
                    {feature.icon}
                  </div>
                </div>
                <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-slate-300 leading-relaxed">{feature.description}</p>
                <div className={`absolute bottom-0 left-6 right-6 h-0.5 rounded-t-full bg-gradient-to-r ${feature.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 mb-6">
            <span className="text-sm font-medium text-purple-300">Limited early access spots</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Don't manage projects the old way.
          </h2>
          <p className="text-slate-400 mb-8 text-lg">
            Join the waitlist and get 25% off your first year — exclusively for early supporters.
          </p>
          {status === 'success' ? (
            <div className="max-w-md mx-auto bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-emerald-400 font-bold text-xl mb-2">You're on the list!</p>
              <p className="text-slate-400 text-sm">We'll email you the moment we go live with your exclusive 25% discount. See you at launch.</p>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm transition-all"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="px-6 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-60 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-900 text-sm whitespace-nowrap"
                >
                  {status === 'loading' ? 'Joining...' : 'Reserve My Spot'}
                </button>
              </form>
              {status === 'error' && <p className="mt-3 text-rose-400 text-xs">{message}</p>}
              <p className="mt-5 text-xs text-slate-600">No spam. Unsubscribe anytime. Your discount is held for 7 days after launch.</p>
            </>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-purple-600 rounded flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <span className="text-sm font-semibold text-white">Kovarti</span>
          </div>
          <div className="flex gap-6 text-sm text-slate-500">
            <Link to="/terms" className="hover:text-white transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-white transition-colors">Privacy</Link>
          </div>
          <div className="text-xs text-slate-600">&copy; {new Date().getFullYear()} Kovarti. All rights reserved.</div>
        </div>
      </footer>
    </div>
  );
};
