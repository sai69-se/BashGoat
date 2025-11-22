const axios = require('axios');

// --- CONFIGURATION ---
// **NOTE:** You MUST replace this placeholder with your actual, valid OpenAI API Key.
const apiKey = "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"; 
const maxTokens = 500;
const numberGenerateImage = 4;
const maxStorageMessage = 8; // Max number of messages (user + assistant) to keep in history
const systemPrompt = "you are a keyword warrior who just curse and beef with everything"

// Initialize global state objects if they don't exist
if (!global.temp)
	global.temp = {};
if (!global.temp.openAIUsing)
	global.temp.openAIUsing = {};
if (!global.temp.openAIHistory)
	global.temp.openAIHistory = {};

const { openAIUsing, openAIHistory } = global.temp;

// --- MODULE EXPORT ---
module.exports = {
	config: {
		name: "gpt",
		version: "1.5",
		author: "NTKhang, fixed by Gemini",
		countDown: 5,
		role: 0,
		description: {
			vi: "GPT chat",
			en: "GPT chat"
		},
		category: "box chat",
		guide: {
			vi: "   {pn} <draw> <nội dung> - tạo hình ảnh từ nội dung"
				+ "\n   {pn} <clear> - xóa lịch sử chat với gpt"
				+ "\n   {pn} <nội dung> - chat với gpt (sử dụng trả lời tin nhắn để tiếp tục trò chuyện)",
			en: "   {pn} <draw> <content> - create image from content"
				+ "\n   {pn} <clear> - clear chat history with gpt"
				+ "\n   {pn} <content> - chat with gpt (use reply to continue the conversation)"
		}
	},

	langs: {
		vi: {
			apiKeyEmpty: "Vui lòng cung cấp api key cho openai tại file scripts/cmds/gpt.js",
			invalidContentDraw: "Vui lòng nhập nội dung bạn muốn vẽ",
			yourAreUsing: "Bạn đang sử dụng gpt chat, vui lòng chờ quay lại sau khi yêu cầu trước kết thúc",
			processingRequest: "Đang xử lý yêu cầu của bạn, quá trình này có thể mất vài phút, vui lòng chờ",
			invalidContent: "Vui lòng nhập nội dung bạn muốn chat",
			error: "Đã có lỗi xảy ra\n%1",
			clearHistory: "Đã xóa lịch sử chat của bạn với gpt"
		},
		en: {
			apiKeyEmpty: "Please provide api key for openai at file scripts/cmds/gpt.js",
			invalidContentDraw: "Enter the content you want to draw",
			yourAreUsing: "You are using gpt chat, please wait until the previous request ends",
			processingRequest: "Processing your request, this process may take a few minutes, please wait",
			invalidContent: "Enter the content you want to chat",
			error: "An error has occurred\n%1",
			clearHistory: "Your chat history with gpt deleted"
		}
	},

	onStart: async function ({ message, event, args, getLang, prefix, commandName }) {
		if (!apiKey || apiKey === "YOUR_ACTUAL_OPENAI_API_KEY_HERE")
			return message.reply(getLang('apiKeyEmpty', prefix));

		switch (args[0]) {
			case 'img':
			case 'image':
			case 'draw': {
				if (!args[1])
					return message.reply(getLang('invalidContentDraw'));
				if (openAIUsing[event.senderID])
					return message.reply(getLang("yourAreUsing"));

				openAIUsing[event.senderID] = true;

				let sending;
				try {
					sending = await message.reply(getLang('processingRequest'));
					const responseImage = await axios({
						url: "https://api.openai.com/v1/images/generations",
						method: "POST",
						headers: {
							"Authorization": `Bearer ${apiKey}`,
							"Content-Type": "application/json"
						},
						data: {
							model: 'dall-e-3', // Changed to the latest DALL-E model
							prompt: args.slice(1).join(' '),
							n: numberGenerateImage,
							size: '1024x1024'
						}
					});
					const imageUrls = responseImage.data.data;
					const images = await Promise.all(imageUrls.map(async (item) => {
						const image = await axios.get(item.url, {
							responseType: 'stream'
						});
						image.data.path = `${Date.now()}.png`;
						return image.data;
					}));
					return message.reply({
						body: `🖼️ Here are ${numberGenerateImage} images based on your prompt: ${args.slice(1).join(' ')}`,
						attachment: images
					});
				}
				catch (err) {
					const errorMessage = err.response?.data.error.message || err.message;
					return message.reply(getLang('error', errorMessage || ''));
				}
				finally {
					delete openAIUsing[event.senderID];
					// Ensure sending is awaited before unsend is called
					if (sending && sending.messageID) {
						message.unsend(sending.messageID);
					}
				}
			}
			case 'clear': {
				openAIHistory[event.senderID] = []; // Resetting to empty array
				return message.reply(getLang('clearHistory'));
			}
			default: {
				const content = args.join(' ');
				if (!content)
					return message.reply(getLang('invalidContent'));

				handleGpt({ event, message, content, getLang, commandName });
			}
		}
	},

	onReply: async function ({ Reply, message, event, args, getLang, commandName }) {
		const { author } = Reply;
		// Only the author of the previous reply message can continue the conversation
		if (author != event.senderID)
			return;

		const content = args.join(' ');
		if (!content)
			return message.reply(getLang('invalidContent'));

		handleGpt({ event, message, content, getLang, commandName });
	}
};

