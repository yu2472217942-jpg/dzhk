# 拾光祝福 · 生日祝福制作台

把姓名、生日密码、照片、背景音乐和录音，做成一份可以在手机 / 平板 / 电脑上打开的生日祝福网页。做好之后会得到**分享链接 + 二维码**，微信 / QQ 扫码或点链接即可打开，输入生日密码解锁。

> 这是一个**可以自己部署的完整网页程序**，不依赖任何第三方云服务。源代码和素材都在这个文件夹里。

---

## 一、一分钟上手（Windows）

1. 把整个 `birthday-studio` 文件夹解压到硬盘上（不要在压缩包里直接双击）。
2. 双击 **`启动.bat`**。
3. 浏览器会自动打开制作台。启动窗口里会显示：

   ```
   制作台： http://127.0.0.1:8787/studio
   管理密码：XXXXXXXX
   ```

   如果浏览器没有自动打开，复制这个地址到浏览器即可；管理密码也会写在 `config.json` 里。

4. 填写收件人、送祝福的人、**生日密码**（4–8 位数字，例如 `0707`）、祝福语。
5. 上传照片（最多 9 张）、背景音乐（MP3）、录音（MP3 / M4A / WAV，可选）。
6. 点 **「生成祝福链接」**，得到链接和二维码。
7. 关闭启动窗口即可停止服务；下次再双击 `启动.bat`，之前做的祝福都还在。

> 没有安装 Node.js 也能用：文件夹里自带 `runtime\node.exe`。如果系统提示缺少运行时，请确认解压完整。

---

## 二、功能

- **姓名 / 生日密码**：收件人、送祝福的人、4–8 位生日密码、密码提示。
- **照片墙**：最多 9 张，支持 JPG / PNG / GIF / WebP，手机原图会自动压缩；每张可配一句话。
- **背景音乐**：内置八音盒（自动演奏轻柔的《生日快乐》，不需要上传），也可以上传自己的 MP3。
- **录音**：支持 MP3 / M4A / WAV；没有录音时页面会自动隐藏录音区。
- **主题**：樱粉 / 星夜 / 薄荷 / 落日；字体：默认 / 宋体 / 楷体 / 圆体。
- **分享**：专属链接 + 二维码，可下载二维码 PNG；链接可复制。
- **修改**：做好的祝福可以随时回来改，**链接和二维码不变**。
- **数据**：全部保存在 `data/blessings/<id>/`，直接复制 `data` 文件夹即可备份/迁移。
- **适配**：手机、平板、电脑自适应；微信 / QQ 内置浏览器可直接打开。
- **密码校验在服务端**：页面不会把生日密码明文发给访客；照片/录音使用随机文件名。

---

## 三、分享给 TA

### 方式 A：同一个 Wi-Fi（最快，适合当面/在家）

生成结果里选择 **「局域网 · WLAN」** 地址，手机连同一个 Wi-Fi，用微信/QQ 扫二维码即可打开。

> 注意：`127.0.0.1` / `localhost` 只能在本机打开，不要用这个地址生成二维码。制作台会自动优先选局域网地址。

### 方式 B：异地 / 发给外地朋友（需要公网地址）

链接要让外地朋友打开，必须把这个程序放到一台**公网可访问的服务器**上，或者用内网穿透。部署后把 `PUBLIC_BASE_URL` 设置成你的公网地址，制作台生成的链接和二维码就会自动使用公网地址。

#### 1. 有云服务器 / 域名（推荐）

把整个文件夹上传到服务器，安装 Node.js 18+，然后：

```bash
cd birthday-studio
PUBLIC_BASE_URL=https://birthday.example.com node server.js
```

用 Nginx 反向代理并配置 HTTPS：

```nginx
server {
    listen 443 ssl http2;
    server_name birthday.example.com;

    ssl_certificate     /path/to/fullchain.pem;
    ssl_certificate_key /path/to/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

- 微信 / QQ 对 HTTPS 更友好，建议一定上 HTTPS。
- 不要把 8787 端口直接裸奔到公网；用 Nginx + HTTPS 包一层。
- 如果改过端口，记得同步改 `config.json` 里的 `port`。

#### 2. Docker

```bash
docker build -t shiguang-blessing .
docker run -d --name blessing \
  -p 8787:8787 \
  -v "$(pwd)/data:/app/data" \
  -e PUBLIC_BASE_URL=https://birthday.example.com \
  -e ADMIN_KEY=你的管理密码 \
  shiguang-blessing
```

- `-v` 挂载 `data`，重建容器不丢祝福。
- 不传 `ADMIN_KEY` 时，容器日志里会打印随机生成的管理密码。
- 前面同样建议放 Nginx / Caddy 处理 HTTPS。

#### 3. Render / Railway / Zeabur 等 Node 托管

- 新建 Node 服务，启动命令：`node server.js`。
- 环境变量：`PUBLIC_BASE_URL=https://你的域名`、`ADMIN_KEY=你的管理密码`。
- 挂载一个持久化磁盘到 `/app/data`（否则重新部署会丢数据）。
- 平台通常会自动分配 HTTPS 域名；把这个域名填到 `PUBLIC_BASE_URL`。

#### 4. 内网穿透（了解即可）

