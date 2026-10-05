let allQuestions = [];
let currentTicket = [];

// URL вашего сервера (позже заменим на реальный адрес при деплое)
const SERVER_URL = 'http://localhost:3000';

const fileInput = document.getElementById('fileInput');
const questionsCountInput = document.getElementById('questionsCount');
const pointsPerQuestionInput = document.getElementById('pointsPerQuestion');
const startBtn = document.getElementById('startBtn');
const submitBtn = document.getElementById('submitBtn');
const restartBtn = document.getElementById('restartBtn');

const setupSection = document.getElementById('setupSection');
const ticketSection = document.getElementById('ticketSection');
const loadingSection = document.getElementById('loadingSection');
const resultSection = document.getElementById('resultSection');
const questionsContainer = document.getElementById('questionsContainer');
const scoreDisplay = document.getElementById('scoreDisplay');
const aiFeedbackContainer = document.getElementById('aiFeedbackContainer');

startBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
        alert('Пожалуйста, выберите файл!');
        return;
    }

    try {
        if (file.name.endsWith('.json')) {
            const text = await file.text();
            allQuestions = JSON.parse(text);
        } else if (file.name.endsWith('.docx')) {
            const arrayBuffer = await file.arrayBuffer();
            const textResult = await mammoth.extractRawText({ arrayBuffer });
            allQuestions = await parseDocxText(textResult.value, arrayBuffer);
        }
        
        if (allQuestions.length === 0) throw new Error('Вопросы не найдены в файле.');
        generateTicket();
    } catch (e) {
        alert('Ошибка: ' + e.message);
    }
});

// Простой парсер Word: предполагает, что вопрос и ответ разделены строкой
// или имеют формат "В: ... О: ..."
async function parseDocxText(text, arrayBuffer) {
    console.log("--- DEBUG START ---");
    console.log("RAW TEXT:", text);
    
    const htmlResult = await mammoth.convertToHtml({ arrayBuffer });
    const html = htmlResult.value;
    console.log("HTML CONTENT:", html);
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const rows = doc.querySelectorAll('tr');
    console.log("ROWS FOUND:", rows.length);
    
    if (rows.length > 0) {
        const questions = [];
        rows.forEach((row, i) => {
            const cells = row.querySelectorAll('td');
            console.log(`Row ${i} cells: ${cells.length}`);
            if (cells.length >= 2) {
                let qIndex = 0;
                let aIndex = 1;
                const firstCell = cells[0].textContent.trim();
                if (/^\d+$/.test(firstCell) && cells.length >= 3) {
                    qIndex = 1; aIndex = 2;
                }
                const qText = cells[qIndex].textContent.trim();
                const aText = cells[aIndex] ? cells[aIndex].textContent.trim() : '';
                console.log(`Row ${i} data -> Q: "${qText}", A: "${aText}"`);
                if (qText !== '' && aText !== '') { 
                    questions.push({ question: qText, answer: aText });
                }
            }
        });
        console.log("QUESTIONS FROM TABLE:", questions.length);
        if (questions.length > 0) return questions;
    }

    const blocks = text.split(/\n\s*\n/);
    const textQuestions = [];
    blocks.forEach((block, i) => {
        const lines = block.split('\n').filter(l => l.trim() !== '');
        console.log(`Block ${i} lines: ${lines.length}`);
        if (lines.length >= 2) {
            const qText = lines[0].trim();
            const aText = lines[1].trim();
            if (qText !== '' && aText !== '') {
                textQuestions.push({ question: qText, answer: aText });
            }
        }
    });
    console.log("QUESTIONS FROM TEXT:", textQuestions.length);
    console.log("--- DEBUG END ---");
    return textQuestions;
}

function generateTicket() {
    const count = parseInt(questionsCountInput.value);
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
    currentTicket = shuffled.slice(0, count);

    questionsContainer.innerHTML = '';
    currentTicket.forEach((q, index) => {
        const div = document.createElement('div');
        div.className = 'question-block';
        div.innerHTML = `
            <label>Вопрос ${index + 1}: ${q.question}</label>
            <textarea placeholder="Ваш ответ..." class="user-answer"></textarea>
        `;
        questionsContainer.appendChild(div);
    });

    setupSection.classList.add('hidden');
    ticketSection.classList.remove('hidden');
}

submitBtn.addEventListener('click', async () => {
    const answers = document.querySelectorAll('.user-answer');
    const userAnswers = Array.from(answers).map(input => input.value.trim());
    
    ticketSection.classList.add('hidden');
    loadingSection.classList.remove('hidden');

    try {
        const response = await fetch(`${SERVER_URL}/analyze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ticket: currentTicket,
                userAnswers: userAnswers,
                pointsPerQuestion: parseInt(pointsPerQuestionInput.value)
            })
        });

        const result = await response.json();
        displayResults(result);
    } catch (e) {
        alert('Ошибка сервера: ' + e.message);
        ticketSection.classList.remove('hidden');
    } finally {
        loadingSection.classList.add('hidden');
    }
});

function displayResults(result) {
    scoreDisplay.innerHTML = `Итоговый балл: ${result.totalScore}`;
    aiFeedbackContainer.innerHTML = '';

    result.analysis.forEach((item, index) => {
        const div = document.createElement('div');
        div.className = `ai-feedback ${item.isCorrect ? 'feedback-correct' : 'feedback-wrong'}`;
        div.innerHTML = `
            <p><strong>Вопрос ${index + 1}:</strong> ${currentTicket[index].question}</p>
            <p><strong>Ваш ответ:</strong> ${item.userAnswer || 'пусто'}</p>
            <p><strong>AI-разбор:</strong> ${item.feedback}</p>
        `;
        aiFeedbackContainer.appendChild(div);
    });

    resultSection.classList.remove('hidden');
}

restartBtn.addEventListener('click', () => {
    setupSection.classList.remove('hidden');
    resultSection.classList.add('hidden');
    aiFeedbackContainer.innerHTML = '';
});
