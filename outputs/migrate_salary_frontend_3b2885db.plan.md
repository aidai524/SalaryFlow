---
name: Migrate Salary Frontend
overview: 将 salary 的前端部分迁移到空仓库 stableflow-pay（salary 全程只读，只写 stableflow-pay），升级到 Vite 8，剥离合约与后端接口。单笔与批量付薪各走一套后端 quote/swap/submit/status 接口，前端只负责签名广播；去掉钱包验证功能；数据层改为 hooks 级 mock，并按 11 项需求改造页面、抽象通用组件、接入带 HMAC 签名的 RPC 代理与 fallback。
todos:
  - id: scaffold
    content: 以 stableflow-x 的 Vite 8 配置为模板，用 pnpm 搭建脚手架：package.json（packageManager pnpm@10.19.0、build 带 max-old-space-size）、vite.config.ts（从 vitest/config 导入 defineConfig 并内联 test；normalizeNodeBuiltinImports pre 插件；require.resolve + 正则精确 alias；optimizeDeps.rolldownOptions.transform.define；不装 vite-plugin-node-polyfills）、tsconfig 三件套（erasableSyntaxOnly、tsBuildInfoFile 进 node_modules/.tmp）、index.html、.env.example、.gitignore、README.md，复制 public/。不写 pnpm-workspace.yaml 与 vitest.config.ts
    status: completed
  - id: types
    content: 建立 src/types/：按 auth/org/recipient/payment/overview/invite/batch 拆分领域类型，只保留被引用的，删除 27 个死类型与 payroll / payment-attempt 遗留类型；ApiError 移到 src/lib/api-error.ts
    status: completed
  - id: mocks
    content: 建立 src/mocks/：fixtures 静态数据、db.ts 内存可变状态（支持 create/update/delete 反映到列表）、delay.ts 延迟模拟
    status: completed
  - id: rpc
    content: 建立 src/lib/rpc/：移植 signature.ts（@noble/hashes 同步 HMAC-SHA256）、chain-rpc.ts（代理优先 + 公共兜底 + proxySlug 映射，标注 scroll/monad/near 无代理）、evm.ts（viem fallback + onFetchRequest 逐请求签名）、solana.ts（httpHeaders + Proxy 循环降级）、near.ts（多公共 RPC 顺序 fallback）
    status: completed
  - id: migrate-core
    content: 迁移核心骨架：main.tsx（顶部手动挂 Buffer 全局，取代 polyfills.ts）、App.tsx、styles.css、router/、layouts/、stores/、config/chains.ts、lib/ 工具函数（不含 api.ts、erc191.ts、wallet.ts、polyfills.ts）
    status: completed
  - id: migrate-wallet
    content: 迁移 src/wallet/ 并接入新 RPC 层：evm/config.ts 的 wagmi transports 改用 lib/rpc；三个 transfer.ts 收敛为只读余额的 balance.ts（删除 encodeErc20Transfer/Approve、readErc20Allowance、sendSplTransfer、sendNearFtTransfer）；删除 send-origin-deposit.ts，新增 broadcast-prepared-payout.ts 按链分派签名广播
    status: completed
  - id: common-components
    content: 建立 src/components/common/：平移 Pagination、SearchInput、StatCell、IdentityAvatar、TokenChainIcon；新增 EmptyState、LoadingSpinner；统一 Field（合并 AuthField 与 AddRecipientDialog 内联 Field）；ResponsiveDialog 的 rainbowkit-overlay 耦合改为可选 prop；抽出 AvatarPicker。迁移 ui/ 与 icons/
    status: completed
  - id: hooks
    content: 迁移 hooks 并把 queryFn/mutationFn 指向 mocks，保持 query key 不变，每个 hook 顶部写 TODO(api) 注释标注 endpoint/method/参数/响应类型。不迁移 use-payout-ownership.ts 与原版 use-batch-payout-api.ts
    status: completed
  - id: views
    content: 迁移 views/：admin（Pay、Recipients、Overview、PaymentHistory、CreateTeam、HowItWorks）、auth、employee，以及 quick-pay / you-pay / pending-payments / batch-payout 业务组件
    status: completed
  - id: req-payout
    content: 需求 3：单笔与批量各一套 quote/swap/submit/status 接口骨架（use-single-payout-api.ts、use-batch-payout-api.ts，均为 mock）；src/types/payout.ts 定义两组请求响应类型 + 共享的 PreparedPayout 联合类型（evm/solana/near）；删除 config/batch-payout-chains.ts；QuickPayPanel 与 BatchPayoutDialog 改为 swap → broadcastPreparedPayout → submit → status，去掉全部前端 calldata 编码；两个模块顶部写清待后端定稿的 TODO(api) 清单
    status: completed
  - id: req-forms
    content: 需求 4/8/9：Add Recipient 的 email 对所有类型必填；amount-input 默认 2 位小数并修正全部调用点（含 AddRecipientDialog 未 sanitize 的 Compensation 输入）+ 补测试；员工 self 表单拆为 EditMyProfileDialog，只允许改 avatar/token/network/wallet
    status: completed
  - id: req-pages
    content: 需求 5/6/7：PaymentHistoryView 删除 Batches tab 与 HistoryTabs/BatchHistoryList；RecipientsToolbar 去掉 PaymentPeriodPicker；InviteView 重写为显式接受 + 密码/确认密码（8–50 位）→ accept(token, password) → 登录跳转 /my-pay，密码规则常量提到 auth/config.ts 共用
    status: completed
  - id: req-wallet-verify
    content: 需求 11：去掉钱包验证（管理员 + 员工）。删除 use-payout-ownership.ts、PayoutOwnershipActions.tsx、EmployeePayoutWalletDialog.tsx 与 4 个 challenge/verify 接口；WalletConnect 只留绑定、删掉 verify 与验证徽章；删除 payout_verified_at / wallet_verified 字段与 isVerified()，清掉 5 处验证徽章；BatchEmployeeSelectTable 取消选中门槛；员工端不再连钱包，header 按钮改为打开 EditMyProfileDialog；连带删除 wallet 层已无消费者的 signMessage
    status: completed
  - id: verify
    content: 验收：pnpm check、pnpm build、pnpm test 全绿；手工走查 10 条路由；rg '[\p{Han}]' src 为空；rg 'encodeFunctionData|encodeErc20|BATCH_PAYOUT|0x[0-9a-fA-F]{40}' src 为空；rg 'signMessage|verified|challenge' src 无验证残留；清理迁移后无引用的依赖
    status: completed
