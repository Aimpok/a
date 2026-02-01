import Groq from 'groq-sdk';

// Инициализация клиента Groq
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

// Разрешаем CORS, чтобы ваш фронтенд мог обращаться к этому API
const allowCors = fn => async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*'); // В продакшене лучше указать конкретный домен
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

        // Подготовка промпта для Llama Vision
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
                            1. NSFW/Pornography/Nudity.
                            2. Hate speech, racism, or extremism.
                            3. Illegal drugs or weapons promotion.
                            4. Scams or impersonation of famous coins/people in a malicious way.
                            
                            Return ONLY a JSON object with this format (no markdown):
                            {
                                "allowed": boolean,
                                "reason": "string (explanation if allowed is false, otherwise empty)"
                            }`
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: image // Ожидается base64 формат: "data:image/jpeg;base64,..."
                            }
                        }
                    ]
                }
            ],
            model: "llama-3.2-11b-vision-preview",
            temperature: 0,
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content);
        
        return res.status(200).json(result);

    } catch (error) {
        console.error("AI Check Error:", error);
        return res.status(500).json({ error: "Moderation check failed", details: error.message });
    }
};

export default allowCors(handler);
