import Groq from "groq-sdk";

export default async function handler(req, res) {
    // 1. CORS - Разрешаем доступ с твоего сайта
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    // Обработка предварительного запроса браузера
    if (req.method === 'OPTIONS') return res.status(200).end();
    
    // Разрешаем только POST
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { name, ticker, description, image } = req.body;
        
        // Проверяем ключ
        if (!process.env.GROQ_API_KEY) {
            console.error("No API Key found");
            return res.status(500).json({ status: "ERROR", reason: "Server config error: API Key missing" });
        }

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        // Отправляем запрос в Groq
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `You are a crypto moderator.
                            Task: Check this token for NSFW (porn), Scam, or Racism.
                            
                            Token Info:
                            Name: ${name}
                            Ticker: ${ticker}
                            Desc: ${description}
                            
                            Respond with VALID JSON ONLY. Do not use Markdown blocks.
                            Format 1 (Good): {"status": "APPROVED"}
                            Format 2 (Bad): {"status": "REJECTED", "reason": "short reason in English"}
                            `
                        },
                        {
                            type: "image_url",
                            image_url: { url: image } // Groq принимает base64 напрямую
                        }
                    ]
                }
            ],
            model: "llama-3.2-11b-vision-preview",
            temperature: 0,
            max_tokens: 100,
            top_p: 1,
            stream: false,
            response_format: { type: "json_object" }
        });

        // Получаем ответ и чистим его
        let resultText = completion.choices[0]?.message?.content || "{}";
        
        // Иногда ИИ добавляет ```json ... ```, убираем это
        resultText = resultText.replace(/```json/g, "").replace(/```/g, "").trim();
        
        const jsonResult = JSON.parse(resultText);
        
        console.log("AI Response:", jsonResult); // Для логов Vercel
        
        res.status(200).json(jsonResult);

    } catch (error) {
        console.error("Groq Error:", error);
        // Возвращаем текст ошибки клиенту, чтобы ты видел, что случилось
        res.status(500).json({ status: "ERROR", reason: error.message });
    }
}
