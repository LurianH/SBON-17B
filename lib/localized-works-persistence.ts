import {z} from 'zod';
import {attackPlan2026} from './attack-plan-2026';

/** Validation shared by local drafts and the Supabase integration. */
export const localizedWorkInputSchema=z.object({
 name:z.string().trim().min(1).max(150),
 rowKey:z.string().trim().min(1),
 kind:z.enum(['RESERVOIR','BOOSTER','EEE']),
 quantity:z.number().int().positive(),
 capacityM3:z.number().finite().nonnegative().nullable(),
 powerCv:z.number().finite().nonnegative().nullable(),
 flowLps:z.number().finite().nonnegative().nullable(),
 hmtMca:z.number().finite().nonnegative().nullable(),
 material:z.string().trim().max(80).nullable(),
 hydraulic:z.enum(['NOT_STARTED','IN_PROGRESS','COMPLETED','APPROVED']),
 electrical:z.enum(['NOT_STARTED','IN_PROGRESS','COMPLETED','APPROVED']).nullable(),
 structural:z.enum(['NOT_STARTED','IN_PROGRESS','COMPLETED','APPROVED']).nullable(),
 budget:z.enum(['NOT_BUDGETED','IN_PREPARATION','BUDGETED','UNDER_REVIEW','APPROVED']),
 contractualCode:z.string().trim().max(80).nullable(),
 notes:z.string().trim().max(2000).nullable(),
 referenceDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{
  const date=new Date(value+'T00:00:00Z');
  return !Number.isNaN(date.getTime())&&date.toISOString().slice(0,10)===value;
 },'Data inválida'),
}).superRefine((v,ctx)=>{
 if(v.kind==='EEE'&&(v.electrical===null||v.structural===null)) ctx.addIssue({code:'custom',path:['electrical'],message:'EEE exige acompanhamento elétrico e estrutural'});
});
export type LocalizedWorkInput=z.infer<typeof localizedWorkInputSchema>;
export type PreparedLocalizedWork={input:LocalizedWorkInput; municipality:string; stainId:string; segment:'WATER'|'SEWER'; front:string; rowKey:string};
export function prepareLocalizedWork(input:unknown):PreparedLocalizedWork{
 const value=localizedWorkInputSchema.parse(input);
 const row=attackPlan2026.find(r=>r.rowKey===value.rowKey);
 if(!row)throw new Error('Frente inexistente no Plano de Ataque 2026.');
 if(row.segment!==(value.kind==='EEE'?'SEWER':'WATER'))throw new Error('O tipo de estrutura não corresponde ao sistema da mancha.');
 return {input:value,municipality:row.municipality,stainId:row.stainId,segment:row.segment,front:row.front,rowKey:row.rowKey};
}
