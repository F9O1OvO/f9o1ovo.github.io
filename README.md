# F9O1OvO 的博客

基于 Jekyll + GitHub Pages，地址：https://f9o1ovo.github.io

## 写文章

在 `_posts/` 下新建 `YYYY-MM-DD-名字.md`，头部格式：

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

## 文章背景音乐

- 音乐文件放在 `music/` 目录，在文章头部的 `music` 里按顺序列出路径（相对网站根目录，也可以写 `https://` 外链）。
- 打开文章后右下角会出现播放器，按列表顺序循环播放；只有一首时单曲循环。
- 不写 `music` 或者列表为空，就不显示播放器。
- 浏览器默认禁止带声音的自动播放，所以通常要在页面上点一下之后才开始播放。

## 目录

| 路径 | 说明 |
| --- | --- |
| `_posts/` | 文章 |
| `_drafts/` | 草稿，不会发布（本地 `jekyll serve --drafts` 可预览） |
| `img-post/` | 文章配图 |
| `music/` | 文章背景音乐 |
| `harmonica/` | 口琴小工具 |
| `_layouts/`, `_includes/` | 页面模板 |
| `less/` → `css/` | 样式源码与编译产物（`grunt` 编译） |

## 致谢

主题来自 [BY](https://github.com/qiubaiying/qiubaiying.github.io)，其前身是 [Hux](https://github.com/Huxpro/huxpro.github.io)。遵循 MIT 许可证，见 [LICENSE](LICENSE)。
