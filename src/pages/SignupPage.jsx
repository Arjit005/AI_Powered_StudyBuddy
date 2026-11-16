import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, Lock, User, Mail, ArrowRight, ShieldCheck, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

const SignupPage = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const navigate = useNavigate();

    const handleGoogleSignIn = async () => {
        if (isLoading || isGoogleLoading) return;
        setError('');
        setIsGoogleLoading(true);
        try {
            const { idToken } = await signInWithGoogle();
            const res = await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_token: idToken })
            });
            let data = {};
            try {
                data = await res.json();
            } catch (_) {
                data = { detail: res.statusText || 'Google sign-up server error' };
            }
            if (!res.ok) {
                throw new Error(data.detail || 'Google sign-up failed');
            }
            if (!data.access_token || !data.user) {
                throw new Error('Authentication response is missing required credentials.');
            }
            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('auth_token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            navigate('/');
        } catch (err) {
            console.error("Google auth error:", err);
            if (err.code === 'auth/unauthorized-domain' || err.message?.includes('unauthorized-domain')) {
                setError(`Domain Authorization Required: Please add '${window.location.hostname}' to Authorized Domains in Firebase Console (Authentication > Settings > Authorized domains). Or use the Email & Password form below to sign up immediately.`);
            } else {
                setError(err.message || 'Google sign-up encountered an error.');
            }
        } finally {
            setIsGoogleLoading(false);
        }
    };

    // Password Strength Evaluator (Developer Grade)
    const passwordChecks = useMemo(() => {
        return {
            hasLength: password.length >= 8,
            hasUpper: /[A-Z]/.test(password),
            hasLower: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasSpecial: /[!@#$%^&*(),.?":{}|<>\-_=+/\\\[\]]/.test(password),
        };
    }, [password]);

    const strengthScore = useMemo(() => {
        const checks = [
            passwordChecks.hasLength,
            passwordChecks.hasUpper,
            passwordChecks.hasLower,
            passwordChecks.hasNumber,
            passwordChecks.hasSpecial
        ];
        return checks.filter(Boolean).length;
    }, [passwordChecks]);

    const strengthLabel = useMemo(() => {
        if (!password) return { text: 'Empty', color: 'bg-slate-700', textClass: 'text-slate-500' };
        if (strengthScore <= 2) return { text: 'Weak', color: 'bg-rose-500', textClass: 'text-rose-400' };
        if (strengthScore <= 4) return { text: 'Good', color: 'bg-amber-500', textClass: 'text-amber-400' };
        return { text: 'Strong (Recommended)', color: 'bg-emerald-400', textClass: 'text-emerald-400' };
    }, [password, strengthScore]);

    const redirectTimerRef = useRef(null);
    useEffect(() => {
        return () => {
            if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current);
        };
    }, []);

    const handleSignup = async (e) => {
        e.preventDefault();
        if (isLoading || isGoogleLoading) return;
        setError('');

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        if (strengthScore < 5) {
            setError("Please fulfill all 5 security criteria for a strong password.");
            return;
        }

        setIsLoading(true);

        try {
            const res = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    username: username.trim(),
                    email: email.trim(),
                    password: password
                }),
            });

            let data = {};
            try {
                data = await res.json();
            } catch (_) {
                data = { detail: res.statusText || 'Registration server response error' };
            }
            if (!res.ok) {
                throw new Error(data.detail || 'Failed to create account.');
            }

            if (!data.access_token || !data.user) {
                throw new Error('Authentication response is missing required credentials.');
            }

            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('auth_token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));

            setIsSuccess(true);
            redirectTimerRef.current = setTimeout(() => {
                navigate('/');
            }, 1200);
        } catch (err) {
            setError(err.message || 'Error creating account. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center space-y-6 glass-panel-glow rounded-3xl p-10 animate-in fade-in zoom-in duration-300">
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 mb-2">
                        <CheckCircle2 className="w-10 h-10 text-emerald-400 animate-bounce" />
                    </div>
                    <h2 className="text-3xl font-extrabold text-white">Account Created!</h2>
                    <p className="text-slate-400 text-sm">Welcome aboard! Redirecting you to your study dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center p-4 relative">
            <div className="max-w-lg w-full relative z-10 py-8">
                <div className="glass-panel rounded-3xl p-8 sm:p-10 shadow-2xl border border-white/10 relative overflow-hidden">
                    {/* Top Decorative accent */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-400/20 border border-emerald-500/30 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                            <Brain className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Create Account</h1>
                        <p className="text-slate-400 text-sm mt-1">Join AI Study Buddy to learn faster and study smarter</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                            <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Google Sign-Up Button */}
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isLoading || isGoogleLoading}
                        className="w-full mb-5 py-3 px-4 rounded-xl font-medium text-sm bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-white transition-all flex items-center justify-center gap-3 shadow-lg hover:border-emerald-500/50 cursor-pointer disabled:opacity-50"
                    >
                        {isGoogleLoading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : (
                            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                            </svg>
                        )}
                        <span>Sign up with Google</span>
                    </button>

                    <div className="relative flex items-center justify-center mb-5">
                        <div className="border-t border-slate-800 w-full" />
                        <span className="bg-[#0b0f17] px-3 text-[11px] font-mono text-slate-500 uppercase">Or sign up with email</span>
                        <div className="border-t border-slate-800 w-full" />
                    </div>

                    <form onSubmit={handleSignup} className="space-y-5">
                        {/* Username */}
                        <div>
                            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Username</label>
                            <div className="relative">
                                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. arjit_dev"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm font-mono placeholder:text-slate-600"
                                />
                            </div>
                        </div>

                        {/* Email */}
                        <div>
                            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Email Address</label>
                            <div className="relative">
                                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                                <input
                                    type="email"
                                    required
                                    placeholder="student@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm font-mono placeholder:text-slate-600"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <div className="flex justify-between items-center mb-1.5 ml-1">
                                <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Password</label>
                                <span className={`text-[11px] font-mono font-medium ${strengthLabel.textClass}`}>{strengthLabel.text}</span>
                            </div>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="Enter secure password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full pl-10 pr-10 py-3 rounded-xl glass-input text-sm font-mono placeholder:text-slate-600"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
                                >
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* Password Strength Visual Meter */}
                            <div className="mt-2.5 space-y-2">
                                <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden flex gap-1">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                        <div
                                            key={level}
                                            className={`h-full flex-1 transition-all duration-300 ${
                                                strengthScore >= level ? strengthLabel.color : 'bg-slate-800'
                                            }`}
                                        />
                                    ))}
                                </div>

                                {/* Security Requirement Checkpoints */}
                                <div className="grid grid-cols-2 gap-1.5 pt-1 text-[11px] font-mono">
                                    <div className={`flex items-center gap-1.5 ${passwordChecks.hasLength ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        <CheckCircle2 className="w-3 h-3" /> 8+ Characters
                                    </div>
                                    <div className={`flex items-center gap-1.5 ${passwordChecks.hasUpper ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        <CheckCircle2 className="w-3 h-3" /> Uppercase (A-Z)
                                    </div>
                                    <div className={`flex items-center gap-1.5 ${passwordChecks.hasLower ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        <CheckCircle2 className="w-3 h-3" /> Lowercase (a-z)
                                    </div>
                                    <div className={`flex items-center gap-1.5 ${passwordChecks.hasNumber ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        <CheckCircle2 className="w-3 h-3" /> Number (0-9)
                                    </div>
                                    <div className={`flex items-center gap-1.5 col-span-2 ${passwordChecks.hasSpecial ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        <CheckCircle2 className="w-3 h-3" /> Special Symbol (!@#$%...)
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Confirm Password */}
                        <div>
                            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Confirm Password</label>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="Re-enter password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm font-mono placeholder:text-slate-600"
                                />
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={isLoading || isGoogleLoading}
                            className="w-full mt-6 py-3.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.35)] disabled:opacity-50"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Create Account</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                        <p className="text-xs text-slate-400">
                            Already have an account?{' '}
                            <Link to="/login" className="text-emerald-400 hover:text-emerald-300 font-medium">
                                Sign In
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
