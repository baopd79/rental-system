"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { Building2, LayoutDashboard } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/properties", label: "Nhà trọ", icon: Building2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 flex flex-col border-r bg-white h-screen sticky top-0">
      <div className="px-4 py-5 border-b">
        <span className="font-bold text-base">Quản lý nhà trọ</span>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-gray-100 text-gray-900 font-medium"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-4 py-4 border-t flex items-center gap-2.5">
        <UserButton />
        <span className="text-sm text-gray-600">Tài khoản</span>
      </div>
    </aside>
  );
}
