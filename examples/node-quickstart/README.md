# Vidu S2 Node Quickstart

A Node service with two browser pages: **Avatar** for interactive characters and **Editing** for real-time video editing. The service keeps your API key on the server and proxies HTTP requests and the control WebSocket. Audio/video flows through Aliyun RTC.

## Run

Requires Node.js 20+, Chrome or Edge, and a microphone. Video mode also requires a camera.

From this directory:

```bash
cp ../../.env.example ../../.env
# Edit ../../.env to set VIDU_API_KEY and VIDU_HOST.
npm install
npm run dev
```

Use `api.vidu.com` for Global or `api.vidu.cn` for China, with an API key from the same region. Open **http://localhost:8787**, choose a page, and allow microphone/camera access when prompted. Click **Hang up** when you're done.

## Avatar

Open `/avatar`, configure the character image, persona, and voice, then choose audio or video mode and click **Create and connect**. Talk through your microphone or send text instructions. Video mode also supports **Optimize persona prompt**.

## Editing

Open `/editing`, choose style transfer, virtual try-on, subject replacement, or background replacement, and select a reference image. Click **Create and connect** to compare the camera feed with the edited result.

You can enter an image URL or upload a local image up to **4 MB**. During a session, use **Apply change** to update the image or scenario, or **Keep current image** to reuse the active reference.

## Configuration

Process environment variables take priority. The service reads the repository root `.env` first, then fills in unset variables from this directory's `.env`.

| Variable | Purpose |
|---|---|
| `VIDU_API_KEY` | Required; accepts `vda_xxx` or `Token vda_xxx` |
| `VIDU_HOST` | `api.vidu.cn` (default) or `api.vidu.com` |
| `NODE_QUICKSTART_PORT` | Local port; defaults to `8787` |
| `VIDU_CALL_MODE` | Avatar mode: `video` (default) or `audio` |
| `VIDU_AVATAR_IMAGE_URI` | Character image URL or base64 data URI |
| `VIDU_AVATAR_PERSONA` | Character persona |
| `VIDU_AVATAR_NAME` / `VIDU_AVATAR_VOICE` | Optional name and voice; each falls back to `Tina` when unset |
| `VIDU_EDITING_IMAGE_URL` | Optional default reference image URL |
| `VIDU_EDITING_TYPE` | `style_transfer` (default), `virtual_tryon`, `subject_replacement`, or `background_replacement` |

## Connection notes

- Sessions use `POST /live/s_avatar/realtime` or `POST /live/s_editing/realtime`. The control WebSocket is proxied through Node.
- Avatar video mode and Editing wait for control initialization before joining RTC. Avatar audio mode can join while initialization is in progress.
- Vidu supplies the RTC credentials; no Aliyun AppKey configuration is needed.
- Editing changes take a few seconds. Success has no application-level acknowledgement; failures appear in the event log.
- The service listens only on the local loopback interface. Restarting Node requires a new session.

For capture or playback issues, check browser permissions, device availability, access to the [Aliyun ARTC SDK](https://g.alicdn.com/apsara-media-box/imp-web-rtc/7.1.9/aliyun-rtc-sdk.js), and the page's event log.

## Checks

```bash
npm test
```

Tests use a local mock upstream without creating billable sessions. Real audio/video testing requires a valid API key and working devices.

See the [Global API docs](https://platform.vidu.com/vidu-stream/doc), [China API docs](https://platform.vidu.cn/vidu-stream/doc), or the [integration skill](../../skills/vidu-s-api/SKILL.md) for protocol details.
