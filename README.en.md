<div align="center">

<img src="docs/assets/readme/logo.jpg" alt="NailMirror" width="140" />

# NailMirror

**AI Nail Try-On · Smart Style Operations · WeChat Mini Program**

*Upload a hand photo, see the result in seconds. Platform picks, merchant uploads, and Xiaohongshu trending styles — all in one try-on flow.*

<br/>

[![Version](https://img.shields.io/badge/version-1.2.21-7c3aed?style=for-the-badge)](https://github.com/Icarus-2001/NailMirror)
[![Platform](https://img.shields.io/badge/Platform-WeChat_Mini_Program-07c160?style=for-the-badge&logo=wechat&logoColor=white)](https://developers.weixin.qq.com/miniprogram/dev/framework/)
[![Cloud](https://img.shields.io/badge/Backend-WeChat_Cloud-1677ff?style=for-the-badge)](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
[![AI](https://img.shields.io/badge/AI-DashScope_Wan_2.7-ff6a00?style=for-the-badge)](https://help.aliyun.com/zh/model-studio/)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](./LICENSE)

<br/>

[**Repository**](https://github.com/Icarus-2001/NailMirror) · [**Try-On Results**](#try-on-results) · [**Product Demo**](#product-demo) · [**中文 README**](./README.md)

</div>

---

## What is this?

**NailMirror** is a WeChat Mini Program for consumers and nail salons: it fuses hand photos with style reference images to produce realistic try-on results, plus a full loop of style library, heat rankings, and merchant operations.

| Audience | Capabilities |
|----------|--------------|
| **Consumers** | AI cloud try-on · 50+ real styles (daily updates) · Xiaohongshu trending picks · filter & sort · favorites & HD export |
| **Merchants** | Identity verification · style library (view / upload / deactivate) · shop profile · daily dashboard · AI ops insights |

---

## Try-On Results

> Reference style + real hand photo → AI composite. Only nails change; hands and background stay intact.

<div align="center">

<table>
<tr>
<td align="center" width="33%">
<strong>Reference</strong><br/><br/>
<img src="docs/assets/readme/tryon-reference.jpg" alt="Reference style" width="100%"/><br/>
<sub>XHS trending · Dreamy Galaxy</sub>
</td>
<td align="center" width="33%">
<strong>Before</strong><br/><br/>
<img src="docs/assets/readme/tryon-before.jpg" alt="Before try-on" width="100%"/><br/>
<sub>User hand photo</sub>
</td>
<td align="center" width="33%">
<strong>After</strong><br/><br/>
<img src="docs/assets/readme/tryon-after.jpg" alt="After try-on" width="100%"/><br/>
<sub>AI output</sub>
</td>
</tr>
</table>

</div>

---

## Highlights

<table>
<tr>
<td width="25%" align="center"><h3>AI Cloud Try-On</h3>4 steps: shape → style → hand photo → preview & rate<br/>Wan 2.7 Pro · eval hands / album upload</td>
<td width="25%" align="center"><h3>Rich Style Library</h3>50+ real styles · daily updates<br/>Platform · merchant · XHS hot · 8 color families</td>
<td width="25%" align="center"><h3>Dual Heat Rankings</h3>In-app platform heat + off-app XHS TOP10<br/>Dedicated “trending” badge & cover</td>
<td width="25%" align="center"><h3>Merchant Ops</h3>3-tab style library · daily dashboard<br/>AI strategy · shop configuration</td>
</tr>
</table>

---

## Product Demo

> Real-device screen recordings as GIF previews.

### Style Library

Consumer style library: filter drawer, three source tags (platform / merchant / XHS hot), heat & time sorting.

<div align="center">
<img src="docs/assets/readme/gifs/style-library.gif" alt="Style library" width="280"/>
</div>

### Try-On Flow

Home → try-on: pick shape → pick style (album reference supported) → hand photo → AI compose → preview & rate.

<div align="center">
<img src="docs/assets/readme/gifs/tryon-flow.gif" alt="Try-on flow" width="280"/>
</div>

### Heat Rankings

Platform style heat + Xiaohongshu “trending” TOP10, side by side.

<div align="center">
<img src="docs/assets/readme/gifs/hot-rank.gif" alt="Heat rankings" width="280"/>
</div>

### Merchant · Style Library

Merchant center → 3-tab style management: view / upload / deactivate & delete.

<div align="center">
<img src="docs/assets/readme/gifs/merchant-style-library.gif" alt="Merchant style library" width="280"/>
</div>

### Merchant Dashboard

Daily dashboard: core metrics, trends, tag aggregates, and AI operational recommendations.

<div align="center">
<img src="docs/assets/readme/gifs/merchant-dashboard.gif" alt="Merchant dashboard" width="280"/>
</div>

---

## Documentation

**Quick links for reviewers & evaluators**

| Doc | Description |
|-----|-------------|
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | Architecture summary — try-on pipeline, cloud functions, data flow |
| [docs/SETUP_USER.md](./docs/SETUP_USER.md) | Experience guide — DashScope, WeChat Cloud, deploy & try-on test |

<details>
<summary><strong>More docs (contributors)</strong></summary>

| Doc | Description |
|-----|-------------|
| [docs/PROJECT.md](./docs/PROJECT.md) | Project overview, directory layout, current capabilities |
| [docs/DATA_SCHEMA.md](./docs/DATA_SCHEMA.md) | Style fields, VLM tagging, APIs |
| [docs/CHANGELOG.md](./docs/CHANGELOG.md) | Release history |
| [docs/美甲标签与标准词表.md](./docs/美甲标签与标准词表.md) | Closed tag vocabulary (Chinese) |
| [docs/README.md](./docs/README.md) | Full documentation index |

</details>

---

<div align="center">

**NailMirror** — See every style on your hands before you decide.

<br/>

[GitHub](https://github.com/Icarus-2001/NailMirror) · [中文 README](./README.md) · [License](./LICENSE)

</div>
