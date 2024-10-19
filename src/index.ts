import sha256 from 'crypto-js/sha256';

interface Env {
    kv: KVNamespace;
    baseAPI: string;
    token: string;
}

interface Notification {
    content: {
        body?: string;
    };
    event_id?: string;
    room_id?: string;
    counts?: {
        missed_calls?: number;
        unread?: number;
    };
    sender_display_name?: string;
    room_name?: string;
    room_alias?: string;
    sender?: string;
    devices: Array<{ app_id: string; pushkey: string; }>;
}

export default {
    async fetch(request: Request, env: Env) {
        // 读取请求的内容
        const requestBody: { notification: Notification } = await request.json();
        const hsNtfy = requestBody.notification;
        console.log(hsNtfy)

        // 拼接字符串
        const textPromise = generateNotificationText(hsNtfy);
        const url = `${env.baseAPI}sendMessage`;

        // 发送消息
        const sendErrorPromises = hsNtfy.devices.map(async (element: { app_id: string; pushkey: string; }) => {
            const app_id = element.app_id;
            const pushkey = element.pushkey;

            // 使用 await 发送消息，返回错误的 pushkey
            const errorPushkey = await sendMessage(app_id, pushkey, textPromise, url, env.token, hsNtfy, env.kv);
            return errorPushkey; // 直接返回发送结果
        });

        // 使用 Promise.all 来等待所有发送消息任务完成
        const sendErrorResults = await Promise.all(sendErrorPromises);

        // 使用 filter 方法过滤掉空字符串、null 和 undefined
        const sendError = sendErrorResults.filter((pushkey: string | undefined) => pushkey);

        const responseMsg = { "rejected": sendError };
        return Response.json(responseMsg);
    },
};

async function generateNotificationText(notification: Notification) {
    const content = notification.content || {};
    const counts = notification.counts || {};
    const senderInfo = notification.sender_display_name || notification.room_name || notification.room_alias || notification.sender || notification.room_id || "你的 Homeserver 没说";

    let messageText = `*消息通知*\n*来自:* ${senderInfo}\n`;
    if (content.body) {
        messageText += `*内容:* ${content.body}\n`;
    }
    if (counts.missed_calls !== undefined) {
        messageText += `*未接来电:* ${counts.missed_calls}\n`;
    }
    if (counts.unread !== undefined) {
        messageText += `*未读消息:* ${counts.unread}\n`;
    }
    if (typeof notification.room_id === 'string' && typeof notification.event_id === 'string') {
        messageText += `\n[matrix.to](https://matrix.to/#/${notification.room_id}/${notification.event_id})`;
    }
    const safeText = messageText.replace(/[.!]/g, (match: string) => `\\${match}`).trim();
    console.log(safeText)
    return safeText;
}

async function checkShouldSend(app_id: string, pushkey: string, token: string, hsNtfy: Notification, kv: KVNamespace) {
    // 检查 app_id
    const expectedAppId = 'chat.nekos.tgntfy';
    if (app_id !== expectedAppId) {
        return 'reject';
    }

    // 检查签名
    const regex = /^([^:]+):([^:]+)$/; // 匹配格式为 chat_id:single_chat_id
    const match = pushkey.match(regex);
    if (!match) {
        return 'reject';
    }
    const chat_id = match[1];
    const signature = match[2];
    const expectedSign = sha256(chat_id + token).toString();
    if (signature !== expectedSign) {
        return 'reject';
    }

    // KV 存储
    const chatIdKey = await kv.get(chat_id, 'json');
    if (chatIdKey === null) {
        await kv.put(chat_id, JSON.stringify({ 'sign': signature, 'time': Date.now() }));
    }

    // 检查是否应该发送消息
    if ((hsNtfy.counts?.unread === 0 || hsNtfy.counts?.unread === 1) && (hsNtfy.counts?.missed_calls === 0 || hsNtfy.counts?.missed_calls === undefined)) {
        return 'nothing';
    }

    return chat_id;
}

async function sendMessage(app_id: string, pushkey: string, promiseText: Promise<string>, url: string, token: string, hsNtfy: Notification, kv: KVNamespace) {
    // 检查是否应该发送消息并获取 chat_id
    const action = await checkShouldSend(app_id, pushkey, token, hsNtfy, kv);
    if (action === 'nothing') {
        return;
    }
    if (action === 'reject') {
        return pushkey;
    }
    const chat_id = action;

    const text = await promiseText;
    const payload = {
        text: text,
        chat_id: chat_id,
        parse_mode: 'MarkdownV2'
    };

    // 使用 await 等待 fetch 请求完成
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (response.status !== 200) {
        return pushkey; // 如果状态码不是 200，返回 pushkey
    }

    // 解析响应 JSON
    const jsonResponse = await response.json() as { ok: boolean };

    // 检查响应内容是否包含 { "ok": "true" }
    if (jsonResponse.ok !== true) {
        return pushkey; // 如果响应里没有 { "ok": "true" }，返回 pushkey
    }
}