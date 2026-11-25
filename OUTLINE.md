# LARE 博客写作框架

这里保存最初的章节和配图计划，实验材料的现状见[博客的实验依据](EXPERIMENTS_NEEDED.md)。完整正文与修改入口见 [中文稿](article/zh-CN.md) 和 [英文稿](article/en.md)。

现稿有八节，开头的 TL;DR 暂留空白。第 1 节从 1.5B 模型的早期评测讲到 124M 模型的梯度诊断。第 2 节对照四组高数学配方，并用一对数学与通识语料的混合实验讨论 GSM8K 的延迟增长。第 3 节从已有配比方法过渡到配比实测、阶段训练与遗忘。第 4 节用论文的双域线性回归模型解释折中。第 5 节写固定数据下的常数权重搜索和 LARE。第 6 节检验多领域与长训练，第 7 节对照逐来源加权和按校准 loss 分组。第 8 节总结数据配比和 loss 权重怎样影响模型学到的知识与数学能力。

以下保存最初的十四节构思及备选图。当前图表和数据出处见[博客的实验依据](EXPERIMENTS_NEEDED.md)。

## 1. 训练目标

想让一个预训练模型既有知识，又能做基本的数学推理，一个很自然的做法是把知识类数据和数学题解混在一起。前者提供事实和概念，后者提供解题过程；对语言模型来说，两者都是通过预测下一个 token 来学习的。

