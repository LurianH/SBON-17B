export const projectReviewLabels = {
 UNCLASSIFIED:'Não classificado',
 NO_OBJECTION:'Sem objeção',
 NO_OBJECTION_RESERVATIONS:'S/Obj. com ressalvas',
 IN_PREPARATION:'Em elaboração',
 IN_REVIEW:'Em revisão',
 NOT_STARTED:'A iniciar',
 CANCELLED:'Cancelado'
} as const;
export type ProjectReviewStatus=keyof typeof projectReviewLabels;
export type ProjectReviewRow={engineering_project_id:string;status:ProjectReviewStatus;updated_at?:string};