isProject: false
---

## 硬约束：只写 `stableflow-pay`，其余仓库只读

工作区里有四个目录，**只有 `pay/stableflow-pay` 允许写入**：

- `pay/stableflow-pay` —— 唯一的写入目标。
- `pay/salary` —— **只读**。它是迁移来源，全程只能读取和复制内容出去，不得新增、修改、删除、重命名任何文件，也不在其中执行 `pnpm install` / `git` 写操作或删除 `api/`、`contracts/` 等目录。计划里所有"删除 X"、"不迁移 X"的说法，含义都是"新仓库里不创建 X"，而不是去 salary 里删掉它。
- `stableflow-interface` —— **只读**。RPC 签名与 fallback 方案的参考来源。
- `stableflow-x` —— **只读**。Vite 8 配置的参考来源。

执行时的具体注意点：

- 所有 shell 命令显式指定 `working_directory` 为 `stableflow-pay`，不要依赖继承的 cwd。
- 复制 `public/` 等资源用单向 `cp salary/public/... stableflow-pay/public/`，方向不能反。
- `pnpm install` 只在 `stableflow-pay` 里跑，避免动到 salary 的 `node_modules` 与 `pnpm-lock.yaml`。
- 验收阶段的 `rg` 检查全部限定在 `stableflow-pay/src`。

唯一例外：本计划文件自身位于 `salary/.cursor/plans/`，执行过程中更新 todo 状态需要写它。除此之外 `salary` 目录零写入。

---

## 背景事实（已核实）

- 目标目录 `stableflow-pay` 目前只有 `.git`，属于从零搭建脚手架，不是增量改造。
- 源项目 `salary/src` 共 184 个文件；`api/`、`contracts/`、`functions/`、`wrangler.toml`、`pnpm-workspace.yaml` 属于后端与合约，全部不迁移。
- 已确认死代码：`src/components/drawer/GlobalDrawerHost.tsx`、`src/components/drawer/RecipientPickerDrawer.tsx`、`src/stores/drawer.ts`、`src/lib/erc191.ts`、`src/lib/wallet.ts`。
- `src/lib/api.ts` 中有 27 个从未被外部引用的导出类型，以及整套未接线的 payroll run / payment attempt 遗留接口。
- `src/` 内已无中文字符（`rg '[\p{Han}]' src` 无匹配），迁移后需保持。
- Vite 最新为 8.2.1。Vite 8 用 Rolldown + Oxc 取代 Rollup + esbuild，要求 Node 22.12+。
- 包管理器统一用 **pnpm**（salary 源仓库已是 pnpm；新仓库不迁移 `pnpm-workspace.yaml`，因为不再有 `api` workspace）。
- **`vite-plugin-node-polyfills` 与 Vite 8 / Rolldown 不兼容，已有可直接照搬的解决方案。** 同 monorepo 下的 `stableflow-x` 已完成 Vite 7 → 8 升级，`stableflow-x/vite.config.ts` 文件头明确记录了原因：Rolldown 拒绝与结尾带斜杠的导入（`buffer/`、`process/`）冲突的字符串 alias，会报 folder-to-folder mapping 错误。该项目把插件从 `plugins` 数组里摘掉，换成"自定义 pre 插件去尾斜杠 + 正则精确匹配 alias + 在 `main.tsx` 里挂 Buffer 全局"三件套，技术栈与 pay 高度重合（wagmi/viem/RainbowKit/Solana/NEAR wallet-selector/`@noble/hashes`），可直接复用。
- 已核实 `salary/src` 无 enum、无构造函数参数属性，因此可以安全采用 `stableflow-x` tsconfig 里的 `erasableSyntaxOnly: true`。
已确认的决策：

- mock 放在 hooks 层，不保留 `api.ts` 请求层。
- **单笔付薪与批量付薪都走后端预构建交易接口，且是两套独立接口**，各含 `quote` / `swap` / `submit` / `status` 四步（口头约定，未定稿）。前端不再自行编码任何链上调用，职责收敛为：钱包连接、把后端下发的交易交给钱包签名并广播、提交 tx hash 并轮询状态。
- 保留前端链上余额读取（ERC20 / SPL / NEAR FT），走新的 RPC 代理层。

---

## 一、脚手架与依赖（需求 1）

**基准参考：`stableflow-x`。** 它已经跑通 Vite 8 + Rolldown + 多链钱包 SDK 的组合，脚手架直接以 `stableflow-x/vite.config.ts`、`package.json`、`tsconfig.*.json` 为模板，再叠加 pay 自身的差异，不要从 salary 的 Vite 7 配置起改。

包管理器：**pnpm**。安装、加依赖、跑脚本一律用 `pnpm` / `pnpm add` / `pnpm <script>`，不生成 `package-lock.json` 或 `yarn.lock`。`package.json` 写入 `"packageManager": "pnpm@10.19.0"`（与 `stableflow-x` 对齐）。`.gitignore` 忽略 `node_modules` 但提交 `pnpm-lock.yaml`。单包仓库，**不写** `pnpm-workspace.yaml`。

在 `stableflow-pay` 根目录新建：`package.json`、`vite.config.ts`、`tsconfig.json` / `tsconfig.app.json` / `tsconfig.node.json`、`index.html`、`.env.example`、`.gitignore`、`components.json`、`README.md`。`public/` 从 salary 整体复制（`auth/`、`avatars/`、`fonts/`、`howitwork/`、`icons/`、logo 与 favicon）。

