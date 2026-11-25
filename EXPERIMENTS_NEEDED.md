# 博客的实验依据

正式对照实验的分数、权重和训练曲线以工作区的 LARE 论文修订稿为准。

开篇的图 1 记录更早的 1.5B 实验。[4 月 29 日周报的两张评测图](https://docs.google.com/document/d/1LOsw1kCkT_XWHopT5HgreecLIDU6iz7V1T4qqj-Syuk/edit?tab=t.0#heading=h.lsqmm0qi81p4)和[早期 checkpoint 导出](reference-data/observations/early-checkpoints.csv)可以逐点对照。取 `n4st3m9egcvxewyu7gkiw` 在 step 0 至 129,000 的 44 次评测，知识曲线对应 `eval/mmlu_fineweb/acc`，数学曲线对应 `eval/gsm8k/acc`。图 1 的时间范围截至周报当时的进展。

图 1 的启动配置读取 `data/nemotron_mix_v9/nemotron_mix_train_*.bin`。作者已确认 4 月 29 日周报里的配料命令对应这次训练使用的 Nemotron 混合语料。High-Quality、Diverse-QA 和 CC-Math 的预算各为 70B tokens，Science 和 Synthetic-Code 各为 1B，数学占配料预算的 70/212，约 33%。[周报中的配料命令](https://docs.google.com/document/d/1LOsw1kCkT_XWHopT5HgreecLIDU6iz7V1T4qqj-Syuk/edit?tab=t.0#heading=h.71mfyhv3tew4) · [图 1 的 SwanLab 配置](https://swanlab.cn/@foreverlasting/agd_qa_pretraining/runs/n4st3m9egcvxewyu7gkiw/chart)

图 2 对应 124M、知识与数学配比 2∶1 的实验。训练日志每 25 步记录当批出现的领域。对每个领域，将 72 个线性层的权重梯度 Frobenius 范数平方求和再开方，共得知识 235 次、数学 59 次测量。图中采用训练日志的步号，SwanLab 界面比它大 1。第 4,000 步之后的 18 个共同测量步中，14 次知识范数更大，逐步比值的中位数为 2.2581。读数来自原始测量点。[6 月 11 日周报](https://docs.google.com/document/d/1LOsw1kCkT_XWHopT5HgreecLIDU6iz7V1T4qqj-Syuk/edit?tab=t.0#heading=h.p45g7a7c2w2b) · [SwanLab 运行](https://swanlab.cn/@foreverlasting/agd_grad_spectra/runs/e82s2puj4ptf9ion5q25b/chart) · [图 2 数据](public/figures/domain-gradient-norm.json)

图 3a 取同一份早期导出中的 new-v1 至 new-v4 四组零样本评测。配方标签按数学∶维基排列，周报中的 15∶5 在正文和图中等比写为 30∶10。这组实验的末次下游评测在第 57,000 步，其余三组到第 60,000 步。图和正文统一比较第 0 至 57,000 步，每条曲线都有同样的 20 个实测点。逐次评测及对应的四个 SwanLab 运行链接均在数据文件中。[图 3a 数据](public/figures/math-rich-pilot.json) · [五月周报](https://docs.google.com/document/d/1LOsw1kCkT_XWHopT5HgreecLIDU6iz7V1T4qqj-Syuk/edit?tab=t.0#heading=h.wbnkyhr2fnhe)

图 3b 是所给截图中两条完整的 GSM8K 曲线，同样按数学和知识的零样本评测画到第 57,000 步。蓝色 `mix_qa_v5` 和绿色 `mix_v1` 都在 SwanLab 中有第 60,000 步的真实评测。截图中的淡青色独立短跑到第 6,000 步。绿线按作者给出的数学∶知识配比 1∶1 标注。同期周报中备料配方记为 36∶30。作者确认蓝线加入网页和摘要问答后，数学∶知识的配比为 1∶6。原始配置没有记录最终采到的两域 token 总数。两组的问答训练方式也不同。[曲线、运行链接与配方来源](public/figures/low-math-pilot.json) · [5 月 28 日周报](https://docs.google.com/document/d/1LOsw1kCkT_XWHopT5HgreecLIDU6iz7V1T4qqj-Syuk/edit?tab=t.0#heading=h.c5h6v581q2dw)

## 各节采用的论文结果

| 正文 | 依据 |
| --- | --- |
| 第 3 节 | 30B tokens 下的三种直接混合配比。7∶1 另有相同知识、数学 token 预算下的两种阶段顺序。分别比较切换前峰值、全程峰值和最终 checkpoint。 |
| 第 4 节 | 修订稿第 2 节的双域正交线性回归模型和有限步 SGD 命题，对应 `arxiv_version/sections/02_phenomenon/theory_v3.tex`。 |
| 第 5 节 | 图 6a 和 6b 分别对应论文图 2 的常数权重搜索和图 5 的 LARE 训练轨迹。7∶1 直接混合的 MMLU / GSM8K 在两张原图中为 31.41 / 28.66，正文沿用论文表格的 31.40 / 27.67。固定 2 倍数学权重为 32.27 / 38.59，LARE 为 32.24 / 39.80。 |
| 第 6 节 | 主文长训练表和对应曲线、附录模型规模实验。 |
| 第 7 节 | 附录中的三领域、十八来源和六个校准 loss 组对照。 |

## 本地复核材料

- [早期 checkpoint](reference-data/observations/early-checkpoints.csv) 和 [6 月阶段训练与梯度诊断](reference-data/observations/swanlab-june-diagnostics.json)
- [长训练记录与独立复评](reference-data/observations/swanlab-long-checkpoints.csv)
- [分组对照](reference-data/observations/swanlab-grouping-checkpoints.csv)、[六组训练序列](reference-data/observations/swanlab-six-group-training.csv) 和[逐来源校准记录](reference-data/observations/source-calibration.json)

运行日志中的重评、周报末几个 checkpoint 的平均值和论文的最终 checkpoint 有时给出不同的数值。复核时按优化器、配比、评测方式和 checkpoint 对齐，博客引用各自论文章节的结果。
