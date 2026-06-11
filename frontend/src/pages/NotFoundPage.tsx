import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-alt">
      <div className="text-center">
        <div className="text-6xl font-bold text-primary mb-2">404</div>
        <p className="text-text-secondary mb-6">The page you're looking for doesn't exist.</p>
        <Link to="/" className="bg-primary text-white px-5 py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-dark transition-colors">
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
