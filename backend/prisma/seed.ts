import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const email = process.env.SEED_ADMIN_EMAIL ?? 'owner@parkease.local';
const password = process.env.SEED_ADMIN_PASSWORD ?? '';
if (password.length < 12) throw new Error('Set SEED_ADMIN_PASSWORD to a password of at least 12 characters.');

async function main() {
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.adminUser.upsert({ where: { email }, update: { passwordHash, active: true }, create: { email, passwordHash, displayName: 'ParkEase Owner' } });
  const monthlyPrice = Number(process.env.PLAN_MONTHLY_PRICE ?? 0);
  const yearlyPrice = Number(process.env.PLAN_YEARLY_PRICE ?? 0);
  if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0 || !Number.isFinite(yearlyPrice) || yearlyPrice < 0) throw new Error('PLAN_MONTHLY_PRICE and PLAN_YEARLY_PRICE must be non-negative numbers.');
  await prisma.subscriptionPlan.upsert({ where: { code: 'MONTHLY' }, update: { name: 'Monthly', validityDays: 30, price: monthlyPrice, active: true }, create: { code: 'MONTHLY', name: 'Monthly', validityDays: 30, price: monthlyPrice } });
  await prisma.subscriptionPlan.upsert({ where: { code: 'YEARLY' }, update: { name: 'Yearly', validityDays: 365, price: yearlyPrice, active: true }, create: { code: 'YEARLY', name: 'Yearly', validityDays: 365, price: yearlyPrice } });
  console.log(`Seeded admin ${email} and default plans.`);
}

main().finally(() => prisma.$disconnect());
