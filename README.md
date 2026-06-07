<div align="center">



<img src="docs/assets/readme/logo.jpg" alt="NailMirror" width="140" />



# NailMirror



**美甲 AI 试戴 · 智能款式运营 · 微信小程序**



*上传手照，秒看效果。平台精选、商家原创、小红书全网热款，一站试戴。*



<br/>



[![Version](https://img.shields.io/badge/version-1.2.21-7c3aed?style=for-the-badge)](https://github.com/Icarus-2001/nailmirror-v1.0.3-20260527)

[![Platform](https://img.shields.io/badge/平台-微信小程序-07c160?style=for-the-badge&logo=wechat&logoColor=white)](https://developers.weixin.qq.com/miniprogram/dev/framework/)

[![Cloud](https://img.shields.io/badge/后端-微信云开发-1677ff?style=for-the-badge)](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)

[![AI](https://img.shields.io/badge/AI-DashScope_万相_2.7-ff6a00?style=for-the-badge)](https://help.aliyun.com/zh/model-studio/)



<br/>



[**GitHub 仓库**](https://github.com/Icarus-2001/nailmirror-v1.0.3-20260527) · [**试戴效果**](#试戴效果) · [**产品演示**](#产品演示) · [**快速上手**](#快速上手) · [**文档中心**](./docs/README.md)



</div>



---



## 这是什么



**NailMirror** 是一款面向 C 端用户与 B 端美甲商家的微信小程序：把手部照片与款式参考图融合，生成逼真的试戴效果；同时提供款式库、热度榜单、商家运营等完整链路。



| 面向 | 能力 |

|------|------|

| **消费者** | AI 云试戴 · 25+ 真实款式 · 小红书全网热款 · 筛选排序 · 收藏与高清出片 |

| **商家** | 身份认证 · 款式库管理（查看 / 上传 / 下架）· 店铺信息配置 |

| **团队** | 微信云开发统一后端 · 封闭标签词表 · 可测可部署的 MVP 架构 |



<div align="center">



<strong>体验 NailMirror</strong><br/><br/>

<img src="docs/assets/readme/miniprogram-qr.svg" alt="微信小程序体验版二维码（待补充）" width="200"/><br/>

<sub>扫码体验 · 二维码待补充</sub>



</div>



---



## 试戴效果



> 参考款式 + 真实手照 → AI 合成试戴。只改指甲，保留手部与背景。



<div align="center">



<table>

<tr>

<td align="center" width="33%">

<strong>参考款式</strong><br/><br/>

<img src="docs/assets/readme/tryon-reference.jpg" alt="参考款式" width="100%"/><br/>

<sub>小红书热款 · 梦幻星河</sub>

</td>

<td align="center" width="33%">

<strong>试戴前</strong><br/><br/>

<img src="docs/assets/readme/tryon-before.jpg" alt="试戴前" width="100%"/><br/>

<sub>用户真实手照</sub>

</td>

<td align="center" width="33%">

<strong>试戴后</strong><br/><br/>

<img src="docs/assets/readme/tryon-after.jpg" alt="试戴后" width="100%"/><br/>

<sub>AI 合成输出</sub>

</td>

</tr>

</table>



</div>



---



## 核心亮点



<table>

<tr>

<td width="25%" align="center"><h3>AI 云试戴</h3>四步完成：选甲型 → 选款式 → 选手照 → 预览评分<br/>万相 2.7 Pro · 评测手照 / 相册 / Mock 调试</td>

<td width="25%" align="center"><h3>丰富款式库</h3>平台特供 · 商家上传 · 全网热款<br/>八大色系筛选 · 来源标签 · 热度排序</td>

<td width="25%" align="center"><h3>双轨热榜</h3>站内平台热度 + 站外小红书 TOP10<br/>「全网热款」独立徽章与封面</td>

<td width="25%" align="center"><h3>商家运营</h3>手机号核验 · 款式库三 Tab 管理<br/>MD5/pHash 去重 · VLM 美甲图门禁</td>

</tr>

</table>



---



## 产品演示



> 以下为真机录屏，可直接在页面内播放。



### 款式库展示



C 端款式库：筛选抽屉、来源三标签（平台 / 商家 / 全网热款）、热度与时间排序、卡片浏览。



<div align="center">

<video controls width="720" src="https://github.com/Icarus-2001/nailmirror-v1.0.3-20260527/raw/docs/readme-beautify/docs/assets/readme/videos/style-library.mp4"></video>

</div>



<div align="center">

<img src="docs/assets/readme/style-sample-1.jpg" width="32%" alt="款式样例1"/>

<img src="docs/assets/readme/style-sample-2.jpg" width="32%" alt="款式样例2"/>

</div>



### 试戴流程



从首页进入试戴：选甲型 → 选款式（支持相册上传参考图）→ 选手照 → AI 合成 → 预览与评分。



<div align="center">

<video controls width="720" src="https://github.com/Icarus-2001/nailmirror-v1.0.3-20260527/raw/docs/readme-beautify/docs/assets/readme/videos/tryon-flow.mp4"></video>

</div>



### 站内 · 站外热度榜单



热度榜单页：平台款式热度排行 + 小红书「全网热款」TOP10，双榜并列展示。



<div align="center">

<video controls width="720" src="https://github.com/Icarus-2001/nailmirror-v1.0.3-20260527/raw/docs/readme-beautify/docs/assets/readme/videos/hot-rank.mp4"></video>

</div>



### 商家 · 款式库管理



商家中心 → 款式库管理三 Tab：查看款式 / 上传款式 / 下架与删除。



<div align="center">

<video controls width="720" src="https://github.com/Icarus-2001/nailmirror-v1.0.3-20260527/raw/docs/readme-beautify/docs/assets/readme/videos/merchant-style-library.mp4"></video>

</div>



---



## 项目结构



```

nailmirror-v1.6-20260519-r3/

├── README.md                 ← 你正在阅读

├── docs/                     ← 文档中心

│   ├── assets/readme/        ← README 配图与演示视频

│   ├── SETUP_USER.md         ← 部署与试戴配置（必读）

│   └── CHANGELOG.md          ← 版本变更记录

└── nailmirror/src/           ← 小程序根目录（微信开发者工具打开此目录）

    ├── app.js / app.json

    ├── config/               ← 云环境、功能开关、标签词表

    ├── cloudfunctions/       ← tryon · ops · login

    ├── pages/                ← C 端页面

    ├── pages-b/              ← B 端商家分包

    └── services/             ← 业务逻辑与云适配器

```



---



## 快速上手



1. 用**微信开发者工具**打开 [`nailmirror/src/`](./nailmirror/src/)（不是仓库根目录）

2. 确认云环境 ID：[`config/cloud-env.js`](./nailmirror/src/config/cloud-env.js)

3. 部署云函数 `tryon`、`ops`、`login`（**上传并部署：云端安装依赖**）

4. 配置环境变量 `DASHSCOPE_API_KEY`

5. 编译运行 → 完整步骤见 [**部署指南**](./docs/SETUP_USER.md)



**队友接入**：[TEAMMATE_ONBOARDING.md](./docs/TEAMMATE_ONBOARDING.md) · **协作流程**：[GITHUB_COLLABORATION.md](./docs/GITHUB_COLLABORATION.md)



---



## 文档中心



| 文档 | 说明 |

|------|------|

| [docs/PROJECT.md](./docs/PROJECT.md) | 项目概述、目录结构、当前能力 |

| [docs/SETUP_USER.md](./docs/SETUP_USER.md) | DashScope、云开发、部署、试戴测试 |

| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | 试戴链路、云函数、数据流 |

| [docs/DATA_SCHEMA.md](./docs/DATA_SCHEMA.md) | 款式字段、VLM 打标、API |

| [docs/CHANGELOG.md](./docs/CHANGELOG.md) | 迭代记录 |

| [docs/美甲标签与标准词表.md](./docs/美甲标签与标准词表.md) | 封闭标签词表 |



---



<div align="center">



**NailMirror** — 让每一次选款，都能先看见效果。



<br/>



[GitHub](https://github.com/Icarus-2001/nailmirror-v1.0.3-20260527) · [文档](./docs/README.md) · [变更记录](./docs/CHANGELOG.md)



</div>


