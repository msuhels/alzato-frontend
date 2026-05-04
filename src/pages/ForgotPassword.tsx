import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AlzatLogo from '../components/AlzatLogo';
import { authService } from '../services/auth';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const result = await authService.forgotPassword(email);
      if (result.success) {
        setMessage('Code sent! Check your email and enter the code below.');
        // Redirect to reset password page with email
        setTimeout(() => {
          navigate(`/reset-password?email=${encodeURIComponent(email)}`);
        }, 1500);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-custom-50">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-10 shadow-lg">
        <div>
          <AlzatLogo layout="vertical" size="lg" />
          <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-gray-custom-900">
            Forgot your password?
          </h2>
          <p className="mt-2 text-center text-sm text-gray-custom-600">
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {message && (
          <div className="rounded-md bg-green-50 p-4 text-green-800 text-sm">
            {message}
          </div>
        )}

        {error && (
          <div className="rounded-md bg-red-50 p-4 text-red-800 text-sm">
            {error}
          </div>
        )}

        <form className="mt-8 space-y-6" onSubmit={handleReset}>
          <div>
            <label htmlFor="email-address" className="sr-only">Email address</label>
            <input
              id="email-address"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="relative block w-full appearance-none rounded-md border border-gray-custom-300 px-3 py-2 text-gray-custom-900 placeholder-gray-custom-500 focus:z-10 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
              placeholder="Enter your email address"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative flex w-full justify-center rounded-md border border-transparent bg-primary py-2 px-4 text-sm font-medium text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </div>
        </form>
        <div className="text-center">
          <Link to="/login" className="font-medium text-primary hover:text-primary-dark">
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
