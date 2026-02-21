import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore.js';

export default function Register() {
  const [form, setForm] = useState({ username: '', email: '', password: '', displayName: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useAuthStore(s => s.register);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form.username, form.email, form.password, form.displayName || form.username);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.details?.map(d => d.message).join(', ') || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  return (
    <div className="min-h-screen bg-cat-dark flex items-center justify-center p-4">
      <div className="w-full max-w-md card p-8">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐱</div>
          <h1 className="text-2xl font-bold"><span className="text-cat-accent">Cat</span>Tube</h1>
          <p className="text-cat-textSecondary mt-1">Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm">{error}</div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Username</label>
            <input type="text" value={form.username} onChange={update('username')} required className="w-full" placeholder="coolcat42" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Display Name</label>
            <input type="text" value={form.displayName} onChange={update('displayName')} className="w-full" placeholder="Cool Cat" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input type="email" value={form.email} onChange={update('email')} required className="w-full" placeholder="cat@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input type="password" value={form.password} onChange={update('password')} required className="w-full" placeholder="Min. 8 characters" />
          </div>
          <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 disabled:opacity-50">
            {loading ? 'Creating...' : 'Create Account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-cat-textSecondary">
          Already have an account? <Link to="/login" className="text-cat-accent hover:underline">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
