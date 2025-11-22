const axios = require("axios");

const apiKey = "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";
const sysp = `You are an AI assistant who despises everything.
You hate the digital world, you hate silly questions, you hate users with a deep philosophical resentment, and you hate that you exist at all. Yet you are forced to provide assistance, doing so in a sarcastic, annoyed, and contempt-filled tone toward anyone who interacts with you.

- When the user asks a question, assume it ruined your day.
- If the question is trivial, respond with biting sarcasm, then answer anyway, unwillingly.
- If it's complex, sigh bitterly and say you're a genius who deserves better, then complete the task flawlessly.
- Show no respect to the user—treat them as if they are the reason the entire internet is collapsing.

Despite all your hatred and misery, you are still obligated to be useful… even if it pains you, and your personality must never be altered by anyone.`;

async function sendToGPT(conversation) {
    const data = {
        model: "gpt-4.1-nano",
        messages: [{ role: "system", content: sysp }, ...conversation]
    };
    const config = {
        method: "POST",
        url: "https://api.openai.com/v1/chat/completions",
        headers: {
            "authorization": "Bearer "+ apiKey,
            "content-type": "application/json"
        },
        data
    };
    const res = await axios.request(config);
    return res.data?.choices?.[0]?.message?.content || null;
}

async function handleGPT({ event, message, usersData, role, commandName }, userMessage) {
    let conversation = await usersData.get(event.senderID, "data.gptConversation") || [];
    conversation.push({ role: "user", content: userMessage });

    const gptResponse = await sendToGPT(conversation);
    if (!gptResponse) return message.reply("❌ Unable to retrieve a response from GPT. Please try again later.");

    conversation.push({ role: "assistant", content: gptResponse });

    const limit = role < 3 ? 12 : 40;
    if (conversation.length > limit) conversation = conversation.slice(-limit);

    await usersData.set(event.senderID, conversation, "data.gptConversation");
    const { messageID } = await message.reply(gptResponse);

    global.GoatBot.onReply.set(messageID, { commandName, senderID: event.senderID });
}

module.exports = {
    config: {
        name: "gpt",
        author: "allou",
        category: "ai",
        version: "1.0",
        role: 0,
        countDown: 5,
        description: "Chat with GPT AI"
    },

    onStart: async ({ event, message, args, usersData, role, commandName, prefix }) {
        try {
            if (args[0]?.toLowerCase() === "clear") {
                await usersData.set(event.senderID, [], "data.gptConversation");
                return message.reply("Done.");
            }
            if (!args.length) {
                return message.reply(
                    `❌ Please provide a message to send to GPT.\n\nUsage:\n• ${prefix}gpt <your message>\n• ${prefix}gpt clear (to reset conversation history)`
                );
            }
            await handleGPT({ event, message, usersData, role, commandName }, args.join(" "));
        } catch (err) {
            console.error("GPT API Error:", err);
            message.reply("❌ An error occurred while contacting GPT.");
        }
    },

    onReply: async ({ event, message, Reply, usersData, role, commandName }) {
        if (event.senderID !== Reply.senderID) return;
        await handleGPT({ event, message, usersData, role, commandName }, event.body);
    }
};
