'use server';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { createSession, destroySession, requireUser } from '@/lib/auth';
import { isManager, isOwner, projectScope } from '@/lib/perm';
import { audit } from '@/lib/audit';
import { isoToDate, dateToIso, tehranParts, weekdaySat } from '@/lib/jalali';
import { DEFAULT_CATEGORIES, DEFAULT_SKILLS } from '@/lib/labels';

const str = (fd: FormData, k: string) => String(fd.get(k) ?? '').trim();
const opt = (fd: FormData, k: string) => str(fd, k) || null;
const faToEn = (s: string) => s.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٠-٩]/g, (c) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[,٬،\s]/g, '');
const num = (fd: FormData, k: string) => { const s = faToEn(str(fd, k)); const n = Number(s); return s && Number.isFinite(n) ? n : null; };
const bigint = (fd: FormData, k: string) => { const s = faToEn(str(fd, k)); return /^\d+$/.test(s) ? BigInt(s) : null; };
const refresh = () => revalidatePath('/', 'layout');

// ---------- auth ----------
const fails = new Map<string, { n: number; until: number }>();
export async function login(fd: FormData) {
  const email = str(fd, 'email').toLowerCase();
  const rec = fails.get(email);
  if (rec && rec.n >= 5 && rec.until > Date.now()) redirect('/login?e=locked');
  const u = await prisma.user.findFirst({ where: { email, active: true, deletedAt: null } });
  if (!u || !(await bcrypt.compare(str(fd, 'password'), u.passwordHash))) {
    fails.set(email, { n: (rec?.n ?? 0) + 1, until: Date.now() + 15 * 60_000 });
    redirect('/login?e=bad');
  }
  fails.delete(email);
  await createSession(u.id);
  await audit(u.id, 'User', u.id, 'login');
  redirect('/');
}
export async function logout() { destroySession(); redirect('/login'); }

export async function setupOwner(fd: FormData) {
  if ((await prisma.user.count()) > 0) redirect('/login');
  const name = str(fd, 'name'), email = str(fd, 'email').toLowerCase(), pw = str(fd, 'password');
  if (!name || !email || pw.length < 8 || pw !== str(fd, 'password2')) redirect('/setup?e=1');
  const u = await prisma.user.create({ data: { name, email, passwordHash: await bcrypt.hash(pw, 10), role: 'OWNER', title: 'مدیرعامل', canSeeFinance: true } });
  await prisma.projectCategory.createMany({ data: DEFAULT_CATEGORIES.map((name) => ({ name })), skipDuplicates: true });
  await prisma.skill.createMany({ data: DEFAULT_SKILLS.map((name) => ({ name })), skipDuplicates: true });
  await audit(u.id, 'User', u.id, 'owner_created');
  await createSession(u.id);
  redirect('/');
}

// ---------- tasks ----------
export async function createTask(fd: FormData) {
  const u = await requireUser();
  const title = str(fd, 'title');
  if (!title) return;
  const mgr = isManager(u);
  const assigneeId = mgr ? (fd.has('assigneeId') ? opt(fd, 'assigneeId') : u.id) : u.id; // members/interns only create tasks for themselves; quick-add defaults to self
  let projectId = opt(fd, 'projectId');
  if (projectId && !mgr && !(await prisma.project.count({ where: { id: projectId, ...projectScope(u) } }))) projectId = null;
  const iso = str(fd, 'deadline');
  const deadline = /^\d{4}-\d{2}-\d{2}$/.test(iso) ? isoToDate(iso) : null;
  const t = await prisma.task.create({
    data: {
      title, description: opt(fd, 'description'), projectId, assigneeId, creatorId: u.id, deadline,
      priority: (str(fd, 'priority') || 'MEDIUM') as never, type: (str(fd, 'type') || 'ADMINISTRATIVE') as never,
      status: 'NOT_STARTED',
    },
  });
  await audit(u.id, 'Task', t.id, 'created', undefined, { title, assigneeId, projectId, deadline });
  if (assigneeId && assigneeId !== u.id) await prisma.notification.create({ data: { userId: assigneeId, kind: 'task_assigned', message: `وظیفه‌ی جدید: ${title}`, link: '/tasks' } });
  if (assigneeId && deadline) {
    const remindAt = new Date(deadline.getTime() - 24 * 3600_000);
    if (remindAt > new Date()) await prisma.reminder.create({ data: { userId: assigneeId, title: `فردا مهلت وظیفه: ${title}`, remindAt, taskId: t.id } });
  }
  refresh();
}

