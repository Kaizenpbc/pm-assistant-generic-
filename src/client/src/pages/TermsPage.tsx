import React from 'react';
import { Link } from 'react-router-dom';

export const TermsPage: React.FC = () => {
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
              <span className="ml-2 text-xl font-bold text-gray-900">Kovarti PM Assistant</span>
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Terms of Service</h1>
        <div className="prose prose-gray max-w-none text-sm text-gray-600 space-y-6">
          <p><strong>Last updated:</strong> February 2026</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">1. Acceptance of Terms</h2>
          <p>By accessing or using Kovarti PM Assistant ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">2. Description of Service</h2>
          <p>Kovarti PM Assistant is an AI-powered project management application that provides scheduling, risk analysis, reporting, and collaboration tools. The Service is provided on a subscription basis with free and paid tiers.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">3. Account Registration</h2>
          <p>You must provide accurate, complete information when creating an account. You are responsible for maintaining the security of your account credentials. You must be at least 18 years old to use the Service.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">4. Subscription and Billing</h2>
          <p>Paid subscriptions are billed monthly. Free trials last 14 days. You can cancel at any time; access continues until the end of the billing period. Refunds are handled on a case-by-case basis. Prices may change with 30 days' notice.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">5. Acceptable Use</h2>
          <p>You agree not to misuse the Service, including but not limited to: reverse engineering, unauthorized access attempts, distributing malware, or using the Service for illegal purposes.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">6. Data and Privacy</h2>
          <p>Your use of the Service is also governed by our <Link to="/privacy" className="text-indigo-600 hover:text-indigo-700">Privacy Policy</Link>. You retain ownership of your data. We may use anonymized, aggregated data to improve the Service.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">7. AI-Generated Content</h2>
          <p>The Service uses AI to generate suggestions, schedules, and analyses. AI outputs are provided as recommendations only and should not be relied upon as the sole basis for critical decisions. We do not guarantee the accuracy of AI-generated content.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">8. Limitation of Liability</h2>
          <p>The Service is provided "as is" without warranties of any kind. We are not liable for any indirect, incidental, or consequential damages arising from your use of the Service. Our total liability shall not exceed the amount you paid in the 12 months preceding the claim.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">9. Termination</h2>
          <p>We may suspend or terminate your account for violations of these Terms. Upon termination, your right to use the Service ceases. You may export your data before termination.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">10. Changes to Terms</h2>
          <p>We may update these Terms from time to time. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>

          <h2 className="text-lg font-semibold text-gray-900 mt-8">11. Contact</h2>
          <p>For questions about these Terms, contact us at support@kpbc.ca.</p>
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
