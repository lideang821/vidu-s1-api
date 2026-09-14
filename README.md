# Vidu S2

**Bring characters to life. Transform video in real time.**

Build interactive characters with **Vidu S2**, or change the style, clothing, subject, and background of a live camera feed. Start with a conversation or a reference image, and bring real-time generation to your product.

[**Try it online ↗**](https://www.vidu.com/vidu-stream) · [**Run locally**](#quickstart) · [API docs](https://platform.vidu.com/vidu-stream/doc) · [Agent Skill](skills/vidu-s-api/SKILL.md)

**English** / [中文](README.zh-CN.md)

---

## Two ways to get started

| | **Vidu S2-Avatar** | **Vidu S2-Editing** |
|---|---|---|
| **Start with** | A character image and persona | A camera feed and reference image |
| **What happens live** | The character talks with you, follows text instructions, performs actions, and responds to what it sees and hears | The stream's style, clothing, subject, or background changes based on your reference image |
| **Build for** | AI companionship, virtual characters, customer support, and education | Livestream effects, virtual try-on, and character or environment replacement |
| **Try the example** | [Avatar →](examples/node-quickstart/README.md#avatar) | [Editing →](examples/node-quickstart/README.md#editing) |

### Avatar · From an image to a conversation

Give your character a persona and voice, turn on your microphone, and start talking. Choose an audio or video call, or send text instructions to guide the character's next response. Video mode also supports **persona prompt optimization** to help refine the character's persona.

S2-Avatar also supports reference images for object interactions, outfit changes, and background changes. See the [official API docs](https://platform.vidu.com/vidu-stream/doc) for integration details.

### Editing · Change the style, clothing, subject, and background in real time

The Node example includes a reference image for each of the four editing scenarios, so you can choose a scenario and try it right away. You can also enter an image URL or upload a local image to use your own material.

| Style transfer | Virtual try-on | Subject replacement | Background replacement |
|:---:|:---:|:---:|:---:|
| Give your stream a different visual style | Try a new look with a reference outfit | Replace the subject with a reference character | Move your stream to a different setting |
| Painting reference | Blue shirt reference | Tina portrait reference | Sunlit forest reference |

You can change the reference image and scenario while streaming. Select a new sample, click **Apply change**, and watch the result.

## Quickstart

**You'll need:** Node.js 20+, Chrome or Edge, an API key, and a microphone. Video mode also requires a camera.

### 1. Get an API key

Create an API key on the [Global](https://platform.vidu.com/api-keys) or [China](https://platform.vidu.cn/api-keys) platform. From the repository root, run:

```bash
cp .env.example .env
```

Edit `.env` with your key and the API host for your region:

```dotenv
VIDU_API_KEY=vda_your_api_key_here
VIDU_HOST=api.vidu.com
```

For China, use `api.vidu.cn`. Your key and API host must belong to the same region.

### 2. Start the example

```bash
cd examples/node-quickstart
npm install
npm run dev
```

### 3. Try it out

Open **http://localhost:8787**, choose **Avatar** or **Editing**, and click **Create and connect**. Allow microphone/camera access when prompted, and click **Hang up** when you're done.

Both pages support English and Chinese. Editing includes sample images to get you started. Set `NODE_QUICKSTART_PORT` to use a different port.

**Keep building →** [Configuration, custom characters, and controls during a session](examples/node-quickstart/README.md)

### How does the example connect to Vidu?

The Node service creates sessions and proxies HTTP requests and the control WebSocket, keeping your API key on the server. The browser uses credentials returned by Vidu to join Aliyun RTC, publish local audio/video, and receive the generated output in real time.

Avatar and Editing have separate pages, so you can start with the experience you want to integrate.

## Build with your agent

The included [`vidu-s-api` skill](skills/vidu-s-api/SKILL.md) covers session creation, RTC integration, WebSocket initialization, controls during a session, and cleanup for both S2 Avatar and Editing.

Install [`skills/vidu-s-api`](skills/vidu-s-api) in your agent's skills directory and load `SKILL.md`. Then describe what you want to build, for example:

> Use the vidu-s-api skill to integrate Vidu S2-Editing for real-time background replacement from a webcam.

## Demos, docs, and API keys

| | Global | China |
|---|---|---|
| **Online demo** | [Open Vidu S ↗](https://www.vidu.com/vidu-stream) | [Open Vidu S ↗](https://www.vidu.cn/vidu-stream) |
| **API docs** | [Read the docs](https://platform.vidu.com/vidu-stream/doc) | [Read the docs](https://platform.vidu.cn/vidu-stream/doc) |
| **API key** | [Get a key](https://platform.vidu.com/api-keys) | [Get a key](https://platform.vidu.cn/api-keys) |
| **API host** | `api.vidu.com` | `api.vidu.cn` |

The official API docs are the source of truth for available capabilities, parameters, pricing, and service limits. They also cover Avatar component and offline integrations.

---

**Start a conversation. Transform a stream.**

[Run your first S2 example ↑](#quickstart)
