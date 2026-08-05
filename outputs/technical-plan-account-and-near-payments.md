# SalaryFlow 真实账号系统 + NEAR 隐私支付技术方案

调研日期：2026-08-04
范围：账号体系（角色/邀请）、NEAR Intents Confidential Swaps 可行性、整体实施计划
来源：Request Finance 官方 T&C/Privacy、NEAR Intents 官方文档（docs.near-intents.org，含 1Click API OpenAPI spec）、1Click API 实况数据（/v0/tokens 共 186 个代币）

> 说明：本方案尚未编码。所有"已核验"指官方文档明确写出；未经产品实测或沙盒验证的部分会明确标注。

---

## 一、调研结论（可行性）

### 1.1 Request Finance 账号模式（前一轮已核验）

- 账号基于**邮箱 + 密码**（T&C 原文：忘记密码通过邮箱找回；需选择高强度密码）。
- **钱包是链接到账号的功能组件**，用于支付签名/费用扣除，不是登录凭据。
- 员工通过邀请创建账号（帮助中心有 "I was invited as an employee...how do I sign up"）。

→ 我们的账号系统应沿用：**邮箱账号（应用层认证）+ 钱包（支付层授权）**。这符合行业惯例，也符合用户"支付时钱包登录"的要求。

### 1.2 NEAR Intents Confidential Swaps（已核验）

**架构（双链）**：
- NEAR（公开链）：`intents.near` 托管存款，`Treasury` 账户持有真实代币
- FAR（私有链）：NEAR 私有分支，`intents.far` 执行屏蔽余额的交换；RPC 私有，公众不可见
- **Shield**（公开→私有）：代币转入 Treasury，PoA 桥在 FAR 铸等值 IMT 代币
- **Unshield**（私有→公开）：IMT 在 FAR 销毁，PoA 桥从 Treasury 释放真实代币

**两种集成路径**：
| 路径 | 适用 | 说明 |
|---|---|---|
| Foreign-to-foreign | 大多数合作伙伴 | 普通跨链 swap + `confidentiality: "basic"\|"advanced"` 参数；用户在外链存款、外链收款，交换细节在 FAR 私有链执行 |
| Embedded account/wallet | 钱包式高级用法 | 资金已存在用户 Confidential Intents 余额；`depositType/recipientType/refundType = CONFIDENTIAL_INTENTS` + Signed Intent Execution |

**用户认证（关键）**：
- 用户**无需创建 NEAR 账号**；用现有钱包签名 NEP-413 payload（空 `intents` 数组 = 所有权证明）
- `POST /v0/auth/authenticate` 换取 **User-Session token**（access + refresh），用于读取私有余额与交易历史
- Partner JWT（Partner Dashboard 获取）认证集成方，不认证终端用户；**两者分离**
- Account Abstraction：Named account（`alice.near`）或 Implicit account（EdDSA→64-hex NEAR 地址，ECDSA→0x EVM 地址），支持所有支持链的钱包签名标准（nep413/erc191/raw_ed25519/webauthn/ton_connect/sep53/tip191）

**支付流程（Confidential 必需 Signed Intent Execution）**：
1. `POST /v0/quote`（`depositType: CONFIDENTIAL_INTENTS`，`confidentiality: basic/advanced`）
2. `POST /v0/generate-intent` → 返回未签名 intent payload（`swap_transfer`，含 `token_diff`）
3. 用户钱包**离线签名**（NEP-413；payload 不可修改）
4. `POST /v0/submit-intent`（`signedData`：payload + public_key + signature）→ 返回 `intentHash`
5. 轮询状态（`/v0/status` 或 Webhook）至完成

**资产支持（已实测）**：USDC/USDT 在 NEAR、Ethereum、Arbitrum、Base、Solana、Polygon、BNB、Optimism、Avalanche、Gnosis、TON、Sui、Aptos、Stellar、Tron、Monad、XLayer、Scroll 等 30+ 链均支持。我们原型涉及的 Base/Arbitrum/Solana/Polygon 全部覆盖。

