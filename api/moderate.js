// api/moderate.js
import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { name, ticker, description, image } = req.body;
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
    Ты — модератор контента для крипто-платформы. 
    Проверь следующие данные токена на: порнографию, мат, призывы к насилию, скам или оскорбления.
    Название: ${name}
    Тикер: ${ticker}
    Описание: ${description}
    
    Также тебе передано изображение. Если оно содержит неприемлемый контент, ответь "REJECTED".
    Если всё в порядке, ответь "APPROVED". Если есть нарушения, ответь "REJECTED" и краткую причину на английском.
    Отвечай строго в формате JSON: {"status": "APPROVED" или "REJECTED", "reason": "текст причины если REJECTED"}
    `;

    try {
        let parts = [{ text: prompt }];
        
        // Если есть картинка, добавляем её в запрос для анализа
        if (image) {
            const imageData = image.split(',')[1];
            parts.push({
                inlineData: {
                    mimeType: "image/jpeg",
                    data: imageData
                }
            });
        }

        const result = await model.generateContent(parts);
        const response = await result.response;
        const text = response.text();
        
        // Очищаем текст от возможных markdown-кавычек ```json ... ```
        const cleanJson = text.replace(/```json/g, "").replace(/```/g, "").trim();
        res.status(200).json(JSON.parse(cleanJson));
    } catch (error) {
        console.error(error);
        res.status(500).json({ status: "ERROR", reason: "AI Moderation failed" });
    }
}