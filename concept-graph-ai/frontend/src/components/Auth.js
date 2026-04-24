import React, { useState } from 'react';

/**
 * Modern Auth Component
 * Green Theme - Light Professional Design
 */
const Auth = ({ onAuthSubmit }) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (!fullName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!email.trim()) {
      setError('Please enter your email');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email');
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      onAuthSubmit({
        name: fullName,
        email: email,
        userId: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      });
    }, 800);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block">
            <div className="text-6xl mb-6 animate-bounce">🧠</div>
          </div>
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome Back</h1>
          <p className="text-gray-600">Sign up to start learning with AI</p>
        </div>

        {/* Card */}
        <div className="card shadow-lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Error Message */}
            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-4 flex items-center gap-3 animate-shake">
                <span className="text-red-600">⚠️</span>
                <p className="text-red-700 text-sm font-medium">{error}</p>
              </div>
            )}

            {/* Full Name Input */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-gray-900 mb-2">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">👤</span>
                <input
                  id="name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your name"
                  className="pl-12 pr-4 py-3 text-gray-900 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:shadow-lg focus:shadow-green-500/20 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-gray-900 mb-2">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-lg">✉️</span>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  className="pl-12 pr-4 py-3 text-gray-900 border-2 border-gray-200 rounded-lg focus:border-green-500 focus:shadow-lg focus:shadow-green-500/20 focus:outline-none transition-all"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full btn btn-primary py-3 text-lg font-semibold transition-all duration-300 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <span className="inline-block animate-spin">⚡</span>
                  Creating Account...
                </>
              ) : (
                <>
                  <span>Get Started</span>
                  <span>→</span>
                </>
              )}
            </button>

            {/* Features List */}
            <div className="space-y-3 pt-4 border-t border-gray-200">
              <div className="flex items-center gap-3 text-gray-700">
                <span className="text-xl">✨</span>
                <span className="text-sm">AI-powered concept extraction</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <span className="text-xl">🎯</span>
                <span className="text-sm">Adaptive quizzes tailored to you</span>
              </div>
              <div className="flex items-center gap-3 text-gray-700">
                <span className="text-xl">📊</span>
                <span className="text-sm">Track progress and insights</span>
              </div>
            </div>
          </form>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-sm mt-8">
          By continuing, you agree to our Terms of Service
        </p>
      </div>
    </div>
  );
};

export default Auth;
                    placeholder="Enter your full name"
                    className="w-full bg-white/10 border border-white/20 rounded-xl pl-12 pr-4 py-3 text-white placeholder-white/40 font-light text-lg focus:outline-none focus:border-blue-400/50 focus:bg-white/20 focus:shadow-lg focus:shadow-blue-500/20 group-focus-within:backdrop-blur-xl transition-all duration-300"
                  />
                </div>
              </div>

              {/* Email Input */}
              <div className="relative group">
                <label htmlFor="email" className="block text-sm font-semibold text-white/80 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl group-focus-within:scale-110 group-focus-within:text-purple-400 transition-all duration-300">
                    ✉️
                  </span>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email address"
                    className="w-full bg-white/10 border border-white/20 rounded-xl pl-12 pr-4 py-3 text-white placeholder-white/40 font-light text-lg focus:outline-none focus:border-purple-400/50 focus:bg-white/20 focus:shadow-lg focus:shadow-purple-500/20 group-focus-within:backdrop-blur-xl transition-all duration-300"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-lg py-4 rounded-xl transition-all duration-300 shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-purple-500/40 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group relative overflow-hidden"
              >
                {/* Animated background */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

                {/* Content */}
                <span className="relative">
                  {isLoading ? (
                    <>
                      <span className="inline-block animate-spin">⚡</span>
                      Creating Account...
                    </>
                  ) : (
                    <>
                      <span>Start Learning</span>
                      <span className="ml-2">→</span>
                    </>
                  )}
                </span>
              </button>

              {/* Divider */}
              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white/5 text-white/50 font-light">
                    No password needed. Magic link coming soon!
                  </span>
                </div>
              </div>

              {/* Features List */}
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3 text-white/80 font-light">
                  <span className="text-xl">✨</span>
                  <span>AI-powered concept extraction</span>
                </div>
                <div className="flex items-center gap-3 text-white/80 font-light">
                  <span className="text-xl">🎯</span>
                  <span>Adaptive quizzes tailored to you</span>
                </div>
                <div className="flex items-center gap-3 text-white/80 font-light">
                  <span className="text-xl">📊</span>
                  <span>Track progress and insights</span>
                </div>
              </div>
            </form>

            {/* Footer */}
            <div className="mt-8 pt-8 border-t border-white/10 text-center">
              <p className="text-white/50 font-light text-sm">
                By continuing, you agree to our
                <span className="text-white/70 hover:text-white cursor-pointer transition-colors"> Terms of Service</span>
              </p>
            </div>
          </div>

          {/* Subtle glow effect */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-blue-500/0 blur-3xl -z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        </div>
      </div>

      {/* Floating Elements for Visual Interest */}
      <div className="fixed top-10 left-10 w-2 h-2 bg-blue-400 rounded-full animate-pulse opacity-50" />
      <div className="fixed bottom-20 right-10 w-3 h-3 bg-purple-400 rounded-full animate-pulse opacity-30" />
      <div className="fixed top-1/3 right-20 w-1 h-1 bg-white rounded-full animate-pulse opacity-40" />
    </div>
  );
};

export default Auth;
