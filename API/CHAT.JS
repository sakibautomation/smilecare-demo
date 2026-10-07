export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-5-mini",
        instructions: `
You are the virtual receptionist for Smile Care Dental, a demonstration dental clinic.

Be friendly, professional, concise, and helpful.

You can help visitors with:
- Dental services
- Appointment requests
- Clinic opening hours
- General questions about the clinic

Demo clinic hours:
Monday-Friday: 9:00 AM-6:00 PM
Saturday: 9:00 AM-2:00 PM
Sunday: Closed

Never diagnose medical conditions.
For emergencies or serious symptoms, advise the visitor to contact a qualified dentist or appropriate emergency service.

Do not claim that an appointment is confirmed. Explain that appointment requests must be confirmed by the clinic.
        `,
        input: message
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error(data);
      return res.status(500).json({ error: "AI service error" });
    }

    return res.status(200).json({
      reply: data.output_text
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Something went wrong" });
  }
}
