import Link from 'next/link';

export default function Home() {
    return (
        <main className="min-h-screen">
            {/* Header */}
            <header className="bg-isik-blue text-white py-4 px-6 shadow-lg">
                <div className="max-w-7xl mx-auto flex justify-between items-center">
                    <h1 className="text-2xl font-bold">🎓 IşıkSchedule</h1>
                    <nav className="flex gap-6">
                        <Link href="/upload" className="hover:text-isik-gold transition">
                            Upload
                        </Link>
                        <Link href="/about" className="hover:text-isik-gold transition">
                            About
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Hero Section */}
            <section className="bg-gradient-to-br from-isik-blue to-isik-blue-dark text-white py-24 px-6">
                <div className="max-w-4xl mx-auto text-center">
                    <h2 className="text-5xl font-bold mb-6">
                        Create Your Perfect Schedule
                    </h2>
                    <p className="text-xl mb-8 text-gray-200">
                        Upload your course list, select your preferences, and let our
                        AI-powered algorithms generate the optimal schedule for you.
                    </p>
                    <div className="flex justify-center gap-4">
                        <Link
                            href="/scheduler"
                            className="bg-white text-isik-blue px-8 py-4 rounded-lg font-bold text-lg hover:bg-gray-100 transition shadow-lg"
                        >
                            🚀 Get Started
                        </Link>
                        <Link
                            href="/scheduler"
                            className="border-2 border-white text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-white/10 transition"
                        >
                            Try Demo
                        </Link>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section className="py-20 px-6 bg-white">
                <div className="max-w-6xl mx-auto">
                    <h3 className="text-3xl font-bold text-center mb-12 text-gray-800">
                        Why IşıkSchedule?
                    </h3>
                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="bg-gray-50 p-6 rounded-xl shadow-sm">
                            <div className="text-4xl mb-4">⚡</div>
                            <h4 className="text-xl font-bold mb-2">Lightning Fast</h4>
                            <p className="text-gray-600">
                                Generate hundreds of schedule combinations in seconds using
                                advanced algorithms.
                            </p>
                        </div>
                        {/* Feature 2 */}
                        <div className="bg-gray-50 p-6 rounded-xl shadow-sm">
                            <div className="text-4xl mb-4">🎯</div>
                            <h4 className="text-xl font-bold mb-2">Smart Optimization</h4>
                            <p className="text-gray-600">
                                Customize preferences like free days, morning classes, and
                                ECTS limits.
                            </p>
                        </div>
                        {/* Feature 3 */}
                        <div className="bg-gray-50 p-6 rounded-xl shadow-sm">
                            <div className="text-4xl mb-4">📤</div>
                            <h4 className="text-xl font-bold mb-2">Easy Export</h4>
                            <p className="text-gray-600">
                                Export your schedule to PDF, iCal, or share with friends
                                via link.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-800 text-gray-400 py-8 px-6">
                <div className="max-w-6xl mx-auto text-center">
                    <p>© 2026 IşıkSchedule. Built for Işık University students.</p>
                </div>
            </footer>
        </main>
    );
}
