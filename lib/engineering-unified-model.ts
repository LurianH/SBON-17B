export type Responsible='VITALUX'|'ESTATICA';
export type Delivery='NOT_STARTED'|'IN_PROGRESS'|'COMPLETED';
export type SegmentStatus='PROJECTED'|'APPROVED'|'EXECUTED';
export type ProjectManagementRow={
 engineering_project_id:string;
 responsible:Responsible|null;
 delivery_status:Delivery|null;
 notes:string|null;
 updated_at?:string;
};
export type ProjectNetworkRow={
 id:string; engineering_project_id:string;
 material:string;diameter_label:string;segment_kind:string|null;
 length_m:string|number;segment_status:SegmentStatus;
 source:'LEGACY'|'MANUAL';notes:string|null;active:boolean;
};
export const responsibleNames:Record<Responsible,string>={VITALUX:'Vitalux',ESTATICA:'Estática'};
export const deliveryNames:Record<Delivery,string>={NOT_STARTED:'Não iniciado',IN_PROGRESS:'Em andamento',COMPLETED:'Finalizado'};
export const segmentNames:Record<SegmentStatus,string>={PROJECTED:'Projetado',APPROVED:'Aprovado',EXECUTED:'Executado'};
export const validMaterials=['PEAD','PVC','PRFV','FERRO FUNDIDO','AÇO','CONCRETO','OUTRO'] as const;
export const fmt=(x:number)=>new Intl.NumberFormat('pt-BR',{maximumFractionDigits:3}).format(x);
export const formatKm=(m:number)=>fmt(m/1000)+' km';
