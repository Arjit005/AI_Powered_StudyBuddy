import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, Lock, User, ArrowRight, ShieldCheck, AlertTriangle, Eye, EyeOff, Zap } from 'lucide-react';
import { signInWithGoogle } from '../firebase';

const LoginPage = () => {
    // Empty default credentials in production builds
    const isDev = import.meta.env.DEV;
    const [username, setUsername] = useState(isDev ? 'testuser1@example.com' : '');
    const [password, setPassword] = useState(isDev ? 'secretpassword123' : '');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [lockoutSecs, setLockoutSecs] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const navigate = useNavigate();

    // Lockout countdown timer
    useEffect(() => {
        if (lockoutSecs <= 0) return;
        const timer = setInterval(() => {
            setLockoutSecs(prev => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [lockoutSecs]);

    const handleGoogleSignIn = async () => {
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
                data = { detail: res.statusText || 'Google sign-in server error' };
            }
            if (!res.ok) {
                throw new Error(data.detail || 'Google sign-in failed');
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
                setError(`Domain Authorization Required: Please add '${window.location.hostname}' to Authorized Domains in Firebase Console (Authentication > Settings > Authorized domains). Or use the Username & Password form below to sign in immediately.`);
            } else {
                setError(err.message || 'Google sign-in encountered an error.');
            }
        } finally {
            setIsGoogleLoading(false);
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        if (lockoutSecs > 0) {
            setError(`Account is locked out. Please wait ${lockoutSecs}s.`);
            return;
        }
        setError('');
        setIsLoading(true);

        try {
            const isEmail = username.includes('@');
            const res = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    email: isEmail ? username.trim() : undefined,
                    username: !isEmail ? username.trim() : undefined,
                    password: password
                }),
            });

            let data = {};
            try {
                data = await res.json();
            } catch (_) {
                data = { detail: res.statusText || 'Unexpected server response' };
            }
            if (!res.ok) {
                if (res.status === 429) {
                    setLockoutSecs(60);
                }
                throw new Error(data.detail || 'Invalid username/email or password');
            }

            if (!data.access_token || !data.user) {
                throw new Error('Authentication response is missing required credentials.');
            }

            localStorage.setItem('isAuthenticated', 'true');
            localStorage.setItem('auth_token', data.access_token);
            localStorage.setItem('user', JSON.stringify(data.user));
            navigate('/');
        } catch (err) {
            setError(err.message || 'Login failed. Please check credentials.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleQuickDemo = (role) => {
        if (role === 'demo') {
            setUsername('testuser1@example.com');
            setPassword('secretpassword123');
        }
    };

    return (
        <div className="min-h-screen bg-[#0b0f17] flex items-center justify-center p-4 relative">
            <div className="max-w-md w-full relative z-10 py-8">
                <div className="glass-panel rounded-3xl p-8 sm:p-10 shadow-2xl border border-white/10 relative overflow-hidden">
                    {/* Top Decorative accent */}
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500" />

                    <div className="text-center mb-8">
                        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500/20 to-teal-400/20 border border-emerald-500/30 mb-4 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                            <Brain className="w-8 h-8 text-emerald-400" />
                        </div>
                        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Welcome Back</h1>
                        <p className="text-slate-400 text-sm mt-1">Authenticate into your secure AI workspace</p>
                    </div>

                    {error && (
                        <div className="mb-6 p-3.5 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
                            <span>{error}</span>
                        </div>
                    )}

                    {lockoutSecs > 0 && (
                        <div className="mb-6 p-3 rounded-xl bg-amber-950/50 border border-amber-800/50 text-amber-300 text-xs flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-amber-400" />
                            <span>Rate Limit Lockout active ({lockoutSecs}s remaining). Protected against brute-force attacks.</span>
                        </div>
                    )}

                    {/* Google Sign-In Button */}
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isGoogleLoading || isLoading}
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
                        <span>Continue with Google</span>
                    </button>

                    <div className="relative flex items-center justify-center mb-5">
                        <div className="border-t border-slate-800 w-full" />
                        <span className="bg-[#0b0f17] px-3 text-[11px] font-mono text-slate-500 uppercase">Or with credentials</span>
                        <div className="border-t border-slate-800 w-full" />
                    </div>

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-xs font-mono uppercase tracking-wider text-slate-400 mb-1.5 ml-1">Username or Email</label>
                            <div className="relative">
                                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                                <input
                                    type="text"
                                    required
                                    placeholder="Enter your email or username"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 rounded-xl glass-input text-sm font-mono placeholder:text-slate-600"
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-1.5 ml-1">
                                <label className="text-xs font-mono uppercase tracking-wider text-slate-400">Password</label>
                            </div>
                            <div className="relative">
                                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    placeholder="Enter your password"
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
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading || isGoogleLoading || lockoutSecs > 0}
                            className="w-full mt-6 py-3.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 text-slate-950 hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.35)] disabled:opacity-50"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <span>Sign In with JWT</span>
                                    <ArrowRight className="w-4 h-4" />
                                </>
                            )}
                        </button>
                    </form>

                    {/* Developer Demo Quick-Fill (Dev Mode Only) */}
                    {isDev && (
                        <div className="mt-4 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs">
                            <span className="text-slate-500 font-mono">Dev Quick-Fill:</span>
                            <button
                                type="button"
                                onClick={() => handleQuickDemo('demo')}
                                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 border border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/40 transition-colors font-mono text-[11px]"
                            >
                                <Zap className="w-3 h-3 text-emerald-400" />
                                <span>Demo User</span>
                            </button>
                        </div>
                    )}

                    <div className="mt-6 pt-4 border-t border-slate-800/60 text-center">
                        <p className="text-xs text-slate-400">
                            Don't have an account?{' '}
                            <Link to="/signup" className="text-emerald-400 hover:text-emerald-300 font-medium">
                                Create Account
                            </Link>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