**费用**：Partner JWT 认证后**免 0.2% 平台费**（仅网络 gas + 做市商点差）；未认证请求收 0.2% 平台费。

**合规（已核验）**：自动化合规筛查（Binance AML、AMLBot/PureFi、TRM Labs 用于非 dry quote）；执法请求走 Kodex Global 门户。**"隐私"是对公众隐藏，平台与授权合规方仍可见**（与调研报告结论一致）。

**测试约束（重要）**：**官方无 testnet**，官方建议在 NEAR mainnet 用独立 dev/test 账号测试。

### 1.3 隐私边界（必须诚实呈现）

| 层级 | 谁可见 |
|---|---|
| 应用层（SalaryFlow） | 按角色 RBAC：管理员见全员，员工仅见自己（现有原型已体现） |
| 链上交换（FAR 私有链） | 公众不可见交换金额与路径；平台（1Click）、持 User-Session 的本人、合规方可见 |
| 存款/收款（外链） | **公开**：员工从 Base 转出、在 Base 收款仍是公开链记录（foreign-to-foreign 模式） |
| 完全私密的资金存放 | 仅 Embedded account 模式把资金放私有余额；但最终收款到外链仍公开 |

→ 产品承诺应为"**交换过程的金额与路径对公众隐藏 + 应用内最小可见**"，不能宣称"工资完全匿名"。

---

## 二、账号系统设计

### 2.1 数据模型

```
User
  id, email, name, passwordHash
  role: 'admin' | 'employee'          // 管理员（雇主侧）/ 普通员工
  status: 'invited' | 'active' | 'disabled'
  authProvider: 'email_password'      // 预留 sso
  createdAt, lastLoginAt

Organization
  id, name, country, currency

Membership (User ↔ Organization)
  id, orgId, userId, role, joinedAt    // 一个用户可属于多个组织（预留）

Invitation
  id, orgId, email, role, token, expiresAt
  invitedBy, status: 'pending'|'accepted'|'expired'|'revoked'

EmployeeProfile
  id, userId, orgId
  token: 'USDC'|'USDT', network, walletAddress, walletVerification: 'pending'|'verified'|'update_required'
  payoutStatus: 'ready'|'update_required'
  lastPaidAt

PayrollRun
  id, orgId, periodLabel, payDate
  status: 'draft'|'ready'|'paid'|'failed'|'partial'
  totalsUsdc, totalsUsdt, createdBy

PayrunItem
  id, runId, employeeId, amount, token, network
  status: 'pending'|'paid'|'failed'|'refunded'
  intentHash, depositAddress, chainRecordId

ChainRecord
  id, itemId, originChain, destChain, confidentiality: 'public'|'basic'|'advanced'
  intentHash, submitTxHash, status: 'pending'|'confirmed'|'failed'
  timestamps: quoteAt, signedAt, submittedAt, confirmedAt

AuditLog                         // 从原型的 in-memory events 升级为持久化
  id, orgId, actorId, action, detail, createdAt  (append-only)
```

### 2.2 认证与角色

- **登录**：邮箱 + 密码（bcrypt/argon2）+ 可选 TOTP 2FA。会话用 HttpOnly cookie（Session）或短期 JWT + refresh。
- **角色权限矩阵**：

| 能力 | admin | employee |
|---|---|---|
| 维护组织与员工档案 | ✅ | — |
| 发起/查看工资批次 | ✅ | — |
| 支付（连接钱包签名） | ✅ | — |
| 查看全员链上记录 | ✅ | — |
| 查看本人工资/收款方式/工资单 | — | ✅ |
| 修改本人收款方式 | — | ✅ |
| 签署稳定币发薪同意书 | — | ✅ |

- 后端强制校验（服务端授权），前端仅渲染。

### 2.3 邀请机制（真实交互）

1. 管理员 → "Invite employee"：填邮箱 + 角色（当前仅 employee）
2. 后端创建 `Invitation`（随机 token + 7 天过期）→ 发邮件（含邀请链接 `app.salaryflow.dev/invite/<token>`）
3. 员工打开链接 → 若未注册：创建账号（邮箱+密码）→ 自动绑定组织与角色 → 进入员工门户；若已注册：直接加入组织
4. 邀请状态流转：pending → accepted / expired；可 resend / revoke
5. 管理员在 Team payouts 看到成员与邀请状态

