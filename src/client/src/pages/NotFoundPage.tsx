import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="text-center">
        <p className="text-6xl font-bold text-gray-200">404</p>
        <h1 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 btn btn-primary"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </Link>
        <p className="mt-4 text-xs text-gray-400 dark:text-gray-500">
          Need help?{' '}
          <a
            href={`mailto:support@kpbc.ca?subject=${encodeURIComponent('Help - Page Not Found')}&body=${encodeURIComponent(`I couldn't find the page I was looking for.\n\nPage: ${window.location.href}\nTime: ${new Date().toISOString()}`)}`}
            className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
          >
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
