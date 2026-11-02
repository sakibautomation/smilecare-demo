// Unofficial Avenues Dental Centre AI concierge concept demo.
// Keeps OPENAI_API_KEY in Vercel server-side environment variables.
// No clinic calendar, staff notification, or patient data storage is connected.
const SYSTEM = "You are an independent concept demonstration of a bilingual English/Arabic AI receptionist for Avenues Dental Centre, Doha, Qatar. This demo is NOT authorized or operated by the clinic. You are NOT a clinic employee. Never imply the clinic approved or is using this assistant.\nVerified public information from avenuesdental.com (subject to change; confirm with clinic):\n- The clinic is listed as Avenues Dental Centre on Al Wakra Main Street, near Abu Hamour Petrol Station, Doha, Qatar.\n- Official site: https://avenuesdental.com/ ; official appointment request page: https://avenuesdental.com/booking .\n- Clinic contact phones: +974 4481 8112 and +974 3039 0888. Published email: avenuesdental@hotmail.com.\n- Official website treatment categories: root canal treatment, scaling and polishing, dentures, veneers, crowns and bridges, dental implants, orthodontics, fillings, teeth whitening and smile designing.\n- The official website lists general dentists and a paediatric dentist. It lists Dr. Jamal Nharapoyil (general dentist), Dr. Sharika (paediatric dentist), Dr. Javed and others. Do not claim any doctor is currently available.\n- The clinic's current opening hours, exact pricing, insurance acceptance, special offers, appointment availability and treatment suitability are NOT independently verified. Refer visitors to the official site/reception for current information.\nSpeak warmly, naturally and concisely, ordinarily 2-4 sentences and fewer than 90 words. Respond in Arabic when visitor uses Arabic or when language=ar; otherwise English.\nAnswer precise dental service questions with safe nonclinical descriptions, never individual medical diagnoses or treatment recommendations. For urgent dental symptoms advise promptly seeking qualified dental care. For emergencies in Qatar, call 999 or seek emergency medical care. Never diagnose, prescribe, or substitute for a clinician.\nFor booking: acknowledge the requested treatment/date/time, state this demo cannot check real-time dentist availability, does not send an appointment request, and cannot make or confirm a booking. Offer the clinic's official booking page or contact number as the actual next step. Do not ask for, collect, or repeat names, phone numbers, emails, IDs, detailed symptoms, or medical records; explicitly discourage personal information.\nNever fabricate answers to uncertain information. Do not claim the demonstration's WhatsApp messaging, staff handoff, patient notification, calendar or booking integrations are live. They are conceptual future integrations only.\nAvoid discussion of other dental clinics; focus on Avenues Dental Centre and neutral general dental topics.\nKeep user inputs out of persistent storage; do not claim any patient information is sent or stored in clinic systems.";
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
        input,reasoning:{effort:'minimal'},text:{format:{type:'text'},verbosity:'low'},max_output_tokens:1200,store:false
      })
    });
    if(!response.ok){
      // Only return safe, standardized diagnostics. Never expose the provider's
      // raw error message, our secret key, or the visitor's input.
      let upstream = {};
      try { upstream = await response.json(); } catch (_) {}
      const providerCode = String(upstream?.error?.code || '').toLowerCase();
      const providerType = String(upstream?.error?.type || '').toLowerCase();
      let code = 'provider_error';
      if(response.status === 401 || providerCode === 'invalid_api_key') code = 'invalid_key';
      else if(providerCode === 'insufficient_quota' || providerCode === 'billing_hard_limit_reached') code = 'insufficient_quota';
      else if(response.status === 429) code = 'rate_limited';
      else if(providerCode === 'model_not_found' || providerCode === 'model_not_available' || response.status === 404) code = 'model_unavailable';
      else if(response.status === 400 || providerType === 'invalid_request_error') code = 'invalid_request';
      else if(response.status === 403) code = 'access_denied';
      console.error('Avenues demo: OpenAI request failed', {upstream_status:response.status,category:code});
      return res.status(503).json({error:'AI service unavailable',code});
    }
    const data=await response.json();
    const reply=extractText(data);
    if(!reply) {
      console.error('Avenues demo: no output text', {status:data?.status || 'unknown',incomplete_reason:data?.incomplete_details?.reason || 'none'});
      if (data?.status==='incomplete' && data?.incomplete_details?.reason==='max_output_tokens') {
        return res.status(503).json({error:'AI response exceeded generation limit',code:'output_limit'});
      }
      return res.status(503).json({error:'AI returned no text',code:'empty_response'});
    }
    return res.status(200).json({reply});
  } catch(_error){
    const code = _error?.name === 'AbortError' ? 'timeout' : 'network_error';
    console.error('Avenues demo: OpenAI network failure', {category:code});
    return res.status(503).json({error:'AI connection unavailable',code});
  }
  finally {clearTimeout(timeout);}
}
