async function generateNotificationText(notification) {
    const content = notification.content || {};
    const counts = notification.counts || {};
    const senderInfo = notification.sender_display_name || notification.room_name || notification.room_alias || notification.sender || notification.room_id || "你的 Homeserver 没说";
    console.log(senderInfo)
    let messageText = `消息通知\n来自: ${await safeContent(senderInfo)}\n`;
    if (content.body) {
        messageText += `内容: ${safeContent(content.body)}\n`;
    }
    if (counts.missed_calls !== undefined) {
        messageText += `未接来电: ${counts.missed_calls}\n`;
    }
    if (counts.unread !== undefined) {
        messageText += `未读消息: ${counts.unread}\n`;
    }
    messageText += `\n调试信息\n\`\`\`json\n${JSON.stringify(notification, null, 2)}\n\`\`\``;
    return messageText.trim();
}

async function safeContent(str) {
    return str.replace(/[.!]/g, match => `\\${match}`);
}

async function sendMessage(app_id, chat_id, text, env, debug) {
    const expectedAppId = 'chat.nekos.ntfy.tg'; // 替换为预期的 app_id

    // 检查 app_id 是否一致
    if (app_id !== expectedAppId) {
        return chat_id; // 返回 chat_id，表示没有发送
    }

    const url = `${env.baseAPI}sendMessage`;
    console.log(url)
    const payload = {
        text: text,
        chat_id: chat_id,
        parse_mode: 'MarkdownV2'
    };
    const err = {
        chat_id: chat_id,
        text: `你的推送爆了，快去找开发者看看吧！\n调试信息\n\`\`\`json\n${JSON.stringify(debug, null, 2)}\n\`\`\``,
        parse_mode: 'MarkdownV2'
    };
    const errInit = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(err)
    };

    // 使用 await 等待 fetch 请求完成
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (response.status !== 200) {
        await fetch(url, errInit);
        return chat_id; // 如果状态码不是 200，返回 chat_id
    }

    // 解析响应 JSON
    const jsonResponse = await response.json();

    // 检查响应内容是否包含 { "ok": "true" }
    if (jsonResponse.ok !== true) {
        await fetch(url, errInit);
        return chat_id; // 如果响应里没有 { "ok": "true" }，返回 chat_id
    }
}

export default {
    async fetch(request, env) {
        // 读取请求的内容
        const hsNtfy = await request.json();
        console.log(hsNtfy)

        // 拼接字符串
        const text = await generateNotificationText(hsNtfy.notification);

        // 发送消息
        const sendErrorPromises = hsNtfy.notification.devices.map(async (element) => {
            const app_id = element.app_id;
            const chat_id = element.pushkey;

            // 使用 await 发送消息，返回错误的 chat_id
            const errorChatId = await sendMessage(app_id, chat_id, text, env, hsNtfy.notification);
            return errorChatId; // 直接返回发送结果
        });

        // 使用 Promise.all 来等待所有发送消息任务完成
        const sendErrorResults = await Promise.all(sendErrorPromises);

        // 过滤出所有发送失败的 chat_id
        const sendError = sendErrorResults.filter(chatId => chatId);

        const responseMsg = { "rejected": sendError };
        return Response.json(responseMsg);
    },
};