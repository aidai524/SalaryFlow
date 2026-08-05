# Payment 场景与隐私工资支付调研

调研日期：2026-08-04  
案例：Request Finance、Rise、Bitwage、Deel、Toku  
范围：支付/工资工作流、法币与数字资产轨道、审批、权限、链上可见性、合规边界，以及隐私工资 prototype。

> 本报告只使用官网、官方帮助中心、官方开发文档与标准组织资料。这里的“已核验”表示官方资料明确写出，不代表已登录产品实测，也不代表能力在所有国家、客户或套餐中均为 GA。

## 一句话结论

隐私工资不应被定义为“匿名发薪”或“雇主也看不到工资”。更可信的产品承诺是：

> 雇主、支付服务商及依法有权的审计/监管仍可获得必要信息；组织内每个人只在履职需要时看到必要字段；工资批次封存后不可悄悄修改；员工可证明收入资格，而不必交出完整工资单。

首版产品最值得做真的，不是复杂隐私链，而是：最小可见、限时解封、职责分离、批次封存、双人审批、诚实预检、可对账执行和独立审计。

## 案例能力地图

| 产品 | 最强场景 | 可借鉴的支付模式 | 隐私方式 | 关键边界 |
|---|---|---|---|---|
| Request Finance | 企业应付、发票、批量支付、会计工作流 | Payroll/bonus/payslip、CSV 批量、法币与数字资产结算、审批政策 | 托管 Business Account 可分离充值/出款地址并随机延迟；Aleo 路线可隐藏链上双方与金额 | Payroll 是否支持独立 maker-checker 没有清晰公开证据；平台与授权付款双方仍可见必要数据 |
| Rise | 全球承包商、AOR/EOR、混合薪资 | 雇主邀请，收款人自助 KYC、管理银行/钱包并按比例分配 | 官方描述 burn-and-mint 方式降低雇主、员工与薪资的公开链关联 | 属于 unlinkability/obfuscation，不应宣称匿名；原生多级 payroll 审批公开资料不足 |
| Bitwage | 现有工资系统之上的个人收款分配层 | 员工可把税后收入按比例分到银行和钱包；企业创建周期工资单 | 非托管减少平台余额风险 | 公开链地址、金额、时间仍可能被观察；不承担完整全球雇佣、工资税或分类责任 |
| Deel | 全球雇佣、承包商、Payroll 与审批闭环 | Payroll package 差异审核、多级顺序审批、替补人、差异阈值；多种稳定币入金/提款 | 平台内 RBAC、Sensitive Viewer、Privacy Sets、审计与认证 | 主要是应用权限，不是链上机密交易；稳定币所用公开链仍泄漏交易图谱 |
| Toku | crypto-native 全球工资与 HRIS 下方结算 API | 法币/稳定币入金，员工选择法币、稳定币或混合；承包商发票与批量支付 | 与 Aleo/Paxos Labs 的 USAD 私密工资可默认加密地址、金额和双方信息，并保留合规 view key | 官网同时出现上线、early access、Coming Soon 等表述；不能推断所有国家/集成/私密组合均已自助 GA |

### 1. Request Finance

已核验的模式：

