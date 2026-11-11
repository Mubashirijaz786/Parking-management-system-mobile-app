import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { prisma } from './prisma.js';

declare module '@fastify/jwt' { interface FastifyJWT { user: { id: string; email: string; role: 'SUPER_ADMIN' } } }

export async function registerAuth(app: FastifyInstance) {
  app.decorate('requireAdmin', async function (request: FastifyRequest, reply: FastifyReply) {
    try { await request.jwtVerify(); } catch { return reply.code(401).send({ error: 'Unauthorized' }); }
    if (request.user.role !== 'SUPER_ADMIN') return reply.code(403).send({ error: 'Forbidden' });
    const admin = await prisma.adminUser.findUnique({ where: { id: request.user.id }, select: { active: true, role: true } });
    if (!admin?.active) return reply.code(401).send({ error: 'Admin account is inactive' });
    if (admin.role !== 'SUPER_ADMIN') return reply.code(403).send({ error: 'Forbidden' });
  });
}

export async function audit(adminId: string, action: string, entityType: string, entityId?: string, customerId?: string, details?: unknown) {
  await prisma.adminAuditLog.create({ data: { adminId, action, entityType, entityId, customerId, details: details as any } });
}
