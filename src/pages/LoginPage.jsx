import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';

const LoginPage = () => {
    const [username, setUsername] = useState('user@example.com');
    const [password, setPassword] = useState('password123');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();
        // Updated to accept dummy credentials
        if (username === 'user@example.com' && password === 'password123') {
            localStorage.setItem('isAuthenticated', 'true');
            navigate('/');
        } else {
            setError('Invalid username or password');
        }
    };

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
            <div className="max-w-md w-full relative">
                {/* Background Decorative Elements */}
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse"></div>
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse delay-700"></div>

                <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white p-10 relative z-10">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-50 mb-6 shadow-sm">
                            <Brain className="w-10 h-10 text-emerald-600" />
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Welcome Back</h1>
                        <p className="text-slate-500">Secure access to your study dashboard</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Username</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <User className="w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Enter your username"
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    placeholder="Enter your password"
                                    className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium animate-shake">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-bold shadow-lg shadow-emerald-600/30 transition-all hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 group"
                        >
                            Sign In
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>

                    <p className="mt-8 text-center text-slate-500 text-sm">
                        Don't have an account?{' '}
                        <Link to="/signup" className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
                            Create Account
                        </Link>
                    </p>

                    <div className="mt-4 text-center">
                        <span className="bg-emerald-50 text-emerald-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest border border-emerald-100">
                            Demo: user@example.com / password123
                        </span>
                    </div>

                    <div className="mt-10 pt-8 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-xs font-semibold tracking-wider uppercase">End-to-end Encrypted</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
