import { z } from 'zod';

export const loginSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
export const customerSchema = z.object({ fullName: z.string().min(2), businessName: z.string().min(2), phone: z.string().min(5), whatsapp: z.string().optional(), city: z.string().min(2), address: z.string().optional(), planId: z.string().min(1), deviceIdentifier: z.string().min(3).optional(), referralCode: z.string().trim().min(3).optional(), paymentAmount: z.coerce.number().nonnegative().optional(), paymentMethod: z.enum(['CASH','BANK_TRANSFER','EASYPAISA','JAZZCASH','OTHER']).optional() });
export const paymentSchema = z.object({ amount: z.coerce.number().positive(), method: z.enum(['CASH','BANK_TRANSFER','EASYPAISA','JAZZCASH','OTHER']), transactionRef: z.string().optional(), notes: z.string().optional(), invoiceId: z.string().optional() });
export const adjustmentSchema = z.object({ amount: z.coerce.number().finite().refine(value => value !== 0, 'Adjustment cannot be zero'), reason: z.string().min(2).max(240), invoiceId: z.string().optional(), paymentId: z.string().optional(), subscriptionId: z.string().optional() });
export const licenseSchema = z.object({ deviceId: z.string().min(1), subscriptionId: z.string().min(1) });
export const planSchema = z.object({ code: z.string().min(2).regex(/^[A-Z0-9_-]+$/), name: z.string().min(2), validityDays: z.coerce.number().int().positive(), price: z.coerce.number().nonnegative() });
export const activationAcknowledgementSchema = z.object({ licenseId: z.string().min(1), deviceIdentifier: z.string().min(3), acknowledgement: z.string().min(16).max(4096) });
export const customerUpdateSchema = z.object({ fullName: z.string().min(2).optional(), businessName: z.string().min(2).optional(), phone: z.string().min(5).optional(), whatsapp: z.string().optional(), city: z.string().min(2).optional(), address: z.string().optional() }).refine(value => Object.keys(value).length > 0, 'At least one field is required');
export const renewalSchema = z.object({ planId: z.string().min(1).optional(), paymentAmount: z.coerce.number().nonnegative().optional(), paymentMethod: z.enum(['CASH','BANK_TRANSFER','EASYPAISA','JAZZCASH','OTHER']).optional() });
export const referralVerifySchema = z.object({ amount: z.coerce.number().positive() });
export const deviceSchema = z.object({ deviceIdentifier: z.string().min(3), label: z.string().max(80).optional() });