不单独建 `vitest.config.ts` —— 按 `stableflow-x` 的做法，`vite.config.ts` 从 `vitest/config` 导入 `defineConfig` 并内联 `test: { environment: "node", include: ["src/**/*.test.ts"] }`，一个配置文件搞定，避免两份配置里的 alias 走偏。

包名改为 `stableflow-pay`，移除 `workspaces`、所有 `*:api` / `deploy:*` / `db:migrate` 脚本，只留 `dev` / `build` / `check` / `test` / `preview`。README 里的命令写成 `pnpm dev` / `pnpm build`。`build` 脚本沿用 `stableflow-x` 的堆内存设置（多链钱包 SDK 体积大，容易在收尾阶段爆 Node 堆）：

```
"build": "NODE_OPTIONS='--max-old-space-size=8192' tsc -b && NODE_OPTIONS='--max-old-space-size=8192' vite build"
```

依赖版本按 `stableflow-x` 已验证的组合钉住：

- `vite@^8.2.1`、`@vitejs/plugin-react@^5.1.0`、`vitest@^4.1.10`、`@tailwindcss/vite` + `tailwindcss@^4`。
- **不安装 `vite-plugin-node-polyfills`**（`stableflow-x` 只是留着没删，plugins 数组里并未使用）。改为把 polyfill 包提为直接依赖：`buffer`、`process`、`stream-browserify`、`util`、`events`。
- 新增 `@noble/hashes@^2.2.0`（RPC HMAC 签名，与 `stableflow-interface` / `stableflow-x` 一致）。
- 移除 `shadcn`（CLI 不应作为运行时依赖）；移除迁移后无引用的依赖（逐个 `rg` 确认，重点核查 `near-api-js`、`bs58`、`motion`、`date-fns`）。
- 保留 `wagmi`/`viem`/`@rainbow-me/rainbowkit`/`@solana/wallet-adapter-*`/`@solana/web3.js`/NEAR wallet-selector：签名广播与余额读取都还需要它们。
- `@solana/spl-token` 仍需保留 —— 前端不再构造 SPL 转账，但 SPL 余额读取用到 `getAccount` 与 ATA 推导。`viem` 只保留 `erc20Abi` 中 `balanceOf` / `decimals` 这类读方法，不再需要 `encodeFunctionData`。
- 如果出现 `@solana/web3.js` 多版本共存导致的运行时报错，照搬 `stableflow-x` 的 `pnpm.overrides`：`{ "@solana/web3.js": "~1.98.4" }`。

### `vite.config.ts` 关键构成（照搬 `stableflow-x`）

1. **自定义 pre 插件 `normalizeNodeBuiltinImports()`**：拦截以 `/` 结尾的 Node builtin 导入（`buffer/`、`process/`、`stream/`、`util/`、`events/` 及其 `node:` 前缀形式），去掉尾斜杠后重新 resolve。这是绕开 Rolldown "folder-to-folder mapping" 报错的关键，必须 `enforce: "pre"` 且排在 `react()` 前面。
2. **正则精确匹配 alias**，用 `createRequire(import.meta.url).resolve()` 解析出真实入口文件，避免前缀式重映射污染 `buffer/index.js` 这类深层导入：

```ts
const bufferEntry = require.resolve("buffer/");
const processEntry = require.resolve("process/browser.js");
const streamEntry = require.resolve("stream-browserify");
const utilEntry = require.resolve("util/");
const eventsEntry = require.resolve("events/");
// resolve.alias 用数组 + 正则形式：{ find: /^buffer$/, replacement: bufferEntry } …
// 同时为每个包补一条 /^node:xxx$/
```

3. **`optimizeDeps`**：`esbuildOptions` 已废弃，改为 `rolldownOptions.transform.define`；`include` 列 `["buffer", "process", "stream-browserify", "util", "events"]`（注意是 `stream-browserify` 而非 `stream`）；保留 `force: true`。
4. **`define`** 保持 salary 原样：`global: "globalThis"`、`"process.env": "{}"`、`"process.browser": "true"`。
5. **Buffer 全局**不再由插件注入，改在 `src/main.tsx` 顶部手动挂（必须是文件第一批语句，早于任何钱包 SDK 导入）：

```ts
import { Buffer } from "buffer";
if (typeof window !== "undefined") {
  (window as any).Buffer = Buffer;
}
```

salary 原有的 `src/polyfills.ts` 因此可以删掉，polyfill 职责合并进 `main.tsx` 与 vite 配置两处，不再有第三个地方。

6. **`build`**：`reportCompressedSize: false` + `chunkSizeWarningLimit: 2000`（同理由：多链钱包 SDK 体积）。
7. **`server`**：保留 `port: 5173`，但删除 `server.proxy` 的 `/api` 转发（不再有本地 Worker）；后续对接接口时由 `VITE_API_BASE_URL` 直连，配置里留注释说明。

### tsconfig

以 `stableflow-x/tsconfig.app.json` 为模板：`target/lib: ES2022`、`moduleResolution: "bundler"`、`verbatimModuleSyntax: true`、`erasableSyntaxOnly: true`、`noUncheckedSideEffectImports: true`、`strict: true`、`noUnusedLocals/Parameters: false`，`tsBuildInfoFile` 指向 `./node_modules/.tmp/`（避免像 salary 那样把 `*.tsbuildinfo` 落在仓库根目录）。根 `tsconfig.json` 用 `references` 指向 app / node 两份。

`.env.example` 变量（并在 `src/vite-env.d.ts` 的 `ImportMetaEnv` 中声明）：

- `VITE_WALLETCONNECT_PROJECT_ID`
- `VITE_RPC_PROXY_HOST`（注意：source 项目用的是拼写有误的 `VITE_PRC_PROXY_HOST`，新仓库改正为 `RPC`）
- `VITE_RPC_SECRET_KEY`
- `VITE_API_BASE_URL`（占位，后续对接接口用）

---

## 二、目录结构

