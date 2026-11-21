# 星辰班级 · 学习资源站

瑞昌一中高一化学备课资源 + 星辰班级主页。**纯静态站点**：无构建、无后端、无依赖，`git push` 即上线。

线上地址：<https://a1b2c312.github.io/a6/>

---

## 目录结构

```
a6/
├── index.html                ← 总入口（学生入口 + 课件库两块）
│
├── xingchen/                 ← 星辰班级主站（学生用，2313 个文件）
│   ├── index.html              首页：班级风采 / 化学小屋 / 数学加油站 / 英语角 / 物理之家
│   ├── class.html              班级风采（照片、接力视频、远足 MV）
│   ├── chemistry.html          化学小屋：课件入口 + 在线练习 + 成绩汇总
│   ├── math.html               数学加油站
│   ├── english.html            英语角
│   ├── physics.html            物理之家
│   ├── chemistry-*.html        化学互动课件（氯 / 钠 / 物质的量 / 氧化还原 / 期末复习）
│   ├── chem3-card.html         化学练习3 答题卡补录（凭印象重填 → 找回成绩码）
│   ├── quiz-report.html        教师端：粘贴成绩码 → 正确率 / 错题排行 / 明细导出
│   ├── login.html              登录页
│   └── assets/
│       ├── css/                4 个样式表（style / quiz / quiz-en / quiz-exam）
│       ├── js/                 答题引擎与鉴权（见下表）
│       ├── papers/             题库：16 套试卷的 JSON + 2118 张题目切片
│       ├── audio/              英语听力音频
│       ├── media/              班级视频（接力、远足 MV）
│       ├── games/  poster/     小游戏与海报素材
│       └── vendor/katex/       本地 KaTeX，公式离线渲染
│
├── courseware/               ← 化学课件库（老师备课用，纯网页可直接投屏）
│   ├── index.html              课件库导航
│   ├── cl2/                    氯气 · 三册合一互动课件
│   ├── na/                     钠及其化合物 · 互动课件（含 img/）
│   ├── chem-exam1/             第一次月考讲评（网页 index.html + PPT）
│   └── _legacy/na-v1/          早期版本，保留存档，站点不入口
│
├── tools/                    ← 生成脚本与源数据（不参与部署）
│   ├── cl2/                    氯气课件逐页文稿 JSON 与改稿脚本
│   └── chem-exam1/             月考 PPT 生成脚本（python-pptx）与配图
│
├── DEPLOY.md                 发布与临时局域网访问说明
├── .nojekyll                 关闭 GitHub Pages 的 Jekyll 处理
└── .gitignore
```

### 页面脚本分工（`xingchen/assets/js/`）

| 文件 | 作用 |
|---|---|
| `auth.js` | 姓名 + 学号登录校验，只存加盐 SHA-256，**不含明文** |
| `quiz.js` | 练习模式：即时判对错 + 解析 + 讲评 |
| `quiz-exam.js` | 考试模式：交卷只判 ✓/✗，生成 `XC3-` 成绩码，本机暂存可续答 |
| `quiz-en.js` | 英语听力专用（音频播放 + 选项） |
| `review.js` | 试题讲评页逐题展开 |
| `main.js` | 公共交互（返回顶部、高亮当前板块等） |

---

## 常见改动

**加一套练习/试卷**
1. 把题目切片图放进 `xingchen/assets/papers/<新卷名>/`
2. 写 `xingchen/assets/papers/<新卷名>.json`（字段见 `quiz-exam.js` 顶部注释）
3. 在 `chemistry.html`（或对应学科页）里加一张卡片，`fetch` 该 JSON

**加一个课件**：放进 `courseware/<名字>/index.html`，在 `courseware/index.html` 和根 `index.html` 各加一条链接。

**新增学生账号**：按 `auth.js` 里现有方式算加盐 SHA-256 追加到 `TOKENS`，并升级引用处的 `?v=` 版本号。

**改完记得升版本号**：静态站靠 `?v=20261120g` 这种查询串破缓存，改了 css/js 就要改引用它的 `?v=`。

---

## 已知限制

- **鉴权是"防误点"级别**：静态站没有服务端，`auth.js` 只能挡住随手点开，懂技术的人可以绕过。**不要在这里放敏感资料。**
- `xingchen/assets/papers/_monthly_stats.json` 含学生姓名与分数分布，仓库是公开的。
- 成绩汇总靠学生把成绩码发给老师再粘贴统计，没有自动回传。
- 单个大文件 `星辰班远足MV.mp4` 约 86MB，clone 仓库会比较慢。

---

## 已清理 / 可从历史找回

整理前的这些内容不再维护，但仍在 git 历史里：

| 内容 | 说明 | 找回方式 |
|---|---|---|
| `氯气课件/shots/` | 143 张逐页校验截图（约 15MB） | `git log --diff-filter=D -- 氯气课件/shots` |
| `氯气课件/text/` | 已迁至 `tools/cl2/`，无遗漏 | — |
| `化学互动课堂/` | 早期钠课件 + 外链导航页 | 现存档于 `courseware/_legacy/na-v1/` |
| `氯气互动课件/氯气-三册合一互动课件.html` | 与 `index.html` 完全相同，已去重 | 任意历史提交 |

**注意**：根目录下原来的中文目录名（`氯气互动课件/`、`钠及其化合物互动课件/` 等）已改为 `courseware/` 下的英文名。如果有二维码或外链指向旧地址，需要更新。
