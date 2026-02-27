import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  CreditCard,
  Crown,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { apiService } from '../services/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubscriptionStatus {
  tier: string;
  status: string;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function getStatusBadge(status: string, cancelAtPeriodEnd: boolean) {
  if (cancelAtPeriodEnd) {
    return { label: 'Canceling', color: 'bg-amber-100 text-amber-700', icon: XCircle };
  }
  switch (status) {
    case 'trialing':
      return { label: 'Trialing', color: 'bg-blue-100 text-blue-700', icon: Clock };
    case 'active':
      return { label: 'Active', color: 'bg-green-100 text-green-700', icon: CheckCircle2 };
    case 'past_due':
      return { label: 'Past Due', color: 'bg-red-100 text-red-700', icon: AlertCircle };
    case 'canceled':
      return { label: 'Canceled', color: 'bg-gray-100 text-gray-600', icon: XCircle };
    default:
      return { label: status || 'Free', color: 'bg-gray-100 text-gray-600', icon: CreditCard };
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const AccountBillingPage: React.FC = () => {
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const { data, isLoading, error } = useQuery<SubscriptionStatus>({
    queryKey: ['subscription-status'],
    queryFn: () => apiService.getSubscriptionStatus(),
  });

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const result = await apiService.createPortalSession();
      window.location.href = result.url;
    } catch {
      setPortalLoading(false);
    }
  };

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const result = await apiService.createCheckoutSession();
      window.location.href = result.url;
    } catch {
      setCheckoutLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="h-4 bg-gray-200 rounded w-48" />
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
          <p className="text-red-700 text-sm">Failed to load billing information. Please try again later.</p>
        </div>
      </div>
    );
  }

  const isPro = data.tier === 'pro' || data.tier === 'business';
  const isTrialing = data.status === 'trialing';
  const trialDays = daysUntil(data.trialEndsAt);
  const badge = getStatusBadge(data.status, data.cancelAtPeriodEnd);
  const BadgeIcon = badge.icon;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Account & Billing</h1>
        <p className="text-sm text-gray-500 mt-1">Manage your subscription and billing details</p>
      </div>

      {isPro ? (
        <>
          {/* Current Plan Card */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Current Plan</h2>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center">
                <Crown className="w-6 h-6 text-indigo-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-lg font-semibold text-gray-900">Pro Plan</span>
                  <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}>
                    <BadgeIcon className="w-3 h-3" />
                    {badge.label}
                  </span>
                </div>

                <div className="mt-2 space-y-1 text-sm text-gray-600">
                  {isTrialing && trialDays !== null && (
                    <p>
                      Trial ends <span className="font-medium text-gray-900">{formatDate(data.trialEndsAt)}</span>
                      {' '}({trialDays} day{trialDays !== 1 ? 's' : ''} remaining)
                    </p>
                  )}
                  {data.currentPeriodEnd && !data.cancelAtPeriodEnd && (
                    <p>
                      Next billing date: <span className="font-medium text-gray-900">{formatDate(data.currentPeriodEnd)}</span>
                    </p>
                  )}
                  {data.cancelAtPeriodEnd && data.currentPeriodEnd && (
                    <p className="text-amber-700">
                      Access until <span className="font-medium">{formatDate(data.currentPeriodEnd)}</span>, then reverts to Free
                    </p>
                  )}
                </div>

                <button
                  onClick={handleManageBilling}
                  disabled={portalLoading}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {portalLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  Manage Billing
                </button>
              </div>
            </div>
          </div>

          {/* Plan Details Card */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Plan Details</h2>
            <ul className="space-y-3">
              {[
                'Unlimited projects',
                'AI-powered insights & reports',
                'EVM forecasting & Monte Carlo simulation',
                'Meeting minutes & lessons learned',
                'Priority support',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : (
        /* Free User — Upgrade Card */
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl shadow-sm p-6">
          <div className="text-center max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7 text-indigo-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Upgrade to Pro</h2>
            <p className="text-sm text-gray-600 mb-6">
              Unlock AI insights, advanced forecasting, and unlimited projects with a 14-day free trial.
            </p>

            <ul className="text-left space-y-2 mb-6">
              {[
                'Unlimited projects',
                'AI-powered insights & reports',
                'EVM forecasting & Monte Carlo simulation',
                'Meeting minutes & lessons learned',
                'Priority support',
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm text-gray-700">
                  <CheckCircle2 className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={handleUpgrade}
              disabled={checkoutLoading}
              className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {checkoutLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Crown className="w-4 h-4" />
              )}
              Start Free Trial
            </button>
            <p className="text-xs text-gray-500 mt-2">No charge until your trial ends</p>
          </div>
        </div>
      )}
    </div>
  );
};
