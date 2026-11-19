import { requireUser } from '@/lib/auth';
import { isManager } from '@/lib/perm';
import { prisma } from '@/lib/db';
import { ROLE } from '@/lib/labels';
import { logout, createTask } from '../actions';
import NavLink from '@/components/NavLink';
import Clock from '@/components/Clock';
import ReminderPoller from '@/components/ReminderPoller';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser();
  const mgr = isManager(u);
  const unread = await prisma.notification.count({ where: { userId: u.id, readAt: null } });
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand"><img src="/logo.png" alt="" /><div><b>راوند</b><span>سیستم مدیریت</span></div></div>
        <NavLink href="/">{mgr ? 'کنترل مدیریت' : 'روز من'}{unread > 0 && <span className="badge b-HIGH">{unread}</span>}</NavLink>
        <NavLink href="/tasks">وظایف</NavLink>
        <NavLink href="/projects">پروژه‌ها</NavLink>
        <NavLink href="/calendar">تقویم</NavLink>
        <NavLink href="/reminders">یادآورها</NavLink>
        <NavLink href="/reports">گزارش‌ها</NavLink>
        {mgr && <NavLink href="/team">تیم</NavLink>}
        <div className="who">
          <div>{u.name}</div><div>{ROLE[u.role]}</div>
          <form action={logout}><button>خروج</button></form>
        </div>
      </aside>
      <div className="main">
        <header className="top">
          <Clock />
          <div className="grow" />
          <ReminderPoller />
          <form className="quick" action={createTask}>
            <input name="title" placeholder="افزودن سریع وظیفه… (Enter)" required />
            <button className="btn">افزودن</button>
          </form>
        </header>
        <main className="page">{children}</main>
      </div>
    </div>
  );
}