```
src/
├── main.tsx  App.tsx  styles.css  vite-env.d.ts   # Buffer 全局在 main.tsx 顶部挂载
├── router/           # 路由表 + guards
├── layouts/          # AppLayout
├── types/            # 领域类型，替代原 api.ts 的类型区
├── mocks/            # fixtures + 内存 db + 延迟模拟
├── hooks/            # react-query hooks，queryFn 目前指向 mocks
├── stores/           # zustand
├── lib/
│   ├── rpc/          # 新增：签名 + 链 RPC 注册表 + 各链客户端
│   └── ...           # format / amount-input / address-validation / utils / logo ...
├── config/           # chains.ts 等
├── components/
│   ├── ui/           # shadcn 基元（纯展示）
│   ├── common/       # 新增：通用非业务组件
│   ├── icons/
│   └── <feature>/    # 业务组件
├── views/
└── wallet/           # 钱包连接 + 余额读取 + 广播后端下发的交易
```

---

## 三、数据层：类型 + hooks 级 mock（需求 2）

不迁移 `src/lib/api.ts`。拆成三部分：

1. **类型** → `src/types/`，按域拆为 `auth.ts`、`org.ts`、`recipient.ts`、`payment.ts`、`overview.ts`、`invite.ts`、`batch.ts`。只保留实际被引用的类型，删除全部 27 个死类型与 payroll / payment-attempt 遗留类型（`PayrollRun`、`PayrollSchedule`、`PayrunItem`、`PaymentAttempt`、`QuickPayQuote`、`ChainRecord` 等）。`ApiError` 类移到 `src/lib/api-error.ts` 保留，错误提示逻辑（`lib/quote-error.ts`、`auth-shared.tsx`）依赖它。

2. **mock 数据** → `src/mocks/`：
   - `fixtures/*.ts`：静态种子数据（org、recipients、payments、overview、invite、my-pay）。
   - `db.ts`：模块级可变内存状态，让 create / update / delete 能反映到列表查询，UI 交互闭环。
   - `delay.ts`：`await mockDelay()` 模拟网络延迟，保证 loading 态可见。

3. **hooks** → `src/hooks/` 保持原有 react-query 结构与 query key 不变，只把 `queryFn` / `mutationFn` 指向 mock。每个 hook 顶部加固定格式注释，供后续对接 agent 使用：

```ts
/**
 * Recipients list.
 * TODO(api): replace mock with `GET /org/employees`
 *   query: { page, pageSize, q?, type?, status? }
 *   response: RecipientListResult
 */
```

只迁移实际在用的 hooks：`use-auth-api`、`use-org-api`、`use-recipients-api`、`use-overview-api`、`use-pay-api`、`use-employee-api`、`use-pending-payments`、`use-payment-wallet`、`use-token-balances`、`use-quick-pay-commit-queue`、`use-media-query`、`use-evm-wallet-info`、`use-open-wallet-modal`、`use-pay-origin-token`、`use-toast`。

两个例外：`use-payout-ownership` 不迁移（需求 11 删掉钱包验证）；`use-batch-payout-api.ts` 不照搬原版（原版只服务被删掉的 Batches 列表），按需求 3 重写为四步骤接口，并新增同构的 `use-single-payout-api.ts`。

---

## 四、RPC 代理层（需求 10）

新增 `src/lib/rpc/`，移植 stableflow-interface 的方案。改造后 RPC 层的用途收敛为两件事：读取代币余额，以及广播后端下发的已签名交易（EVM 由 wagmi 内部走这层 transport，Solana 需要 `Connection` 才能 `sendRawTransaction`）。

**`signature.ts`** — 移植 `stableflow-interface/src/libs/signature.ts`：同步 HMAC-SHA256（`@noble/hashes`，无 `crypto.subtle`，所以能在同步的 transport 构造里调用），签名串为 `` `${chain}${timestamp}` ``（无分隔符），timestamp 为 Unix 秒，输出 header `x-hmac-signature` / `x-timestamp`。

**`chain-rpc.ts`** — 每条链的 RPC 列表，代理排第一、公共 RPC 兜底，并记录代理 slug。依据你给的 `availableChains`，pay 项目 15 条链的支持情况：

- 有代理：`eth→ethereum`、`base→base`、`arb→arbitrum`、`op→optimism`、`pol→polygon`、`bsc→bsc`、`avax→avalanche`、`gnosis→gnosis`、`xlayer→xlayer`、`plasma→plasma`、`bera→berachain`、`sol→solana`
- 无代理（只能公共 RPC）：`scroll`、`monad`、`near`

代理 URL 格式 `https://${VITE_RPC_PROXY_HOST}/rpc/${slug}`。无代理的链在配置里显式标注 `proxySlug: null` 并写注释说明原因，后端加上后只需补一行。

**`evm.ts`** — 用 viem `fallback([...])`，每个 URL 用 `http(url, cfg)`，`cfg` 只在 URL 属于代理域名时提供 `onFetchRequest`，在其中调用 `generateRpcSignature(slug)` 注入 header。这样每次请求都重新签名，不会因 timestamp 过期失效。同一个 transport map 同时给 `src/wallet/evm/config.ts` 的 wagmi `transports` 和 `getPublicClientForNetwork` 使用，替换掉现在 `src/wallet/evm/transfer.ts:33-35` 里硬编码的 Scroll RPC 和裸 `http()`。

**`solana.ts`** — `new Connection(url, { commitment, httpHeaders })`，并移植 interface 的 Proxy 包装做循环降级：捕获 fetch / timeout / 401 / 403 / 429 / 503 / network 类错误时切下一个 endpoint，非网络错误直接抛出。替换 `src/wallet/solana/provider.tsx:10-21` 和 `src/wallet/solana/transfer.ts:13-24` 里的 `VITE_SOLANA_RPC_URL` 读取。

**`near.ts`** — 代理不支持 near，所以只做多公共 RPC 的顺序 fallback（`src/wallet/near/transfer.ts:12-28` 现在是单 URL 裸 `fetch`）。文件头注释写明：代理支持 near 后，只需在 `chain-rpc.ts` 补 slug，签名注入逻辑复用 `evm.ts` 的写法。

