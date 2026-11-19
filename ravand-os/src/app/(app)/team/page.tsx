import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isManager, isOwner } from '@/lib/perm';
import { OPEN } from '@/lib/data';
import { EMPLOYMENT, ROLE } from '@/lib/labels';
import { faNum, startOfTehranDay } from '@/lib/jalali';
import { createUser, resetPassword, toggleUserActive } from '../actions';

export default async function Team() {
  const u = await requireUser();
  if (!isManager(u)) redirect('/');
  const today0 = startOfTehranDay();
  const since = new Date(Date.now() - 30 * 86400000);
  const [users, open, late, reps] = await Promise.all([
    prisma.user.findMany({ where: { deletedAt: null }, orderBy: [{ active: 'desc' }, { name: 'asc' }] }),
    prisma.task.groupBy({ by: ['assigneeId'], where: { deletedAt: null, status: { in: [...OPEN] }, assigneeId: { not: null } }, _count: true }),
    prisma.task.groupBy({ by: ['assigneeId'], where: { deletedAt: null, status: { in: [...OPEN] }, assigneeId: { not: null }, deadline: { lt: today0 } }, _count: true }),
    prisma.report.groupBy({ by: ['authorId'], where: { createdAt: { gte: since } }, _count: true }),
  ]);
  const n = (m: { assigneeId?: string | null; authorId?: string; _count: number }[], id: string) => m.find((x) => (x.assigneeId ?? x.authorId) === id)?._count ?? 0;
  const owner = isOwner(u);
  return (
    <>
      <div className="page-head"><div><h1>تیم</h1><div className="muted">{faNum(users.filter((x) => x.active).length)} عضو فعال</div></div></div>
      {owner && <details className="panel"><summary>عضو جدید</summary>
        <form action={createUser} className="form cols">
          <label>نام<input name="name" required /></label>
          <label>ایمیل<input name="email" type="email" required dir="ltr" /></label>
          <label>رمز موقت (حداقل ۸ نویسه)<input name="password" minLength={8} required dir="ltr" /></label>
          <label>نقش<select name="role" defaultValue="MEMBER">{Object.entries(ROLE).filter(([k]) => k !== 'OWNER').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>نوع همکاری<select name="employment" defaultValue="FULL_TIME">{Object.entries(EMPLOYMENT).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>عنوان شغلی<input name="title" /></label>
          <label style={{ flexDirection: 'row', display: 'flex', gap: 6 }}><input type="checkbox" name="canSeeFinance" /> دسترسی به اطلاعات مالی</label>
          <div><button className="btn">افزودن</button></div>
        </form>
      </details>}
      <div className="panel" style={{ marginTop: 14, overflowX: 'auto' }}>
        <table><thead><tr><th>نام</th><th>نقش</th><th>همکاری</th><th>باز</th><th>دیرکرد</th><th>گزارش ۳۰ روز</th>{owner && <th></th>}</tr></thead><tbody>
          {users.map((m) => (
            <tr key={m.id} style={m.active ? undefined : { opacity: 0.5 }}>
              <td><strong>{m.name}</strong><div className="muted sm" dir="ltr" style={{ textAlign: 'right' }}>{m.email}</div></td>
              <td>{ROLE[m.role]}{m.title && <div className="muted sm">{m.title}</div>}</td>
              <td>{EMPLOYMENT[m.employment]}</td>
              <td className="num">{faNum(n(open, m.id))}</td>
              <td className={`num ${n(late, m.id) ? 'late' : ''}`}>{faNum(n(late, m.id))}</td>
              <td className="num">{faNum(n(reps, m.id))}</td>
              {owner && <td style={{ whiteSpace: 'nowrap' }}>
                {m.id !== u.id && <form action={toggleUserActive} style={{ display: 'inline' }}><input type="hidden" name="id" value={m.id} /><button className="btn ghost sm">{m.active ? 'غیرفعال' : 'فعال‌سازی'}</button></form>}
                <form action={resetPassword} style={{ display: 'inline-flex', gap: 4, marginRight: 6 }}><input type="hidden" name="id" value={m.id} /><input name="password" placeholder="رمز جدید" minLength={8} style={{ width: 90 }} dir="ltr" /><button className="btn ghost sm">تغییر رمز</button></form>
              </td>}
            </tr>
          ))}
        </tbody></table>
        <p className="muted sm">تعداد وظایف تنها یک شاخص بار کاری است، نه معیار عملکرد.</p>
      </div>
    </>
  );
}
