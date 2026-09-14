# Vidu S2

**让角色回应你，让画面随你改变。**

用 **Vidu S2** 构建实时互动角色，为摄像头画面赋予新的风格、服装、主体与背景。从一次对话、一张参考图开始，把实时生成带进你的产品。

[**在线体验 ↗**](https://www.vidu.cn/vidu-stream) · [**本地运行**](#快速开始) · [API 文档](https://platform.vidu.cn/vidu-stream/doc) · [Agent Skill](skills/vidu-s-api/SKILL.md)

[English](README.md) / **中文**

---

## 两种体验，从这里开始

| | **Vidu S2-Avatar** | **Vidu S2-Editing** |
|---|---|---|
| **你来提供** | 一张角色图片与人设 | 摄像头画面与参考图 |
| **实时发生** | 角色与你语音互动，响应文字指令，展现动作与双向感知 | 视频流中的风格、服装、主体或背景随参考图改变 |
| **可以构建** | AI 陪伴、虚拟角色、客服、教育互动 | 直播视觉效果、虚拟试穿、角色与环境替换 |
| **从示例开始** | [Avatar →](examples/node-quickstart/README.md#avatar) | [Editing →](examples/node-quickstart/README.md#editing) |

### Avatar · 从一张图片，到一场对话

为角色设定人设与音色，打开麦克风，开始交流。使用语音或视频模式通话，也可以发送文字指令，引导角色接下来的回应。视频模式支持**人设提示词优化**，帮助你完善角色设定。

S2-Avatar 还支持通过参考图引导物品交互、换装和背景切换；接入方式见[官方 API 文档](https://platform.vidu.cn/vidu-stream/doc)。

### Editing · 实时改变画面的风格、服装、主体和背景

Node 示例为四种编辑场景分别提供了参考图，选择场景即可体验。你也可以填写图片 URL 或上传本地图片，使用自己的素材。

| 风格迁移 | 虚拟试穿 | 主体替换 | 背景替换 |
|:---:|:---:|:---:|:---:|
| 给画面换一种视觉风格 | 用参考服装尝试新造型 | 把画面主体换成参考角色 | 把直播带到另一个环境 |
| 绘画风格参考图 | 蓝色衬衫参考图 | Tina 人像参考图 | 阳光森林参考图 |

持续推流时也能更换参考图与场景：选择新的示例，点击**应用更改**，观察画面变化。

## 快速开始

**准备好：** Node.js 20+、Chrome 或 Edge、API key 和麦克风。视频模式还需要摄像头。

### 1. 获取密钥

前往[中国站](https://platform.vidu.cn/api-keys)或[全球站](https://platform.vidu.com/api-keys)创建 API key。在仓库根目录执行：

```bash
cp .env.example .env
```

编辑 `.env`，填入密钥和对应地区的域名：

```dotenv
VIDU_API_KEY=vda_your_api_key_here
VIDU_HOST=api.vidu.cn
```

全球站使用 `api.vidu.com`，密钥与域名须属于同一地区。

### 2. 启动示例

```bash
cd examples/node-quickstart
npm install
npm run dev
```

### 3. 开始体验

打开 **http://localhost:8787**，选择 **Avatar** 或 **Editing**，点击**创建并连接**。按浏览器提示允许使用麦克风／摄像头，体验结束后点击**挂断**。

两个页面均支持中英文切换；Editing 已预置示例图。端口可通过 `NODE_QUICKSTART_PORT` 修改。

**继续接入 →** [配置、自定义角色与运行中控制](examples/node-quickstart/README.md)

### 示例如何连接 Vidu？

Node 服务创建会话、代理 HTTP 与控制 WebSocket，API key 保留在服务端。浏览器使用 Vidu 返回的凭证加入 Aliyun RTC，发布本地音视频，并接收实时生成结果。

示例提供 Avatar 与 Editing 两个独立入口，便于从对应场景开始阅读和集成。

## 让你的 Agent 也能接入

仓库提供 [`vidu-s-api` skill](skills/vidu-s-api/SKILL.md)，覆盖 S2 Avatar 与 Editing 的会话创建、RTC 接入、WebSocket 初始化、运行中控制和结束清理。

将 [`skills/vidu-s-api`](skills/vidu-s-api) 安装到所用 Agent 的 skills 目录，加载 `SKILL.md`，即可围绕具体需求开始集成，例如：

> 使用 vidu-s-api skill，帮我接入 Vidu S2-Editing，实现摄像头画面的实时背景替换。

## 体验、文档与密钥

| | 中国站 | 全球站 |
|---|---|---|
| **在线体验** | [打开 Vidu S ↗](https://www.vidu.cn/vidu-stream) | [打开 Vidu S ↗](https://www.vidu.com/vidu-stream) |
| **API 文档** | [阅读文档](https://platform.vidu.cn/vidu-stream/doc) | [阅读文档](https://platform.vidu.com/vidu-stream/doc) |
| **API key** | [获取密钥](https://platform.vidu.cn/api-keys) | [获取密钥](https://platform.vidu.com/api-keys) |
| **API 域名** | `api.vidu.cn` | `api.vidu.com` |

可用能力、参数、计费与服务限制以官方 API 文档为准。文档也提供 Avatar 组件版与离线版的接入说明。

---

**一张图开启对话，一帧画面开始改变。**

[运行你的第一个 S2 示例 ↑](#快速开始)
