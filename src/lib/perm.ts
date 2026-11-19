import type { SessionUser } from './auth';
export const isOwner = (u: SessionUser) => u.role === 'OWNER';
export const isManager = (u: SessionUser) => u.role === 'OWNER' || u.role === 'MANAGER';
export const canSeeMoney = (u: SessionUser) => u.role === 'OWNER' || u.canSeeFinance;
export const taskScope = (u: SessionUser) =>
  isManager(u) ? { deletedAt: null } : { deletedAt: null, OR: [{ assigneeId: u.id }, { creatorId: u.id }] };
export const projectScope = (u: SessionUser) =>
  isManager(u) ? { deletedAt: null } : { deletedAt: null, OR: [{ pmId: u.id }, { members: { some: { userId: u.id } } }, { tasks: { some: { assigneeId: u.id } } }] };
