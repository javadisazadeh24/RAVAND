import { Prisma } from '@prisma/client';
import { prisma } from './db';
export async function audit(userId: string | null, entity: string, entityId: string, action: string, before?: unknown, after?: unknown) {
  await prisma.auditLog.create({
    data: {
      userId, entity, entityId, action,
      before: before === undefined ? undefined : (JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue),
      after: after === undefined ? undefined : (JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue),
    },
  });
}
