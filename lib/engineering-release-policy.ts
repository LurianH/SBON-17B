/** Critério operacional interno do contrato SBON 17B.
 * Uma frente de rede "Sem objeção" ou "Em análise SABESP" conta como
 * liberada para obra nos indicadores gerenciais. O status documental original
 * continua preservado e pode não constituir aprovação formal da SABESP.
 */
export const OPERATIONALLY_RELEASED_NETWORK_STATUSES=['NO_OBJECTION','UNDER_SABESP_REVIEW'] as const;
export function isOperationallyReleased(status:string|null|undefined):boolean {
 return status==='NO_OBJECTION'||status==='UNDER_SABESP_REVIEW';
}
export function isOperationallyReleasedFront(status:string|null|undefined):boolean {
 return status==='SEM OBJEÇÃO'||status==='EM ANÁLISE SABESP';
}
export const RELEASE_POLICY_DESCRIPTION='Liberadas para obra (critério interno): Sem objeção + Em análise SABESP';
