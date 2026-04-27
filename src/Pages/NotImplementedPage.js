export default function NotImplementedPage({
  title = "Coming Soon",
  subtitle = "This area is part of the Tally-style structure and is prepared for the next implementation step.",
}) {
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-3xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="max-w-3xl">
            <div className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-700">
              Tally-style module
            </div>
            <h1 className="mt-4 text-3xl font-bold text-slate-900">{title}</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">{subtitle}</p>
          </div>
        </section>
      </div>
    </div>
  );
}
