export default function AuthLayout({ children, title, subtitle, quote }) {
  return (
    <div className="h-screen grid lg:grid-cols-2 font-sans overflow-hidden">
      {/* Left: Fixed Imagery */}
      <div className="hidden lg:flex bg-slate-950 p-16 flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-40 bg-[url('https://images.unsplash.com/photo-1614062848658-251c6c9751d8?auto=format&fit=crop&q=80')] bg-cover bg-center" />
        <div className="relative z-10">
          <span className="font-display text-3xl font-black italic tracking-tighter text-white font-display">AION</span>
        </div>
        <div className="relative z-10">
          <p className="font-display text-4xl font-bold text-white leading-tight mb-6 italic">"{quote}"</p>
          <div className="h-1 w-20 bg-indigo-500" />
        </div>
      </div>

      {/* Right: Scrollable Interaction Area */}
      <div className="flex items-start lg:items-center justify-center p-6 sm:p-12 bg-white overflow-y-auto">
        <div className="w-full max-w-md py-8"> {/* Added vertical padding here for scrolling room */}
          <header className="mb-8 text-center lg:text-left">
            <h1 className="font-display text-4xl font-bold text-slate-950 mb-2 tracking-tight">{title}</h1>
            <p className="text-slate-500 font-medium text-sm">{subtitle}</p>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}