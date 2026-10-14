from pathlib import Path
p = Path('components/EngineeringPanel.tsx')
if not p.exists():
    raise SystemExit('Erro: execute na raiz do projeto SBON-17B.')
s = p.read_text(encoding='utf-8')
imp = "import {LocalizedWorksEngineering} from '@/components/LocalizedWorksEngineering';"
if imp not in s:
    anchor = "import {useRouter} from 'next/navigation';"
    if anchor not in s:
        raise SystemExit('Estrutura de Engenharia diferente da esperada; nenhum arquivo alterado.')
    s = s.replace(anchor, anchor+'\n'+imp,1)
widget = '    <LocalizedWorksEngineering/>'
if widget not in s:
    anchor = '    {canEdit && editing && <EngineeringForm'
    if anchor not in s:
        raise SystemExit('Ponto de inserção não encontrado; nenhum arquivo alterado.')
    s = s.replace(anchor,widget+'\n'+anchor,1)
if s != p.read_text(encoding='utf-8'):
    p.with_name('EngineeringPanel.tsx.bak').write_text(p.read_text(encoding='utf-8'),encoding='utf-8')
    p.write_text(s,encoding='utf-8')
print('Obras Localizadas integradas somente à área /engenharia. Painel principal preservado.')
