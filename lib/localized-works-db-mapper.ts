import {z} from 'zod';
import {prepareLocalizedWork, type LocalizedWorkInput} from './localized-works-persistence';

// CONTRATO DE DADOS: preparação para o banco, nenhuma escrita habilitada.
// A identificação do projeto é UUID, não o código textual da mancha.
const uuid=z.string().uuid();
export const localizedWorkDbLinkSchema=z.object({
  contractId:uuid,
  engineeringProjectId:uuid,
  projectContractId:uuid,
  projectMunicipality:z.string().min(1),
  projectSegment:z.enum(['WATER','SEWER']),
  projectActive:z.boolean(),
});
export type LocalizedWorkDbLink=z.infer<typeof localizedWorkDbLinkSchema>;

export function prepareLocalizedWorkForDatabase(input:LocalizedWorkInput, link:unknown){
  const prepared=prepareLocalizedWork(input);
  const checked=localizedWorkDbLinkSchema.parse(link);
  if(checked.contractId!==checked.projectContractId)throw new Error('Contrato do projeto não corresponde ao contrato da estrutura.');
  if(!checked.projectActive)throw new Error('Projeto de Engenharia inativo.');
  if(checked.projectMunicipality!==prepared.municipality)throw new Error('Município não coincide com o projeto.');
  if(checked.projectSegment!==prepared.segment)throw new Error('Sistema não coincide com o projeto.');
  const parent={
    contract_id:checked.contractId,
    engineering_project_id:checked.engineeringProjectId,
    mancha_id:prepared.stainId,
    municipality:prepared.municipality,
    segment_type:prepared.segment,
    kind:prepared.input.kind,
    designation:prepared.input.name,
    quantity:prepared.input.quantity,
  } as const;
  const update={
    reference_date:prepared.input.referenceDate,
    hydraulic_project_status:prepared.input.hydraulic,
    electrical_project_status:prepared.input.electrical,
    structural_project_status:prepared.input.structural,
    pump_power_cv:prepared.input.powerCv,
    flow_lps:prepared.input.flowLps,
    head_mca:prepared.input.hmtMca,
    capacity_m3:prepared.input.capacityM3,
    material:prepared.input.material,
    budget_status:prepared.input.budget,
    contractual_item_code:prepared.input.contractualCode,
    notes:prepared.input.notes,
  } as const;
  return {parent,update,planRowKey:prepared.rowKey};
}
export const localizedWorkDbWritesEnabled=false as const;
export async function commitLocalizedWorkToDatabase():Promise<never>{
  throw new Error('Gravação remota bloqueada: migration não aplicada e permissões não homologadas.');
}
