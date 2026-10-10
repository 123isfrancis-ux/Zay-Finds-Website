const {createStore}=require('./trending-store');
const {authorized,report}=require('./dashboard');
function createDashboardHandler({items,getStore=createStore,getPassword=()=>process.env.DASHBOARD_PASSWORD,now=Date.now}){
 let cached=null,until=0;
 return async function handler(req,res){
  res.setHeader('Cache-Control','private, no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');
  if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'Method not allowed'});}
  const password=getPassword();
  if(!password||password.length<24)return res.status(503).json({error:'Dashboard access has not been configured.'});
  try{
   const store=getStore();if(!store)return res.status(503).json({error:'Activity storage is not connected.'});
   const address=String(req.headers['x-vercel-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
   if(!authorized(req.headers.authorization,password)){
    if(await store.dashboardBlocked(address)||!await store.allowDashboard(address)){res.setHeader('Retry-After','900');return res.status(429).json({error:'Too many attempts. Try again in 15 minutes.'});}
    return res.status(401).json({error:'Enter your dashboard password.'});
   }
   if(!cached||now()>until){const {days,signals}=await store.dashboard();cached=report(items,days,signals,now());until=now()+60000;}
   return res.status(200).json(cached);
  }catch{return res.status(503).json({error:'Activity data is temporarily unavailable. Please try again.'});}
 };
}
module.exports={createDashboardHandler};
