import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { isManager, projectScope, taskScope } from '@/lib/perm';
import { OPEN } from '@/lib/data';
import { PRIORITY, TASK_TYPE } from '@/lib/labels';
import { faNum, startOfTehranDay } from '@/lib/jalali';
import TaskRow, { taskInclude } from '@/components/TaskRow';
import JalaliDateInput from '@/components/JalaliDateInput';
import { createTask } from '@/app/actions';

const VIEWS: [string, string][] = [['open', 'باز'], ['overdue', 'دیرکرد'], ['blocked', 'مسدود'], ['done', 'انجام‌شده'], ['all', 'همه']];

export default async function Tasks({ searchParams }: { searchParams: { view?: string; who?: string; q?: string } }) {
  const u = await requireUser();
  const mgr = isManager(u);
  const today0 = startOfTehranDay();
  const view = searchParams.view ?? 'open';
  const who = mgr ? searchParams.who ?? 'all' : 'me';
  const q = (searchParams.q ?? '').trim();
  const status: Prisma.TaskWhereInput =
    view === 'open' ? { status: { in: [...OPEN] } } :
    view === 'overdue' ? { status: { in: [...OPEN] }, deadline: { lt: today0 } } :
    view === 'blocked' ? { status: 'BLOCKED' } :
    view === 'done' ? { status: { in: ['COMPLETED', 'CANCELLED'] } } : {};
  const whoF: Prisma.TaskWhereInput = who === 'me' ? { assigneeId: u.id } : who === 'none' ? { assigneeId: null } : who !== 'all' ? { assigneeId: who } : {};
  const [tasks, projects, people] = await Promise.all([
    prisma.task.findMany({
      where: { AND: [taskScope(u), status, whoF, q ? { title: { contains: q, mode: 'insensitive' } } : {}] },
      include: taskInclude, orderBy: [{ priority: 'asc' }, { deadline: 'asc' }], take: 200,
    }),
    prisma.project.findMany({ where: { ...projectScope(u), status: { notIn: ['COMPLETED', 'ARCHIVED'] } }, select: { id: true, title: true }, orderBy: { title: 'asc' } }),
    mgr ? prisma.user.findMany({ where: { active: true, deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }) : Promise.resolve([]),
  ]);
  const link = (v: string, w = who) => `/tasks?view=${v}&who=${w}${q ? `&q=${encodeURIComponent(q)}` : ''}`;
  return (
    <>
      <div className="page-head"><div><h1>وظایف</h1><div className="muted">{faNum(tasks.length)} مورد</div></div></div>
      <details className="panel"><summary>وظیفه‌ی جدید</summary>
        <form action={createTask} className="form cols">
          <label className="full">عنوان<input name="title" required /></label>
          <label>پروژه (اختیاری)<select name="projectId"><option value="">بدون پروژه</option>{projects.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}</select></label>
          {mgr && <label>مسئول<select name="assigneeId" defaultValue={u.id}><option value="">بدون مسئول</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}
          <label>نوع<select name="type" defaultValue="ADMINISTRATIVE">{Object.entries(TASK_TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>اولویت<select name="priority" defaultValue="MEDIUM">{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label>مهلت<JalaliDateInput name="deadline" /></label>
          <label className="full">توضیحات<textarea name="description" /></label>
          <div><button className="btn">ثبت وظیفه</button></div>
        </form>
      </details>
      <div className="filters" style={{ marginTop: 14 }}>
        {VIEWS.map(([v, l]) => <Link key={v} href={link(v)} className={view === v ? 'on' : ''}>{l}</Link>)}
        {mgr && <>
          <span className="muted sm" style={{ padding: '4px 6px' }}>|</span>
          <Link href={link(view, 'all')} className={who === 'all' ? 'on' : ''}>همه</Link>
          <Link href={link(view, 'me')} className={who === 'me' ? 'on' : ''}>مال من</Link>
          <Link href={link(view, 'none')} className={who === 'none' ? 'on' : ''}>بدون مسئول</Link>
        </>}
        <form style={{ marginRight: 'auto' }}><input type="hidden" name="view" value={view} /><input type="hidden" name="who" value={who} /><input name="q" defaultValue={q} placeholder="جستجو در عنوان…" /></form>
      </div>
      <div className="panel">
        {tasks.length ? tasks.map((t) => <TaskRow key={t.id} t={t} today0={today0} mgr={mgr} me={u.id} people={people} />) : <div className="empty-note">موردی پیدا نشد.</div>}
      </div>
    </>
  );
}