注意 salary 现在的 `.env.local` 已经把 `VITE_SOLANA_RPC_URL` 指向 `https://rpc.stableflow.jimmygu.com/rpc/solana`，但没有带 HMAC header，只是靠白名单放行。新的 RPC 层要把签名补上，不要沿用裸 URL 的用法。

---

## 五、按需求逐项改造

**需求 3 — 单笔与批量付薪都走后端预构建交易接口**

这是本次改造最核心的一项。前端不再自行编码任何链上调用：只提交"给谁、发多少、什么币、哪条链"，后端负责查报价、构造交易；前端拿到交易后交给钱包签名广播，再把 tx hash 提交回后端并轮询状态。

**单笔与批量是两套独立接口。** 每套预计包含四个步骤（`quote` / `swap` / `submit` / `status`）。注意：这只是口头约定，**endpoint 路径、请求响应字段、是否真的四个步骤都未定稿**，具体等后端实现。因此前端要做的是搭好四步骤的骨架与调用时序，把不确定的部分全部收敛到两个 hook 模块里，后端定稿时只改这两个文件。

四个步骤在前端的职责，以及它们各自替代了 salary 的哪些调用：

- **`quote`** —— 拿报价与预估成本，喂给 `YouPaySection` / `EstCostRow` 展示。单笔替代 `quoteQuickPayDry` + `quoteQuickPay`；批量替代 `BatchPayoutDialog.runQuotes` 里那圈并发逐条报价。
- **`swap`** —— 拿到待签名交易。这一步取代了前端全部的 calldata 编码：单笔替代 `encodeErc20Transfer` + `sendOriginDeposit`，批量替代 `BATCH_PAYOUT_ABI` 的 approve + execute 构建。
- **`submit`** —— 把签名广播后的 tx hash 交回后端。单笔替代 `commitQuickPay`，批量替代 `commitBatchPayout`；现有两个 commit queue store 保留，降级为 `submit` 的失败重试层。
- **`status`** —— 轮询到终态。替代 `reconcilePaymentAttempt` / `reconcileOpenPayments`，供 `PendingPaymentsDock` 与批量进度条使用。

对应两个 hook 模块，命名和文件一一对应，不要合并：

- `src/hooks/use-single-payout-api.ts` —— `useSinglePayoutQuote` / `useSinglePayoutSwap` / `useSinglePayoutSubmit` / `useSinglePayoutStatus`
- `src/hooks/use-batch-payout-api.ts` —— `useBatchPayoutQuote` / `useBatchPayoutSwap` / `useBatchPayoutSubmit` / `useBatchPayoutStatus`

两套接口的请求 / 响应类型也分开定义在 `src/types/payout.ts`（`SinglePayout*` 与 `BatchPayout*` 两组），**唯一共享的是 `swap` 返回的待签名交易结构** —— 因为签名广播的逻辑与单笔 / 批量无关，只与链有关，没必要写两份。这个共享结构用按链区分的联合类型，因为三条链的"待签名交易"形态本质不同：EVM 是 calldata，Solana 是序列化后的 transaction，NEAR 是 function-call action 列表。

```ts
/** Shared by both the single and batch `swap` responses. */
export type PreparedPayout = {
  /** Server-generated id; echo it back on submit / status so the backend can reconcile. */
  payoutId: string;
  /** Quote expiry (unix seconds). Re-run quote + swap if the user idles past it. */
  deadline: number;
  chain: PreparedPayoutChain;
};

export type PreparedPayoutChain =
  | {
      kind: "evm";
      chainId: number;
      /** Sign and broadcast in array order; approve (if any) must land before transfer. */
      transactions: Array<{
        to: `0x${string}`;
        data: `0x${string}`;
        value?: string;
        label: "approve" | "transfer";
      }>;
    }
  | {
      kind: "solana";
      /** Base64 serialized unsigned VersionedTransaction, signed and broadcast in order. */
      transactions: string[];
    }
  | {
      kind: "near";
      receiverId: string;
      /** Passed straight into wallet-selector signAndSendTransactions. */
      actions: Array<{ methodName: string; args: Record<string, unknown>; gas: string; deposit: string }>;
    };
```

签名广播按链分派，收进 `src/wallet/broadcast-prepared-payout.ts`（替代被删掉的 `send-origin-deposit.ts`），对外只暴露一个 `broadcastPreparedPayout(prepared): Promise<string[]>` 返回 tx hash 列表：

- EVM：`switchChainAsync` 到 `chainId`，再按顺序 `sendTransactionAsync({ to, data, value })`。
- Solana：反序列化 base64 后交 wallet-adapter 的 `sendTransaction(tx, connection)`，`connection` 来自 `lib/rpc/solana.ts`。
- NEAR：直接把 `actions` 传给 wallet-selector 的 `signAndSendTransactions`，它自带广播。

改造点：

- 删除 `src/config/batch-payout-chains.ts` 整个文件（`BATCH_PAYOUT_ABI` 与 3 个合约地址）。
- `BatchPayoutDialog.tsx`：删除 `encodeFunctionData` 导入、`getBatchPayoutContract`（原 L318）、`readErc20Allowance` / `encodeErc20Approve`（原 L368-383）、execute calldata 构建与发送（原 L385-402）。`handleSign` 改为 `batchSwap` → `broadcastPreparedPayout` → `batchSubmit`（经 commit queue）→ `batchStatus` 轮询。
- `QuickPayPanel.tsx`：删除 `encodeErc20Transfer` 与 `sendOriginDeposit` 的调用（原 L445-463），以及 private 模式分支里的 ERC20 transfer 编码（原 L397-418），改为 `singleSwap` → `broadcastPreparedPayout` → `singleSubmit` → `singleStatus`。
- 报价展示（`YouPaySection`、`EstCostRow`、`use-pay-origin-token`）保留，数据来源从前端算改为各自 `quote` 接口的返回值，mock 里给出对应形状。
- 保留：全部 step 组件、`BatchEmployeeSelectTable`、`batch-payout/config.ts`、`utils.ts` 的草稿校验、两个 commit queue store 与其 hook（降级为 `submit` 重试层）、`BatchPayoutButton`、余额预检（走 RPC 层读余额）。

