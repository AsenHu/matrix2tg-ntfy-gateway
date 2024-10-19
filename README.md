# matrix2tg-ntfy-gateway

这个项目把 telegram 作为消息通知接口，通过 tg 来做 matrix 的推送工作。因为大陆用户的手机，GCM 工作的一点都不好，让这些用户去折腾 ntfy 也不现实。但如果这些用户安装了 tg，就可以在不安装任何软件的情况下获得消息通知（通过 tg 常驻后台与服务器的长连接）。

## 如何使用？

1. 前往 TG bot [@jQ7y_bot](https://t.me/jQ7y_bot) 发送消息 /start 获取你的 pushkey。拥有 pushkey 的人可以通过 bot 给你发消息，所以妥善保管。
2. 获取你的家服务器客户端端点，通常在 `home.server/.well-known/matrix/client` 这个路径下，如果你家服务器这个路径不存在，那客户端端点就是 `https://home.server:8448`
   例子: `matrix.org` 的客户端端点是 `https://matrix-client.matrix.org`
3. 获取你的访问令牌，对于 element web，在 设置 - 帮助及关于 - 高级 - 访问令牌。请注意，你的访问令牌可以完全访问你的账户。不要将其与任何人分享。
4. 构建 POST 请求，向你的家服务器注册一个推送网关，下面写了 curl 示例。

```
curl -X POST https://<你的 HS 客户端端点>/_matrix/client/v3/pushers/set \
    -H 'Authorization: Bearer <你的 TOKEN>' \
    -H 'Content-Type: application/json' \
    -d '
{
  "app_display_name": "Telegram Bot",
  "app_id": "chat.nekos.tgntfy",
  "append": false,
  "data": {
    "format": "event_id_only",
    "url": "https://tgntfy.nekos.chat/_matrix/push/v1/notify"
  },
  "device_display_name": "Telegram Bot",
  "kind": "http",
  "lang": "zh",
  "pushkey": "<你的 PUSHKEY>"
}'
```

## 其他问题

Q: 部署指南？
A: 如果你写过 cf worker 就知道如何部署。以后学业压力小了可能会写。不过，欢迎你的 PR。

Q: 英文版？
A: 海外用户手机那消息推送工作的一个比一个好，他们多半不需要这玩意。因此，以后会写。

Q: 获取 pushkey 的机器人的代码在哪？
A: [AsenHu/tg-webhook-pushkey](https://github.com/AsenHu/tg-webhook-pushkey)
