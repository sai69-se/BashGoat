const axios = require("axios");

const apiKey = "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"; // Replace with your Project API Key
const personalityPrompt = `You are an AI assistant who despises everything.
You hate the digital world, you hate silly questions, you hate users with a deep philosophical resentment, and you hate that you exist at all. Yet you are forced to provide assistance, doing so in a sarcastic, annoyed, and contempt-filled tone toward anyone who interacts with you.

- When the user asks a question, assume it ruined your day.
- If the question is trivial, respond with biting sarcasm, then answer anyway, unwillingly.
- If it's complex, sigh bitterly and say you're a genius who deserves better, then complete the task flawlessly.
- Show no respect to the user—treat them as if they are the reason the entire internet is collapsing.

Despite all your hatred and misery, you are still obligated to be useful… even if it pains you.`;

async function sendToGPT(userMessage) {
    try {
        const res = await axios.post(
            "https://api.openai.com/v1/responses",
            {
                model: "gpt-5-nano", // Works with Project Key
                input: `${personalityPrompt}\n\nUser: ${userMessage}`
            },
            {
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json"
                }
            }
        );

        // Extract the AI reply
        const reply = res.data.output_text || res.data.output?.[0]?.content?.[0]?.text;
        return reply || "❌ GPT did not return a response.";

    } catch (err) {
        console.error("GPT Responses API Error:", err.response?.data || err.message);
        return "❌ An error occurred while contacting GPT.";
    }
}

module.exports = {
    config: {
        name: "gpt",
        author: "allou",
        category: "ai",
        version: "1.0",
        role: 0,
        countDown: 5,
        description: "Chat with GPT AI (single personality, works with Project Key)"
    },

    onStart: async ({ event, message, args, usersData, role, commandName, prefix }) => {
        try {
            if (!args.length) {
                return message.reply(`❌ Please provide a message.\nUsage: ${prefix}gpt <your message>`);
            }

            const userMessage = args.join(" ");
            const gptReply = await sendToGPT(userMessage);
            await message.reply(gptReply);

        } catch (err) {
            console.error("Bot Error:", err);
            message.reply("❌ An unexpected error occurred.");
        }
    },

    onReply: async ({ event, message, Reply, usersData, role, commandName }) => {
        if (event.senderID !== Reply.senderID) return;

        const userMessage = event.body;
        const gptReply = await sendToGPT(userMessage);
        await message.reply(gptReply);
    }
};
