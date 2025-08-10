# Commit 规范

本规范基于 [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) 规范改进，旨在为项目提交提供一致的格式和语义化版本控制。

---

## 核心类型 (Core Types)

### `feat` - 功能特性

**中文说明：** 引入具有独立性的新功能特性的提交，为用户或开发者提供重要的新能力或行为。通常是相对完整、独立的功能模块。

**English Description:** A commit that introduces new feature with strong independence, providing significant new capabilities or behaviors for users or developers. Usually represents relatively complete and independent functional modules.

**示例 (Examples):**

```
feat: 添加用户头像上传功能
feat: add user avatar upload functionality
feat: 支持暗黑模式切换
feat: support dark mode toggle
feat: 新增订单管理模块
feat: implement order management module
```

---

### `fix` - 修复性变更

**中文说明：** 对现有代码进行修复、完善或补充的提交，包括但不限于：
- 传统意义上的错误修复
- 对已发布功能的改进和完善
- 添加不痛不痒但有益的小功能或调整
- 对发布版本的补充性修复和优化
- 不影响主体功能使用的细节改进

**English Description:** A commit that fixes, improves, or supplements existing code, including but not limited to:
- Traditional error corrections
- Improvements and refinements to released features
- Adding minor but beneficial features or adjustments
- Supplementary fixes and optimizations for released versions
- Detail improvements that don't affect core functionality usage

**示例 (Examples):**

```
fix: 修复用户登录时的验证逻辑错误
fix: resolve login validation logic error
fix: 完善表单提交的边界情况处理
fix: improve edge case handling in form submission
fix: 优化暗黑模式下按钮的显示效果
fix: optimize button display in dark mode
fix: 调整移动端菜单的交互体验
fix: adjust mobile menu interaction experience
```

---

## 辅助类型 (Supporting Types)

### `docs` - 文档变更

**中文说明：** 仅涉及文档的变更，不影响代码功能。

**English Description:** Documentation-only changes that do not affect code functionality.

**示例 (Examples):**

```
docs: 更新 API 使用说明
docs: update API usage instructions
docs: 修正 README 中的安装步骤
docs: fix installation steps in README
```

---

### `style` - 代码格式化

**中文说明：** 不影响代码含义的变更，如格式化、缺失分号、空白等。

**English Description:** Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc.).

**示例 (Examples):**

```
style: 格式化代码，统一缩进风格
style: format code with consistent indentation
style: 移除多余的空行和空格
style: remove extra blank lines and spaces
```

---

### `refactor` - 代码调整

**中文说明：** 对代码进行调整、改动的提交，既不添加主要功能也不修复问题，包括但不限于：
- 代码结构重构和优化
- 提升代码可读性和可维护性
- 添加日志、注释等辅助性代码
- 无关紧要但有益的代码改动
- 代码规范性调整

**English Description:** Code adjustments and modifications that neither add major features nor fix issues, including but not limited to:
- Code structure refactoring and optimization
- Improving code readability and maintainability
- Adding logs, comments, and other auxiliary code
- Minor but beneficial code changes
- Code standard compliance adjustments

**示例 (Examples):**

```
refactor: 重构用户认证逻辑，提升代码可读性
refactor: restructure user authentication logic for better readability
refactor: 提取公共工具函数到独立模块
refactor: extract common utility functions to separate module
refactor: 为关键业务逻辑添加详细日志
refactor: add detailed logs for critical business logic
refactor: 统一变量命名规范
refactor: standardize variable naming conventions
```

---

### `perf` - 性能优化

**中文说明：** 提升代码性能的变更。

**English Description:** A code change that improves performance.

**示例 (Examples):**

```
perf: 优化图片加载算法，减少内存占用
perf: optimize image loading algorithm to reduce memory usage
perf: 使用虚拟滚动提升大列表渲染性能
perf: implement virtual scrolling for better large list performance
```

---

### `test` - 测试相关

**中文说明：** 添加缺失的测试或修正现有测试。

**English Description:** Adding missing tests or correcting existing tests.

**示例 (Examples):**

```
test: 为用户注册功能添加单元测试
test: add unit tests for user registration feature
test: 修复登录测试的断言错误
test: fix assertion error in login tests
```

---

### `build` - 构建系统

**中文说明：** 影响构建系统或外部依赖的变更（如 webpack、npm、gulp 等）。

**English Description:** Changes that affect the build system or external dependencies (webpack, npm, gulp, etc.).

**示例 (Examples):**

```
build: 升级 webpack 到 5.0 版本
build: upgrade webpack to version 5.0
build: 添加 TypeScript 编译配置
build: add TypeScript compilation configuration
```

---

### `ci` - 持续集成

**中文说明：** 对 CI 配置文件和脚本的变更（如 GitHub Actions、Jenkins 等）。

**English Description:** Changes to CI configuration files and scripts (GitHub Actions, Jenkins, etc.).

**示例 (Examples):**

```
ci: 添加自动化测试到 GitHub Actions
ci: add automated testing to GitHub Actions
ci: 更新部署脚本的 Node.js 版本
ci: update Node.js version in deployment scripts
```

---

### `chore` - 日常维护

**中文说明：** 其他不修改源代码或测试文件的变更，如维护任务、依赖更新等。

**English Description:** Other changes that don't modify src or test files, such as maintenance tasks, dependency updates, etc.

**示例 (Examples):**

```
chore: 更新项目依赖到最新版本
chore: update project dependencies to latest versions
chore: 清理无用的配置文件
chore: clean up unused configuration files
```

---

## 特殊标记 (Special Markers)

### `revert` - 回滚提交

**中文说明：** 回滚之前的提交。

**English Description:** Reverts a previous commit.

**格式 (Format):**

```
revert: <被回滚的提交标题>

This reverts commit <commit-hash>.
```

---

## 破坏性变更 (Breaking Changes)

在任何类型后添加 `!` 表示包含破坏性变更，或在提交信息中包含 `BREAKING CHANGE:` 说明。

Add `!` after any type to indicate breaking changes, or include `BREAKING CHANGE:` in the commit message.

**示例 (Examples):**

```
feat!: 重新设计用户认证 API
feat!: redesign user authentication API

BREAKING CHANGE: 用户登录接口返回格式发生变化
BREAKING CHANGE: user login API response format has changed
```

---

## 语义化版本对应关系 (Semantic Versioning Correlation)

- `feat` → MINOR 版本增加
- `fix` → PATCH 版本增加
- `!` 或 `BREAKING CHANGE` → MAJOR 版本增加
- 其他类型 → 通常对应 PATCH 版本增加（根据项目策略决定）

---

## 提交格式规范 (Commit Message Format)

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**示例 (Example):**

```
feat(auth): 添加 OAuth 2.0 支持

支持 Google 和 GitHub 第三方登录，提升用户体验。
完善了错误处理和用户反馈机制。

Closes #123
```
