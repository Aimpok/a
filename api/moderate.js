import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    // Настройка CORS, чтобы GitHub Pages мог делать запросы
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, ticker, description, image } = req.body;
        
        if (!process.env.GEMINI_API_KEY) {
            return res.status(500).json({ status: "ERROR", reason: "API Key missing on server" });
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `Ты модератор. Проверь данные крипто-токена на: порнографию, мат, скам, оскорбления или политические провокации.
        Название: ${name}
        Тикер: ${ticker}
        Описание: ${description}
        Если всё хорошо, ответь строго JSON: {"status": "APPROVED"}
        Если есть нарушения, ответь строго JSON: {"status": "REJECTED", "reason": "краткая причина на английском"}`;

        let parts = [{ text: prompt }];

        // Если прислали картинку, добавляем её в запрос
        if (image && image.includes('base64,')) {
            const base64Data = image.split('base64,')[1];
            parts.push({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: base64Data
                }
            });
        }

        const result = await model.generateContent(parts);
        const response = await result.response;
        let text = response.text();
        
        // Очистка ответа от возможных markdown кавычек
        text = text.replace(/```json/g, "").replace(/```/g, "").trim();
        
        res.status(200).json(JSON.parse(text));
    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({ status: "ERROR", reason: "Moderation failed" });
    }
}