export async function setTaskStatus(fd: FormData) {
  const u = await requireUser();
  const id = str(fd, 'id'), status = str(fd, 'status');
  const t = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!t || !(isManager(u) || t.assigneeId === u.id || t.creatorId === u.id)) return;
  const done = status === 'COMPLETED';
  const blockerNote = status === 'BLOCKED' ? opt(fd, 'note') ?? t.blockerNote : null;
  const upd = await prisma.task.update({ where: { id }, data: { status: status as never, completedAt: done ? new Date() : null, progress: done ? 100 : t.progress, blockerNote } });
  await audit(u.id, 'Task', id, 'status_changed', { status: t.status }, { status: upd.status });
  if (status === 'BLOCKED' && t.assigneeId) {
    const mgrs = await prisma.user.findMany({ where: { role: { in: ['OWNER', 'MANAGER'] }, active: true, id: { not: u.id } }, select: { id: true } });
    await prisma.notification.createMany({ data: mgrs.map((m) => ({ userId: m.id, kind: 'blocked', message: `وظیفه مسدود شد: ${t.title}`, link: '/tasks?view=blocked' })) });
  }
  refresh();
}

export async function setTaskProgress(fd: FormData) {
  const u = await requireUser();
  const id = str(fd, 'id'); const p = Math.max(0, Math.min(100, num(fd, 'progress') ?? 0));
  const t = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!t || !(isManager(u) || t.assigneeId === u.id)) return;
  await prisma.task.update({ where: { id }, data: { progress: p, status: t.status === 'NOT_STARTED' && p > 0 ? 'IN_PROGRESS' : t.status } });
  await audit(u.id, 'Task', id, 'progress_changed', { progress: t.progress }, { progress: p });
  refresh();
}

export async function reassignTask(fd: FormData) {
  const u = await requireUser();
  if (!isManager(u)) return;
  const id = str(fd, 'id'), assigneeId = opt(fd, 'assigneeId');
  const t = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!t) return;
  await prisma.task.update({ where: { id }, data: { assigneeId } });
  await audit(u.id, 'Task', id, 'reassigned', { assigneeId: t.assigneeId }, { assigneeId });
  if (assigneeId && assigneeId !== u.id) await prisma.notification.create({ data: { userId: assigneeId, kind: 'task_assigned', message: `وظیفه به شما محول شد: ${t.title}`, link: '/tasks' } });
  refresh();
}

export async function deleteTask(fd: FormData) {
  const u = await requireUser();
  const id = str(fd, 'id');
  const t = await prisma.task.findFirst({ where: { id, deletedAt: null } });
  if (!t || !(isManager(u) || t.creatorId === u.id)) return;
  await prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
  await audit(u.id, 'Task', id, 'deleted', { title: t.title });
  refresh();
}

