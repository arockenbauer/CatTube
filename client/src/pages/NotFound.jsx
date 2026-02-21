import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="text-8xl mb-6">😿</div>
        <h1 className="text-4xl font-bold mb-2">404</h1>
        <p className="text-cat-textSecondary text-lg mb-6">This page doesn't exist (yet)</p>
        <Link to="/" className="btn-primary">Back to Home</Link>
      </div>
    </div>
  );
}
