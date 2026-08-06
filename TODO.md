# SalaryFlow TODO

> 记录待办、已知问题与已确认的决策。更新日期：2026-08-06

## 生产上线前必做

- [ ] **真实主网支付尚未启用**：逐工资项状态机、幂等键、签名校验、提交未知态和定时对账已完成，
      quote/status 内嵌 quote 验签及 provider 资产元数据校验已完成，并通过本地假 1Click 全流程测试。
      当前仍为 `PAYMENTS_MODE=dry-run`；配置并复核生产资产映射、完成主网极小金额验收前，
      不得设置 `PAYMENTS_EXECUTION_ACK=mainnet-live`

- [ ] **Resend 发件域名验证**：免费版只能发到 Resend 账户验证邮箱（aidai524@gmail.com）。
      到 https://resend.com/domains 验证域名（如 salaryflow.dev）→ 设置 `SENDER_EMAIL=SalaryFlow <invites@<域名>>`
      → 生产 `wrangler secret put RESEND_API_KEY`
- [ ] **NEAR Intents Partner API Key**：到 https://partners.near-intents.org 申请 →
      `wrangler secret put INTENTS_API_KEY`（未配置时真实支付 quote 会失败）
- [x] **Cloudflare 生产部署**：已创建 `salaryflow` D1 并应用 0001-0007 迁移，
      `salaryflow-api` Worker 已安装 `JWT_SECRET`，Pages 正式环境已通过 Service Binding 同源接入 `/api`
- [x] **Cookie 域配置**：当前 `APP_URL=https://salaryflow-payroll-prototype.pages.dev`、
      `COOKIE_DOMAIN` 为空，由 Pages Function 同源代理承载会话；启用自定义域时需同步更新 `APP_URL`

## 已知限制 / 决策记录

- [ ] **PYUSD 不支持**：实测 1Click API 186 个代币中无 PYUSD；USDC/USDT 覆盖 30+ 链。
      产品若需要 PYUSD 需等 NEAR Intents 上线（UI 已按 USDC/USDT 设计）
- [ ] **NEAR Intents 无 testnet**：真实支付只能在 NEAR mainnet 用小额 dev 账号测试；
      quote 支持 `dry: true` 校验不执行
- [ ] **2FA / 密码找回**：当前只有邮箱+密码（PBKDF2）。生产建议补 TOTP 2FA 与重置密码邮件
- [ ] **合规 / KYC**：按用户决策暂不考虑；页面保留隐私边界说明（交换金额对公众隐藏，存款/收款公开）
- [ ] **员工收款流程主网验收**：状态机已按 Confidential Intents 签名执行并以员工 EVM 地址作为目标，
      但尚未用真实余额验证各网络的 assetId、提现费用、失败退款和最终到账体验
- [ ] **钱包依赖安全升级**：`npm audit --omit=dev` 仍报告钱包连接依赖链中的 `axios` 与
      `ws` 高危项，完整自动修复要求升级 Wagmi 3；需单独完成破坏性升级与钱包回归测试，当前真实支付保持禁用

## 已修复（2026-08-05）

- [x] **Team Payouts 导航数字 2 为写死测试值** → 已改为真实数据（按员工目录中待处理数量实时计算，为 0 时不显示）
- [x] **邀请可重复发送同一邮箱**（toleg1984@163.com 出现两条 pending）→ 创建邀请时校验：
      同组织已有 pending 邀请 → 409 拒绝；已有成员 → 409 拒绝

## 已修复（2026-08-06）

- [x] **本地基线不可重复验证** → 新增隔离临时 D1 的 API smoke test，并纳入 `npm run verify:full`
- [x] **邀请接受未形成登录与员工档案闭环** → 接受后写入会话、按邮箱关联员工档案，并拒绝跨组织迁移
- [x] **支付入口可能误触真实执行** → `PAYMENTS_MODE=dry-run` 下仅执行本地预检；生成、提交、状态接口统一拒绝
- [x] **代币金额单位混用** → 员工、工资项、链上记录统一保存 USDC/USDT 六位小数最小单位
- [x] **员工收款地址仅填写未验权** → 使用十分钟、一次性 ERC-191 消息签名验证；修改地址、币种或网络后自动失效
- [x] **管理员付款钱包可直接绑定** → 改为十分钟、一次性 ERC-191 所有权挑战；旧绑定迁移后强制重新验证
- [x] **支付流程没有幂等和对账** → 新增逐工资项 payment attempt、合法状态转换、提交未知态、
      provider 状态映射与每分钟单条限速对账；本地假 provider 覆盖完整流程
- [x] **provider 资产或 quote 可被错误配置/篡改后继续执行** → quote 前核对 `/v0/tokens` 的 assetId、
      symbol、decimals 与目标 chain；使用官方 1Click SDK 验证 quote Ed25519 签名并保存 canonical hash，
      对账时再次校验状态响应内嵌的 signed quote；本地测试覆盖错误 decimals 与签名后篡改地址

## 备注

- 本地开发：`api/.dev.vars` 已建立安全骨架并被 gitignore；填入 Resend Key 后由该文件设置
  `MOCK_EMAIL=false`，未填 Key 时仍自动回退到 Mock，不会误发邮件
- 当前运行：API :8787（wrangler dev），Web :5173（vite，/api 代理）
- 生产运行：Web `https://salaryflow-payroll-prototype.pages.dev`，Worker
  `https://salaryflow-api.aidai524.workers.dev`；线上支付仍为 `dry-run`
