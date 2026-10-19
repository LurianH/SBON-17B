export type GisProjectRow = {
 id:string;
 gis_code:string;
 municipality:string;
 neighborhood:string|null;
 settlement_type:string|null;
 classification:'BOTH'|'SEWER';
 segment_type:'WATER'|'SEWER';
 economies_ica:number|null;
 economies_ice:number|null;
 cancelled:boolean;
 engineering_project_id:string|null;
 effective_status:string;
};
