import Link from 'next/link';
import type { Prisma } from '@prisma/client';
import { PRIORITY, TASK_STATUS, TASK_TYPE } from '@/lib/labels';
import { formatJalaliShort } from '@/lib/jalali';
import { setTaskStatus, reassignTask, deleteTask } from '@/app/actions';
import AutoSelect from './AutoSelect';

export type TaskWithRels = Prisma.TaskGetPayload<{ include: { project: { select: { id: true; title: true; code: true } }; assignee: { select: { id: true; name: true } } } }>;

export default function TaskRow({ t, today0, mgr, me, people, compact }: { t: TaskWithRels; today0: Date; mgr: boolean; me: string; people?: { id: string; name: string }[]; compact?: boolean }) {
  const closed = t.status === 'COMPLETED' || t.status === 'CANCELLED';
  const late = !closed && t.deadline && t.deadline < today0;
  const canEdit = mgr || t.assigneeId === me || t.creatorId === me;
  return (
    <div className="row">
      <div className="grow">
        <div><strong style={t.status === 'COMPLETED' ? { textDecoration: 'line-through', color: 'var(--gray-600)' } : undefined}>{t.title}</strong>{' '}
          {(t.priority === 'CRITICAL' || t.priority === 'HIGH') && <span className={`badge b-${t.priority}`}>{PRIORITY[t.priority]}</span>}</div>
        <div className="muted sm">
          {t.project ? <Link href={`/projects/${t.project.id}`}>{t.project.title}</Link> : 'بدون پروژه'} · {TASK_TYPE[t.type]} · {t.assignee?.name ?? <span className="late">بدون مسئول</span>}
          {t.status === 'BLOCKED' && t.blockerNote && <> · <span className="late">مانع: {t.blockerNote}</span></>}
        </div>
      </div>
      <span className={`num sm ${late ? 'late' : 'muted'}`}>{t.deadline ? formatJalaliShort(t.deadline) : '—'}{late && ' (دیرکرد)'}</span>
      {!compact && mgr && people && (
        <form action={reassignTask}><input type="hidden" name="id" value={t.id} />
          <AutoSelect name="assigneeId" defaultValue={t.assigneeId ?? ''}><option value="">بدون مسئول</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</AutoSelect>
        </form>
      )}
      {canEdit ? (
        <form action={setTaskStatus} style={{ display: 'flex', gap: 4 }}>
          <input type="hidden" name="id" value={t.id} />
          {!compact && <input name="note" className="sm" placeholder="علت مسدودی" style={{ width: 100 }} />}
          <AutoSelect name="status" defaultValue={t.status}>{Object.entries(TASK_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</AutoSelect>
        </form>
      ) : <span className={`badge b-${t.status}`}>{TASK_STATUS[t.status]}</span>}
      {!compact && (mgr || t.creatorId === me) && <form action={deleteTask}><input type="hidden" name="id" value={t.id} /><button className="btn danger sm" title="حذف (قابل بازیابی)">حذف</button></form>}
    </div>
  );
}
export const taskInclude = { project: { select: { id: true, title: true, code: true } }, assignee: { select: { id: true, name: true } } } as const;