// ---------- projects ----------
export async function createProject(fd: FormData) {
  const u = await requireUser();
  if (!isManager(u)) return;
  const title = str(fd, 'title');
  if (!title) return;
  const clientName = str(fd, 'client');
  let clientId: string | null = null;
  if (clientName) {
    const c = (await prisma.client.findFirst({ where: { name: clientName, deletedAt: null } })) ?? (await prisma.client.create({ data: { name: clientName } }));
    clientId = c.id;
  }
  const iso = str(fd, 'deadline');
  const members = fd.getAll('members').map(String);
  let p = null;
  const base = await prisma.project.count();
  for (let i = 1; i <= 5 && !p; i++) {
    try {
      p = await prisma.project.create({
        data: {
          code: `RV-${String(base + i).padStart(3, '0')}`, title, description: opt(fd, 'description'), clientId,
          categoryId: opt(fd, 'categoryId'), pmId: opt(fd, 'pmId'), priority: (str(fd, 'priority') || 'MEDIUM') as never,
          status: 'PLANNING', deadline: /^\d{4}-\d{2}-\d{2}$/.test(iso) ? isoToDate(iso) : null,
          estBudget: bigint(fd, 'estBudget'), estRevenue: bigint(fd, 'estRevenue'),
          members: { create: members.map((userId) => ({ userId })) },
        },
      });
    } catch (e) { if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002')) throw e; }
  }
  if (!p) return;
  await audit(u.id, 'Project', p.id, 'created', undefined, { title, code: p.code });
  refresh();
  redirect(`/projects/${p.id}`);
}

export async function setProjectStatus(fd: FormData) {
  const u = await requireUser();
  if (!isManager(u)) return;
  const id = str(fd, 'id'), status = str(fd, 'status');
  const p = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!p) return;
  await prisma.project.update({ where: { id }, data: { status: status as never } });
  await audit(u.id, 'Project', id, 'status_changed', { status: p.status }, { status });
  refresh();
}

export async function setProjectHealth(fd: FormData) {
  const u = await requireUser();
  if (!isManager(u)) return;
  const id = str(fd, 'id'), h = str(fd, 'health');
  const p = await prisma.project.findFirst({ where: { id, deletedAt: null } });
  if (!p) return;
  const reason = str(fd, 'reason');
  if (h && !reason) return; // an override must carry a reason
  await prisma.project.update({ where: { id }, data: { healthOverride: (h || null) as never, healthReason: h ? reason : null } });
  await audit(u.id, 'Project', id, 'health_override', { h: p.healthOverride }, { h: h || null, reason });
  refresh();
}

export async function archiveProject(fd: FormData) {
  const u = await requireUser();
  if (!isManager(u)) return;
  const id = str(fd, 'id');
  await prisma.project.update({ where: { id }, data: { status: 'ARCHIVED' } });
  await audit(u.id, 'Project', id, 'archived');
  refresh();
  redirect('/projects');
}

// ---------- team ----------
export async function createUser(fd: FormData) {
  const u = await requireUser();
  if (!isOwner(u)) return;
  const email = str(fd, 'email').toLowerCase(), name = str(fd, 'name'), pw = str(fd, 'password');
  if (!email || !name || pw.length < 8) return;
  if (await prisma.user.findUnique({ where: { email } })) return;
  const nu = await prisma.user.create({
    data: { email, name, passwordHash: await bcrypt.hash(pw, 10), role: (str(fd, 'role') || 'MEMBER') as never, employment: (str(fd, 'employment') || 'FULL_TIME') as never, title: opt(fd, 'title'), canSeeFinance: fd.get('canSeeFinance') === 'on' },
  });
  await audit(u.id, 'User', nu.id, 'created', undefined, { email, role: nu.role });
  refresh();
}
export async function toggleUserActive(fd: FormData) {
  const u = await requireUser();
  const id = str(fd, 'id');
  if (!isOwner(u) || id === u.id) return;
  const t = await prisma.user.findUnique({ where: { id } });
  if (!t) return;
  await prisma.user.update({ where: { id }, data: { active: !t.active } });
  await audit(u.id, 'User', id, t.active ? 'deactivated' : 'activated');
  refresh();
}
export async function resetPassword(fd: FormData) {
  const u = await requireUser();
  const pw = str(fd, 'password');
  if (!isOwner(u) || pw.length < 8) return;
  const id = str(fd, 'id');
  await prisma.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(pw, 10) } });
  await audit(u.id, 'User', id, 'password_reset');
  refresh();
}

