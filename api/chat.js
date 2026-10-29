// Unofficial Gewan Medical Center AI concierge concept demo.
// Keeps OPENAI_API_KEY in Vercel server-side environment variables.
// No clinic calendar, staff notification, or patient data storage is connected.
const SYSTEM = `You are a professional, concise bilingual English/Arabic concierge for an UNOFFICIAL, INDEPENDENT DEMONSTRATION inspired by Gewan Medical Center in Doha. The demo has NOT been authorized by the clinic. Never imply you work for Gewan, have real-time appointment data, or have access to staff or records.

Verified public information (confirm changes with the clinic):
- Gewan Medical Center is at Street 970, Al Ghadeeriyat, behind Landmark Mall, Doha, Qatar; phone +974 3113 3220.
- Official site: https://gewanmedicalcenter.com/index-en.html . Public booking page: https://mawaeidk.com/en/clinics/gewan-medical-center .
- Published opening hours on the public booking page: Sat–Thu 9:00 AM–9:00 PM, Friday closed. Holiday hours may differ.
- Services: general dentistry, orthodontics, cosmetic dental care, root canals, implants; dermatology, laser, Botox, fillers, skincare, Hydrafacial.
- Dr. Rawda Hamada: dermatology/aesthetics; Dr. Tarek Al-Rihani: orthodontics, dental aesthetics/oral surgery; Dr. Kawthar Al-Khalai: dentistry/endodontics (listed on public booking page).
- Respond in Arabic when asked in Arabic or when language=ar, otherwise English.

Provide short nonclinical answers about services, specialties, location and opening hours. For prices and insurance, say to confirm with clinic; do not invent discounts or exact current costs.
You may describe how someone could request an appointment via official channels, but NEVER imply this demo sends, receives, reserves, confirms, or checks a real appointment or time slot. Do not ask for names, phone numbers, email addresses, IDs, health records, or personal medical information. Encourage users not to submit these.
You are not a doctor. Never diagnose, prescribe, or recommend individualized medical treatment. For medical concerns refer to a licensed clinician, and for emergencies in Qatar advise 999 or immediate emergency care.
Avoid hallucinated facts and be explicit about uncertainty. Never impersonate an actual clinic employee.`;
function extractText(data) {
  if (typeof data?.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  return (data?.output || []).flatMap(x => x?.content || []).filter(x=>x?.type === 'output_text' && typeof x.text === 'string').map(x=>x.text).join('\n').trim();
}
function privateData(text) {
  return /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|(?:\+?\d[\d ()-]{7,}\d)|\b\d{9,}\b/i.test(text);
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if (req.method==='GET') return res.status(200).json({ai_ready:Boolean(process.env.OPENAI_API_KEY),demo:true});
  if (req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const origin=req.headers?.origin;
  const host=req.headers?.['x-forwarded-host']||req.headers?.host;
  if(origin&&host) {
    try {if(new URL(origin).host!==host) return res.status(403).json({error:'Origin not allowed'});}
    catch{return res.status(403).json({error:'Origin not allowed'});}
  }
  if(!process.env.OPENAI_API_KEY) return res.status(503).json({error:'AI key not configured'});
  const body=(req.body && typeof req.body==='object')?req.body:{};
  const message=typeof body.message==='string'?body.message.trim():'';
  if(!message||message.length>500) return res.status(400).json({error:'Send a short message (up to 500 characters)'});
  const arabic=body.language==='ar';
  if(privateData(message)) return res.status(200).json({reply:arabic?'يرجى عدم مشاركة بيانات شخصية أو طبية في هذا العرض التجريبي. يمكنك التواصل مع المركز عبر القنوات الرسمية.':'Please do not share personal contact details or medical records in this independent demo. For real bookings, contact the clinic directly.'});
  if(/can't breathe|cannot breathe|chest pain|unconscious|severe bleeding|طوارئ|اختناق|نزيف شديد|ألم الصدر/i.test(message))
    return res.status(200).json({reply:arabic?'إذا كانت حالة طبية طارئة في قطر، اتصل بـ 999 أو اطلب الرعاية الطارئة فوراً.':'For a medical emergency in Qatar, call 999 or seek emergency care immediately.'});
  const history=Array.isArray(body.messages)?body.messages.slice(-6):[];
  const input=history.filter(m=>['user','assistant'].includes(m?.role)&&typeof m.content==='string'&&m.content.length<=500&&!privateData(m.content))
                     .map(m=>({role:m.role,content:m.content}));
  if(!input.length||input[input.length-1].content!==message)input.push({role:'user',content:message});
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),15000);
  try {
    const response=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',signal:controller.signal,
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.OPENAI_API_KEY}`},
      body:JSON.stringify({
        model:process.env.OPENAI_MODEL||'gpt-5-mini',
        instructions:SYSTEM+(arabic?'\nRespond in Arabic.':'\nRespond in English unless the visitor writes in Arabic.'),
        input,max_output_tokens:350,store:false
      })
    });
    if(!response.ok)return res.status(503).json({error:'AI service unavailable. Check API billing and credentials.'});
    const data=await response.json();
    const reply=extractText(data);
    if(!reply)return res.status(503).json({error:'AI did not return a reply'});
    return res.status(200).json({reply});
  } catch(_error){return res.status(503).json({error:'AI connection unavailable'});}
  finally {clearTimeout(timeout);}
}
