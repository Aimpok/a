import Groq from "groq-sdk";

export default async function handler(req, res) {
    // === CORS (Чтобы работало с твоего сайта) ===
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { name, ticker, description, image } = req.body;
        
        if (!process.env.GROQ_API_KEY) {
            return res.status(500).json({ status: "ERROR", reason: "Server API Key missing" });
        }

        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

        // Подготовка картинки (Groq принимает URL)
        // Если image пришел как base64, он уже в нужном формате (data:image/...)
        const imageUrl = image; 

        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `Ты строгий модератор крипто-платформы. 
                            Твоя задача: проверить токен на SCAM, NSFW (порно), расизм или жесткие оскорбления.
                            
                            Данные токена:
                            Name: ${name}
                            Ticker: ${ticker}
                            Description: ${description}
                            
                            1. Проверь картинку на порнографию или насилие.
                            2. Проверь текст на мат или скам.
                            
                            Ответь ТОЛЬКО в формате JSON (без лишнего текста):
                            Если всё чисто: {"status": "APPROVED"}
                            Если есть нарушение: {"status": "REJECTED", "reason": "причина на английском (коротко)"}
                            `
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: imageUrl
                            }
                        }
                    ]
                }
            ],
            model: "llama-3.2-11b-vision-preview", // Быстрая модель с поддержкой картинок
            temperature: 0,
            response_format: { type: "json_object" } // Гарантируем JSON
        });

        const resultText = completion.choices[0]?.message?.content || "{}";
        const jsonResult = JSON.parse(resultText);

        res.status(200).json(jsonResult);

    } catch (error) {
        console.error("Groq Error:", error);
        // Если Groq упал, возвращаем ошибку клиенту
        res.status(500).json({ status: "ERROR", reason: "AI Service Error: " + error.message });
    }
}
