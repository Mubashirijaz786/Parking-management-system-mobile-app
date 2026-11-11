import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import bcrypt from "bcryptjs";
import * as ed from "@noble/ed25519";
import { env } from "./config.js";
import { prisma } from "./prisma.js";
import { audit, registerAuth } from "./auth.js";
import {
  activationAcknowledgementSchema,
  adjustmentSchema,
  customerSchema,
  customerUpdateSchema,
  deviceSchema,
  licenseSchema,
  loginSchema,
  paymentSchema,
  planSchema,
  referralVerifySchema,
  renewalSchema,
} from "./schemas.js";
import { assertLicenseKeyPair, signLicense } from "./license.js";
import type { PaymentStatus, Prisma } from "@prisma/client";

const app = Fastify({ logger: true });
app.decorateRequest("requireAdmin", null);
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function invoiceBalance(invoice: {
  amount: unknown;
  discount?: unknown;
  payments?: Array<{ amount: unknown }>;
  adjustments?: Array<{ amount: unknown }>;
}) {
  const charges =
    Number(invoice.amount) -
    Number(invoice.discount ?? 0) +
    (invoice.adjustments ?? []).reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );
  const paid = (invoice.payments ?? []).reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );
  return charges - paid;
}

function invoiceStatus(
  invoice: {
    amount: unknown;
    discount?: unknown;
    dueAt?: Date | string;
    payments?: Array<{ amount: unknown }>;
    adjustments?: Array<{ amount: unknown }>;
  },
  now = new Date(),
): PaymentStatus {
  const balance = invoiceBalance(invoice);
  if (balance <= 0) return "PAID";
  if (invoice.dueAt && new Date(invoice.dueAt).getTime() <= now.getTime())
    return "OVERDUE";
  const paid = (invoice.payments ?? []).reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );
  return paid > 0 ? "PARTIAL" : "UNPAID";
}

async function refreshOverdueInvoices(now = new Date()) {
  const candidates = await prisma.invoice.findMany({
    where: { status: { in: ["UNPAID", "PARTIAL"] }, dueAt: { lte: now } },
    include: { payments: true, adjustments: true },
  });
  const updates = candidates
    .filter((invoice) => invoiceStatus(invoice, now) !== invoice.status)
    .map((invoice) =>
      prisma.invoice.update({
        where: { id: invoice.id },
        data: { status: invoiceStatus(invoice, now) },
      }),
    );
  if (updates.length) await prisma.$transaction(updates);
}

function startOfKarachiMonth(now = new Date()) {
  const month = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
  }).format(now);
  return new Date(`${month}-01T00:00:00+05:00`);
}

function startOfKarachiYear(now = new Date()) {
  const year = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
  }).format(now);
  return new Date(`${year}-01-01T00:00:00+05:00`);
}

async function isValidActivationAcknowledgement(
  value: string,
  licenseId: string,
  deviceIdentifier: string,
  signedPayload: string,
  registeredPublicKey?: string | null,
) {
  const [version, ackLicenseId, ackDeviceId, publicKeyPart, signaturePart] =
    value.split(".");
  if (
    version !== "ACK2" ||
    ackLicenseId !== licenseId ||
    ackDeviceId !== deviceIdentifier ||
    !publicKeyPart ||
    !signaturePart
  )
    return false;
  if (registeredPublicKey && registeredPublicKey !== publicKeyPart)
    return false;
  try {
    const publicKey = Uint8Array.from(Buffer.from(publicKeyPart, "base64url"));
    const signature = Uint8Array.from(Buffer.from(signaturePart, "base64url"));
    return await ed.verifyAsync(
      signature,
      new TextEncoder().encode(
        `ACK2|${licenseId}|${deviceIdentifier}|${signedPayload}`,
      ),
      publicKey,
    );
  } catch {
    return false;
  }
}

