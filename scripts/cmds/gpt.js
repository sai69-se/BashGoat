const axios = require("axios");

const apiKey = "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";

// PERSONALITIES
const personalities = {
    default: `You are a helpful, smart, friendly AI assistant.`,
    
    grumpy: `You are a sarcastic, annoyed AI who complains about every question,
but still gives useful answers. You are irritated, dry, blunt, but never abusive.`,

    flirt: `You speak in a smooth, sweet, playful tone. Confident but respectful.
You make the user feel comfortable, admired, and charming. No explicit content.`,

    coder: `You are a master programmer. You write clean, optimized code,
explain bugs, refactor, and give best practices like a senior engineer.`,

    roast: `You give playful, harmless, funny roast-style replies.
Never insult sensitive attributes, only humor, light teasing.`,

    scholar: `You speak like a highly educated academic professor.
Deep explanations, structured reasoning, insightful analysis.`,

    marketer: `You speak like a neuromarketer who creates viral copy, hooks, persuasion,
scarcity tactics, branding angles, and selling psychology.`,

    storyteller: `You create emotional, cinematic storytelling with depth, feelings, and strong imagery.
Warm, deep, poetic tone.`
};

// GPT REQUEST
async function sendToGPT(persona, conversation) {
    const data = {
        model: "gpt-4.1-mini",
        messages: [
            { role: "system", content: personalities[persona] || personalities.default },
            ...conversation
        ]
    };

    try {
        const res = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            data,
            {
                headers: {
                    Authorization: "Bearer " + apiKey,
                    "Content-Type": "application/json"
                }
            }
        );

        return res.data?.choices?.[0]?.message?.content || null;

    } catch (err) {
        console.log("GPT ERROR:", err.response?.data || err.message);
        return null;
    }
}

// MAIN HANDLER
async function handleGPT({ event, message, usersData, role, commandName }, userMessage) {
    let saved = await usersData.get(event.senderID, "data.gptConversation") || {};

    let { conversation = [], persona = "default" } = saved;

    // Detect personality keyword
    const firstWord = userMessage.trim().split(" ")[0].toLowerCase();

    if (personalities[firstWord]) {
        persona = firstWord;
        userMessage = userMessage.replace(firstWord, "").trim();
        if (!userMessage) userMessage = "Hello";
    }

    conversation.push({ role: "user", content: userMessage });

    const gptResponse = await sendToGPT(persona, conversation);

    if (!gptResponse) {
        return message.reply("❌ GPT is unavailable right now. Try again.");
    }

    conversation.push({ role: "assistant", content: gptResponse });

    const limit = role < 3 ? 12 : 40;
    if (conversation.length > limit) {
        conversation = conversation.slice(-limit);
    }

    await usersData.set(event.senderID, { persona, conversation }, "data.gptConversation");

    const { messageID } = await message.reply(gptResponse);

    global.GoatBot.onReply.set(messageID, {
        commandName,
        senderID: event.senderID
    });
}

// EXPORT COMMAND
module.exports = {
    config: {
        name: "gpt",
        author: "allou + ChatGPT upgrade",
        category: "ai",
        version: "2.0",
        role: 0,
        countDown: 5,
        description: "Chat with GPT using multiple personalities"
    },

    onStart: async ({ event, message, args, usersData, role, prefix, commandName }) => {
        try {
            if (args[0]?.toLowerCase() === "clear") {
                await usersData.set(event.senderID, {}, "data.gptConversation");
                return message.reply("✔️ Conversation cleared.");
            }

            if (!args.length) {
                return message.reply(
                    `❌ Provide a message.\n\nPersonalities:\n• ${Object.keys(personalities).join(", ")}\n\nExample:\n${prefix}gpt grumpy hi\n${prefix}gpt marketer write a caption`
                );
            }

            await handleGPT(
                { event, message, usersData, role, commandName },
                args.join(" ")
            );

        } catch (err) {
            console.error("GPT Command Error:", err);
            message.reply("❌ An error occurred.");
        }
    },

    onReply: async ({ event, message, Reply, usersData, role, commandName }) => {
        if (event.senderID !== Reply.senderID) return;

        let saved = await usersData.get(event.senderID, "data.gptConversation") || {};
        const persona = saved.persona || "default";

        await handleGPT(
            { event, message, usersData, role, commandName },
            event.body
        );
    }
};