我们的实验也是从这个想法开始的。模型规模约为 1.5B，早期计划先训练 30B tokens，再根据实验结果调整配方。效果上主要看 [MMLU](https://arxiv.org/abs/2009.03300) 和 [GSM8K](https://arxiv.org/abs/2110.14168)：前者考察不同学科的知识与问题求解，后者考察小学数学应用题中的多步推理。

按这个思路，接下来似乎就是在固定的训练预算内，找一个能兼顾两项分数的数据配比。然而，训练跑起来之后，我们发现 loss 在下降，GSM8K 却几乎没有提升。这就把一个更基本的问题摆到了面前：数学数据已经混进去了，为什么模型还是没有学出预期的数学能力？

拟放图：

- **可选：训练目标示意**：知识文本 + 数学题解 → 1.5B 模型 → MMLU、GSM8K 两个评测窗口。只交代目标，不提前展示结果。（示意图待画，不需要实验数据。）

4 月 10 日的计划是先做 30B-token 实验。[当周周报](https://docs.google.com/document/d/1LOsw1kCkT_XWHopT5HgreecLIDU6iz7V1T4qqj-Syuk/edit?tab=t.0) 图 1 使用 Nemotron 语料，配料预算中数学占 70B / 212B，约 33%。运行配置与评测指标见[实验记录](EXPERIMENTS_NEEDED.md)。

如何接下文：接实际训练现象：目标是两项能力都提升，但 GSM8K 几乎不涨。

## 2. GSM8K 停滞与排查

本节写什么：

- 展示现象：loss 在下降，但 GSM8K 提升很小。
- 概括实际做过的排查：评测口径、QA／mask、数据覆盖与过拟合。
- 说明为什么逐渐把问题集中到数据组成，以及数学监督在训练中是否充分。

拟放图：

- **主图已放在正文第 1 节。** 回顾知识与数学按 2∶1 混合的 124M 实验，用原始记录画出两域在线性层上的梯度范数。第 1 节的评测图对应早期 1.5B 训练。
- **可选：排查对照小表**：列评测方式、QA／mask、数据池等检查项，以及实际改动和观察结果。（已有周报，具体运行与结果待对应。）

可复核第 1 节的梯度曲线和同步采样步上的范数比值。[梯度记录](public/figures/domain-gradient-norm.json) · [实验依据](EXPERIMENTS_NEEDED.md)

如何接下文：接诊断实验：把数学比例大幅提高，看模型到底能不能学出来。

## 3. 高数学比例的诊断实验

本节写什么：

- 列出早期 math:wiki 配方，并说明这些数字的准确含义。
- 把 GSM8K 和 MMLU 放在一起看：数学改善了什么，知识表现付出了什么代价。
- 区分混合比例、数学数据池扩大、QA 格式调整的作用。

拟放图：

- **主图：高数学配方的双指标曲线**：左右放 GSM8K、MMLU，两个面板用同色表示同一配方。对比原配方与 math:wiki = 30:5、30:1、30:0，必要时加入 30:10；突出共同训练区间。（现稿第 2 节已按四条 SwanLab 轨迹重绘。）

现稿图 3a、3b 可切换 GSM8K、MMLU，两幅图使用相同的 20 个评测步。[四组配方与实测记录](public/figures/math-rich-pilot.json)

如何接下文：接配比问题：数学可以学出来，但知识不能因此被牺牲。

## 4. Data mixture：相关工作与方法分类

本节写什么：

- 这一节按 related work 来组织：已有论文怎样指导 mixture ratio，各条路线在优化什么，以及它们怎样启发自己的实验。
- 按研究问题归类，类别可以交叉；另外用 offline／online、proxy／目标模型等维度比较方法。
- 每类统一写：核心思路、代表论文、依赖什么信号、额外成本、迁移假设，以及对 1.5B 知识＋数学模型的启发。

### 4.1 问题定义与经验配比

- 先定义候选 domain、token 预算、采样概率和优化目标；区分平均验证 loss、目标 domain loss 与下游 benchmark 分数。
- 列出按语料规模采样、domain 均匀采样、temperature smoothing、人工比例搜索等基线；说明可用数据量和重复采样的假设。
- 区分样本级的数据筛选与 domain 级的预算分配；交代数据质量改善之后，为什么仍要决定各类数据各占多少。

### 4.2 用代理模型优化配比

- 解释先用小模型学习配比、再用于目标模型的流程；比较优化信号，说明迁移的是哪些权重，以及跨模型规模需要什么假设。
- 交代 reference model、验证数据和梯度计算的成本；与第 9 节固定数据流的 loss reweighting 对照，并说明两者在特定假设下的联系。

代表论文与阅读要点：

- [DoReMi](https://arxiv.org/abs/2305.10429)：基于 reference 的 excess loss 与 Group DRO，在 proxy 上求权重，再用于目标模型采样。
- [DoGE](https://proceedings.mlr.press/v235/fan24e.html)：用泛化估计做双层优化；重点写目标分布和 domain 之间的迁移信号。
- [FastMix](https://arxiv.org/abs/2606.14971)：联合优化 mixture 系数与单个 proxy；说明 loss-weight 重参数化及验证反馈。

### 4.3 拟合性能与 mixing laws，再搜索配比

- 概括共同流程：收集小规模实验 → 预测未跑过的配比 → 在拟合曲面上搜索 → 到目标规模验证。
- 比较预测目标、需要多少 proxy runs，以及能否外推模型大小和 token 数；讨论预测 loss 更低是否对应我们关心的 MMLU／GSM8K 取舍。

代表论文与阅读要点：

- [RegMix](https://arxiv.org/abs/2407.01492)：用多个小模型实验回归 mixture ratio 与性能的关系。
- [Data Mixing Laws](https://arxiv.org/abs/2403.16952)：拟合显式 mixing law，并与模型规模、训练步数的 scaling laws 结合。
- [AutoScale](https://arxiv.org/abs/2407.20177)：研究合适的配比怎样随训练规模变化，并外推数据分配。
- [CAMEL](https://arxiv.org/abs/2603.08022)：建模模型容量与配比的交互，并把验证 loss 的预测连接到 benchmark 预测。
- [Mixtures of Data Experts (MDE)](https://arxiv.org/abs/2502.15950)：用 data expert 的预测为 mixture 性能回归增加特征。

### 4.4 用模型合并降低配比搜索成本

- 介绍用 domain experts 的合并结果评估候选配比，减少为每个配方单独训练的成本；同时交代 expert 训练与评估开销。
- 比较合并模型的排名能否预测真实混合训练的排名；明确各论文研究的是 pretraining 还是 mid-training。

代表论文与阅读要点：

- [DeMix](https://arxiv.org/abs/2602.00747)：训练 component models，再用加权模型合并评估候选 data ratios。
- [MergeMix](https://arxiv.org/abs/2601.17858)：优化 expert 合并权重，作为 mid-training 配比搜索的代理。

### 4.5 在线调配比与动态采样

- 介绍为什么训练中途合适的比例可能变化；比较各方法的反馈信号、探索方式、更新频率和额外计算。
- 区分直接调整目标训练过程与在 proxy 上学习日程；讨论反馈噪声、调整滞后，以及是否需要目标任务数据。

代表论文与阅读要点：

- [ODM](https://arxiv.org/abs/2312.02406)：用 multi-armed bandit 在训练过程中更新采样比例。
- [Skill-It](https://arxiv.org/abs/2307.14430)：利用技能依赖与学习进度组织在线采样。
- [Aioli](https://arxiv.org/abs/2411.05735)：训练中估计 mixing-law 参数，据此动态更新配比。
- [Dynamic Gradient Alignment (DGA)](https://arxiv.org/abs/2410.02498)：用训练 domain 与目标任务的梯度对齐来调配比，交代目标任务数据需求。

### 4.6 Domain 关系与数据划分粒度

- 先问权重加给谁：source、topic、skill，还是与模型有关的 group；说明数据怎样分组与组间怎样分配权重是相互关联的。
- 介绍基于表示的 domain 关系，以及 source／topic 两种划分；给第 13–14 节留背景，同时区分 topic grouping 与我们按 loss 分组的做法。

代表论文与阅读要点：

- [Chameleon](https://proceedings.mlr.press/v267/xie25i.html)：用 domain embeddings、affinity matrix 和 leverage scores 确定权重，并适配新增数据。
- [Topic Over Source](https://arxiv.org/abs/2502.16802)：在多种配比算法下比较按 topic 和按 source 划分数据。

### 4.7 阶段日程与 continued pretraining

- 介绍 continued pretraining、后期专项数据和 annealing mixture 等随时间改变数据暴露的方式；区分预设日程与在线反馈控制。
- 列出阶段切换点、是否保留通用数据，以及遗忘问题；自己的两阶段对照和遗忘结果留到第 5 节展开。

代表论文与阅读要点：

- [Don’t Stop Pretraining](https://aclanthology.org/2020.acl-main.740/)：用 domain-adaptive／task-adaptive continued pretraining 作为改变训练分布的背景。
- [2 OLMo 2 Furious](https://arxiv.org/abs/2501.00656)：介绍 Dolmino Mix 与预训练 annealing 阶段的 curriculum。

### 4.8 配比影响能力的机制：容量、阈值与重复

- 归纳模型容量分配、配方跨规模迁移、unique data 与重复 tokens 的差别，以及能力随比例变化可能出现的阈值。
- 联系自己的目标：提高数学比例时如何保留知识。标清各论文的实验设置；合成任务的阈值不能直接给出本模型通用的 knowledge 最低比例。

代表论文与阅读要点：

- [Data Mixing Can Induce Phase Transitions in Knowledge Acquisition](https://proceedings.neurips.cc/paper_files/paper/2025/file/eee7ae5cf0c4356c2aeca400771791aa-Paper-Conference.pdf)：合成人物传记与 web data 的混合实验：比例和模型大小的阈值，以及容量分配解释。
- [Scaling Domain Data Repetition in LLM Pretraining](https://arxiv.org/abs/2608.14071)：介绍 domain 数据重复次数与模型规模、domain loss、过拟合之间的关系。

### 横向比较与接回自己的实验

- 统一比较：分配单位、优化目标、反馈信号、offline／online、proxy／reference 需求、搜索成本，以及最终向目标训练迁移什么。
- 区分 sampling probability、stage schedule 和 loss coefficient；说明等价关系依赖的假设，FastMix 的重参数化可在第 9 节接着讨论。
- 结合自己的预算与两项能力目标，交代从文献中得到哪些可尝试的选择，再引出 multi-stage 实验。叙述早期实验时，区分当时参考的工作与事后补充的文献。

拟放图：

- **主图：data mixture 方法分类图**：按 proxy 优化、性能预测、模型合并代理、在线采样、domain 结构、阶段日程分支组织；把容量和重复采样放在共同考虑因素中。标注输出是静态配比还是动态日程，以及代表论文。（文献结构示意图待画，不需要补实验数据。）
- **主表：统一维度的方法比较**：每行一种方法；列为优化目标、分配单位、反馈信号、proxy／reference 需求、offline／online、输出形式和额外成本。成本按原论文设置标注，不能直接编成跨论文的统一数字排名。（已列论文链接与阅读要点；详细成本项写正文时补齐。）
- **可选机制图：配比阈值**：在容量与阈值部分引用 phase-transition 论文图 2，保留原图坐标和实验设置，说明它对保留知识能力的启发。（已确定论文原图，尚未插入页面。）

图表与证据：以上链接构成初始阅读清单；用综述检查覆盖范围，各方法的机制和成本回到原论文核对并引用。

综述入口：[Rethinking Data Mixture for Large Language Models: A Comprehensive Survey and New Perspectives](https://aclanthology.org/2026.findings-eacl.15/)。

如何接下文：梳理已有方法后，说明为什么接下来尝试 multi-stage，再展示实际遇到的 forgetting。

## 5. Multi-stage 与 forgetting

本节写什么：

- 介绍两种顺序：先知识后数学、先数学后知识。
- 沿着阶段切换看两项指标，指出两种顺序分别遗忘了什么。
- 分开介绍早期探索与后期受控复现，交代各自数据预算。

拟放图：

- **主图：两种阶段顺序与遗忘**：上方画知识→数学、数学→知识两条日程；下方放 MMLU／GSM8K 曲线。用竖线标切换点，突出先学能力在后半程的下降。（可复用后期受控实验播放器；早期 20B+10B 日志待补。）

图表与证据：6 月 11 日探索实验；已有后期 30B Muon 日志播放器。

如何接下文：接 direct mix：让两种数据一直都在，能否缓解遗忘？

## 6. Direct mix 的折中

本节写什么：

- 在匹配数据暴露的设置下，对比直接混合与两种阶段顺序。
- 说明直接混合缓解了怎样的遗忘，以及仍然存在什么知识／推理取舍。

拟放图：

- **延续上一图：加入 direct mix**：在上一节的双指标曲线上加入直接混合。旁边可放终点散点图：横轴 GSM8K、纵轴 MMLU，标出三种日程，展示折中。（已有日程图、轨迹与终点数据。）

图表与证据：训练日程示意、终点分数表和轨迹。

如何接下文：接机制：两种数据都出现了，为什么仍没有把两边都学好？

## 7. 不同 domain 的 loss 与梯度尺度

本节写什么：

- 从总 loss 转向分领域观察：对比 domain loss 与 gradient norm。
- 解释常见训练流程：先汇总各领域梯度，再通过共享优化器更新。
- 提出尺度失衡这一机制解释；区分梯度大小、方向与有效信息。

拟放图：

- 正文在这里回引第 1 节的实测图，讨论梯度大小与方向怎样共同影响更新。
- **辅图：梯度在哪里合并**：画“领域梯度 → 求和 → 共享优化器 → 更新”。可附向量示意，说明尺度差异怎样影响合成方向。（示意图待画；向量只作解释，不当作实测。）

图表与证据：已有 124M、K:M=2:1 梯度范数原图；补领域 loss 曲线，有条件时补匹配的 1.5B 测量。

如何接下文：接解决思路：能否在合并之前，先归一化每个领域的梯度？

## 8. Gradient normalization 的思路与开销

本节写什么：

- 说明分别求领域梯度、归一化、再合并的思路。
- 说明实现上的取舍：分域梯度缓存、反向传播次数和同步开销。

拟放图：

- **主图：两种梯度处理流程**：并列“先平均再过优化器”与“分域求梯度、分别归一化再合并”，标出额外梯度缓存或 backward 的位置。（示意图待画。）
- **可选：实际开销对比**：如果有实测，分别用柱状图比较普通混合与分域梯度归一化的峰值显存、每步耗时。（待补显存和耗时实测，缺数据时先不画。）

图表与证据：计算流程图；如果实际做过，补显存与耗时测试。

如何接下文：接低成本替代：能否利用训练时已经算出的 domain loss？

## 9. 固定数据暴露下的 loss reweighting

本节写什么：

- 说明一次 backward 中，固定的 loss 系数如何缩放对应领域梯度。
- 分开讲采样配比与 loss 权重，并说明 mask 后的有效 target 占比。
- 说明只需额外维护哪些领域统计，以及相应的少量开销。

拟放图：

- **主图：样本不变，权重改变**：上方固定 batch 中知识／数学 token 方块；下方画各域平均 loss 乘不同系数，再求和、backward。让采样占比与 loss 权重的区别直接可见。（可复用已有 token／系数示意，补上 backward 连接。）

图表与证据：加权 loss 公式；一个数据不变、系数改变的小例子。

如何接下文：接权重选择：有了这个控制量，系数应该怎么定？

## 10. 从下降速率到常数搜索，再到 LARE

本节写什么：

- 最初希望各领域 loss 下降得差不多快。介绍用相对降幅打分并平滑权重的 `clip_wema`，再看它怎样影响知识和数学的取舍。
- 回到常数权重搜索，先确认 reweighting 本身是否有效。
- 引入理论上 inv_sqrt 的动机，并说明假设与适用范围。
- 给出 LARE：loss／count EMA、warmup、归一化和下一步权重；再与固定权重比较。

拟放图：

- **下降速率方案的尝试**。采用论文附录 Inverse loss 的配比对照和曲线，第 9 节集中展示。
- **图 B：常数权重搜索**：横轴 GSM8K、纵轴 MMLU；固定数据配比，不同点表示不同数学相对权重。先用实测终点说明重加权有用。（可复用已有常数权重交互图。）
- **图 C：inv_sqrt 规则示意**：画 w ∝ 1/√loss 的 loss—weight 曲线，再接领域间归一化。旁边简标玩具模型中 RMS 梯度的关系与假设。（现稿保留权重计算公式。）
- **图 D：LARE 在线选权重**：三联图展示 MMLU、GSM8K、数学相对权重随训练的变化。标出 warmup，并加入固定权重参考。（可复用已有真实日志播放器。）

论文主文给出常数搜索与 LARE 轨迹，附录给出相对降幅规则的公式与配比对照。

如何接下文：接其他规则：为什么最终保留 LARE，而不是其他 reweighting？

## 11. 其他 reweighting 的比较

本节写什么：

- 列出实际测试过的规则，说明各自使用什么信号。
- 同时比较 MMLU 与 GSM8K，说明选择 LARE 的理由。
- 保留实际的取舍：其他方法可能 GSM8K 更高，但知识表现更低。

拟放图：

- **主图：不同规则的匹配对照**：按数据比例分列，MMLU／GSM8K 分行；用一致颜色对比 direct、LARE 和其他规则。保留终点取舍，避免只展示单项最好结果。（已有相对下降量、残差能量图和终点表。）

图表与证据：已有替代控制器表格，以及相对下降量／残差能量曲线。

如何接下文：接有效性验证：离开短程双域实验，这个方法还成立吗？

## 12. Three-domain 与 8× Chinchilla 验证

本节写什么：

- 加入 code 成为三域，说明直接混合与 LARE 对照中保持一致的设置。
- 比较 120B、240B 预算，解释这里 4×／8× Chinchilla 的含义。
- 同时看知识、数学与代码基准；优化器和模型规模检查放补充材料。

拟放图：

- **主图：长训练下的五项基准**：按 MMLU、GSM8K、MATH、HumanEval、MBPP 放 direct／LARE 成组柱状图；切换 120B、240B，标注百分点提升。（可复用已有基准对比图。）
- **辅图：训练延长到 240B 的轨迹**：知识、数学、代码曲线按 sampled tokens 对齐；标出 120B 终点，并区分独立的 4×、8× 运行。（已有论文原图；动画待未平滑日志。）

图表与证据：已有五项基准终点与长训练图；新动画需要原始时间序列。

如何接下文：接分组粒度：domain 有效，细到每个 source 会不会更好？

## 13. Source-level LARE 的尝试

本节写什么：

- 从同一个语义域内 source 的差异，提出更细粒度加权。
- 展示三个语义域与 18 个独立 source 的对照。
- 说明逐 source 并未带来期待中的额外收益，同时保留它相对直接混合的改善。

拟放图：

- **主图：domain-level 与 source-level**：同一 32.71B-token 设置下，分别画 MMLU／GSM8K 的 direct、三个 domain、18 个 source 柱状图；下一节继续使用这组对照。（已有终点数据，三方法对照图待画。）

图表与证据：已有 domain／source 对照，与下一节共用分组结果表。

如何接下文：接 grouping：问题是否在划分方式，能否按照实际 loss 来分组？

## 14. 按 warmup 后的验证 loss 分组

本节写什么：

- 说明流程：warmup checkpoint → 测 source val loss → 排序 → 固定分组 → 组级 LARE。
- 用 18 个实测 source loss 展示分组，再比较 direct／domain／source／group。
- 收束到采样配比、loss 权重和分组粒度三个决定；列出还要验证的问题。

拟放图：

- **主图 A：source 排序与分组**：横轴为 18 个 source，纵轴为校准 val loss；按 loss 排序，每三个用括号或背景分为一组，颜色标原语义域。突出分组可以跨越数学／代码标签。（已有真实 loss 与六组示意；校准 checkpoint 对应待确认。）
- **主图 B：在上一节对照中加入 grouping**：在上一节 domain／source 对照中加入六组结果，再展示四种方法的匹配训练轨迹。用这一处增量呈现 grouping 带来的变化。（已有四方法终点表与轨迹原图。）

图表与证据：已有 source loss、分组示意、终点表与轨迹；待确认校准 checkpoint 的对应。

如何接下文：结尾：实验得到的认识，以及接下来要回答的问题。

## 使用与材料口径

- 这是按问题关系组织的讲述顺序，不是逐日实验时间线。
- 历史周报截图、论文受控实验与现有日志，各自保留模型大小、预算和评测口径。
- 关键口径：梯度诊断原图来自 124M；其他 weighting 与 LARE 有取舍；source-level 并非相对 direct 完全失败。
- 待补数据与具体差异见 [EXPERIMENTS_NEEDED.md](EXPERIMENTS_NEEDED.md)。
- 网页正文由 [中文稿](article/zh-CN.md) 与 [英文稿](article/en.md) 构建。