### 留给后端定稿的待确认项

两个 hook 模块顶部各写一段 `TODO(api)` 块，把以下问题列清楚。这些都是会影响前端时序的点，不要自己猜一个答案然后埋进代码里：

- `quote` 是否需要分 dry / live 两次。salary 现在是两步：先 dry-run 只为展示预估成本，用户点确认后再要一次 live 报价拿存款地址。如果新接口的 `quote` 只有一种，前端要相应合并。
- 批量的 `quote` 是一次请求带整个 items 数组，还是仍需前端并发逐条请求。如果是后者，`lib/async-pool.ts` 的并发限流要保留；如果是前者，可以删掉。
- `swap` 返回的交易里是否包含 ERC20 approve，以及 approve 是否需要独立成一步等待确认后再要下一笔。当前 `PreparedPayoutChain` 的 EVM 分支用 `label: "approve" | "transfer"` + 数组顺序表达这个约束。
- 报价有效期过期后，是重新 `quote` 还是直接重新 `swap`。
- `submit` 的幂等键是什么。salary 现在是前端自己生成 `batchId`（`batch-payout/utils.ts` 的 `makeBatchId`），如果改由后端在 `quote` / `swap` 阶段下发 `payoutId`，前端这个生成逻辑就该删掉。
- `status` 的轮询间隔、终态枚举，以及批量场景下是返回整批聚合状态还是逐条明细（`BatchPayoutDialog` 的进度条需要逐条）。
- 单笔与批量的四个 endpoint 实际路径与方法。mock 阶段先按 `TODO(api)` 注释里写的占位路径组织代码，不要在多处硬编码字符串。

**需求 4 — Add Recipient email 全类型必填**

改 `src/views/admin/recipients/components/AddRecipientDialog.tsx`：label 与 `required` 从 `!isSelf && isEmployee` 改为对所有 admin 类型恒为必填（原 L575-586）；`submitAdmin` 的校验分支（原 L366-381）合并为统一的"必填 + 格式校验"，不再按 `isEmployee` 区分；提交 body 的 `email: emailRaw || null`（原 L401）改为 `email: emailRaw`。

**需求 5 — /payments 去掉 Batches 列表**

`src/views/admin/PaymentHistoryView.tsx` 删除 `tab` state、`HistoryTabs` 渲染与条件分支（原 L41-94），始终渲染 Payments section。删除文件 `payment-history/components/HistoryTabs.tsx`、`payment-history/components/BatchHistoryList.tsx`，以及 `payment-history/config.ts` 里的 `BATCH_HISTORY_PAGE_SIZE`。保留 `PaymentHistoryTable`、`HistoryMemoCell`、`TxLink`。批量发薪产生的记录以单条形式出现在 Payments 表格中。

**需求 6 — /recipients 去掉周期选择框**

`src/views/admin/recipients/components/RecipientsToolbar.tsx` 移除 `PaymentPeriodPicker` 渲染与相关 props；`src/views/admin/RecipientsView.tsx` 移除 period state 与传参。`PaymentPeriodPicker` 组件本身保留（`/overview` 仍在用），`periodKeyFromDate` / `formatPeriodLabel` 工具函数也保留（`/payments`、`/overview` 在用）。

**需求 7 — 邀请流程加密码**

重写 `src/views/auth/InviteView.tsx`：

- 删除原 L54-74 的自动 accept `useEffect`。
- resolve 成功且 `!accountExists` 时，渲染邀请信息（组织名、email、角色）+ `password` + `confirm_password` 两个输入框 + "Accept invitation" 按钮。
- 校验：长度 8-50（`minLength=8` / `maxLength=50` + 提交前校验并给出明确错误文案）、两次输入一致。
- 点击后调用 `useAcceptInviteMutation` 传 `{ token, password }`；成功后用返回的账户信息 `applyAuthedUser`，再 `navigate("/my-pay", { replace: true })`。
- 保留 `accountExists` 分支（引导去登录）与 resolve 失败分支。
- 密码长度常量与校验函数放 `src/views/auth/config.ts`，供 `RegisterView` 与 `ChangePasswordDialog` 复用，避免三处各写一套规则。

**需求 8 — 金额最多 2 位小数**

`src/lib/amount-input.ts` 新增导出 `AMOUNT_MAX_DECIMALS = 2`，`parsePositiveDecimal` 与 `sanitizeDecimalInput` 的默认值从 6 改为 2，并在文件头注释说明"业务规则：所有 token 统一 2 位小数，与 token decimals 无关"。调用点全部改为不传第二参数或显式传常量：

- `AddRecipientDialog` 的 Compensation 输入（原 L596-603，目前完全没有 sanitize，是唯一的漏洞）
- `batch-payout/steps/EditAmountsStep.tsx`（原 L73、L114，目前用 `dest.decimals`）
- `batch-payout/BatchPayoutDialog.tsx`（原 L247）
- `batch-payout/utils.ts` 的 `validateDraftAmount`（原 L43-44）与 `defaultAmountForEmployee`（原 L19）
- `quick-pay/QuickPayPanel.tsx`（原 L223-229、L625、L659，目前用 `destToken?.decimals ?? 6`）
- 展示侧 `formatTokenMinor` 的 `maximumFractionDigits` 同步改为 2

补一个 `src/lib/amount-input.test.ts` 覆盖截断、粘贴、前导零、超长小数。

**需求 9 — 员工端 edit profile 限制字段**

`AddRecipientDialog` 的 `variant="self"` 分支：`name` 与 `email` 输入框改为 `disabled` 并加说明文案（如 "Contact your admin to change this"），只保留 avatar / token / network / wallet address 可编辑。`submitSelf`（原 L337-345）的 payload 去掉 `name` 与 `email`，只提交 `{ avatar_url, token, network, endpoint }`。Type / Role / Compensation / Schedule / Payment Date 原本在 self 模式已隐藏，保持不变。

