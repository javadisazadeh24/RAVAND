import type { HealthStatus } from '@prisma/client';
type T = { status: string; deadline: Date | null; deletedAt: Date | null };
type P = { status: string; deadline: Date | null; progressManual: number | null; healthOverride: HealthStatus | null; healthReason: string | null; tasks: T[] };

/** Transparent rules — shown to the user as `reasons`. */
export function projectProgress(p: Pick<P, 'progressManual' | 'tasks'>) {
  if (p.progressManual != null) return p.progressManual;
  const live = p.tasks.filter((t) => !t.deletedAt && t.status !== 'CANCELLED');
  if (!live.length) return 0;
  return Math.round((live.filter((t) => t.status === 'COMPLETED').length / live.length) * 100);
}
export function computeHealth(p: P, now = new Date()): { health: HealthStatus; reasons: string[]; overridden: boolean } {
  if (p.healthOverride) return { health: p.healthOverride, reasons: [p.healthReason || 'تغییر دستی مدیر'], overridden: true };
  if (p.status === 'COMPLETED') return { health: 'COMPLETED', reasons: ['پروژه تکمیل شده است'], overridden: false };
  const live = p.tasks.filter((t) => !t.deletedAt && t.status !== 'CANCELLED' && t.status !== 'COMPLETED');
  const blocked = live.filter((t) => t.status === 'BLOCKED').length;
  const overdueTasks = live.filter((t) => t.deadline && t.deadline < now).length;
  const progress = projectProgress(p);
  const reasons: string[] = [];
  if (p.deadline && p.deadline < now) return { health: 'OVERDUE', reasons: ['مهلت پروژه گذشته است'], overridden: false };
  if (p.status === 'BLOCKED' || blocked) return { health: 'BLOCKED', reasons: [blocked ? `${blocked} وظیفه مسدود` : 'وضعیت پروژه مسدود است'], overridden: false };
  if (overdueTasks) reasons.push(`${overdueTasks} وظیفه دیرکرد دارد`);
  if (p.deadline) {
    const days = (p.deadline.getTime() - now.getTime()) / 86400000;
    if (days <= 7 && progress < 70) reasons.push('کمتر از ۷ روز تا مهلت و پیشرفت زیر ۷۰٪');
  }
  if (reasons.length) return { health: 'AT_RISK', reasons, overridden: false };
  return { health: 'HEALTHY', reasons: ['مورد پرخطری دیده نشد'], overridden: false };
}