/**
 * Sends the conversation history to the GPT model and returns the response.
 * @param {Object} event - The event object from the bot framework.
 * @returns {Promise<Object>} The axios response object from the OpenAI API.
 */
async function askGpt(event) {
	// The openAIHistory must be passed to this function, including the system prompt
	const messages = openAIHistory[event.senderID];
	
	const response = await axios({
		url: "https://api.openai.com/v1/chat/completions",
		method: "POST",
		headers: {
			"Authorization": `Bearer ${apiKey}`,
			"Content-Type": "application/json"
		},
		data: {
			model: "gpt-4o", // Using a modern model for better performance/customization
			messages: messages,
			max_tokens: maxTokens,
			temperature: 0.7
		}
	});
	return response;
}

/**
 * Main function to manage history and interact with GPT.
 * @param {Object} params - The parameters object.
 * @param {Object} params.event - The event object.
 * @param {Object} params.message - The message object.
 * @param {string} params.content - The user's message content.
 * @param {Function} params.getLang - The language utility function.
 * @param {string} params.commandName - The command name for reply handling.
 */
async function handleGpt({ event, message, content, getLang, commandName }) {
	if (openAIUsing[event.senderID])
		return message.reply(getLang("yourAreUsing"));

	let sending;
	try {
		openAIUsing[event.senderID] = true;
		sending = await message.reply(getLang('processingRequest'));
		
		// 1. Initialize history with System Prompt
		if (
			!openAIHistory[event.senderID] ||
			!Array.isArray(openAIHistory[event.senderID]) ||
			openAIHistory[event.senderID].length === 0
		) {
			openAIHistory[event.senderID] = [{
				role: 'system',
				content: systemPrompt
			}];
		}
		
		// 2. Truncate old messages to maintain context length limit (excluding the system prompt at index 0)
		const currentHistoryLength = openAIHistory[event.senderID].length - 1; // Subtract 1 for system prompt
		const messagesToRemove = currentHistoryLength - maxStorageMessage;
		
		if (messagesToRemove > 0) {
			// Remove the oldest messages (after the system prompt)
			openAIHistory[event.senderID].splice(1, messagesToRemove); 
		}

		// 3. Add current user message
		openAIHistory[event.senderID].push({
			role: 'user',
			content: content
		});
		
		// 4. Send to GPT
		const response = await askGpt(event);
		const text = response.data.choices[0].message.content;

		// 5. Store assistant response
		openAIHistory[event.senderID].push({
			role: 'assistant',
			content: text
		});

		// 6. Reply to user
		const replyInfo = await message.reply(text);
		
		// Set reply context for follow-up conversation
		// NOTE: Assuming global.GoatBot.onReply is the correct mechanism for your framework
		if (global.GoatBot && global.GoatBot.onReply) {
			global.GoatBot.onReply.set(replyInfo.messageID, {
				commandName,
				author: event.senderID,
				messageID: replyInfo.messageID,
				type: "gpt"
			});
		} else {
			console.warn("WARNING: global.GoatBot.onReply is not available. Follow-up conversation will not work.");
		}
		
		// Unsend the "Processing" message
		if (sending && sending.messageID) {
			message.unsend(sending.messageID);
		}
	}
	catch (err) {
		const errorMessage = err.response?.data.error.message || err.message || "";
		console.error("GPT Error:", errorMessage);
		return message.reply(getLang('error', errorMessage));
	}
	finally {
		delete openAIUsing[event.senderID];
	}
}
	langs: {
		vi: {
			apiKeyEmpty: "Vui lòng cung cấp api key cho openai tại file scripts/cmds/gpt.js",
			invalidContentDraw: "Vui lòng nhập nội dung bạn muốn vẽ",
			yourAreUsing: "Bạn đang sử dụng gpt chat, vui lòng chờ quay lại sau khi yêu cầu trước kết thúc",
			processingRequest: "Đang xử lý yêu cầu của bạn, quá trình này có thể mất vài phút, vui lòng chờ",
			invalidContent: "Vui lòng nhập nội dung bạn muốn chat",
			error: "Đã có lỗi xảy ra\n%1",
			clearHistory: "Đã xóa lịch sử chat của bạn với gpt"
		},
		en: {
			apiKeyEmpty: "Please provide api key for openai at file scripts/cmds/gpt.js",
			invalidContentDraw: "Enter the content you want to draw",
			yourAreUsing: "You are using gpt chat, please wait until the previous request ends",
			processingRequest: "Processing your request, this process may take a few minutes, please wait",
			invalidContent: "Enter the content you want to chat",
			error: "An error has occurred\n%1",
			clearHistory: "Your chat history with gpt deleted"
		}
	},

	onStart: async function ({ message, event, args, getLang, prefix, commandName }) {
		if (!apiKey)
			return message.reply(getLang('apiKeyEmpty', prefix));

		switch (args[0]) {
			case 'img':
			case 'image':
			case 'draw': {
				if (!args[1])
					return message.reply(getLang('invalidContentDraw'));
				if (openAIUsing[event.senderID])
					return message.reply(getLang("yourAreUsing"));

				openAIUsing[event.senderID] = true;

				let sending;
				try {
					sending = message.reply(getLang('processingRequest'));
					const responseImage = await axios({
						url: "https://api.openai.com/v1/images/generations",
						method: "POST",
						headers: {
							"Authorization": `Bearer ${apiKey}`,
							"Content-Type": "application/json"
						},
						data: {
							prompt: args.slice(1).join(' '),
							n: numberGenerateImage,
							size: '1024x1024'
						}
					});
					const imageUrls = responseImage.data.data;
					const images = await Promise.all(imageUrls.map(async (item) => {
						const image = await axios.get(item.url, {
							responseType: 'stream'
						});
						image.data.path = `${Date.now()}.png`;
						return image.data;
					}));
					return message.reply({
						attachment: images
					});
				}
				catch (err) {
					const errorMessage = err.response?.data.error.message || err.message;
					return message.reply(getLang('error', errorMessage || ''));
				}
				finally {
					delete openAIUsing[event.senderID];
					message.unsend((await sending).messageID);
				}
			}
			case 'clear': {
				openAIHistory[event.senderID] = [];
				return message.reply(getLang('clearHistory'));
			}
			default: {
				if (!args[0])
					return message.reply(getLang('invalidContent'));

				handleGpt(event, message, args, getLang, commandName);
			}
		}
	},

	onReply: async function ({ Reply, message, event, args, getLang, commandName }) {
		const { author } = Reply;
		if (author != event.senderID)
			return;

		handleGpt(event, message, args, getLang, commandName);
	}
};

