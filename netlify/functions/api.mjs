import { createApp } from '../../server/app.mjs';
import { productionDatabase } from '../../server/database.mjs';
let app;
export default async (request, context) => {
  try { app ??= createApp({db:productionDatabase()}); return await app(request,context); }
  catch { return Response.json({error:'قاعدة البيانات لم تُهيّأ بعد. راجع دليل النشر.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
};
export const config={path:'/api/*'};