如果你只是临时给外地朋友看，可以用 Cloudflare Tunnel、frp、ngrok 等把 `http://127.0.0.1:8787` 映射成一个公网地址，然后把该地址填到 `PUBLIC_BASE_URL`。这类服务在国内的可用性/速度不稳定，不建议作为长期方案。

### 微信 / QQ 打开提示

- 页面不依赖任何国外 CDN、Google Fonts 或第三方脚本，微信 / QQ 内置浏览器可以直接运行。
- 背景音乐可能被浏览器拦截自动播放：页面会提示「轻触屏幕 · 开启音乐」，点一下即可。
- 微信里分享卡片使用页面里的 `og:title` / `og:description` / `og:image`；不同版本微信的展示效果可能略有差异。
- 如果对方打开是空白/旧内容，先让 TA 下拉刷新，或在链接后加 `?v=2` 强制刷新（不影响密码）。

---

## 四、数据、备份与安全

```
birthday-studio/
  server.js              服务端（零依赖）
  config.json            自动生成：端口、管理密码、cookie 密钥、公网地址
  data/blessings/<id>/   每份祝福的 blessing.json + 照片 + 音乐 + 录音
  public/                制作台与分享页前端
  runtime/node.exe       Windows 便携运行时（如果打包时包含）
```

- **备份**：直接复制 `data` 文件夹；恢复时放回原位置即可。
- **迁移**：复制整个 `birthday-studio` 文件夹（含 `data` 和 `config.json`）。
- **管理密码**：在 `config.json` 的 `adminKey`，或启动窗口里查看；也可以设置环境变量 `ADMIN_KEY` 覆盖。
- **公网地址**：`config.json` 的 `publicBaseUrl`，或环境变量 `PUBLIC_BASE_URL`。
- **安全说明**：生日密码只有 4–8 位数字，本质上是「防误入」而不是高强度加密；照片/录音的 URL 是随机不可猜的，但拿到直链的人仍可访问。请不要放过于私密的内容。
- 公开部署时，建议设置自己的 `ADMIN_KEY`，不要用默认随机值长期暴露在日志里。

---

## 五、常见问题

**Q：双击 `启动.bat` 一闪而过？**
A：右键「以管理员身份运行」不一定需要；先在文件夹里打开 PowerShell，运行 `runtime\node.exe server.js` 看报错。最常见的原因是文件夹没解压完整，或者端口 8787 被占用。

**Q：端口被占用？**
A：编辑 `config.json` 里的 `"port": 8787` 改成别的端口，或在启动前设置环境变量 `PORT=9000`。

**Q：二维码扫出来是 `127.0.0.1`？**
A：在生成结果里把「链接使用的地址」切换成「局域网」或「公网地址」，二维码会跟着变。`127.0.0.1` 只在本机有效。

**Q：手机扫码打不开？**
A：确认手机和电脑在同一个 Wi-Fi；确认电脑防火墙允许 Node.js 访问专用网络；确认地址是 `192.168.x.x` 而不是 `127.0.0.1`。

**Q：照片/录音在微信里不显示？**
A：优先用 JPG / PNG 和 MP3；单张图片建议小于 10MB，音频小于 30MB；公网部署请使用 HTTPS。GIF 会保留动图。

**Q：录音怎么来？**
A：用手机录音机录好后导出/转成 MP3，再上传；微信语音需要先「收藏 → 转存/导出」为音频文件。也可以上传 M4A / WAV。

**Q：音乐没有自动响？**
A：浏览器/微信禁止无交互自动播放。点一下页面，或点右上角音乐按钮即可。

**Q：修改祝福后链接会变吗？**
A：不会。每份祝福的 `id` 不变，链接和二维码都不变；改完保存即可。

**Q：能改成静态网页放到 GitHub Pages 吗？**
A：当前版本需要 Node 服务端做密码校验和媒体存储，不能直接静态托管。可以用上面的 Node 托管 / Docker / 云服务器方案。

---

## 六、开发与自定义

- 服务端：`server.js`，只用 Node 内置模块，无 npm 依赖。
- 制作台：`public/studio.html` + `studio.css` + `studio.js`。
- 分享页：`public/share.html` + `share.css` + `share.js`。
- 烟花：`public/fireworks.js`。
- 二维码：`public/qrcode.min.js`（qrcodejs，MIT）。
- 主题/字体：修改 `share.css` 顶部的 `body[data-theme=...]` 变量即可。
- 默认祝福文案：`public/share.js` 里的 `DEFAULT_CARDS`。
- 内置音乐盒旋律：`public/share.js` 里的 `MusicBox`。

启动：

```bash
node server.js          # 不自动开浏览器
node server.js --open   # 自动打开制作台
```

环境变量：

| 变量 | 说明 |
| --- | --- |
| `PORT` | 端口，默认 8787 |
| `ADMIN_KEY` | 管理密码，覆盖 config.json |
| `APP_SECRET` | cookie 签名密钥，覆盖 config.json |
| `PUBLIC_BASE_URL` | 公网地址，例如 `https://birthday.example.com` |

---

## 七、说明

- 内置背景音乐是用 Web Audio 实时合成的八音盒旋律，不包含任何版权音频文件。
- 用户上传的照片、音乐、录音由使用者自行负责版权与隐私。
- 页面视觉与交互参考了常见的「生日祝福 / 数字糖果」网页套路，代码为重新实现，可自由修改自用。