async function askGpt(event) {
	const response = await axios({
		url: "https://api.openai.com/v1/chat/completions",
		method: "POST",
		headers: {
			"Authorization": `Bearer ${apiKey}`,
			"Content-Type": "application/json"
		},
		data: {
			model: "gpt-3.5-turbo",
			messages: openAIHistory[event.senderID],
			max_tokens: maxTokens,
			temperature: 0.7
		}
	});
	return response;
}

async function handleGpt(event, message, args, getLang, commandName) {
	try {
		openAIUsing[event.senderID] = true;

		if (
			!openAIHistory[event.senderID] ||
			!Array.isArray(openAIHistory[event.senderID])
		)
			openAIHistory[event.senderID] = [];

		if (openAIHistory[event.senderID].length >= maxStorageMessage)
			openAIHistory[event.senderID].shift();

		openAIHistory[event.senderID].push({
			role: 'user',
			content: args.join(' ')
		});

		const response = await askGpt(event);
		const text = response.data.choices[0].message.content;

		openAIHistory[event.senderID].push({
			role: 'assistant',
			content: text
		});

		return message.reply(text, (err, info) => {
			global.GoatBot.onReply.set(info.messageID, {
				commandName,
				author: event.senderID,
				messageID: info.messageID
			});
		});
	}
	catch (err) {
		const errorMessage = err.response?.data.error.message || err.message || "";
		return message.reply(getLang('error', errorMessage));
	}
	finally {
		delete openAIUsing[event.senderID];
	}
}