### 2.4 NEAR 钱包绑定（支付层登录）

- 钱包选择器：支持 NEAR 生态钱包（Meteor Wallet、MyNearWallet 等）或**嵌入式 FastAuth**（邮箱创建的 NEAR 隐式账号，无需浏览器扩展）。
- 绑定流程（管理员支付前 + 员工收款前）：
  1. 用户点击 "Connect wallet" → 钱包签名 NEP-413 所有权证明
  2. 前端调 `POST /v0/auth/authenticate` 换取 User-Session token（仅存后端，作为 1Click 代理凭证）
  3. 后端保存 `walletPublicKey` / implicit accountId 到 `EmployeeProfile` 或 `User`
- 支付时：若未绑定/会话过期 → 弹钱包连接；已绑定 → 直接签名 intent。

---

## 三、支付流程（管理员视角，真实交互）

```
Payroll (ready)
  └─ Pay now → 确认对话框（金额/人数/提醒）
       └─ [未连接钱包] → 连接 NEAR 钱包（签名授权）
       └─ 后端代理 → 1Click API
            1. POST /v0/quote       confidentiality: basic（可配）, depositType: CONFIDENTIAL_INTENTS, 逐员工或批量
            2. POST /v0/generate-intent → 前端把 payload 交给钱包签名（NEP-413）
            3. POST /v0/submit-intent → intentHash
            4. 轮询 /v0/status（或 webhook）→ confirmed / failed / refunded
       └─ 更新 PayrunItem + ChainRecord → Payment records 页展示
```

- **批量**：建议逐笔（per employee）提交以便独立失败重试与精确对账；批次状态 = 成员状态的聚合（partial 支持）。
- **退款**：quote 的 `refundTo` 指向公司退款钱包；失败/超额走 refund 流程并在 Payment records 记录。
- **前端签名**：钱包私钥不出浏览器；后端只做 API 代理与状态持久化（1Click API Key 绝不能放前端）。

---

## 四、实施计划（分阶段，每阶段可验收）

### Phase 0 — 架构与后端脚手架（1–2 周）
- 技术选型：Next.js（App Router）+ TypeScript + Postgres（Prisma）+ Resend（邀请邮件）；`@defuse-protocol/intents-sdk` + `@defuse-protocol/one-click-sdk-typescript`
- 建立后端 API：auth、org、invite、payroll、payments 模块；AuditLog 表
- 决策确认项（见第五节）

### Phase 1 — 账号系统（1 周）
- 注册/登录/登出、2FA、角色字段、邀请流程（创建→邮件→接受→绑定）、管理员/员工门户切换（沿用现有 Shell 的角色切换逻辑）
- 验收：两个角色、邀请闭环、RBAC 生效

### Phase 2 — 工资数据与团队（1 周）
- 员工档案 CRUD（收款方式：币种/网络/地址）、钱包绑定状态、Team payouts 页接真实数据
- 工资批次：录入（CSV/手工）、净额计算、状态机 draft→ready→paid
- 验收：录入→查看提醒→Pay now 按钮（先 mock 支付）

### Phase 3 — NEAR 支付集成（2–3 周）
- 后端：1Click API 代理（quote/generate-intent/submit-intent/status/balances），API Key 安全存储
- 前端：钱包选择器 + NEP-413 签名流程 + User-Session 换取
- Payroll 页真实支付（先 foreign-to-foreign `basic`；评估后切换 embedded）
- 验收：真实小额测试（NEAR mainnet dev 账号；**无 testnet，官方建议主网测试账号**）

### Phase 4 — 链上记录与隐私呈现（1 周）
- Payment records 页接 ChainRecord：intentHash、状态、链、时间；标注"交换对公众隐藏，存款/收款公开"
- 员工端：本人收款记录、收款方式、同意书（签名）
- 验收：支付后记录完整可查