考虑到 self 模式的字段集合与 admin 模式差异已经很大，把 self 表单从 `AddRecipientDialog` 拆成独立的 `src/views/employee/my-pay/components/EditMyProfileDialog.tsx`，两者共用 `common/Field` 与 avatar 选择器。这样 admin 与 employee 两条线互不干扰，后续改动风险更低。

**需求 11 — 去掉钱包验证功能（管理员 + 员工）**

"钱包验证"指 challenge → `signMessage` → verify 这条证明地址所有权的链路。管理员端和员工端各有一套，全部去掉，包括对应的"已验证 / 未验证"状态展示。

整文件删除：

- `src/hooks/use-payout-ownership.ts`（员工证明收款地址所有权，调用 `createPayoutChallenge` + `verifyPayout`）
- `src/components/PayoutOwnershipActions.tsx`（验证操作按钮组）
- `src/components/EmployeePayoutWalletDialog.tsx`（员工收款钱包弹窗，整个存在意义就是验证）

四个接口不迁移到 mock 层：`/records/me/payout/challenge`、`/records/me/payout/verify`、`/records/wallet/challenge`、`/records/wallet/verify`。

`src/components/WalletConnect.tsx`（管理员付款钱包）**保留绑定、删除验证** —— 绑定还有用，因为要确定用哪个钱包付款：

- 删除 `verify()`（原 L99-134）、Verified / Unverified 徽章（原 L209-218）、"Connect the bound wallet to verify ownership" 提示（原 L230-234）、"Verify ownership" / "Connect to verify" 按钮（原 L243-259）。
- 按钮区简化为：已绑定 → "Use a different wallet" + "Done"；未绑定 → "Connect wallet" + "Save"。
- 默认 `description` 文案（原 L35）去掉验证相关表述。
- `onBound` 回调 payload 去掉 `wallet_verified`。

字段与辅助函数删除：

- `AuthUser.wallet_verified`、`MyPayout.payout_verified_at`、`Employee.payout_verified_at` 三个字段从 `src/types/` 中去掉。
- `src/lib/admin-wallets.ts`：`ChainWalletBinding` 从 `{ address; verified }` 简化为 `{ address }`；`withWalletBinding` 去掉 `verified` 入参；`withActiveWallet` / `withoutWalletBinding` 不再写 `wallet_verified`。
- `src/views/admin/recipients/utils.ts` 删除 `isVerified()`。
- `use-employee-api.ts`（原 L85）删掉 `wallet_verified: result.payoutChanged ? false : …` 的重置逻辑；`updateMyProfile` 响应里的 `payoutChanged` 随之失去消费者，mock 响应形状里也不要带。

五处验证徽章清理：

- `RecipientCells.RecipientWalletCell` —— 它的入参就是 `Pick<Employee, "payout_verified_at" | "status">`，纯验证展示，整个组件删除，同时去掉 `RecipientsTable`（原 L54、L96）和 `BatchEmployeeSelectTable`（原 L87、L132）里的对应表格列。
- `RecipientDetailCard`（原 L74）、`MyPayProfileCard`（原 L30）去掉 verified 徽章。
- `AppHeader`（原 L68、L93-109）去掉 `verified` 变量与头像旁的绿点 / 灰点。

行为变更：

- **取消"可支付"门槛。** `BatchEmployeeSelectTable` 原先靠 `isVerified()` 决定收款人能否被选中，现在全部可选，合法性校验交给后端 prepare 接口。
- `RecipientsView.openInviteToVerify`（原 L129-139）失去意义，合并回普通的 `openInviteFor`，去掉 `isVerified` 提前返回；"没有 email 就不能邀请"的守卫保留作为防御（需求 4 之后 email 已必填，正常不会触发）。
- **员工端不再需要连接钱包（已与需求方确认）。** 员工唯一的链上动作就是证明收款地址所有权，去掉之后他们只需填地址。因此 `AppHeader` 员工分支的 `useWallet(employeeKind)` 与连接态灰字逻辑（原 L69-74）一并去掉，header 按钮退化为"头像 + 收款地址"的纯展示，点击打开需求 9 的 `EditMyProfileDialog`（收款 token / 链 / 地址就是在那里填）。钱包连接能力只保留给管理员付款用。

**连带简化：`signMessage` 变成完全无消费者（已与需求方确认）。** 全项目原本只有三处用它 —— 本需求删掉的两处验证，以及需求 3 删掉的 QuickPay private 模式 intent 签名（原 `QuickPayPanel.tsx:401`）。两个需求叠加后归零，所以 wallet 层可以一起瘦身：

- `src/wallet/evm/adapter.ts` 去掉 `useSignMessage` 与 `signMessage`
- `src/wallet/near/adapter.ts` 去掉 NEP-413 `signMessage`，`src/wallet/near/provider.tsx` 去掉 `NEAR_SIGN_RECIPIENT`
- `src/wallet/solana/adapter.ts` 去掉 `signMessage` 与 `toBytes`
- `src/wallet/types.ts` 去掉 `SignMessageParams` / `SignMessageResult` 及 `WalletAdapter.signMessage`，`src/wallet/index.ts` 同步去掉 re-export

（`src/lib/erc191.ts` 本来就在删除清单里，它是这条链路的签名工具。）

迁移时要注意 `sameAddress` / `isAddressValid`（`src/lib/address-validation.ts`）**要保留** —— 它们在管理员绑定钱包与地址输入校验里还在用，不属于验证链路。

---

## 六、删除清单

再次强调：本节以及需求 3 / 11 里的"删除"，一律指**新仓库 `stableflow-pay` 中不创建这些文件**，不是去 `salary` 里删。`salary` 全程只读。

不迁移的目录与文件：`api/`、`contracts/`、`functions/`、`docs/`、`outputs/`、`dist/`、`.wrangler/`、`.pnpm-store/`、`wrangler.toml`、`pnpm-workspace.yaml`、`.gitmodules`、`TODO.md`。

不迁移的源文件：

