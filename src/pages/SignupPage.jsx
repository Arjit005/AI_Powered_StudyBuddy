import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Brain, Lock, User, Mail, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react';

const SignupPage = () => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isSuccess, setIsSuccess] = useState(false);
    const navigate = useNavigate();

    const handleSignup = (e) => {
        e.preventDefault();
        // In a real app, you'd send this to your backend
        // For now, we simulate success and redirect
        setIsSuccess(true);
        setTimeout(() => {
            navigate('/login');
        }, 2000);
    };

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
                <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-emerald-100 mb-4">
                        <CheckCircle2 className="w-12 h-12 text-emerald-600" />
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900">Account Created!</h2>
                    <p className="text-slate-500">Redirecting you to login...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
            <div className="max-w-md w-full relative">
                <div className="absolute -top-24 -left-24 w-64 h-64 bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse"></div>
                <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-indigo-100 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-pulse delay-700"></div>

                <div className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] shadow-2xl border border-white p-10 relative z-10">
                    <div className="text-center mb-10">
                        <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-50 mb-6 shadow-sm">
                            <Brain className="w-10 h-10 text-emerald-600" />
                        </div>
                        <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Create Account</h1>
                        <p className="text-slate-500">Join AI Study Buddy today</p>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Username</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <User className="w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                                </div>
                                <input
                                    type="text"
                                    placeholder="Choose a username"
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Email Address</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Mail className="w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                                </div>
                                <input
                                    type="email"
                                    placeholder="you@example.com"
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-sm font-semibold text-slate-700 ml-1">Password</label>
                            <div className="relative group">
                                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                    <Lock className="w-5 h-5 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
                                </div>
                                <input
                                    type="password"
                                    placeholder="Create a strong password"
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all text-slate-700"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 mt-4 rounded-2xl font-bold shadow-lg shadow-emerald-600/30 transition-all hover:-translate-y-1 active:translate-y-0 flex items-center justify-center gap-2 group"
                        >
                            Create Account
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </form>

                    <p className="mt-8 text-center text-slate-500 text-sm">
                        Already have an account?{' '}
                        <Link to="/login" className="text-emerald-600 font-bold hover:text-emerald-700 transition-colors">
                            Sign In
                        </Link>
                    </p>

                    <div className="mt-10 pt-8 border-t border-slate-100 flex items-center justify-center gap-2 text-slate-400">
                        <ShieldCheck className="w-4 h-4" />
                        <span className="text-xs font-semibold tracking-wider uppercase">Secure Registration</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SignupPage;
