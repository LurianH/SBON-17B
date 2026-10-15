import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {describe,expect,it,vi} from 'vitest';
vi.mock('./localized-works-config',()=>({LOCALIZED_DATABASE_ENABLED:true}));
import {LocalizedWorksEngineering} from '../components/LocalizedWorksEngineering';
const props={contractId:'contract',projects:[],initialWorks:[]};
describe('localized works visible permissions',()=>{
 for(const role of ['GESTOR','DIRETORIA',null])it(`${role} has no create control`,()=>{
  const html=renderToStaticMarkup(createElement(LocalizedWorksEngineering,{...props,role}));
  expect(html).not.toContain('Cadastrar estrutura');expect(html).toContain('Sem estruturas cadastradas');
 });
 for(const role of ['ADMIN','EDITOR'])it(`${role} can create after the registry loaded`,()=>{
  expect(renderToStaticMarkup(createElement(LocalizedWorksEngineering,{...props,role}))).toContain('Cadastrar estrutura');
 });
 it('director mode and registry errors block writing even for an administrator',()=>{
  expect(renderToStaticMarkup(createElement(LocalizedWorksEngineering,{...props,role:'ADMIN',readOnly:true}))).not.toContain('Cadastrar estrutura');
  expect(renderToStaticMarkup(createElement(LocalizedWorksEngineering,{...props,role:'ADMIN',notice:'Consulta falhou'}))).not.toContain('Cadastrar estrutura');
 });
 it('does not promote planning reference seeds into the central registry',()=>{
  const html=renderToStaticMarkup(createElement(LocalizedWorksEngineering,{...props,role:'ADMIN'}));
  expect(html).not.toContain('Booster Alto da Serra');expect(html).not.toContain('Reservação Vidas Novas');
 });
});
