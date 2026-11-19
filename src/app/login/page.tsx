import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { login } from '@/app/actions';
export const dynamic = 'force-dynamic';

export default async function Login({ searchParams }: { searchParams: { e?: string } }) {
  if ((await prisma.user.count()) === 0) redirect('/setup');
  return (
    <div className="auth"><form className="panel form" action={login}>
      <img src="/logo.png" alt="روند" />
      <h2 style={{ textAlign: 'center' }}>ورود به سیستم مدیریت</h2>
      <label>ایمیل<input name="email" type="email" required autoComplete="username" dir="ltr" /></label>
      <label>رمز عبور<input name="password" type="password" required autoComplete="current-password" dir="ltr" /></label>
      {searchParams.e === 'bad' && <div className="err">ایمیل یا رمز عبور درست نیست.</div>}
      {searchParams.e === 'locked' && <div className="err">تلاش‌های ناموفق زیاد بود. ۱۵ دقیقه صبر کنید.</div>}
      <button className="btn">ورود</button>
    </form></div>
  );
}