- Admin/Finance Manager 可手工或 CSV 发起 payroll，最多 200 笔，区分合同计价币和结算币，并生成 payslip。[Payroll 流程](https://help.request.finance/en/articles/8624295-how-to-run-payroll)
- Bills、Direct Payments、Expenses 支持单/多级审批、金额或 Tag 条件、批量审批和 need-to-know 可见性。[Approval policies](https://help.request.finance/en/articles/9825973-approval-policies-overview)
- Private Payments 使用合作方托管钱包分离充值/出款地址，并加入随机延迟，降低公开链可关联性。[Private Payments overview](https://help.request.finance/en/articles/12958312-private-payments-overview)
- Aleo 私密付款可隐藏链上发送方、接收方、金额与币种，但平台中的付款双方仍能看到完整 payable。[Aleo public vs private payments](https://help.request.finance/en/articles/10972006-what-is-the-difference-between-private-and-public-payments-on-aleo-network)

判断：它最适合借鉴“应付对象 → 审批 → 批量支付 → 会计同步”的运营骨架；不要把 Bills/Direct Payments 的审批文档直接宣传成 Payroll 独立审批能力。

### 2. Rise

已核验的模式：

- 企业邀请后，承包商自助完成 KYC、填写资料、添加银行或钱包并选择提款方式；支持多个目的地与比例分配。[Rise payroll overview](https://www.riseworks.io/blog/best-payroll-platform-for-paying-global-teams-in-local-currency)
- 企业可用 USD 银行转账或 USDC/USDT 充值；员工可选择本地银行、稳定币或其他数字资产。[Stablecoin Payroll](https://www.riseworks.io/products/stablecoin-payroll)
- 官方称 burn-and-mint bridge 会打断一对一公开链路径，使外部观察者更难关联雇主、员工与薪资；平台内部仍需完整审计与 KYC/AML。[Crypto payroll privacy](https://www.riseworks.io/blog/are-crypto-payroll-payments-on-rise-public)

判断：最值得借鉴的是“收款人自己管理端点，雇主只看验证状态和脱敏指纹”。它降低外部关联，不等于协议级匿名或对平台保密。

### 3. Bitwage

已核验的模式：

- 企业可邀请 Employee、Contractor、Admin，逐人或 CSV 添加，建立一次性/周期工资单，状态为 Created → Received → Approved → Fulfilled。[Employer payroll workflow](https://support.bitwage.com/how-to-add-workers-as-an-employer-and-create-payrolls)
- 收款人可用 Allocations 按比例把收入分到银行账户和兼容钱包；当期付款进入 Received 后，分配会锁定。[Allocation settings](https://support.bitwage.com/updating-allocations-how-to-add-/-remove-your-bank-account-or-crypto-address)
- W-2 员工的原工资系统继续负责扣税，Bitwage 处理员工选择的税后部分；承包商付款也不代扣工资税。[Employee vs contractor](https://support.bitwage.com/employees-vs-contractors-whats-supported-and-whats-different)

判断：它很适合做“收款偏好层”参考。非托管不代表交易隐私；普通公开链仍可能暴露地址、金额与周期。

### 4. Deel

已核验的模式：

- Global Payroll 闭环是：提交工资输入 → 计算 payroll package → 客户查看差异并批准/退回 → Deel 或客户付款 → 发布 payslip。[Review payroll packages](https://help.letsdeel.com/hc/en-gb/articles/18940617896593-How-to-Review-and-Approve-Global-Payroll-Packages)
- 可分别设置提交与 package approval；支持按人/角色的多级顺序审批、批准人数、替补人与工资成本差异阈值。[Automatic and multi-level approvals](https://help.letsdeel.com/hc/en-gb/articles/41690939621265-How-to-Enable-Automatic-Payroll-Submission-and-Approval)
- Payer、Sensitive Viewer 与非敏感角色可分离；Privacy Sets 决定自定义字段对员工、经理、同事或管理员的可见性。[Admin roles](https://help.letsdeel.com/hc/en-gb/articles/7632094667281-What-Are-The-Different-Roles-For-Group-Admins-In-Deel) 与 [Privacy Sets](https://help.letsdeel.com/hc/en-gb/articles/19637271310865-How-Clients-Can-Collect-Worker-Information)
- 支持用 USDC/USDT 为多类发票注资，并在公开链上做监控、制裁筛查和必要人工审核。[Stablecoin funding](https://help.letsdeel.com/hc/en-gb/articles/42333671207697-Funding-Your-Deel-Account-and-Paying-Invoices-with-Stablecoins)

判断：最值得借鉴的是“突出与上周期差异，而非让审批人重新读全表”，以及显式展示审批人、层级、阈值和替补人。隐私主要是应用内权限，而非机密链结算。

### 5. Toku

已核验的官方主张：

- 可作为完整 Global Payroll/EOR，也可在 ADP、Workday 等系统下方作为稳定币执行层；企业用法币或稳定币入金，个人选择法币、稳定币或混合付款。[Stablecoin Payroll](https://www.toku.com/stablecoin-payroll)
- Toku、Aleo、Paxos Labs 宣布 USAD/Aleo 私密工资：地址、金额、发送方与接收方默认加密，Toku 仍处理扣税、报表、合同和 EOR。[Toku announcement](https://www.toku.com/resources/aleo-toku-and-paxos-labs-launch-first-private-stablecoin-payroll-solution-removing-the-final-barrier-to-enterprise-stablecoin-adoption)
- USAD 不是“无人可查”：合规服务持有 view key，可按法律要求解密；底层稳定币仍保留监管控制。[USAD FAQ](https://aleo.org/usad/)

判断：这是最直接的机密链工资参考，但可用性必须逐客户、国家、HRIS 和结算资产确认；官网营销表述不能代替实施验证或独立安全审计。

## 推荐的 Payment 产品流程

1. **建立 Payable**：导入固定薪资、奖金、费用、工时或承包商发票，保留来源与版本。
2. **收款人自助配置**：个人选择银行、公开链稳定币、私密轨道或混合比例；端点变更需再次验证和第二人批准。
3. **Preflight**：检查重复端点、金额突变、余额、网络、KYC、制裁、税务、工资媒介与当地规则；没接 API 的项显示 `not_checked`。
4. **Seal Payroll**：对批次版本、周期、人员行、端点指纹、策略版本做规范化摘要并签名；封存后修改必须生成 v2 并撤销旧审批。
5. **Private Review**：审批人默认只看人数、总额、环比、异常和自己辖区；查看个人净额必须选择理由、工单、MFA 和有效期。
6. **Approvals**：制单、复核、执行分离；审批人签同一批次摘要，超阈值追加 Treasury/Controller。
7. **Visibility Receipt**：执行前逐项说明公司同事、平台、链、KYC 商、支付商与监管方分别会看到什么。
8. **人工最终确认**：真实资金动作必须单独确认；provider payload 只由后端产生，带 idempotency key。
9. **Reconcile**：逐笔记录 provider reference、链上/银行结果、汇率、失败原因和 payslip；显式处理部分失败与重试。
10. **Audit & Recovery**：访问、解封、审批、执行、恢复都进入独立 append-only/WORM 审计；break-glass 需要双人、限时、告警。

## 隐私模型：四层而不是一个开关

### 1. 应用数据隐私

- 身份、薪酬、税务和收款端点分成不同加密域。
- RBAC 解决基础角色，ABAC 再结合租户、部门、职责、字段、目的、时间和设备风险。
- 逐个字段只在后端授权后返回；数据库行级权限不能替代服务端授权与字段加密。
- 参考：[NIST ABAC SP 800-162](https://csrc.nist.gov/pubs/sp/800/162/upd2/final) 与 [NIST Key Management](https://csrc.nist.gov/projects/key-management/key-management-guidelines)。

### 2. 批次完整性与治理

推荐状态机：

`draft → sealed → approving → approved → funding → submitted → settled / partial / failed → reconciled → archived`

Seal 时计算 manifest hash 并由后端签名；工资明文仍在 vault，审计只保存必要元数据和摘要。职责分离、最小权限和审计保护可参考 [NIST SP 800-53](https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final)。

### 3. 结算隐私

- 银行：信息不上链，但银行、支付商和合规服务仍会处理必要字段。
- 普通 EVM 稳定币：发送方、接收方、金额与时间通常公开；stealth address 只降低长期地址关联，不隐藏金额或时序。
- 机密交易/私密链：可能隐藏金额或双方，但仍要评估 view key、托管、合规、工资法、钱包生态和独立安全审计。
- 测试网/早期软件只能放在 R&D 模式，不能承载真实工资。

### 4. 凭证与法定披露

- v1 可由雇主签发 `employment_status / income_band / currency / period / valid_until`，员工只披露租房或信贷所需 claim。
- SD-JWT 支持 claim 选择性披露和 holder key binding，但不自动提供 issuer-verifier unlinkability，也不替代传输层保密。[RFC 9901](https://datatracker.ietf.org/doc/html/rfc9901)
- “收入 ≥ X 且不泄露数值”若只是预先签发 income band，可信但粗粒度；真正任意阈值证明需要专门 ZK 电路、可信数据绑定和安全审计。

## 合规边界

- GDPR 要求数据最小化、目的限制、privacy by design/default、安全与恢复；删除权对法定义务和法律主张有例外。[GDPR official text](https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32016R0679)
- FATF 对虚拟资产服务要求 CDD、记录保存、可疑交易报告及安全传输发起人/受益人信息；“对公众和无关员工保密”与“对授权合规方可披露”可以同时成立。[FATF virtual assets](https://www.fatf-gafi.org/en/topics/virtual-assets.html)
- 合法性必须按“雇主实体 × 员工所在地 × 付款轨道”建矩阵；未知状态只能写 `待确认 / not_checked`，不能显示绿色“合规”。

## Prototype 已实现

- 8 月批次主屏：总额、人数、待审批、准备/封存/审批/执行进度。
- 四位虚构收款人；个人净额默认遮蔽。
- 选择理由与工单，模拟 30 分钟临时解封，再立即重新隐藏。
- 选择收款路线与 Visibility Receipt；明确公开链泄漏和服务商 `not_checked`。
- 本地审批、执行前预检、模拟完成；不生成虚假交易哈希。
- 收款人路线、2 人审批链、活动记录、角色可见性矩阵。
- 桌面 1536×1024 与移动 390×844 响应式交互。

## Prototype 没有伪装成真实的部分

| 界面能力 | 真实状态 |
|---|---|
| 星号/CSS mask | 仅界面遮罩，不等于加密 |
| 角色预览 | 不是服务端访问控制 |
| Seal | 流程封存模拟，非密码学封存 |
| Approval | 本地演示审批，未验证身份或 MFA |
| Audit | 可修改的内存记录，非防篡改日志 |
| KYC/AML/税务/余额/网络 | `not_checked` |
| Payment | Simulation，未发送资金 |
| 交易证明 | 未生成 tx hash 或 explorer link |
| 选择性披露凭证 | 未签发、未验证 |

## 推荐下一步

1. 先访谈 3–5 位 Payroll/Finance/Controller，验证“默认只看差异与异常”是否足够审批。
2. 把原型拆成两个权限 persona：Payroll Preparer 与 Finance Approver，做任务测试。
3. 若要做真实 MVP，优先接入：企业 SSO/MFA、服务端策略、KMS/HSM 字段加密、支付 provider sandbox、独立审计存储。
4. 把机密链结算独立为 `Privacy Rail Lab`，testnet-first，不与首版真实工资绑定。
5. 每个国家和轨道建立合规矩阵；在销售、法律和支付方确认前持续显示 `待确认`。
