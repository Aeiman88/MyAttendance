export function AuthFrame({ title, intro, children }: { title: string; intro?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-navy-800 lg:flex-row">
      <aside className="relative overflow-hidden px-6 pb-16 pt-10 text-white lg:flex lg:w-[44%] lg:flex-col lg:justify-between lg:p-14">
        <ClockFace />
        <div className="relative flex items-center gap-3">
          <img src="/icons/icon.svg" alt="" className="size-11 rounded-2xl ring-2 ring-white/15" />
          <div>
            <p className="text-lg font-extrabold tracking-tight">MyAttendance</p>
            <p className="text-[13px] text-navy-200">DAICOE AI Center, Kota Kinabalu High School</p>
          </div>
        </div>
        <p className="relative mt-10 hidden max-w-sm text-[28px] font-bold leading-[1.2] tracking-tight lg:block">
          Clock in where you work. Print the record when it&apos;s due.
        </p>
      </aside>
      <main className="relative -mt-8 flex flex-1 items-start justify-center rounded-t-[28px] bg-mist px-5 pb-10 pt-8 lg:mt-0 lg:items-center lg:rounded-none">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold tracking-tight text-navy-900">{title}</h1>
          {intro && <div className="mt-1.5 text-[14.5px] leading-relaxed text-slate-600">{intro}</div>}
          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** A quiet clock-dial motif drawn behind the brand panel. */
function ClockFace() {
  const ticks = Array.from({ length: 60 }, (_, i) => i);
  return (
    <svg
      aria-hidden
      viewBox="0 0 400 400"
      className="pointer-events-none absolute -right-28 -top-24 size-[380px] text-white/[0.07] lg:-bottom-40 lg:-right-40 lg:top-auto lg:size-[560px]"
    >
      <circle cx="200" cy="200" r="190" fill="none" stroke="currentColor" strokeWidth="2" />
      <circle cx="200" cy="200" r="150" fill="none" stroke="#12a8a2" strokeOpacity="0.35" strokeWidth="10" strokeDasharray="590 943" transform="rotate(-90 200 200)" strokeLinecap="round" />
      {ticks.map((i) => (
        <line
          key={i}
          x1="200"
          y1={i % 5 === 0 ? 18 : 26}
          x2="200"
          y2="36"
          stroke="currentColor"
          strokeWidth={i % 5 === 0 ? 4 : 2}
          transform={`rotate(${i * 6} 200 200)`}
        />
      ))}
      <line x1="200" y1="200" x2="200" y2="92" stroke="currentColor" strokeWidth="8" strokeLinecap="round" transform="rotate(40 200 200)" />
      <line x1="200" y1="200" x2="200" y2="64" stroke="#e7a928" strokeOpacity="0.5" strokeWidth="4" strokeLinecap="round" transform="rotate(160 200 200)" />
      <circle cx="200" cy="200" r="9" fill="currentColor" />
    </svg>
  );
}
