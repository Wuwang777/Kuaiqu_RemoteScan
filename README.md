# 🛵 微信公众号扫车助手

通过微信公众号查询**快趣出行**共享电动车，并自动生成可直接扫码骑车的二维码图片。支持自定义地点管理，**无需区分校区**，全平台通用，一键 Docker 部署。

---

## ✨ 功能特性

- 📍 **自定义地点管理** — 每位用户可自行添加、删除常用地点，数据持久化保存
- 🔍 **实时查询附近车辆** — 查询指定坐标周边电量充足的可用车辆（最多返回 4 辆）
- 📷 **自动生成二维码** — 为每辆车生成扫码骑行链接，标注车辆编号与距离，合并为一张图片发送
- 🌐 **全平台通用** — 基于快趣出行统一 API，只需经纬度即可查询，无需区分学校或区域
- 🐳 **Docker 一键部署** — 开箱即用，无需手动配置运行环境

---

## 🏗️ 工作原理

```
用户发送指令 (微信公众号)
        │
        ▼
   Node.js 服务解析指令
        │
        ├─── add / del / ls / help  → 管理用户自定义地点 (存入 userData.json)
        │
        └─── [数字ID]  → 读取对应经纬度
                │
                ▼
        POST https://api.kvcoogo.com/...queryNearbyCar
                │
                ▼
        过滤出电量充足车辆 (最多4辆)
                │
                ▼
        为每辆车生成二维码 (https://www.kvcoogo.com/ebike?id=xxx)
                │
                ▼
        合并二维码图片 + 标注编号/距离
                │
                ▼
        上传至微信媒体接口 → 回复用户图片消息
```

---

## 🚀 快速部署 (Docker 推荐)

### 1. 克隆项目

```bash
https://github.com/Wuwang777/Kuaiqu_RemoteScan
cd Kuaiqu_RemoteScan
```

### 2. 配置环境变量

复制并编辑 `.env` 文件，填入你的配置：

| 变量名                    | 说明                                          | 是否必填 |
| ------------------------- | --------------------------------------------- | -------- |
| `PORT`                    | 服务监听端口，默认 `80`                       | 否       |
| `WECHAT_TOKEN`            | 微信公众号 Token（后台自定义）                | ✅       |
| `WECHAT_APPID`            | 微信公众号 AppID                              | ✅       |
| `WECHAT_APP_SECRET`       | 微信公众号 AppSecret                          | ✅       |
| `WECHAT_ENCODING_AES_KEY` | 消息加解密密钥（43位）                        | ✅       |
| `API_URL`                 | 快趣出行查车 API 地址（默认已填，一般不用改） | 否       |
| `API_TOKEN`               | 快趣出行 API Token（**实测不校验，随便填**）  | 否       |

> 微信相关参数请在 [微信公众平台](https://developers.weixin.qq.com) → 开发者平台 → 前往控制台 → 我的业务与服务 → 公众号 中获取。

### 3. 启动服务

```bash
docker-compose up -d
```

服务默认运行在 `80` 端口。

### 4. 配置微信公众号服务器

在微信公众平台后台完成以下配置：

1. **服务器地址 (URL)**：填入 `http://你的服务器IP`
2. **Token**：与 `.env` 中的 `WECHAT_TOKEN` 保持一致
3. **消息加解密密钥**：与 `WECHAT_ENCODING_AES_KEY` 保持一致
4. **IP 白名单**：在开发者平台将你的服务器 IP 加入白名单

---

## 💬 用户指令

详细使用说明请参阅 [用户侧使用教程.md](./用户侧使用教程.md)，以下为快速参考：

| 指令     | 格式                       | 说明                   |
| -------- | -------------------------- | ---------------------- |
| 添加地点 | `add [名称] [经度] [纬度]` | 添加一个新的常用地点   |
| 删除地点 | `del [ID]`                 | 按 ID 删除已保存的地点 |
| 查看列表 | `ls`                       | 显示所有已保存的地点   |
| 选择地点 | `[ID]`（如 `1`）           | 查询该地点附近的车辆   |
| 帮助     | `help`                     | 显示帮助信息           |

**示例：**

```
add 学生公寓7栋 116.03523691 28.68901457
ls
1
del 2
```

> 经纬度请精确到小数点后 8 位，可在 [https://jingweidu.bmcx.com](https://jingweidu.bmcx.com) 查询。

---

## 📁 项目结构

```
.
├── server.js              # 主服务逻辑
├── Dockerfile             # Docker 镜像构建文件
├── docker-compose.yml     # Docker Compose 配置
├── package.json           # Node.js 依赖声明
├── .env                   # 环境变量配置（不要提交到 Git）
├── SmileySans-Oblique.ttf # 二维码图片合成用中文字体
├── userData.json          # 用户自定义地点数据（初始为空，通过 Docker bind mount 持久化）
├── qrcodes/               # 二维码图片临时目录（运行时自动生成）
└── 用户侧使用教程.md      # 面向用户的使用说明
```

---

## ⚙️ 技术栈

- **运行时**: Node.js 18 (Alpine)
- **Web 框架**: Express
- **微信接入**: wechat
- **二维码生成**: qrcode
- **图片合成**: canvas + 得意黑字体 (SmileySans)
- **容器化**: Docker + Docker Compose

---

## ⚠️ 注意事项

- `userData.json` 已通过 `docker-compose.yml` 中的 bind mount 持久化到宿主机，**容器重建或重启后用户数据不会丢失**
- 仓库中已预置一个空的 `userData.json`，clone 后无需手动创建，可直接启动服务
- `.env` 文件含敏感信息，已加入 `.gitignore`，**切勿提交到公开仓库**
- 快趣出行 API 实测不校验 `API_TOKEN`，`API_TOKEN` 字段随便填即可
