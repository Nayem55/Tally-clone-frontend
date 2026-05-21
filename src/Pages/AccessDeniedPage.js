import { Link } from "react-router-dom";

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-10 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
          Access Restricted
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-900">You do not have permission to open this page</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Your current employee role does not include access to this area. Please use an account with the correct role or ask an administrator to update your access boundaries.
        </p>
        <div className="mt-8">
          <Link
            to="/"
            className="inline-flex rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