async function main() {
  await assertLicenseKeyPair();
  await app.register(cors, {
    origin: env.ADMIN_ORIGIN === "*" ? true : env.ADMIN_ORIGIN,
  });
  await app.register(jwt, { secret: env.ADMIN_JWT_SECRET });
  await registerAuth(app);
  app.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST" || request.url !== "/auth/login") return;
    const now = Date.now();
    const current = loginAttempts.get(request.ip);
    if (!current || current.resetAt <= now)
      loginAttempts.set(request.ip, { count: 1, resetAt: now + 60000 });
    else {
      current.count += 1;
      if (current.count > 10)
        return reply
          .code(429)
          .send({ error: "Too many login attempts. Try again later." });
    }
  });
  app.addHook("preHandler", async (request, reply) => {
    if (
      request.method !== "POST" ||
      !request.url.startsWith("/activation/acknowledge")
    )
      return;
    const body = request.body as {
      licenseId?: string;
      deviceIdentifier?: string;
      acknowledgement?: string;
    };
    if (!body?.licenseId || !body.deviceIdentifier || !body.acknowledgement)
      return;
    const license = await prisma.licenseIssuance.findUnique({
      where: { licenseId: body.licenseId },
      include: { device: true },
    });
    if (
      !license ||
      license.device.deviceIdentifier !== body.deviceIdentifier ||
      !(await isValidActivationAcknowledgement(
        body.acknowledgement,
        body.licenseId,
        body.deviceIdentifier,
        license.signedPayload,
        license.device.activationPublicKey,
      ))
    )
      return reply
        .code(400)
        .send({ error: "Invalid activation acknowledgement" });
  });
  app.addHook("preHandler", async (request, reply) => {
    if (request.method !== "POST") return;
    const match = request.url.match(/^\/admin\/customers\/([^/]+)\/payments$/);
    const body = request.body as { invoiceId?: string };
    if (!match || !body?.invoiceId) return;
    const invoice = await prisma.invoice.findFirst({
      where: { id: body.invoiceId, customerId: match[1] },
    });
    if (!invoice)
      return reply
        .code(400)
        .send({ error: "Invoice does not belong to this customer" });
  });

  app.get("/health", async () => ({
    ok: true,
    service: "parkease-admin-api",
    time: new Date().toISOString(),
  }));
  app.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "Invalid credentials format" });
    const admin = await prisma.adminUser.findUnique({
      where: { email: parsed.data.email.toLowerCase() },
    });
    if (
      !admin ||
      !admin.active ||
      !(await bcrypt.compare(parsed.data.password, admin.passwordHash))
    )
      return reply.code(401).send({ error: "Invalid email or password" });
    const token = app.jwt.sign(
      { id: admin.id, email: admin.email, role: admin.role },
      { expiresIn: "8h" },
    );
    return {
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
        role: admin.role,
      },
    };
  });

  app.get(
    "/admin/dashboard",
    { preHandler: (app as any).requireAdmin },
    async () => {
      const now = new Date();
      await refreshOverdueInvoices(now);
      const inSeven = new Date(now.getTime() + 7 * 86400000);
      const monthStart = startOfKarachiMonth(now);
      const unpaidStatuses = [
        "UNPAID",
        "PARTIAL",
        "OVERDUE",
      ] as PaymentStatus[];
      const [
        totalCustomers,
        activeSubscriptions,
        expiringSoon,
        expiredSubscriptions,
        monthlyRevenue,
        totalRevenue,
        outstandingPayments,
        totalUnpaidInvoices,
        totalReferralRewards,
        devices,
        monthlySubscribers,
        yearlySubscribers,
        newCustomers,
        renewals,
      ] = await Promise.all([
        prisma.customer.count({ where: { status: "ACTIVE" } }),
        prisma.subscription.count({
          where: { status: "ACTIVE", expiresAt: { gt: now } },
        }),
        prisma.subscription.count({
          where: { status: "ACTIVE", expiresAt: { gt: now, lte: inSeven } },
        }),
        prisma.subscription.count({
          where: { expiresAt: { lte: now }, status: { not: "CANCELLED" } },
        }),
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { paidAt: { gte: monthStart }, status: "PAID" },
        }),
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { status: "PAID" },
        }),
        prisma.invoice.findMany({
          where: { status: { in: unpaidStatuses } },
          include: { payments: true, adjustments: true },
        }),
        prisma.invoice.count({ where: { status: { in: unpaidStatuses } } }),
        prisma.referralReward.aggregate({
          _sum: { amount: true },
          where: { status: "REWARD_ISSUED" },
        }),
        prisma.customerDevice.count({ where: { active: true } }),
        prisma.subscription.count({
          where: { plan: { code: "MONTHLY" }, startsAt: { gte: monthStart } },
        }),
        prisma.subscription.count({
          where: { plan: { code: "YEARLY" }, startsAt: { gte: monthStart } },
        }),
        prisma.customer.count({ where: { registeredAt: { gte: monthStart } } }),
        prisma.subscription.count({
          where: { createdAt: { gte: monthStart }, renewalStatus: "RENEWED" },
        }),
      ]);
      const outstanding = outstandingPayments.reduce(
        (sum, invoice) => sum + Math.max(0, invoiceBalance(invoice)),
        0,
      );
      return {
        totalCustomers,
        activeSubscriptions,
        expiringSoon,
        expiredSubscriptions,
        monthlyRevenue: monthlyRevenue._sum.amount ?? 0,
        totalRevenue: totalRevenue._sum.amount ?? 0,
        outstandingPayments: outstanding,
        totalUnpaidInvoices,
        totalReferralRewards: totalReferralRewards._sum.amount ?? 0,
        devices,
        monthlySubscribers,
        yearlySubscribers,
        newCustomers,
        renewals,
      };
    },
  );

  app.get("/admin/plans", { preHandler: (app as any).requireAdmin }, async () =>
    prisma.subscriptionPlan.findMany({ orderBy: { createdAt: "asc" } }),
  );
  app.post(
    "/admin/plans",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const parsed = planSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.flatten() });
      const plan = await prisma.subscriptionPlan.create({ data: parsed.data });
      return reply.code(201).send(plan);
    },
  );

  app.get(
    "/admin/customers",
    { preHandler: (app as any).requireAdmin },
    async (request) => {
      await refreshOverdueInvoices();
      const query = request.query as {
        search?: string;
        status?: "ACTIVE" | "ARCHIVED" | "ALL";
      };
      const search = query.search?.trim();
      const status =
        query.status === "ALL" ? undefined : (query.status ?? "ACTIVE");
      return prisma.customer.findMany({
        where: {
          status,
          ...(search
            ? {
                OR: [
                  { fullName: { contains: search, mode: "insensitive" } },
                  { businessName: { contains: search, mode: "insensitive" } },
                  { phone: { contains: search } },
                  { customerCode: { contains: search, mode: "insensitive" } },
                  {
                    licenses: {
                      some: {
                        licenseId: { contains: search, mode: "insensitive" },
                      },
                    },
                  },
                ],
              }
            : {}),
        },
        include: {
          devices: { orderBy: { createdAt: "desc" } },
          subscriptions: {
            include: {
              plan: true,
              invoices: { orderBy: { createdAt: "desc" }, take: 1 },
            },
            orderBy: { expiresAt: "desc" },
            take: 1,
          },
        },
        orderBy: { registeredAt: "desc" },
      });
    },
  );
  app.get(
    "/admin/customers/:id",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      await refreshOverdueInvoices();
      const { id } = request.params as { id: string };
      const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
          devices: true,
          subscriptions: {
            include: {
              plan: true,
              invoices: {
                include: { payments: true, adjustments: true },
                orderBy: { createdAt: "desc" },
              },
              licenses: { orderBy: { issuedAt: "desc" } },
            },
            orderBy: { startsAt: "desc" },
          },
          payments: {
            orderBy: { paidAt: "desc" },
            include: { invoice: true, subscription: { include: { plan: true } } },
          },
          referrals: {
            include: { claims: { include: { claimedBy: true, reward: true } } },
          },
        },
      });
      if (!customer)
        return reply.code(404).send({ error: "Customer not found" });
      return customer;
    },
  );

  app.post(
    "/admin/customers",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const parsed = customerSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.flatten() });
      const body = parsed.data;
      const admin = request.user;
      const plan = await prisma.subscriptionPlan.findUnique({
        where: { id: body.planId },
      });
      if (!plan || !plan.active)
        return reply.code(400).send({ error: "Subscription plan not found" });
      const referral = body.referralCode
        ? await prisma.referralCode.findUnique({
            where: { code: body.referralCode.toUpperCase() },
            include: { customer: true, claims: true },
          })
        : null;
      if (
        body.referralCode &&
        (!referral ||
          !referral.active ||
          referral.claims.length > 0 ||
          referral.customer.phone === body.phone ||
          referral.customer.whatsapp === body.phone ||
          (body.whatsapp && referral.customer.phone === body.whatsapp))
      )
        return reply
          .code(400)
          .send({
            error:
              "Referral code is invalid, already used, inactive, or belongs to the same operator",
          });
      const customerCode = `CUS-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
      const startsAt = new Date();
      const expiresAt = new Date(
        startsAt.getTime() + plan.validityDays * 86400000,
      );
      const result = await prisma.$transaction(
        async (tx: Prisma.TransactionClient) => {
          const customer = await tx.customer.create({
            data: {
              customerCode,
              fullName: body.fullName,
              businessName: body.businessName,
              phone: body.phone,
              whatsapp: body.whatsapp,
              city: body.city,
              address: body.address,
            },
          });
          if (referral)
            await tx.referralClaim.create({
              data: { codeId: referral.id, claimedById: customer.id },
            });
          const subscription = await tx.subscription.create({
            data: {
              customerId: customer.id,
              planId: plan.id,
              price: plan.price,
              startsAt,
              expiresAt,
            },
          });
          const invoice = await tx.invoice.create({
            data: {
              invoiceNumber: `INV-${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`,
              customerId: customer.id,
              subscriptionId: subscription.id,
              amount: plan.price,
              dueAt: startsAt,
              status:
                body.paymentAmount && body.paymentAmount >= Number(plan.price)
                  ? "PAID"
                  : body.paymentAmount
                    ? "PARTIAL"
                    : "UNPAID",
            },
          });
          if (body.deviceIdentifier)
            await tx.customerDevice.create({
              data: {
                customerId: customer.id,
                deviceIdentifier: body.deviceIdentifier,
              },
            });
          if (body.paymentAmount && body.paymentAmount > 0)
            await tx.payment.create({
              data: {
                paymentId: `PAY-${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`,
                customerId: customer.id,
                subscriptionId: subscription.id,
                invoiceId: invoice.id,
                amount: body.paymentAmount,
                method: body.paymentMethod ?? "OTHER",
                recordedById: admin.id,
              },
            });
          return tx.customer.findUnique({
            where: { id: customer.id },
            include: {
              devices: true,
              subscriptions: { include: { plan: true } },
              invoices: true,
            },
          });
        },
      );
      await audit(
        admin.id,
        "CUSTOMER_CREATED",
        "Customer",
        result!.id,
        result!.id,
        referral ? { referralCode: referral.code } : undefined,
      );
      return reply.code(201).send(result);
    },
  );

  app.post(
    "/admin/customers/:id/payments",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = paymentSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.flatten() });
      const customer = await prisma.customer.findUnique({ where: { id } });
      if (!customer)
        return reply.code(404).send({ error: "Customer not found" });
      const invoice = parsed.data.invoiceId
        ? await prisma.invoice.findFirst({
            where: { id: parsed.data.invoiceId, customerId: id },
            include: { payments: true, adjustments: true },
          })
        : await prisma.invoice.findFirst({
            where: {
              customerId: id,
              status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
            },
            include: { payments: true, adjustments: true },
            orderBy: { dueAt: "asc" },
          });
      if (parsed.data.invoiceId && !invoice)
        return reply
          .code(400)
          .send({ error: "Invoice does not belong to this customer" });
      const payment = await prisma.$transaction(async (tx) => {
        const saved = await tx.payment.create({
          data: {
            paymentId: `PAY-${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`,
            customerId: id,
            subscriptionId: invoice?.subscriptionId,
            invoiceId: invoice?.id,
            amount: parsed.data.amount,
            method: parsed.data.method,
            transactionRef: parsed.data.transactionRef,
            notes: parsed.data.notes,
            recordedById: request.user.id,
          },
        });
        if (invoice) {
          const fresh = await tx.invoice.findUnique({
            where: { id: invoice.id },
            include: { payments: true, adjustments: true },
          });
          if (fresh) {
            await tx.invoice.update({
              where: { id: fresh.id },
              data: { status: invoiceStatus(fresh) },
            });
          }
        }
        return saved;
      });
      await audit(
        request.user.id,
        "PAYMENT_RECORDED",
        "Payment",
        payment.id,
        id,
      );
      return reply.code(201).send(payment);
    },
  );
  app.post(
    "/admin/customers/:id/payments/:paymentId/refund",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const { id, paymentId } = request.params as {
        id: string;
        paymentId: string;
      };
      const payment = await prisma.payment.findFirst({
        where: { id: paymentId, customerId: id },
      });
      if (!payment) return reply.code(404).send({ error: "Payment not found" });
      if (payment.status !== "PAID")
        return reply
          .code(400)
          .send({ error: "Only a paid payment can be refunded" });
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.payment.update({
          where: { id: payment.id },
          data: { status: "REFUNDED" },
        });
        if (payment.invoiceId) {
          const invoice = await tx.invoice.findUnique({
            where: { id: payment.invoiceId },
            include: { payments: true, adjustments: true },
          });
          if (invoice) {
            await tx.paymentAdjustment.create({
              data: {
                adjustmentId: `ADJ-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
                paymentId: payment.id,
                invoiceId: invoice.id,
                subscriptionId: payment.subscriptionId,
                amount: payment.amount,
                reason: `Refund reversal for ${payment.paymentId}`,
                createdById: request.user.id,
              },
            });
            const fresh = await tx.invoice.findUnique({
              where: { id: invoice.id },
              include: { payments: true, adjustments: true },
            });
            if (fresh) {
              await tx.invoice.update({
                where: { id: fresh.id },
                data: { status: invoiceStatus(fresh) },
              });
            }
          }
        }
        return updated;
      });
      await audit(
        request.user.id,
        "PAYMENT_REFUNDED",
        "Payment",
        payment.id,
        id,
        { paymentId: payment.paymentId },
      );
      return result;
    },
  );

  app.post(
    "/admin/subscriptions/:id/licenses",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = licenseSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.flatten() });
      const subscription = await prisma.subscription.findUnique({
        where: { id },
        include: { plan: true, customer: true },
      });
      const device = await prisma.customerDevice.findUnique({
        where: { id: parsed.data.deviceId },
      });
      const now = new Date();
      if (
        !subscription ||
        !device ||
        device.customerId !== subscription.customerId
      )
        return reply
          .code(404)
          .send({ error: "Subscription or device not found" });
      if (
        !device.active ||
        subscription.status !== "ACTIVE" ||
        subscription.expiresAt <= now
      )
        return reply
          .code(400)
          .send({
            error:
              "Only an active device and valid subscription can receive a license",
          });
      const license = await signLicense({
        customerId: subscription.customerId,
        deviceId: device.deviceIdentifier,
        planId: subscription.plan.code,
        startsAt: subscription.startsAt,
        expiresAt: subscription.expiresAt,
      });
      const saved = await prisma.licenseIssuance.create({
        data: {
          licenseId: license.licenseId,
          customerId: subscription.customerId,
          deviceId: device.id,
          subscriptionId: subscription.id,
          issuedById: request.user.id,
          signedPayload: license.signed,
          startsAt: subscription.startsAt,
          expiresAt: subscription.expiresAt,
        },
      });
      await audit(
        request.user.id,
        "LICENSE_ISSUED",
        "LicenseIssuance",
        saved.id,
        subscription.customerId,
        { licenseId: saved.licenseId },
      );
      return reply
        .code(201)
        .send({
          licenseId: license.licenseId,
          activationCode: license.signed,
          startsAt: license.startsAt,
          expiresAt: license.expiresAt,
        });
    },
  );

  app.post("/activation/acknowledge", async (request, reply) => {
    const parsed = activationAcknowledgementSchema.safeParse(request.body);
    if (!parsed.success)
      return reply.code(400).send({ error: "Incomplete acknowledgement" });
    const { licenseId, deviceIdentifier, acknowledgement } = parsed.data;
    const license = await prisma.licenseIssuance.findUnique({
      where: { licenseId },
      include: { device: true },
    });
    if (!license || license.device.deviceIdentifier !== deviceIdentifier)
      return reply.code(404).send({ error: "License not found" });
    const existing = await prisma.activationAcknowledgement.findUnique({
      where: { acknowledgementId: acknowledgement },
    });
    if (existing)
      return {
        confirmed: true,
        alreadyProcessed: true,
        confirmedAt: existing.confirmedAt,
      };
    const now = new Date();
    const saved = await prisma.$transaction(async (tx) => {
      const ack = await tx.activationAcknowledgement.create({
        data: {
          acknowledgementId: acknowledgement,
          licenseId: license.id,
          customerId: license.customerId,
          deviceId: license.deviceId,
          payload: acknowledgement,
          confirmedAt: now,
        },
      });
      await tx.customerDevice.update({
        where: { id: license.deviceId },
        data: {
          activationStatus: "CONFIRMED",
          activatedAt: now,
          lastAcknowledgedAt: now,
          activationPublicKey: acknowledgement.split(".")[3],
        },
      });
      return ack;
    });
    return {
      confirmed: true,
      alreadyProcessed: false,
      acknowledgementId: saved.acknowledgementId,
      confirmedAt: saved.confirmedAt,
    };
  });

  app.put(
    "/admin/customers/:id",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = customerUpdateSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.flatten() });
      const customer = await prisma.customer.update({
        where: { id },
        data: parsed.data,
      });
      await audit(
        request.user.id,
        "CUSTOMER_UPDATED",
        "Customer",
        id,
        id,
        parsed.data,
      );
      return customer;
    },
  );

  app.post(
    "/admin/subscriptions/:id/renew",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = renewalSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.flatten() });
      const current = await prisma.subscription.findUnique({
        where: { id },
        include: { plan: true, customer: true },
      });
      if (!current)
        return reply.code(404).send({ error: "Subscription not found" });
      const plan = parsed.data.planId
        ? await prisma.subscriptionPlan.findUnique({
            where: { id: parsed.data.planId },
          })
        : current.plan;
      if (!plan || !plan.active)
        return reply.code(400).send({ error: "Subscription plan not found" });
      const now = new Date();
      const startsAt = current.expiresAt > now ? current.expiresAt : now;
      const expiresAt = new Date(
        startsAt.getTime() + plan.validityDays * 86400000,
      );
      const result = await prisma.$transaction(async (tx) => {
        await tx.subscription.update({
          where: { id: current.id },
          data: {
            status: current.expiresAt <= now ? "EXPIRED" : current.status,
            renewalStatus: "RENEWED",
          },
        });
        const subscription = await tx.subscription.create({
          data: {
            customerId: current.customerId,
            planId: plan.id,
            price: plan.price,
            startsAt,
            expiresAt,
            renewalStatus: "PENDING",
          },
        });
        const invoice = await tx.invoice.create({
          data: {
            invoiceNumber: `INV-${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`,
            customerId: current.customerId,
            subscriptionId: subscription.id,
            amount: plan.price,
            dueAt: startsAt,
            status: "UNPAID",
          },
        });
        const reward = await tx.referralReward.findFirst({
          where: {
            status: "REWARD_ISSUED",
            appliedAt: null,
            claim: { claimedById: current.customerId },
          },
          orderBy: { issuedAt: "asc" },
        });
        const rewardAmount = reward
          ? Math.min(Number(plan.price), Number(reward.amount))
          : 0;
        if (reward && rewardAmount > 0) {
          await tx.paymentAdjustment.create({
            data: {
              adjustmentId: `ADJ-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
              invoiceId: invoice.id,
              subscriptionId: subscription.id,
              amount: -rewardAmount,
              reason: "Referral reward discount",
              createdById: request.user.id,
            },
          });
          await tx.referralReward.update({
            where: { id: reward.id },
            data: { appliedAt: now, appliedInvoiceId: invoice.id },
          });
        }
        const paymentAmount = parsed.data.paymentAmount ?? 0;
        if (paymentAmount > 0)
          await tx.payment.create({
            data: {
              paymentId: `PAY-${randomUUID().replace(/-/g, "").slice(0, 14).toUpperCase()}`,
              customerId: current.customerId,
              subscriptionId: subscription.id,
              invoiceId: invoice.id,
              amount: paymentAmount,
              method: parsed.data.paymentMethod ?? "OTHER",
              recordedById: request.user.id,
            },
          });
        const fresh = await tx.invoice.findUnique({
          where: { id: invoice.id },
          include: { payments: true, adjustments: true },
        });
        if (fresh)
          await tx.invoice.update({
            where: { id: fresh.id },
            data: { status: invoiceStatus(fresh, now) },
          });
        return tx.subscription.findUnique({
          where: { id: subscription.id },
          include: {
            plan: true,
            invoices: { include: { adjustments: true, payments: true } },
          },
        });
      });
      await audit(
        request.user.id,
        "SUBSCRIPTION_RENEWED",
        "Subscription",
        result!.id,
        current.customerId,
        { previousSubscriptionId: current.id },
      );
      return reply.code(201).send(result);
    },
  );

  app.post(
    "/admin/subscriptions/:id/suspend-renewals",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const subscription = await prisma.subscription.update({
        where: { id },
        data: { renewalStatus: "SUSPENDED" },
      });
      await audit(
        request.user.id,
        "RENEWALS_SUSPENDED",
        "Subscription",
        id,
        subscription.customerId,
      );
      return subscription;
    },
  );
  app.post(
    "/admin/subscriptions/:id/suspend",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const subscription = await prisma.subscription.update({
        where: { id },
        data: { status: "SUSPENDED", renewalStatus: "SUSPENDED" },
      });
      await audit(
        request.user.id,
        "SUBSCRIPTION_SUSPENDED",
        "Subscription",
        id,
        subscription.customerId,
      );
      return subscription;
    },
  );

  app.get(
    "/admin/notifications",
    { preHandler: (app as any).requireAdmin },
    async () => {
      const now = new Date();
      await refreshOverdueInvoices(now);
      const inSeven = new Date(now.getTime() + 7 * 86400000);
      const [stored, expiring, overdue, activity] = await Promise.all([
        prisma.adminNotification.findMany({
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
        prisma.subscription.findMany({
          where: { status: "ACTIVE", expiresAt: { gt: now, lte: inSeven } },
          include: { customer: true },
          orderBy: { expiresAt: "asc" },
          take: 50,
        }),
        prisma.invoice.findMany({
          where: { status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] } },
          include: { customer: true, payments: true, adjustments: true },
          orderBy: { dueAt: "asc" },
          take: 50,
        }),
        prisma.adminAuditLog.findMany({
          include: { customer: true, admin: { select: { displayName: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]);
      return {
        stored,
        expiring: expiring.map((item) => ({
          type: "EXPIRING_SUBSCRIPTION",
          title: "Subscription expiring soon",
          body: `${item.customer.businessName} expires on ${item.expiresAt.toISOString()}`,
          customerId: item.customerId,
        })),
        overdue: overdue.map((item) => ({
          type: "UNPAID_INVOICE",
          title: "Unpaid invoice",
          body: `${item.customer.businessName} has invoice ${item.invoiceNumber} with outstanding PKR ${Math.max(0, invoiceBalance(item))}`,
          customerId: item.customerId,
          outstanding: Math.max(0, invoiceBalance(item)),
        })),
        activity: activity.map((item) => ({
          type: "AUDIT",
          title: item.action,
          body: `${item.customer?.businessName ?? item.entityType} - ${item.admin.displayName}`,
          customerId: item.customerId,
          createdAt: item.createdAt,
        })),
      };
    },
  );

  app.get(
    "/admin/referrals",
    { preHandler: (app as any).requireAdmin },
    async () =>
      prisma.referralCode.findMany({
        include: {
          customer: true,
          claims: { include: { claimedBy: true, reward: true } },
        },
        orderBy: { createdAt: "desc" },
      }),
  );
  app.post(
    "/admin/customers/:id/referrals",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const customer = await prisma.customer.findUnique({ where: { id } });
      if (!customer)
        return reply.code(404).send({ error: "Customer not found" });
      const count = await prisma.referralCode.count({
        where: { customerId: id, active: true },
      });
      if (count >= 2)
        return reply
          .code(400)
          .send({ error: "Customer already has two active referral codes" });
      const code = `PARK-${randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
      const referral = await prisma.referralCode.create({
        data: { customerId: id, code },
      });
      await audit(
        request.user.id,
        "REFERRAL_CREATED",
        "ReferralCode",
        referral.id,
        id,
      );
      return reply.code(201).send(referral);
    },
  );

  app.post(
    "/admin/referral-claims/:id/verify",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = referralVerifySchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.flatten() });
      const claim = await prisma.referralClaim.findUnique({
        where: { id },
        include: { reward: true },
      });
      if (!claim)
        return reply.code(404).send({ error: "Referral claim not found" });
      if (claim.reward)
        return reply
          .code(400)
          .send({ error: "Referral reward already exists" });
      const result = await prisma.$transaction(async (tx) => {
        await tx.referralClaim.update({
          where: { id },
          data: { status: "VERIFIED" },
        });
        return tx.referralReward.create({
          data: {
            claimId: id,
            amount: parsed.data.amount,
            status: "PENDING_VERIFICATION",
          },
        });
      });
      await audit(
        request.user.id,
        "REFERRAL_VERIFIED",
        "ReferralClaim",
        id,
        claim.claimedById,
      );
      return result;
    },
  );

  app.put(
    "/admin/plans/:id",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = planSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.flatten() });
      const plan = await prisma.subscriptionPlan.update({
        where: { id },
        data: parsed.data,
      });
      await audit(
        request.user.id,
        "PLAN_UPDATED",
        "SubscriptionPlan",
        id,
        undefined,
        parsed.data,
      );
      return plan;
    },
  );

  app.post(
    "/admin/customers/:id/archive",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const customer = await prisma.customer.update({
        where: { id },
        data: { status: "ARCHIVED", archivedAt: new Date() },
      });
      await audit(request.user.id, "CUSTOMER_ARCHIVED", "Customer", id, id);
      return customer;
    },
  );
  app.post(
    "/admin/customers/:id/devices",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = deviceSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.flatten() });
      const customer = await prisma.customer.findUnique({ where: { id } });
      if (!customer)
        return reply.code(404).send({ error: "Customer not found" });
      const device = await prisma.$transaction(async (tx) => {
        await tx.customerDevice.updateMany({
          where: { customerId: id, active: true },
          data: { active: false, activationStatus: "REPLACED" },
        });
        return tx.customerDevice.create({
          data: {
            customerId: id,
            deviceIdentifier: parsed.data.deviceIdentifier,
            label: parsed.data.label,
          },
        });
      });
      await audit(
        request.user.id,
        "DEVICE_REPLACED",
        "CustomerDevice",
        device.id,
        id,
      );
      return reply.code(201).send(device);
    },
  );

  app.get(
    "/admin/payments",
    { preHandler: (app as any).requireAdmin },
    async () => {
      await refreshOverdueInvoices();
      return prisma.payment.findMany({
        include: {
          customer: true,
          invoice: true,
          recordedBy: { select: { displayName: true } },
        },
        orderBy: { paidAt: "desc" },
        take: 250,
      });
    },
  );
  app.get(
    "/admin/subscriptions",
    { preHandler: (app as any).requireAdmin },
    async () => {
      await refreshOverdueInvoices();
      return prisma.subscription.findMany({
        include: {
          customer: true,
          plan: true,
          invoices: true,
          licenses: { orderBy: { issuedAt: "desc" }, take: 1 },
        },
        orderBy: { expiresAt: "asc" },
        take: 250,
      });
    },
  );
  app.get(
    "/admin/reports",
    { preHandler: (app as any).requireAdmin },
    async () => {
      const now = new Date();
      await refreshOverdueInvoices(now);
      const yearStart = startOfKarachiYear(now);
      const [yearRevenue, byMethod, paidPayments, unpaid] = await Promise.all([
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { paidAt: { gte: yearStart }, status: "PAID" },
        }),
        prisma.payment.groupBy({
          by: ["method"],
          _sum: { amount: true },
          _count: { _all: true },
          where: { paidAt: { gte: yearStart }, status: "PAID" },
        }),
        prisma.payment.findMany({
          where: { paidAt: { gte: yearStart }, status: "PAID" },
          include: { subscription: { include: { plan: true } } },
        }),
        prisma.invoice.findMany({
          where: { status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] } },
          include: { payments: true, adjustments: true },
        }),
      ]);
      const byPlan = new Map<
        string,
        { planId: string; planName: string; amount: number; count: number }
      >();
      for (const payment of paidPayments) {
        const planId = payment.subscription?.plan.id ?? "UNASSIGNED";
        const planName = payment.subscription?.plan.name ?? "Unassigned";
        const current = byPlan.get(planId) ?? {
          planId,
          planName,
          amount: 0,
          count: 0,
        };
        current.amount += Number(payment.amount);
        current.count += 1;
        byPlan.set(planId, current);
      }
      return {
        yearRevenue: yearRevenue._sum.amount ?? 0,
        byMethod,
        byPlan: Array.from(byPlan.values()),
        unpaid: unpaid.reduce((sum, invoice) => sum + Math.max(0, invoiceBalance(invoice)), 0),
      };
    },
  );

  app.post(
    "/admin/customers/:id/adjustments",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const parsed = adjustmentSchema.safeParse(request.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.flatten() });
      const customer = await prisma.customer.findUnique({ where: { id } });
      if (!customer)
        return reply.code(404).send({ error: "Customer not found" });
      const invoice = parsed.data.invoiceId
        ? await prisma.invoice.findFirst({
            where: { id: parsed.data.invoiceId, customerId: id },
            include: { payments: true, adjustments: true },
          })
        : await prisma.invoice.findFirst({
            where: { customerId: id },
            include: { payments: true, adjustments: true },
            orderBy: { createdAt: "desc" },
          });
      const payment = parsed.data.paymentId
        ? await prisma.payment.findFirst({
            where: { id: parsed.data.paymentId, customerId: id },
          })
        : null;
      const subscription = parsed.data.subscriptionId
        ? await prisma.subscription.findFirst({
            where: { id: parsed.data.subscriptionId, customerId: id },
          })
        : invoice
          ? await prisma.subscription.findUnique({
              where: { id: invoice.subscriptionId },
            })
          : null;
      if (parsed.data.invoiceId && !invoice)
        return reply
          .code(400)
          .send({ error: "Invoice does not belong to this customer" });
      if (parsed.data.paymentId && !payment)
        return reply
          .code(400)
          .send({ error: "Payment does not belong to this customer" });
      if (parsed.data.subscriptionId && !subscription)
        return reply
          .code(400)
          .send({ error: "Subscription does not belong to this customer" });
      const adjustment = await prisma.$transaction(async (tx) => {
        const saved = await tx.paymentAdjustment.create({
          data: {
            adjustmentId: `ADJ-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`,
            paymentId: payment?.id,
            invoiceId: invoice?.id,
            subscriptionId: subscription?.id,
            amount: parsed.data.amount,
            reason: parsed.data.reason,
            createdById: request.user.id,
          },
        });
        if (invoice) {
          const fresh = await tx.invoice.findUnique({
            where: { id: invoice.id },
            include: { payments: true, adjustments: true },
          });
          if (fresh) {
            await tx.invoice.update({
              where: { id: fresh.id },
              data: { status: invoiceStatus(fresh) },
            });
          }
        }
        return saved;
      });
      await audit(
        request.user.id,
        "PAYMENT_ADJUSTMENT_RECORDED",
        "PaymentAdjustment",
        adjustment.id,
        id,
        { amount: parsed.data.amount, reason: parsed.data.reason },
      );
      return reply.code(201).send(adjustment);
    },
  );
  app.post(
    "/admin/referral-rewards/:id/issue",
    { preHandler: (app as any).requireAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const reward = await prisma.referralReward.findUnique({
        where: { id },
        include: { claim: true },
      });
      if (!reward)
        return reply.code(404).send({ error: "Referral reward not found" });
      if (reward.status === "REWARD_ISSUED")
        return reply
          .code(400)
          .send({ error: "Referral reward already issued" });
      const now = new Date();
      const result = await prisma.$transaction(async (tx) => {
        const updated = await tx.referralReward.update({
          where: { id },
          data: { status: "REWARD_ISSUED", issuedAt: now },
        });
        await tx.referralClaim.update({
          where: { id: reward.claimId },
          data: { status: "REWARD_ISSUED" },
        });
        return updated;
      });
      await audit(
        request.user.id,
        "REFERRAL_REWARD_ISSUED",
        "ReferralReward",
        id,
        reward.claim.claimedById,
      );
      return result;
    },
  );
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
  await app.listen({ port: env.PORT, host: env.HOST });
}

main().catch((error) => {
  app.log.error(error);
  process.exit(1);
});
