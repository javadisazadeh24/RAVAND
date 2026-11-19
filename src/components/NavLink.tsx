'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
export default function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const p = usePathname();
  const active = href === '/' ? p === '/' : p.startsWith(href);
  return <Link href={href} className={active ? 'nav active' : 'nav'}>{children}</Link>;
}
