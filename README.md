# F9O1OvO 的博客

网站：https://f9o1ovo.github.io  
仓库：https://github.com/F9O1OvO/f9o1ovo.github.io

改完推到 `main` 后，GitHub Pages 会自动发布。这个 README 不会出现在网站上。

## 管理入口

| 要管什么 | 地址 |
| --- | --- |
| 博客前台 | https://f9o1ovo.github.io |
| 评论管理（删评论、看用户） | https://walinetest-f9o1ovo.vercel.app/ui |
| 评论服务是否在线 | https://walinetest-f9o1ovo.vercel.app |
| Vercel 项目 | https://vercel.com/f9o1ovo/walinetest |
| 评论服务的环境变量（数据库密钥） | https://vercel.com/f9o1ovo/walinetest/settings/environment-variables |
| 评论服务的访问保护 | https://vercel.com/f9o1ovo/walinetest/settings/deployment-protection |
| GitHub Pages 发布设置 | https://github.com/F9O1OvO/f9o1ovo.github.io/settings/pages |

评论管理后台要登录。第一个注册的账号是管理员。读者在文章下面评论不用登录，昵称不填会显示为“匿名”。

Vercel 的 **Deployment Protection** 必须保持关闭（`Require Log In` 是灰的）。打开之后，普通读者加载不了评论区。数据库密钥只放在 Vercel 环境变量里，不要写进仓库或文章。

## 写文章

在 `_posts/` 新建 `YYYY-MM-DD-名字.md`：

```yaml
---
layout:     post
title:      标题
subtitle:   副标题
date:       2026-09-24
author:     F9O1
header-img: img-post/xxx.jpg
catalog: false
tags:
    - 标签
music:
    - music/歌名.mp3
    - { title: 自定义显示名, src: music/另一首.mp3 }
---
```

正文用 Markdown：`# 标题`、`> 引用`、`[文字](链接)`、`![说明]({{ site.baseurl }}/img-post/图.jpg)`。

- 配图放 `img-post/`，封面写在 `header-img`。
- 不想发布的文章放 `_drafts/`，不要放在网站根目录，否则会进导航栏。
- 标签页是 `/tags/`，导航名来自 `1-tags.html` 的 `title`。
- 关于页是 `/about/`，内容在 `2-about.html`。

## 背景音乐

音乐文件放 `music/`，在文章头部的 `music` 里按顺序写路径。不写就不显示播放器。

- 用 `.mp3`。网易云 `.ncm`、QQ 音乐加密格式要先转成 mp3。
- 建议 128kbps，一首大约几 MB。GitHub 单文件上限 100MB。
- 文件名不要带 `#`、`?`、`%`。
- 只有一首时单曲循环，多首按列表循环。
- 初始音量 `0.3`。读者调过的音量会记在浏览器里。
- 浏览器不允许自动出声，页面上点一下才会开始放。

播放器代码在 `_includes/music-player.html`。

## 评论

服务端地址在 `_config.yml`：

```yaml
waline:
  serverURL: "https://walinetest-f9o1ovo.vercel.app"
```

留空则文章下不显示评论区。样式和中文文案在 `_includes/comments.html`。

- 管理评论、删除评论：打开上面的 `/ui`。
- 想让评论审核后才公开：在 Vercel 环境变量加 `COMMENT_AUDIT=true`，然后重新部署。
- 评论数据在云数据库里，不在这个仓库里。

## 站点设置

日常改 `_config.yml`：

| 配置 | 作用 |
| --- | --- |
| `title` / `description` | 站名、首页描述 |
| `sidebar-avatar` | 侧栏头像，现在是 `/img/avatar.jpg` |
| `sidebar-about-description` | 侧栏简介 |
| `github_username` | 有值时页脚和侧栏出现 GitHub 图标；删掉这一行就没有 |
| `email` | 侧栏邮箱 |
| `waline.serverURL` | 评论服务地址 |
| `featured-tags` | 是否显示标签 |

外观在 `css/site.css` 和 `js/site.js`：中文字号、首页卡片、暗色模式、阅读进度、回到顶部、图片点击放大。暗色模式由读者自己在导航栏切换，选择记在各自浏览器里。

## 目录

| 路径 | 说明 |
| --- | --- |
| `_posts/` | 已发布文章 |
| `_drafts/` | 草稿，不会发布 |
| `img-post/` | 文章配图 |
| `music/` | 背景音乐 |
| `harmonica/` | 口琴小工具，导航里有入口 |
| `_config.yml` | 站点配置 |
| `_includes/comments.html` | 评论区 |
| `_includes/music-player.html` | 音乐播放器 |
| `css/site.css`、`js/site.js` | 自己加的样式和交互 |
| `js/waline/` | Waline 前端，本地托管 |
| `_layouts/`、`_includes/` | 页面模板 |
| `less/` | 原主题样式源码，改完要用 `grunt` 编译到 `css/` |

## 致谢

主题来自 [BY](https://github.com/qiubaiying/qiubaiying.github.io)，其前身是 [Hux](https://github.com/Huxpro/huxpro.github.io)。遵循 MIT 许可证，见 [LICENSE](LICENSE)。
