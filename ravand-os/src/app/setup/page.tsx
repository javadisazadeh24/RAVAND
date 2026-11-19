import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import { setupOwner } from '../actions';
export const dynamic = 'force-dynamic';

export default async function Setup({ searchParams }: { searchParams: { e?: string } }) {
  if ((await prisma.user.count()) > 0) redirect('/login');
  return (
    <div className="auth"><form className="panel form" action={setupOwner}>
      <img src="/logo.png" alt="راوند" />
      <h2 style={{ textAlign: 'center' }}>راه‌اندازی اولیه</h2>
      <p className="muted sm">حساب مدیرعامل را بسازید. این صفحه فقط یک بار، وقتی هنوز کاربری وجود ندارد، فعال است.</p>
      <label>نام<input name="name" required /></label>
      <label>ایمیل<input name="email" type="email" required dir="ltr" /></label>
      <label>رمز عبور (حداقل ۸ نویسه)<input name="password" type="password" minLength={8} required dir="ltr" /></label>
      <label>تکرار رمز عبور<input name="password2" type="password" minLength={8} required dir="ltr" /></label>
      {searchParams.e && <div className="err">اطلاعات معتبر نیست یا رمزها یکسان نیستند.</div>}
      <button className="btn">ساخت حساب مدیرعامل</button>
    </form></div>
  );
}
