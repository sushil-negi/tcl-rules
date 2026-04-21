import Image from "next/image";
import Link from "next/link";
import { isAdmin } from "@/lib/auth";
import SignOutButton from "./sign-out-button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authed = await isAdmin();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-[#1E2533] text-white py-3 px-4 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <Link href="/admin/issues" className="flex items-center gap-3 min-w-0">
            <div className="bg-white rounded-full p-1 shadow-md shrink-0">
              <Image
                src="/tcl-logo.png"
                alt="TCL"
                width={36}
                height={36}
                className="w-8 h-8 sm:w-9 sm:h-9"
              />
            </div>
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-bold leading-tight truncate">
                TCL Admin
              </div>
              <div className="text-[10px] sm:text-xs text-orange-300 leading-tight">
                Support Issues Tracker
              </div>
            </div>
          </Link>
          {authed && <SignOutButton />}
        </div>
      </header>
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6">{children}</main>
    </div>
  );
}
