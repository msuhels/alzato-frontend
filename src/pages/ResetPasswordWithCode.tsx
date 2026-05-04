import React, { useState, useMemo } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import AlzatLogo from '../components/AlzatLogo';
import { authService } from '../services/auth';

const ResetPasswordWithCode = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Get email from query param if passed from forgot password page
    const emailFromParams = searchParams.get('email') || '';

    const [email, setEmail] = useState(emailFromParams);
    const [code, setCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    // Validation checks
    const validationErrors = useMemo(() => {
        const errors: string[] = [];

        if (!email) {
            errors.push('Email is required');
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Please enter a valid email');
        }

        if (!code) {
            errors.push('Verification code is required');
        } else if (code.length < 6) {
            errors.push('Verification code must be 6 digits');
        }

        if (!newPassword) {
            errors.push('New password is required');
        } else if (newPassword.length < 6) {
            errors.push('Password must be at least 6 characters');
        }

        if (!confirmPassword) {
            errors.push('Please confirm your password');
        } else if (newPassword !== confirmPassword) {
            errors.push('Passwords do not match');
        }

        return errors;
    }, [email, code, newPassword, confirmPassword]);
    
    // Check if form is valid
    const isFormValid = validationErrors.length === 0;

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();

        // Additional validation before submit
        if (!isFormValid) {
            setError(validationErrors[0] || 'Please fill in all fields correctly');
            return;
        }

        setLoading(true);
        setError('');
        setMessage('');

        try {
            const result = await authService.verifyResetCode(email, code, newPassword);
            if (result.success) {
                setMessage('Password reset successful! Redirecting to login...');
                setTimeout(() => {
                    navigate('/login');
                }, 2000);
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to reset password. Please check your code.');
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
                        Reset Your Password
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-custom-600">
                        Enter the code from your email and your new password.
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
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-custom-700">
                                Email Address <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="mt-1 block w-full appearance-none rounded-md border border-gray-custom-300 px-3 py-2 text-gray-custom-900 placeholder-gray-custom-500 focus:z-10 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                                placeholder="Enter your email address"
                            />
                        </div>

                        <div>
                            <label htmlFor="code" className="block text-sm font-medium text-gray-custom-700">
                                Verification Code <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="code"
                                name="code"
                                type="text"
                                required
                                value={code}
                                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                className="mt-1 block w-full appearance-none rounded-md border border-gray-custom-300 px-3 py-2 text-gray-custom-900 placeholder-gray-custom-500 focus:z-10 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                                placeholder="Enter the 6-digit code"
                                maxLength={6}
                            />
                            <p className="mt-1 text-xs text-gray-custom-500">
                                {code.length}/6 digits entered
                            </p>
                        </div>

                        <div>
                            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-custom-700">
                                New Password <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="newPassword"
                                name="newPassword"
                                type="password"
                                required
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                className="mt-1 block w-full appearance-none rounded-md border border-gray-custom-300 px-3 py-2 text-gray-custom-900 placeholder-gray-custom-500 focus:z-10 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                                placeholder="Enter new password (min 6 characters)"
                                minLength={6}
                            />
                            <p className="mt-1 text-xs text-gray-custom-500">
                                {newPassword.length < 6
                                    ? `Need ${6 - newPassword.length} more characters`
                                    : '✓ Password length is good'}
                            </p>
                        </div>

                        <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-custom-700">
                                Confirm New Password <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                required
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 block w-full appearance-none rounded-md border border-gray-custom-300 px-3 py-2 text-gray-custom-900 placeholder-gray-custom-500 focus:z-10 focus:border-primary focus:outline-none focus:ring-primary sm:text-sm"
                                placeholder="Confirm new password"
                                minLength={6}
                            />
                            {confirmPassword && newPassword !== confirmPassword && (
                                <p className="mt-1 text-xs text-red-500">✗ Passwords do not match</p>
                            )}
                            {confirmPassword && newPassword === confirmPassword && (
                                <p className="mt-1 text-xs text-green-600">✓ Passwords match</p>
                            )}
                        </div>
                    </div>

                  

                    <div>
                        <button
                            type="submit"
                            disabled={loading || !isFormValid}
                            className="group relative flex w-full justify-center rounded-md border border-transparent bg-primary py-2 px-4 text-sm font-medium text-white hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {loading ? 'Resetting...' : 'Reset Password'}
                        </button>
                    </div>
                </form>
                <div className="text-center">
                    <Link to="/forgot-password" className="font-medium text-primary hover:text-primary-dark">
                        Request new code
                    </Link>
                    <span className="mx-2 text-gray-custom-400">|</span>
                    <Link to="/login" className="font-medium text-primary hover:text-primary-dark">
                        Back to login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ResetPasswordWithCode;
