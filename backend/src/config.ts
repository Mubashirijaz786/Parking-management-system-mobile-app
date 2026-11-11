import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(4000),
  HOST: z.string().default('127.0.0.1'),
  ADMIN_JWT_SECRET: z.string().min(32),
  LICENSE_PRIVATE_KEY_HEX: z.string().regex(/^[0-9a-fA-F]{64}$/),
  LICENSE_PUBLIC_KEY_HEX: z.string().regex(/^[0-9a-fA-F]{64}$/),
  ADMIN_ORIGIN: z.string().default('*')
});

export const env = schema.parse(process.env);