### Phase 5 — 合规与安全（1 周 + 持续）
- 审计日志持久化（append-only/WORM）、密钥轮换、速率限制、CSRF/SSRF 防护
- 合规提示：KYC/AML 由 1Click 侧筛查（非 dry quote），页面标注"需验证身份"的边界
- 渗透/安全清单

**总工期估算：6–9 周（1 名全栈）**；若只做"账号系统 + mock 支付"，Phase 0–2 即可交付（3–4 周）。

---

## 五、需要你确认的决策点

1. **认证方式**：邮箱+密码（推荐，与 Request Finance 一致）？还是要 magic link / 纯钱包登录？
2. **角色粒度**：admin/employee 两个角色是否足够？是否需要"财务/审批"中间角色？（你说过无审批流程，默认不需要）
3. **邀请邮件服务**：Resend / SendGrid？国内可访问性是否要考虑？（若纯演示，可先 mock 邮件+复制链接）
4. **NEAR 钱包形态**：浏览器扩展钱包（Meteor/MyNearWallet）还是**嵌入式 FastAuth**（邮箱即钱包，无扩展，适合普通员工）？推荐 FastAuth 降低门槛。
5. **隐私级别**：先用 foreign-to-foreign `basic`（简单、可快速上线），还是直接做 Embedded account（资金完全在私有余额，体验更像"钱包"但复杂）？
6. **部署形态**：是否需要真实后端（Next.js + Postgres）？还是先保留纯前端原型 + mock API，等方案确认后再引入后端？
7. **合规/KYC**：现在是否需要接入身份验证（如供应商），还是先沿用"未连接"标注？
8. **支付币种入口**：公司用什么充值/支付？(a) 公司钱包持 USDC 从外链支付；(b) NEAR 上 USDC；(c) 需要法币入金桥？

---

## 六、风险与约束

| 风险 | 说明 | 缓解 |
|---|---|---|
| 无 testnet | 官方明确无测试网 | 主网 dev 账号小额测试；Phase 3 设 dry-run 开关（`dry: true` quote） |
| 隐私边界误解 | "Confidential"≠完全匿名 | 产品文案与 UI 明示：交换金额对公众隐藏；存款/收款、平台、合规方可见 |
| 1Click API 稳定性 | 平台 API、需 Partner Dashboard 密钥 | 后端代理 + 状态持久化 + webhook/轮询双通道；设计降级（记录失败并提示重试） |
| 做市商流动性 | 点差与滑点影响净额 | quote 阶段展示实付/到账；EXACT_OUTPUT 保证员工到账金额 |
| 合规 | 工资/雇佣/税务各地不同 | 页面保留"not_checked"标注；不与真实雇佣绑定；建议法务确认目标市场 |
| API Key 泄露 | 1Click JWT 若放前端 | 全部放后端；前端仅持 User-Session（本人数据） |
| 邮件可达性 | 邀请/找回邮件 | 选可达邮件服务；支持复制邀请链接的降级路径 |

---

## 附：已核验的官方资料（NEAR Intents）

- Confidential Swaps：https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/confidential-swaps
- Signed Intent Execution：https://docs.near-intents.org/integration/distribution-channels/1click-api/quickstart/signed-intent-execution
- Authenticate User with Signed Data：https://docs.near-intents.org/api-reference/user-auth/authenticate-user-with-signed-data
- Account Abstraction：https://docs.near-intents.org/integration/verifier-contract/account-abstraction
- Confidential Intents（FAR 架构）：https://docs.near-intents.org/integration/market-makers/confidential-intents
- API Keys & 费用：https://docs.near-intents.org/integration/distribution-channels/1click-api/authentication
- Risk & Compliance：https://docs.near-intents.org/security-compliance/risk-and-compliance
- 1Click API OpenAPI：https://1click.chaindefuser.com/docs/v0/openapi.yaml
- 代币支持（实测）：https://1click.chaindefuser.com/v0/tokens （186 个代币，USDC/USDT 覆盖 30+ 链）
