import {createServerClient} from '@supabase/ssr';
import {NextResponse,type NextRequest} from 'next/server';
import {getSupabasePublicConfig} from './config';
import {canAccessRoute,type AppRole} from '../authorization';

export async function updateSession(request:NextRequest){
  const config=getSupabasePublicConfig();
  if(!config)return NextResponse.next({request});
  let response=NextResponse.next({request});
  const supabase=createServerClient(config.url,config.key,{cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll(items,headers){
      items.forEach(({name,value})=>request.cookies.set(name,value));
      response=NextResponse.next({request});
      items.forEach(({name,value,options})=>response.cookies.set(name,value,options));
      Object.entries(headers).forEach(([key,value])=>response.headers.set(key,value));
    }
  }});
  const {data}=await supabase.auth.getClaims();
  const subject=typeof data?.claims?.sub==='string'?data.claims.sub:null;
  const isPublic=request.nextUrl.pathname.startsWith('/login')||request.nextUrl.pathname.startsWith('/auth');
  if(!subject&&!isPublic){const url=request.nextUrl.clone();url.pathname='/login';url.searchParams.set('reason','auth');return NextResponse.redirect(url)}
  if(subject&&!isPublic){
    const {data:profile}=await supabase.from('profiles').select('active,role').eq('id',subject).maybeSingle();
    if(!profile?.active){const url=request.nextUrl.clone();url.pathname='/login';url.searchParams.set('reason','profile');return NextResponse.redirect(url)}
    if(!canAccessRoute(request.nextUrl.pathname,profile.role as AppRole)){const url=request.nextUrl.clone();url.pathname='/';url.searchParams.set('reason','role');return NextResponse.redirect(url)}
  }
  return response;
}
