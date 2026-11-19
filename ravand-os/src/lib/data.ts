import { prisma } from './db';
import type { SessionUser } from './auth';
import { projectScope, taskScope } from './perm';
import { dateToIso, isoToDate, jalaliMonthLength, startOfTehranDay, toGregorian } from './jalali';
import type { CalItem } from '@/components/MiniCalendar';

export const OPEN = ['NOT_STARTED', 'IN_PROGRESS', 'WAITING', 'BLOCKED'] as const;

export async function calendarItems(u: SessionUser, jy: number, jm: number): Promise<CalItem[]> {
  const g = toGregorian(jy, jm, 1);
  const start = new Date(isoToDate(`${g.gy}-${String(g.gm).padStart(2, '0')}-${String(g.gd).padStart(2, '0')}`).getTime() - 12 * 3600_000);
  const end = new Date(start.getTime() + jalaliMonthLength(jy, jm) * 86400_000);
  const today0 = startOfTehranDay();
  const [tasks, reminders, projects] = await Promise.all([
    prisma.task.findMany({ where: { ...taskScope(u), status: { in: [...OPEN] }, deadline: { gte: start, lt: end } }, select: { title: true, deadline: true } }),
    prisma.reminder.findMany({ where: { userId: u.id, doneAt: null, remindAt: { gte: start, lt: end } }, select: { title: true, remindAt: true } }),
    prisma.project.findMany({ where: { ...projectScope(u), status: { notIn: ['COMPLETED', 'ARCHIVED'] }, deadline: { gte: start, lt: end } }, select: { title: true, deadline: true } }),
  ]);
  return [
    ...tasks.map((t) => ({ iso: dateToIso(t.deadline!), label: t.title, tone: (t.deadline! < today0 ? 'late' : 'task') as CalItem['tone'] })),
    ...reminders.map((r) => ({ iso: dateToIso(r.remindAt), label: r.title, tone: 'remind' as const })),
    ...projects.map((p) => ({ iso: dateToIso(p.deadline!), label: `مهلت پروژه: ${p.title}`, tone: 'project' as const })),
  ];
}
