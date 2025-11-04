import { FormEvent, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
// Use the WebP logo from public on the login page

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    try {
      const loggedInUser = await login(email, password);
      navigate(loggedInUser?.role === 'admin' ? '/dashboard' : '/students');
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-custom-50">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-lg">
        <div className="flex flex-col items-center">
          <img src="/logo/alzato-logo.webp" alt="Alzato logo" className="h-16 w-48 object-contain" />
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-custom-900">
            Sign in to your account
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="-space-y-px rounded-md shadow-sm">
            <div>
              <label htmlFor="email-address" className="sr-only">Email address</label>
              <input
                id="email-address"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="relative block w-full appearance-none rounded-t-md border border-gray-custom-300 px-3 py-2 text-gray-custom-900 placeholder-gray-custom-500 focus:z-10 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                placeholder="admin@school.com (any email)"
              />
            </div>
            <div className="relative">
              <label htmlFor="password" className="sr-only">Password</label>
              <input
                id="password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                className="relative block w-full appearance-none rounded-b-md border border-gray-custom-300 px-3 py-2 pr-10 text-gray-custom-900 placeholder-gray-custom-500 focus:z-10 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                placeholder="password"
              />
              <button
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword(v => !v)}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-custom-500 hover:text-primary"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <div className="text-sm">
              <Link to="/forgot-password" className="font-medium text-primary hover:text-primary-dark">
                Forgot your password?
              </Link>
            </div>
          </div>

          <div>
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-primary py-2 px-4 text-sm font-medium text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
              disabled={submitting}
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
