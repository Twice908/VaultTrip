import { LayoutGrid, Plane, Archive, User } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Trips",     href: "/trips",     icon: Plane },
  { label: "Vault",     href: "/vault",     icon: Archive },
  { label: "Profile",   href: "/profile",   icon: User },
];
