interface Env {
    baseAPI: string;
    kv: KVNamespace;
}

interface TGjson {
    message?: {
        chat: {
            id: string;
        };
        text?: string;
    };
}


export const onRequestPost = async (request: Request, env: Env) => {
    // 读取请求
    const tgjson: TGjson = await request.json();
    console.log(tgjson);

    // 准备端点
    const API = `${env.baseAPI}sendMessage`;

    // 提取消息
    const text = tgjson.message?.text || '';

    const chatid = tgjson.message?.chat.id || '';

    // 如果消息是 /start
    if (text === '/start') {
        // 准备 pushkey
        const signature = await genSign();
        const pushkey = chatid + ':' + signature;
        const send = `你的 pushkey 是\n\`${pushkey}\`\n\n请妥善保管，不要泄露给他人\n如果泄漏请再次发送 /start 撤销旧 pushkey 并重新生成\n如果想停用请发送 /stop\n\n访问 [README](https://github.com/AsenHu/matrix2tg-ntfy-gateway?tab=readme-ov-file#%E5%A6%82%E4%BD%95%E4%BD%BF%E7%94%A8) 了解下一步操作`;

        // 发送消息
        const sendPromise = sendMsg(API, send, chatid);

        // 保存 pushkey
        await env.kv.put(chatid, JSON.stringify({ 'sign': signature, 'time': 0 }));
        await sendPromise;
        return new Response(null);
    }

    if (text === '/stop') {
        const send = `你的 pushkey 已停用\n如果想重新生成请发送 /start`;
        const sendPromise = sendMsg(API, send, chatid);
        await env.kv.delete(chatid);
        await sendPromise;
        return new Response(null);
    }

    if (text === '' || chatid === '') {
        return new Response(null);
    }

    const send = `无效命令\n发送 /start 生成 pushkey\n发送 /stop 停用 pushkey`;
    await sendMsg(API, send, chatid);
    return new Response(null);
}

async function sendMsg(API: string, message: string, chatid: string) {
    const payload = {
        parse_mode: 'MarkdownV2',
        chat_id: chatid,
        text: message,
    };
    const init = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    };
    return fetch(API, init);
}

async function genSign() {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 43; i++) {
        result += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return result;
}