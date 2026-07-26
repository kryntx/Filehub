# FileHub 文件下载站 — 项目需求文档

## 项目位置
`/home/admin/Code/web/` — 4 个文件：`server.py`（Flask 后端）、`index.html`、`app.js`、`style.css`

## 运行方式
```bash
cd /home/admin/Code/web && python3 server.py
# 监听 0.0.0.0:8888
```

## 密码机制
- 默认密码：`8888`（可通过环境变量 `UPLOAD_PASSWORD` 覆盖）
- 所有写操作（上传、新建文件夹/文件、重命名、删除、编辑保存、URL下载）都需要在 HTTP Header 中传 `x-upload-password`
- 前端输入密码后写入 Cookie（当日过期），后续操作自动附带

## 后端 API

| 方法 | 路径 | 功能 | 参数 |
|------|------|------|------|
| GET | `/api/files?path=` | 列出目录内容（文件+子文件夹），返回 `[{name, type:file/dir, size, mtime, ext}]`，文件夹排前面 | 缺省 path 为根目录 |
| GET | `/download/<path:filename>` | 下载文件 | 支持子路径 |
| GET | `/api/preview/<path:filename>` | 预览文本文件（返回 `{content, truncated, size}`），限 1MB | 仅支持 `TEXT_EXTS` 列表中的扩展名 |
| POST | `/api/upload` | 上传文件（form-data），自动重名加 `_1/_2` 后缀 | `file` + `path` |
| POST | `/api/upload-url` | 从 URL 下载文件到服务器 | `{url, path}`，自动解析 Content-Disposition 文件名 |
| GET | `/api/download-zip?path=` | 下载整个文件夹为 ZIP | 自动打包子目录 |
| POST | `/api/mkdir` | 创建文件夹 | `{path, name}` |
| POST | `/api/newfile` | 创建空文件 | `{path, name}` |
| PUT | `/api/rename` | 重命名文件或文件夹，目标已存在时自动加 `_1/_2` | `{path, name, newName}` |
| PUT | `/api/save` | 保存文本文件内容 | `{path, name, content}` |
| DELETE | `/api/delete` | 删除文件或空文件夹（非空拒绝） | `{path, name}` |

路径安全：所有接口使用 `resolve()` 函数做 `os.path.normpath` + 前缀校验防止路径遍历。

## 前端功能

### 视图模式（保存到 localStorage）
- **图标视图**（默认）：网格卡片，显示 emoji 图标 + 文件名 + 大小 + 时间 + 操作按钮
- **列表视图**：表格，列：图标 \| 名称 \| 大小 \| 时间 \| ⋮ 下拉菜单
- 工具栏 `⊞`/`☰` 按钮切换

### 文件夹导航
- 面包屑导航 `Root > folder1 > subfolder`，每段可点击跳转
- 点击文件夹卡片进入子目录，列表视图点击名称进入
- 操作按钮区域不触发进入目录

### 卡片（图标视图）操作按钮
- 文件夹：下载(ZIP) \| 删除 \| 重命名
- 文件：下载 \| 预览 \| 删除 \| 重命名
- 下载按钮独占一行（`flex-basis:100%`），在其他按钮下方

### 列表视图下拉菜单
- 文件夹：下载 \| 删除 \| 重命名
- 文件：下载 \| 预览 \| 删除 \| 重命名

### 预览模态框
- 图片直接显示
- 文本文件显示内容，支持：
  - 编辑按钮 → 切换 `<textarea>`，修改后保存（需密码验证）
  - 换行切换按钮（`⤻`/`↔`），保存偏好到 localStorage
  - 超过 1MB 提示"仅显示前 1MB"
- 预览中可直接下载文件

### 上传模态框
- 拖拽/点击选择文件上传，显示进度条
- 分割线"或者"下方：输入 URL + 下载按钮，从链接下载到服务器

### 其他功能
- 工具栏：📁 新建文件夹、📄 新建空文件、☰ 切换视图
- 暗色/亮色主题切换（🌙/☀️），跟随系统偏好，保存到 localStorage
- Toast 消息提示（成功/失败，3 秒自动消失）
- 删除/重命名/新建文件夹/新建文件/编辑保存 均需密码验证

## 重要细节
1. 卡片 hover 效果（背景亮起 + 上移 + 阴影）只在 `.card-body` 区域触发，操作按钮区域不受影响
2. 文件卡片用 `.card-body` 包裹内容区域与 `.file-actions` 分离
3. 响应式：480px 以下 2 列，480-768px 自适应，768px+ 根据 minmax 自适应
4. uploads 目录所有权需确保运行用户可读写（之前遇到过 Docker 产生 root 所有导致写失败的问题）
5. 同名文件上传/重命名自动加数字后缀避免覆盖
