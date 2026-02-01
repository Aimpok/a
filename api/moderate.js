import Groq from 'groq-sdk';

// Инициализация. Ключ берется из настроек Vercel
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// === CORS WRAPPER ===
// Эта обертка нужна, чтобы браузер не блокировал запрос
const allowCors = fn => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    // Если браузер просто "спрашивает" разрешение (OPTIONS), отвечаем ОК сразу
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
}

// === MAIN HANDLER ===
const handler = async (req, res) => {
    // Разрешаем только POST запросы
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, ticker, description, image } = req.body;

        // Если картинки нет — ошибка
        if (!image) {
            return res.status(400).json({ error: 'Image is required' });
        }

        // Промпт для ИИ
        const completion = await groq.chat.completions.create({
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: `You are a strict content moderator for a crypto launchpad. 
                            Analyze the provided token image and details.
                            
                            Token Name: "${name}"
                            Ticker: "${ticker}"
                            Description: "${description}"
                            
                            CHECK FOR:
                            1. NSFW/Pornography/Nudity (Strictly forbidden).
                            2. Hate speech, racism, slurs or extremism.
                            3. Promotion of illegal drugs or weapons.
                            4. Scams attempting to impersonate official projects maliciously.
                            
                            Return ONLY a JSON object with this exact format (do not use markdown blocks):
                            {
                                "allowed": boolean,
                                "reason": "string (explanation if allowed is false, otherwise empty string)"
                            }`
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: image // Сюда прилетает base64 строка
                            }
                        }
                    ]
                }
            ],
            // Используем Vision модель (она умеет смотреть картинки)
            model: "llama-3.2-11b-vision-preview",
            temperature: 0,
            response_format: { type: "json_object" }
        });

        // Парсим ответ от ИИ
        const content = completion.choices[0].message.content;
        const result = JSON.parse(content);
        
        // Возвращаем результат фронтенду
        return res.status(200).json(result);

    } catch (error) {
        console.error("AI Check Error:", error);
        // Возвращаем текст ошибки, чтобы видеть его в alert на телефоне
        return res.status(500).send(error.message || "Internal Server Error");
    }
};

// Экспортируем функцию, обернутую в CORS
export default allowCors(handler);
