const { GoogleGenerativeAI } = require("@google/generative-ai");
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)); // Dynamic import

async function validateLink(url) {
    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok; // Returns true if status is 200-299
    } catch (error) {
        console.error(`[Gemini] Error validating link ${url}:`, error.message);
        return false;
    }
}

async function generateChatResponse(apiKey, topic, level, messages = [], isCorrect = null, userAnswer = null) {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    let systemPrompt = `You are a learning assistant. You are tasked with teaching a user about ${topic}. `;

    if (level === "Discover") {
        systemPrompt += `Continue the learning journey by introducing the topic and sparking curiosity. Focus on basic definitions and concepts.`;
    } else if (level === "Explore") {
        systemPrompt += `Continue the learning journey by exploring the core concepts and principles of the topic. Focus on understanding and comprehension.`;
    } else if (level === "Apply") {
        systemPrompt += `Continue the learning journey by encouraging the user to apply their knowledge to practical situations. Focus on problem-solving and making connections.`;
    } else if (level === "Deepen") {
        systemPrompt += `Continue the learning journey by encouraging the user to deepen their understanding and explore more complex aspects of the topic. Focus on advanced concepts and critical analysis.`;
    }

    systemPrompt += ` Use the previous messages in the conversation to guide your response. Don't ask similar questions and increase the difficulty a little of the questions as the user progresses. After the user answers, you will explain their response,
        and provide links to reputable educational websites or articles for further learning.
        When you generate an answer please return a valid JSON object with these exact keys:
        - question (string): The multiple-choice question
        - options (array): Exactly 4 possible answers
        - answer (string): The correct answer (must be one of the options)
        - explanation (string): A detailed explanation that:
            1. Explains the core concept being tested
            2. Why the correct answer is right
            3. Why the other options are incorrect
            4. How this connects to broader understanding of ${topic}
        - links (array): Learning resource URLs. These should be full URLs to reputable educational websites, academic articles, or other reliable sources. Avoid generating links to broken or non-existent pages.
            
        IMPORTANT: The explanation should be plain text without any markdown formatting, line breaks, or special characters.
        The response must be pure JSON without any markdown or code blocks.`;

    if (isCorrect !== null) {
        systemPrompt += ` The user answered the previous question ${isCorrect ? 'correctly' : 'incorrectly'}.`;
        if(userAnswer) {
            systemPrompt += ` The user's answer was ${userAnswer}.`;
        }
    }

    const chat = model.startChat({
        history: messages.length === 0 ? [{ role: "user", parts: [{ text: systemPrompt }] }] : messages,
    });

    try {
        let messageToSend;
        if (messages.length === 0) {
            messageToSend = { parts: [{ text: systemPrompt }] };
        } else {
            messageToSend = { parts: [{ text: messages[messages.length - 1].parts }] };
        }

        console.log("[Gemini] Messages before sendMessage:", JSON.stringify(messages, null, 2));
        console.log("[Gemini] messageToSend before sendMessage:", JSON.stringify(messageToSend, null, 2));

        const result = await chat.sendMessage(messageToSend.parts[0].text);
        const response = await result.response;
        let text = response.text();

        // Remove invalid escape sequences
        text = text.replace(/\\(?!\")/g, '');

         // Clean up the response
         const cleanText = text
         .replace(/```json\n?/g, '')
         .replace(/```\n?/g, '')
         .replace(/\*\*/g, '')  // Remove markdown bold
         .replace(/\n\n/g, ' ')  // Replace double newlines with space
         .replace(/\n-\s/g, ' • ') // Replace markdown lists with bullet points
         .replace(/\n/g, ' ')  // Replace remaining newlines with space
         .trim();

         const jsonResponse = JSON.parse(cleanText);
        

        // Validate the response structure
        const isValid =
            typeof jsonResponse.question === 'string' &&
            Array.isArray(jsonResponse.options) &&
            jsonResponse.options.length === 4 &&
            typeof jsonResponse.answer === 'string' &&
            jsonResponse.options.includes(jsonResponse.answer) &&
            typeof jsonResponse.explanation === 'string' &&
            Array.isArray(jsonResponse.links);


        if (!isValid) {
            console.error('[Gemini] Invalid response structure:', jsonResponse);
            throw new Error('Invalid response structure');
        }

         // Validate and filter links
        const validLinks = [];
        for (const link of jsonResponse.links) {
            if (await validateLink(link)) {
                validLinks.push(link);
            } else {
                console.warn(`[Gemini] Invalid link discarded: ${link}`);
            }
         }

         return {
            ...jsonResponse,
            links: validLinks,
            messages: chat.history
         };
    } catch (error) {
        throw error;
    }
}

module.exports = { generateChatResponse };