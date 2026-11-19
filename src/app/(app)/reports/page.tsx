import Link from 'next/link';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isManager, projectScope } from '@/lib/perm';
import { DAILY_FIELDS, REPORT_STATE, REPORT_TYPE, WEEKLY_FIELDS, type Field } from '@/lib/labels';
import { formatJalali, formatJalaliShort, faNum } from '@/lib/jalali';
import { reviewReport, submitReport } from '@/app/actions';

function ReportForm({ type, fields, projects }: { type: 'DAILY' | 'WEEKLY'; fields: Field[]; projects: { id: string; title: string }[] }) {
  return (
    <form action={submitReport} className="form">
      <input type="hidden" name="type" value={type} />
      {fields.map((f) => <label key={f.key}>{f.label}{f.long ? <textarea name={f.key} /> : <input name={f.key} inputMode="decimal" style={{ maxWidth: 120 }} />}</label>)}
      <div className="form cols">
        <label>پروژه‌ی مرتبط (اختیاری)<select name="projectId"><option value="">—</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
        <label>پیشرفت از نظر من (٪)<input name="reportedProgress" inputMode="numeric" style={{ maxWidth: 120 }} /></label>
      </div>
      <div><button className="btn">ارسال گزارش {REPORT_TYPE[type]}</button> <span className="muted sm">اگر امروز/این هفته قبلاً ارسال کرده‌اید، نسخه‌ی قبلی در تاریخچه می‌ماند و این نسخه جایگزین می‌شود.</span></div>
    </form>
  );
}

export default async function Reports({ searchParams }: { searchParams: { s?: string } }) {
  const u = await requireUser();
  const mgr = isManager(u);
  const s = searchParams.s ?? (mgr ? 'SUBMITTED' : 'all');
  const [reports, projects] = await Promise.all([
    prisma.report.findMany({ where: { ...(mgr ? {} : { authorId: u.id }), ...(s === 'all' ? {} : { state: s as never }) }, include: { author: { select: { name: true } }, project: { select: { title: true } }, revisions: { select: { id: true } } }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.project.findMany({ where: { ...projectScope(u), status: { notIn: ['COMPLETED', 'ARCHIVED'] } }, select: { id: true, title: true } }),
  ]);
  const tabs: [string, string][] = mgr ? [['SUBMITTED', 'در انتظار بررسی'], ['RETURNED', 'برگشت‌خورده'], ['APPROVED', 'تأییدشده'], ['all', 'همه']] : [['all', 'همه'], ['RETURNED', 'برگشت‌خورده']];
  return (
    <>
      <div className="page-head"><h1>گزارش‌ها</h1></div>
      <details className="panel"><summary>گزارش روزانه</summary><ReportForm type="DAILY" fields={DAILY_FIELDS} projects={projects} /></details>
      <details className="panel"><summary>گزارش هفتگی</summary><ReportForm type="WEEKLY" fields={WEEKLY_FIELDS} projects={projects} /></details>
      <div className="filters" style={{ marginTop: 14 }}>{tabs.map(([k, l]) => <Link key={k} href={`/reports?s=${k}`} className={s === k ? 'on' : ''}>{l}</Link>)}</div>
      {reports.map((r) => {
        const fields = r.type === 'WEEKLY' ? WEEKLY_FIELDS : DAILY_FIELDS;
        const c = r.content as Record<string, string>;
        return (
          <div className="panel" key={r.id}>
            <div className="row" style={{ borderBottom: 0 }}>
              <div className="grow"><strong>{REPORT_TYPE[r.type]} — {r.author.name}</strong><div className="muted sm">{formatJalali(r.periodStart)}{r.project && ` · ${r.project.title}`}{r.revisions.length > 0 && ` · ${faNum(r.revisions.length)} نسخه‌ی قبلی`}</div></div>
              <span className={`badge b-${r.state}`}>{REPORT_STATE[r.state]}</span>
            </div>
            {fields.filter((f) => c[f.key]).map((f) => <div key={f.key} className="sm" style={{ marginTop: 6 }}><span className="muted">{f.label}</span><div style={{ whiteSpace: 'pre-wrap' }}>{c[f.key]}</div></div>)}
            <div className="sm muted" style={{ marginTop: 8 }}>
              {r.reportedProgress != null && <>پیشرفت گزارش‌شده: {faNum(r.reportedProgress)}٪ </>}
              {r.verifiedProgress != null && <>· پیشرفت تأییدشده: {faNum(r.verifiedProgress)}٪ </>}
              {r.reviewNote && <>· یادداشت مدیر: {r.reviewNote}</>}
            </div>
            {mgr && r.state === 'SUBMITTED' && r.authorId !== u.id && (
              <form action={reviewReport} className="form cols" style={{ marginTop: 10 }}>
                <input type="hidden" name="id" value={r.id} />
                <label>پیشرفت تأییدشده (٪)<input name="verifiedProgress" inputMode="numeric" /></label>
                <label>یادداشت<input name="note" /></label>
                <div style={{ display: 'flex', gap: 6 }}><button className="btn sm" name="decision" value="approve">تأیید</button><button className="btn ghost sm" name="decision" value="return">برگشت برای اصلاح</button></div>
              </form>
            )}
          </div>
        );
      })}
      {!reports.length && <div className="panel empty-note">گزارشی نیست.</div>}
    </>
  );
}
