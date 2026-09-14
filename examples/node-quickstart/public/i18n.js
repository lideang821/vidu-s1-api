const strings = {
  intro: ['Two real-time experiences. Choose one to get started.', '两种实时体验，选择一个开始。'],
  avatarIntro: ['Bring a character image to life. Talk through your microphone or send text instructions.', '让一张角色图片动起来，通过麦克风对话或发送文字指令。'],
  editingIntro: ['Edit your camera stream in real time. Change the style, outfit, subject, or background with a reference image.', '实时编辑摄像头画面，用参考图改变风格、服装、主体或背景。'],
  openAvatar: ['Open Avatar →', '体验 Avatar →'], openEditing: ['Open Editing →', '体验 Editing →'],
  callMode: ['Call mode', '通话模式'], videoMode: ['Video', '视频'], audioMode: ['Audio', '语音'],
  avatarImage: ['Avatar image URI', '角色图片 URI'], persona: ['Persona', '人设'], name: ['Name', '名称'], voice: ['Voice', '音色'],
  enhance: ['Optimize persona prompt (video only)', '人设提示词优化（仅视频）'],
  referenceImage: ['Reference image', '参考图'], newImage: ['New reference image (optional)', '新参考图（可选）'],
  keepImage: ['Keep current image', '不换图'], imageUrl: ['Image URL', '图片 URL'], localImage: ['Local image', '本地选图'],
  sampleImage: ['Sample image', '示例图片'],
  sampleStyle: ['Sample: painting style', '示例：绘画风格'],
  sampleOutfit: ['Sample: blue shirt', '示例：蓝色衬衫'],
  sampleSubject: ['Sample: Tina portrait', '示例：Tina 人像'],
  sampleBackground: ['Sample: sunlit forest', '示例：阳光森林'],
  editingType: ['Editing scenario', '编辑场景'], styleTransfer: ['Style transfer', '风格迁移'], virtualTryon: ['Virtual try-on', '虚拟试穿'],
  subjectReplacement: ['Subject replacement', '主体替换'], backgroundReplacement: ['Background replacement', '背景替换'],
  textTitle: ['Text instructions', '文字指令'], message: ['Message', '消息'], sendText: ['Send text', '发送文本'],
  switchTitle: ['Change image / scenario', '更换参考图 / 场景'], applyEdit: ['Apply change', '应用更改'],
  switchHint: ['The image changes after a few seconds. A successful switch has no acknowledgement.', '画面将在几秒后切换，切换成功没有回执。'],
  checking: ['Checking config', '检查配置'], idle: ['Idle', '未连接'], ready: ['API key configured', 'API key 已配置'], missingKey: ['API key missing', '未配置 API key'],
  createSession: ['Create session', '创建会话'], start: ['Create and connect', '创建并连接'], hangup: ['Hang up', '挂断'],
  localPreview: ['Local preview', '本地预览'], editedResult: ['Edited result', '编辑结果'], digitalCharacter: ['Digital character', '数字人'],
  sessionDetails: ['Session / RTC details', '会话 / RTC 信息'], eventLog: ['Event log', '事件日志'], clearLog: ['Clear log', '清空日志'],
  creating: ['Creating session', '正在创建会话'], connecting: ['Connecting control channel', '正在连接控制通道'],
  warmingUp: ['Waiting for rendering service', '等待渲染服务就绪'], joining: ['Joining RTC', '正在加入 RTC'],
  live: ['Live', '已连接'], ending: ['Ending session', '正在结束会话'], ended: ['Ended', '已结束'], failed: ['Connection failed', '连接失败'],
  keyHint: ['Set VIDU_API_KEY in .env and restart the server.', '请在 .env 配置 VIDU_API_KEY，然后重启服务。'],
  imageRequired: ['Provide a reference image.', '请提供参考图。'], imageLarge: ['Local images must be at most 4 MB. Use a smaller file or an image URL.', '本地图片不能超过 4 MB，请缩小图片或使用图片 URL。'],
  imageInvalid: ['Choose an image file.', '请选择图片文件。'], imageReading: ['Wait for the image to finish loading.', '请等待图片读取完成。'],
  sdkMissing: ['AliRTC SDK did not load. Check access to the CDN.', 'AliRTC SDK 加载失败，请检查 CDN 连接。'],
  unsupported: ['This browser does not support AliRTC. Try Chrome or Edge.', '此浏览器不支持 AliRTC，请使用 Chrome 或 Edge。'],
  textSent: ['Text sent. The character replies through RTC.', '文本已发送，数字人将通过 RTC 回复。'],
  switchSent: ['Change sent. Watch the edited result; success has no acknowledgement.', '更改已发送，请观察编辑结果，成功没有回执。'],
  playback: ['Click play on the remote video to enable playback.', '请点击远端视频的播放按钮。'],
  closed: ['Control connection closed.', '控制连接已关闭。'], expired: ['RTC credentials expired. Create a new session.', 'RTC 凭证已过期，请重新创建会话。']
};

let language = 'en';
try { language = localStorage.getItem('vidu-s-language') === 'zh' ? 'zh' : 'en'; } catch {}
export function t(key) { return strings[key]?.[language === 'zh' ? 1 : 0] || key; }
export function label(element, key) { element.dataset.i18n = key; element.textContent = t(key); }
function applyLanguage() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll('[data-i18n]').forEach(element => label(element, element.dataset.i18n));
}
const selector = document.querySelector('#language');
selector.value = language;
selector.addEventListener('change', () => {
  language = selector.value;
  try { localStorage.setItem('vidu-s-language', language); } catch {}
  applyLanguage();
});
applyLanguage();
