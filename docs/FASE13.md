# Fase 13 — Backup dos cadastros em JSON, sem Supabase

Atualiza apenas `components/LocalizedWorksEngineering.tsx`, sobre a Fase 12.

- O botão **Exportar arquivo de segurança** salva um JSON dos cadastros atuais para o usuário guardar.
- **Importar arquivo** recupera esse JSON na aba atual. Importação valida tamanho, campos, enumerações, números não negativos e duplicidade de identificadores antes de substituir a prévia.
- Não existe salvamento automático. Se fechar a aba sem exportar, os dados editados serão perdidos.
- O histórico da sessão é exportado como contexto, mas a importação zera o histórico local, para não apresentá-lo como registro auditável.
- Nenhuma conexão remota, SQL, alteração na produção ou custo adicional.
- Não substitui o histórico central de autoria/autorização. O banco segue pendente de homologação.

Instalar no Codespaces: `unzip -o SBON17B_FASE13_BACKUP_FORMULARIOS.zip && npm run typecheck`.
