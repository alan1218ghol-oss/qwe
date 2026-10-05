const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// API Ключ будет браться из файла .env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post('/analyze', async (req, res) => {
    try {
        const { ticket, userAnswers, pointsPerQuestion } = req.body;
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        let totalScore = 0;
        const analysis = [];

        for (let i = 0; i < ticket.length; i++) {
            const question = ticket[i].question;
            const correctAnswer = ticket[i].answer;
            const userAnswer = userAnswers[i];

            const prompt = `
                Ты строгий, но поддерживающий преподаватель. 
                Вопрос: "${question}"
                Правильный ответ: "${correctAnswer}"
                Ответ ученика: "${userAnswer}"

                Твоя задача:
                1. Определить, является ли ответ ученика верным по сути (даже если слова другие).
                2. Если ответ верный, напиши "ВЕРНО" в начале, а затем кратко похвали.
                3. Если ответ неверный или неполный, напиши "НЕВЕРНО" в начале, объясни что именно пропущено или в чем ошибка, и что конкретно нужно проверить в учебнике.
                Отвечай кратко и по делу.
            `;

            const result = await model.generateContent(prompt);
            const responseText = result.response.text();
            
            const isCorrect = responseText.toUpperCase().startsWith('ВЕРНО');
            if (isCorrect) totalScore += pointsPerQuestion;

            analysis.push({
                userAnswer,
                feedback: responseText,
                isCorrect
            });
        }

        res.json({
            totalScore,
            analysis
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ошибка при анализе ответа AI' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Сервер запущен на порту ${PORT}`);
});
