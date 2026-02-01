import Groq from 'groq-sdk';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// CORS настройки
const allowCors = fn => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
    
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }
    return await fn(req, res);
}

const handler = async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, ticker, description, image } = req.body;

        if (!image) {
            return res.status(400).json({ error: 'Image is required' });
        }

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
                                url: image
                            }
                        }
                    ]
                },
            ],
            // === ИСПОЛЬЗУЕМ ВАШУ МОДЕЛЬ SCOUT ===
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            
            temperature: 0,
            // Важно: некоторые превью-модели могут не поддерживать response_format: json_object идеально,
            // но мы обрабатываем это ниже очисткой строки.
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0].message.content;
        
        // Очистка от возможных markdown-тегов (```json ... ```), если модель их добавит
        const cleanContent = content.replace(/```json\n?|```/g, '').trim();
        
        const result = JSON.parse(cleanContent);
        
        return res.status(200).json(result);

    } catch (error) {
        console.error("AI Check Error:", error);
        // Возвращаем детали ошибки, чтобы видеть их в логах теста
        return res.status(500).json({ 
            error: "Moderation failed", 
            details: error.message 
        });
    }
};

export default allowCors(handler);