- `src/components/drawer/GlobalDrawerHost.tsx`、`src/components/drawer/RecipientPickerDrawer.tsx`、`src/stores/drawer.ts`（未挂载的 drawer 子系统）
- `src/lib/erc191.ts`（前端零引用）
- `src/lib/wallet.ts`（废弃 re-export）
- `src/lib/api.ts`（拆分为 `types/` + `mocks/`）
- `src/config/batch-payout-chains.ts`（合约 ABI 与地址）
- `src/hooks/use-batch-payout-api.ts`（原版只服务 Batches 列表；按需求 3 整体重写为 quote/swap/submit/status 四步骤）
- `src/views/admin/payment-history/components/HistoryTabs.tsx`、`BatchHistoryList.tsx`
- `src/wallet/send-origin-deposit.ts`（前端跨链存款编排，整体由后端 prepare 接口取代）
- `src/polyfills.ts`（Vite 8 下 polyfill 改由 vite.config 的 alias + `main.tsx` 顶部挂 Buffer 承担）
- `src/hooks/use-payout-ownership.ts`、`src/components/PayoutOwnershipActions.tsx`、`src/components/EmployeePayoutWalletDialog.tsx`（需求 11：钱包验证链路）
- `src/views/admin/recipients/components/RecipientCells.tsx` 里的 `RecipientWalletCell`（纯验证状态展示；文件其余 cell 保留）

以下三个文件保留，但只留余额读取，删掉全部构造/发送交易的导出：

- `src/wallet/evm/transfer.ts` → 更名 `src/wallet/evm/balance.ts`，只留 `readErc20Balance` 与 publicClient 获取；删除 `encodeErc20Transfer`、`encodeErc20Approve`、`readErc20Allowance`。
- `src/wallet/solana/transfer.ts` → 更名 `src/wallet/solana/balance.ts`，只留 `readSplBalance`；删除 `sendSplTransfer`（含 ATA 创建、`getLatestBlockhash`、`sendRawTransaction`、`confirmTransaction`）。
- `src/wallet/near/transfer.ts` → 更名 `src/wallet/near/balance.ts`，只留 `readNearFtBalance`；删除 `sendNearFtTransfer`（含 `storage_deposit` / `ft_transfer` 构造）。

保留但需说明：`src/views/admin/HowItWorksView.tsx` 与 `how-it-works/**` 是已路由的公开营销页，`AuthShell` 有链接指向它，因此保留；如果不需要可以单独砍掉（连带 `public/howitwork/` 约 15 张图）。

---

## 七、通用组件抽象

新建 `src/components/common/`，收拢无业务依赖的组件：

- `Pagination`（4 处使用，纯 `clsx`，直接平移）
- `SearchInput`（4 处使用，直接平移）
- `StatCell`（3 处使用，直接平移）
- `IdentityAvatar`、`TokenChainIcon`、`EmptyState`、`LoadingSpinner`
- `Field`：统一现在重复实现的表单字段 —— `views/auth/auth-shared.tsx` 的 `AuthField` 与 `AddRecipientDialog` 内联的 `Field`
- `ResponsiveDialog`：目前直接 import `lib/rainbowkit-overlay`，把这层耦合改成可选 prop（如 `guardOverlay?: boolean`），使其成为纯 UI 组件
- `AvatarPicker`：从 `AddRecipientDialog`（原 L477-524）抽出，供 admin 与 employee 两个表单复用

`src/components/ui/`（shadcn 基元）与 `src/components/icons/` 原样保留，本身已是纯展示。

明确不抽象的业务组件（依赖 store / hooks，抽象只会增加间接层）：`TokenNetworkDialog`、`you-pay/*`、`quick-pay/QuickPayPanel`、`pending-payments/PendingPaymentsDock`。

---

## 八、代码规范约定

- 全部注释与 UI 文案用英文；仓库内不出现中文（迁移完成后跑 `rg '[\p{Han}]' src` 校验为空）。
- 每个 hook 顶部按第三节的固定格式写 `TODO(api):` 注释，标注将来要对接的 endpoint、method、请求参数与响应类型。
- 以下五处各写一段实现说明注释，它们是后续对接工作的主要接口面：`src/hooks/use-single-payout-api.ts` 与 `src/hooks/use-batch-payout-api.ts` 顶部的 `TODO(api)` 待确认清单、`src/types/payout.ts` 的 `PreparedPayout` 契约（含三条链的差异与签名顺序约束）、`src/wallet/broadcast-prepared-payout.ts` 的分派逻辑、`src/lib/rpc/chain-rpc.ts` 里代理不支持的链、`src/mocks/db.ts` 的可变状态边界。
- 注释只写代码本身表达不出的约束和契约，不逐行解释代码做了什么。

---

## 九、验收

1. `pnpm build`（Vite 8 + Rolldown）通过，`pnpm check`（`tsc -b`）零错误。
2. `pnpm dev` 下 NEAR / Solana 相关页面不报 `Buffer is not defined` 或 `process is not defined` —— polyfill 换方案后这是最可能回归的点，必须实际打开 `/pay` 与 `/my-pay` 并连一次钱包验证。
3. `pnpm test` 通过（`address-validation`、`async-pool`、`quick-pay/utils`、新增 `amount-input`）。
3. 手工走查全部路由：`/login`、`/register`、`/invite/:token`、`/howitworks`、`/teams/create`、`/pay`、`/recipients`、`/overview`、`/payments`、`/my-pay`，确认 mock 数据渲染、loading 与空态正常。
4. 逐项核对需求 3-11 的行为改动。
5. `rg '[\p{Han}]' src` 无输出。
6. 前端已无自行构造链上调用的痕迹：`rg -n 'encodeFunctionData|encodeErc20|BATCH_PAYOUT|0x[0-9a-fA-F]{40}' src` 无输出（`erc20Abi` 仅用于 `balanceOf` / `decimals` 读取属于例外，需人工确认）。
7. 钱包验证已清干净：`rg -n 'signMessage|payout_verified|wallet_verified|isVerified|Challenge|challengeId' src` 无输出。
8. 员工端全流程不出现任何"连接钱包"入口，管理员端付款钱包绑定仍可正常绑定 / 解绑 / 切链。