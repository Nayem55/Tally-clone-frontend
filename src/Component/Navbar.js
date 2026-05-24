import { Menu } from "lucide-react";

export default function Navbar({ onOpenSidebar }) {
  return (
    <div className="sticky top-0 z-40 w-full bg-blue-800 px-4 py-3 text-white shadow">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 lg:hidden">
          <button
            type="button"
            onClick={onOpenSidebar}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <div className="text-sm font-semibold">AccuBooks</div>
            <div className="text-xs text-blue-100">Accounting workspace</div>
          </div>
        </div>
        <div className="hidden lg:block" aria-hidden="true" />
      </div>
    </div>
  );
}
