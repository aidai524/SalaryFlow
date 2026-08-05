# SalaryFlow TODO

> 记录待办、已知问题与已确认的决策。更新日期：2026-08-05

## 生产上线前必做

- [ ] **Resend 发件域名验证**：免费版只能发到 Resend 账户验证邮箱（aidai524@gmail.com）。
      到 https://resend.com/domains 验证域名（如 salaryflow.dev）→ 设置 `SENDER_EMAIL=SalaryFlow <invites@<域名>>`
      → 生产 `wrangler secret put RESEND_API_KEY`
- [ ] **NEAR Intents Partner API Key**：到 https://partners.near-intents.org 申请 →
      `wrangler secret put INTENTS_API_KEY`（未配置时真实支付 quote 会失败）
- [ ] **Cloudflare 生产部署**：`wrangler d1 create salaryflow` + 远程迁移 +
      `wrangler secret put JWT_SECRET` + `npm run deploy`（API）+ Pages 部署（Web）
- [ ] **Cookie 域配置**：生产设 `APP_URL` / `COOKIE_DOMAIN`（如 `.salaryflow.dev`）保证同域会话

## 已知限制 / 决策记录

- [ ] **PYUSD 不支持**：实测 1Click API 186 个代币中无 PYUSD；USDC/USDT 覆盖 30+ 链。
      产品若需要 PYUSD 需等 NEAR Intents 上线（UI 已按 USDC/USDT 设计）
- [ ] **NEAR Intents 无 testnet**：真实支付只能在 NEAR mainnet 用小额 dev 账号测试；
      quote 支持 `dry: true` 校验不执行
- [ ] **2FA / 密码找回**：当前只有邮箱+密码（PBKDF2）。生产建议补 TOTP 2FA 与重置密码邮件
- [ ] **合规 / KYC**：按用户决策暂不考虑；页面保留隐私边界说明（交换金额对公众隐藏，存款/收款公开）
- [ ] **员工收款流程**：当前工资支付采用 Confidential Intents（embedded）；员工收款/提现到 EVM 钱包的
      unshield 流程尚未在 UI 完成（后端 quote 已支持 CONFIDENTIAL_INTENTS 目标）

## 已修复（2026-08-05）

- [x] **Team Payouts 导航数字 2 为写死测试值** → 已改为真实数据（按员工目录中待处理数量实时计算，为 0 时不显示）
- [x] **邀请可重复发送同一邮箱**（toleg1984@163.com 出现两条 pending）→ 创建邀请时校验：
      同组织已有 pending 邀请 → 409 拒绝；已有成员 → 409 拒绝

## 备注

- 本地开发：`api/.dev.vars` 存 Resend Key（已 gitignore）；MOCK_EMAIL 已关闭
- 当前运行：API :8787（wrangler dev），Web :5173（vite，/api 代理）
