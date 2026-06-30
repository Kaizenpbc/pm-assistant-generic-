import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <p className="text-6xl font-bold text-gray-200">404</p>
        <h1 className="mt-4 text-xl font-semibold text-gray-900">Page not found</h1>
        <p className="mt-2 text-sm text-gray-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center gap-2 btn btn-primary"
        >
          <Home className="w-4 h-4" />
          Back to Home
        </Link>
      </div>
    </div>
  );
}