// ---------- reports ----------
export async function submitReport(fd: FormData) {
  const u = await requireUser();
  const type = str(fd, 'type') === 'WEEKLY' ? 'WEEKLY' : 'DAILY';
  const now = new Date();
  const { gy, gm, gd } = tehranParts(now);
  let start = isoToDate(dateToIso(now)), end = start;
  if (type === 'WEEKLY') {
    const back = weekdaySat(gy, gm, gd);
    start = new Date(start.getTime() - back * 86400000);
    end = new Date(start.getTime() + 6 * 86400000);
  }
  const content: Record<string, string> = {};
  for (const [k, v] of fd.entries()) if (!['type', 'projectId', 'reportedProgress'].includes(k) && typeof v === 'string' && v.trim()) content[k] = v.trim();
  if (!Object.keys(content).length) return;
  const projectId = opt(fd, 'projectId');
  const existing = await prisma.report.findFirst({ where: { authorId: u.id, type, periodStart: start } });
  if (existing) {
    if (existing.state === 'APPROVED') return; // approved reports are frozen
    await prisma.reportRevision.create({ data: { reportId: existing.id, content: existing.content as Prisma.InputJsonValue } });
    await prisma.report.update({ where: { id: existing.id }, data: { content, state: 'SUBMITTED', submittedAt: now, projectId, reportedProgress: num(fd, 'reportedProgress') } });
    await audit(u.id, 'Report', existing.id, 'resubmitted');
  } else {
    const r = await prisma.report.create({ data: { type, authorId: u.id, projectId, periodStart: start, periodEnd: end, content, state: 'SUBMITTED', submittedAt: now, reportedProgress: num(fd, 'reportedProgress') } });
    await audit(u.id, 'Report', r.id, 'submitted');
  }
  const mgrs = await prisma.user.findMany({ where: { role: { in: ['OWNER', 'MANAGER'] }, active: true, id: { not: u.id } }, select: { id: true } });
  await prisma.notification.createMany({ data: mgrs.map((m) => ({ userId: m.id, kind: 'report', message: `گزارش جدید از ${u.name}`, link: '/reports' })) });
  refresh();
}

export async function reviewReport(fd: FormData) {
  const u = await requireUser();
  if (!isManager(u)) return;
  const id = str(fd, 'id'), decision = str(fd, 'decision');
  const r = await prisma.report.findUnique({ where: { id } });
  if (!r || r.authorId === u.id && !isOwner(u)) return;
  const state = decision === 'approve' ? 'APPROVED' : 'RETURNED';
  await prisma.report.update({ where: { id }, data: { state, reviewerId: u.id, reviewNote: opt(fd, 'note'), verifiedProgress: num(fd, 'verifiedProgress') } });
  await audit(u.id, 'Report', id, state.toLowerCase(), { state: r.state }, { state });
  await prisma.notification.create({ data: { userId: r.authorId, kind: 'report_review', message: state === 'APPROVED' ? 'گزارش شما تأیید شد' : 'گزارش شما برای اصلاح برگشت خورد', link: '/reports' } });
  refresh();
}

// ---------- reminders / notifications ----------
export async function createReminder(fd: FormData) {
  const u = await requireUser();
  const title = str(fd, 'title'), iso = str(fd, 'date'), time = str(fd, 'time') || '09:00';
  if (!title || !/^\d{4}-\d{2}-\d{2}$/.test(iso) || !/^\d{2}:\d{2}$/.test(time)) return;
  await prisma.reminder.create({ data: { userId: u.id, title, remindAt: new Date(`${iso}T${time}:00+03:30`) } });
  refresh();
}
export async function doneReminder(fd: FormData) {
  const u = await requireUser();
  await prisma.reminder.updateMany({ where: { id: str(fd, 'id'), userId: u.id }, data: { doneAt: new Date(), notifiedAt: new Date() } });
  refresh();
}
export async function deleteReminder(fd: FormData) {
  const u = await requireUser();
  await prisma.reminder.deleteMany({ where: { id: str(fd, 'id'), userId: u.id } });
  refresh();
}
export async function markNotificationsRead() {
  const u = await requireUser();
  await prisma.notification.updateMany({ where: { userId: u.id, readAt: null }, data: { readAt: new Date() } });
  refresh();
}
