import {createServerClient} from '@supabase/ssr';
import {cookies} from 'next/headers';
import {getSupabasePublicConfig} from './config';
export async function createClient(){const config=getSupabasePublicConfig();if(!config)return null;const store=await cookies();return createServerClient(config.url,config.key,{cookies:{getAll:()=>store.getAll(),setAll:(items)=>{try{items.forEach(({name,value,options})=>store.set(name,value,options))}catch{}}}})}
