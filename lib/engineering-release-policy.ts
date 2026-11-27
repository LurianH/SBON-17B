/** Critério operacional interno do contrato SBON 17B.
 * Frentes com "Sem objeção", "Sem objeção com ressalva" ou "Em análise SABESP"
 * contam como liberadas para obra nos indicadores gerenciais.
 * A classificação documental original permanece preservada e não implica
 * aprovação formal sem ressalvas pela SABESP.
 */
export const OPERATIONALLY_RELEASED_NETWORK_STATUSES=['NO_OBJECTION','NO_OBJECTION_RESERVATIONS','UNDER_SABESP_REVIEW'] as const;
export function isOperationallyReleased(status:string|null|undefined):boolean {
 return status==='NO_OBJECTION'||status==='NO_OBJECTION_RESERVATIONS'||status==='UNDER_SABESP_REVIEW';
}
export function isOperationallyReleasedFront(status:string|null|undefined):boolean {
 return status==='SEM OBJEÇÃO'||status==='S/OBJ. C/ RES.'||status==='SEM OBJEÇÃO COM RESSALVA'||status==='EM ANÁLISE SABESP';
}
export const RELEASE_POLICY_DESCRIPTION='Liberadas para obra (critério interno): Sem objeção + Sem objeção com ressalva + Em análise SABESP';
