import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
export const dynamic = 'force-dynamic';
export async function GET() {
  const u = await getUser();
  if (!u) return NextResponse.json({ items: [] }, { status: 401 });
  const due = await prisma.reminder.findMany({ where: { userId: u.id, doneAt: null, notifiedAt: null, remindAt: { lte: new Date() } }, orderBy: { remindAt: 'asc' }, take: 10 });
  if (due.length) await prisma.reminder.updateMany({ where: { id: { in: due.map((d) => d.id) } }, data: { notifiedAt: new Date() } });
  return NextResponse.json({ items: due.map((d) => ({ id: d.id, title: d.title })) });
}
