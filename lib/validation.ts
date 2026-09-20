import {z} from 'zod';
// Input for new execution records. Legacy engineering keys are stripped, never written.
export const weeklyProgressSchema=z.object({reference_date:z.iso.date(),economies_executed:z.coerce.number().int().nonnegative(),network_executed_m:z.coerce.number().nonnegative()});
export const monthlyFinancialSchema=z.object({reference_month:z.coerce.number().int().min(1).max(12),reference_year:z.coerce.number().int().min(2000).max(2100),amount:z.coerce.number().nonnegative(),notes:z.string().trim().max(1000).optional()});
