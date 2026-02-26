import React from 'react';
import { Link } from 'react-router-dom';

export const PrivacyPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-white">
      <nav className="border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="ml-2 text-xl font-bold text-gray-900">PM Assistant</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
        <div className="prose prose-gray max-w-none text-sm text-gray-600 space-y-6">
          <p><strong>Last updated:</strong> February 2026</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">1. Information We Collect</h2>
          <p><strong>Account information:</strong> Name, email address, username, and password (hashed) when you register.</p>
          <p><strong>Project data:</strong> Projects, tasks, schedules, and other content you create within the Service.</p>
          <p><strong>Payment information:</strong> Billing details are processed by Stripe. We do not store your credit card numbers.</p>
          <p><strong>Usage data:</strong> We collect information about how you use the Service, including pages visited, features used, and interactions with AI features.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">2. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Provide and maintain the Service</li>
            <li>Process payments and manage subscriptions</li>
            <li>Send transactional emails (verification, password reset, billing)</li>
            <li>Improve the Service and AI features</li>
            <li>Respond to support requests</li>
          </ul>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">3. AI Data Processing</h2>
          <p>When you use AI features, your project data may be sent to third-party AI providers (Anthropic) for processing. AI conversations and generated content may be stored to improve response quality. You can disable AI features via your account settings.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">4. Data Sharing</h2>
          <p>We do not sell your personal data. We share data only with:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Stripe:</strong> For payment processing</li>
            <li><strong>Resend:</strong> For transactional emails</li>
            <li><strong>Anthropic:</strong> For AI feature processing</li>
          </ul>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">5. Data Security</h2>
          <p>We implement industry-standard security measures including encrypted connections (HTTPS), hashed passwords (bcrypt), secure HTTP-only cookies for authentication, and regular security updates.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">6. Data Retention</h2>
          <p>Your data is retained as long as your account is active. Upon account deletion, your personal data and project data will be permanently deleted within 30 days. Anonymized, aggregated data may be retained indefinitely.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">7. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Access your personal data</li>
            <li>Correct inaccurate data</li>
            <li>Export your data</li>
            <li>Delete your account and data</li>
            <li>Opt out of non-essential communications</li>
          </ul>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">8. Cookies</h2>
          <p>We use essential cookies for authentication (HTTP-only, secure cookies for session management). We do not use third-party tracking cookies or advertising cookies.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">9. Changes to This Policy</h2>
          <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notification.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">10. Contact</h2>
          <p>For privacy-related questions, contact us at privacy@kpbc.ca.</p>
        </div>
      </div>

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
