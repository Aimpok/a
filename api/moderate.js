import Groq from "groq-sdk";

export default async function handler(req, res) {
    // CORS ЗАГОЛОВКИ (Чтобы пускало с твоего сайта)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { name, ticker, description, image } = req.body;
        
        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ status: "ERROR", reason: "API Key missing" });
        }

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Check this crypto token. Rules: No NSFW, No Scam, No Racism.
                            Name: ${name}, Ticker: ${ticker}, Desc: ${description}.
                            Reply JSON ONLY: {"status": "APPROVED"} or {"status": "REJECTED", "reason": "why"}`
                        },
                        {
                            type: "image_url",
                            image_url: { url: image } // Groq принимает base64 прямо так
                        }
                    ]
                }
            ],
            model: "llama-3.2-11b-vision-preview",
            temperature: 0,
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0]?.message?.content || "{}");
        res.status(200).json(result);

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ status: "ERROR", reason: error.message });
    }
}
