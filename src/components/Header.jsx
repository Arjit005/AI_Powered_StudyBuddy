import React from 'react';
import { Brain, LogOut } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Header = () => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('isAuthenticated');
        navigate('/login');
    };

    return (
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center h-16">
                    <Link to="/" className="flex items-center gap-2">
                        <Brain className="h-8 w-8 text-emerald-600" />
                        <span className="text-xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                            AI Study Buddy
                        </span>
                    </Link>
                    <nav className="flex items-center gap-6">
                        <Link to="/" className="text-slate-600 hover:text-emerald-600 transition-colors font-medium">Home</Link>
                        <Link to="/pricing" className="text-slate-600 hover:text-emerald-600 transition-colors font-medium">Pricing</Link>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 text-slate-500 hover:text-red-600 transition-colors font-medium px-3 py-1.5 rounded-lg hover:bg-red-50"
                        >
                            <LogOut className="w-4 h-4" />
                            Log out
                        </button>
                        <Link to="/chat" className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-600/20 active:scale-95">
                            Start Chat
                        </Link>
                    </nav>
                </div>
            </div>
        </header>
    );
};

export default Header;
