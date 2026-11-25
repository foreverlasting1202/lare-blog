# How a 1.5B model learns both knowledge and mathematics

The first GSM8K curve barely moved. The experiments that followed changed the share of math data, the weight on its loss, and finally which sources shared a weight.

## TL;DR {#tldr}

Math accounted for about a third of the data budget in our first 1.5B pretraining run, yet MMLU improved while GSM8K barely moved. Could the model learn more from the same math problems if they carried more weight in each update? In a later experiment, we held the data and sample order fixed and doubled the weight on math loss. Both scores improved. To avoid tuning that weight by hand for each new mixture, we proposed an adaptive weighting method (LARE). On the same 240B-token budget, LARE beat direct mixing by **17.06 percentage points on GSM8K** and 0.83 on MMLU.

## Can a small model learn to reason better during pretraining? {#overview}

The base-model results in reports such as [OLMo 2](https://arxiv.org/html/2501.00656v3#A2.T22) and [SmolLM3](https://huggingface.co/HuggingFaceTB/SmolLM3-3B-Base#base-pre-trained-model) show room for improvement in math and code. Could a small model get better at reasoning during pretraining itself?

We pretrained the 1.5B model on a mix of Nemotron data. The recipe allocated 70B tokens each to web text, web Q&A and math, plus 1B each to science and code. That gave us two parts web text and Q&A combined for every part math. Across all five sources, math accounted for about 33% of the token budget.

The aim was to solve more math problems while retaining general knowledge. At each evaluation, [GSM8K](https://arxiv.org/abs/2110.14168) measured how many word problems the model could solve, while [MMLU](https://arxiv.org/abs/2009.03300) tracked its performance in subjects such as history and biology.

How much MMLU would it cost to make the model better at math?

<!-- figure:april-pilot -->

The first runs made that question seem premature. Training loss came down steadily. GSM8K barely moved.

### Loss fell. Why was GSM8K flat? {#diagnosis}

The model gradually answered more knowledge questions correctly, while its math score barely moved. Training loss and problem accuracy reward different things. Getting better at completing a phrase like “how many are left?” can lower the average loss. On GSM8K, a mistake in the final calculation still costs the model the whole problem.

Could the answer format explain the result? Adding worked examples to the prompt helped little.

Perhaps MMLU starts to improve while knowledge validation loss is still fairly high, whereas GSM8K only picks up once math validation loss is much lower. If so, both losses could be falling during mixed training even when the only improvement we see is on knowledge questions.

That brings the question back to training. The recipe included math problems. How much did they contribute to a parameter update?

A later experiment measured this on a 124M model trained on two parts knowledge to one part math. The plot compares the size of each domain’s contribution to a batch gradient, combining its gradients across the model’s linear layers.

<!-- figure:domain-gradient-norm -->

The curves crossed several times early on. Later, the math gradient was usually smaller. After step 4,000, both domains had measurements at 18 steps, and the knowledge gradient was larger at 14 of them. The median knowledge-to-math norm ratio across those 18 steps was 2.26. These are each domain’s contributions to the batch, so their sizes also depend on how many math tokens the batch contains.

Back at 1.5B, there was a direct way to see how much math the model could learn during pretraining. What would happen to GSM8K if math problems took up most of the budget?

## Can the model learn to solve math problems if we give it more math? {#math-rich}

How far could a 1.5B model get on GSM8K if it trained entirely on math? We pooled problems and solutions from OpenR1-Math, OpenMathInstruct, NuminaMath and other sources. To reduce the chance of training on test questions, we filtered out examples that shared long passages with questions from GSM8K or other benchmarks.

We trained one model on math alone and mixed Wikipedia text into the other three runs. With math expressed as 30 parts throughout, the four math-to-Wikipedia ratios were 30:0, 30:1, 30:5 and 30:10.

<!-- figure:math-rich-pilot -->

The math-only run reached 28.96% on GSM8K by step 6,000 and 69.22% at step 42,000. Pretraining alone could teach a model this size to solve a substantial fraction of the word problems.

Which recipe looked best depended on when you checked. At step 6,000, the 30:5 and 30:10 runs were both below 13% on GSM8K. By step 57,000, the math-only run had slipped to 50.72%. The 30:5 and 30:10 runs scored 63.23% and 62.32%. The 30:0 run likely made two passes over the same math problems. We suspect some overfitting contributed to the late drop in GSM8K. Switch to MMLU at the same step and both scored 26.76%, compared with 25.96% for math alone. Picking the first run to solve the problems would have led to a different recipe.

We saw a different pattern when we reduced the share of math. The two runs in the figure below used the same math sources. The green curve shows a 1:1 mix of math and knowledge. For the blue curve, we reduced the math-to-knowledge ratio to 1:6.

<!-- figure:low-math-pilot -->

At step 27,000, the green run already scored 35.56% on GSM8K. The blue run was at 1.82%. Looking only at those early scores, we could easily have concluded that the blue run had too little math to learn to solve these problems. But it reached 11.98% at step 33,000 and later hit 15.01%. By step 57,000 it was solving 18.27% of the problems.

These results make one thing clear. Small models can learn math during pretraining. How can we push their math skills further while preserving what they know?

## How much math, and when should the model see it? {#mixture}

There are several ways to choose a mixture. DoReMi learns sampling weights on a small proxy model. RegMix trains small models on different recipes to predict how untried mixtures will perform. Aioli adjusts the proportions during training as it learns how the domain losses respond. There is also a reason to reserve room for knowledge. When Gu and colleagues mixed synthetic biographies into web text, models recalled few biographical facts at low mixture shares, even after extensive training. [DoReMi](https://arxiv.org/abs/2305.10429) · [RegMix](https://arxiv.org/abs/2407.01492) · [Aioli](https://arxiv.org/abs/2411.05735) · [Knowledge acquisition and mixture ratios](https://proceedings.neurips.cc/paper_files/paper/2025/file/eee7ae5cf0c4356c2aeca400771791aa-Paper-Conference.pdf#page=2)

Since we were mixing only knowledge and math, we picked a few ratios and trained the 1.5B model once at each ratio. Each run used 30B tokens, the same Muon setup and unit loss weights. Going from seven parts knowledge per part math to three, GSM8K rose from 27.67% to 43.67% and MMLU rose from 31.40% to 32.16%. At equal shares, GSM8K climbed again to 59.89%, while MMLU slipped to 31.67%.

### What if the model studies one domain at a time? {#forgetting}

The ratio only specifies how much of each domain the model reads. At 7∶1, the same 26.25B knowledge tokens and 3.75B math tokens can appear together throughout training or in two separate stages. The staged runs give a sense of how well the model can do when it concentrates on each domain in turn. Could mixing throughout training preserve the best score from each?

<!-- figure:stage-history -->

With math first, GSM8K reached 18.50% before the switch. After the knowledge stage, accuracy on the same math benchmark was down to 0.76%. Reversing the order changed which subject suffered. During the knowledge-first stage MMLU reached 31.08%. After the switch to math, GSM8K rose to 36.62% while MMLU fell to 29.45%.

### Does mixing throughout training preserve both peaks? {#mixing}

The direct mixture finished between the two stage orders. It kept much of the knowledge score and avoided the near-total collapse on GSM8K seen when knowledge came last. This trade-off fits our earlier suspicion that the larger knowledge gradients can drown out part of the math signal when we average the two. Is there a way to preserve that signal?

## Why does changing the ratio lead to a trade-off? {#gradients}

Suppose a batch contains 128 examples, 32 of them math. Raising the math count to 64 gives math more influence on the update and adds 32 examples to its gradient estimate. Another option is to keep the original 32 examples and double their loss. At a common parameter value, either change doubles the expected contribution from math. The first change also takes 32 examples away from knowledge and alters the sampling noise in both estimates.

Let $B$ be the batch size, $\bar{\eta}$ the shared step size, $p_j$ the sampling fraction for domain $j$, and $\hat{g}_{j,t}^{(n)}$ the mean gradient estimated from $n$ of its examples at step $t$. Remixing replaces $p_j$ with $p'_j$. At fixed exposure, weighting a domain’s loss by $w_j$ gives that domain its own effective step size $\eta_j$ in ordinary SGD.

<!-- figure:mixture-updates -->

Can that distinction change the losses reached by the end of training? Section 2 of the paper isolates it in linear regression. Domain $j$ has Gaussian inputs $x_j$ with mean zero and covariance $A_j$, and noiseless labels $y_j = x_j^\top w^\star$. The two domains occupy orthogonal parameter subspaces, so $A_1 A_2 = 0$. After $T$ steps of SGD, compare their expected squared losses.

<!-- figure:orthogonal-loss -->

Fix the mixture $(p_1, p_2)$ and choose the step size $\eta_j^\star$ that minimizes each domain’s own expected final loss. Now switch to any different mixture $(p'_1, p'_2)$ and tune a shared step size $\eta'$ afresh. The paper proves that at least one of the following inequalities holds in this model.

<!-- figure:remix-bound -->

Changing the mixture gives one domain fewer examples. Adjusting its step size can change how far those examples move the parameters, but the smaller sample still gives a noisier estimate. The figure uses two 512-dimensional blocks and evaluates 20 SGD steps with 128 examples per batch.

<!-- figure:quadratic-frontiers -->

At a fixed 1:1 mixture, choosing a rate for each domain lowers both losses. Across the tested mixtures, giving each domain a rate also lowers the frontier of attainable loss pairs.

In linear regression, we can work out the effect of each update explicitly. In a language model, knowledge and math share parameters, and AdamW and Muon transform the combined gradient. The measured norms already differed on the smaller model. Could raising the math loss weight on a fixed training stream improve both MMLU and GSM8K at 1.5B?

## With the mixture fixed, how much weight should math get? {#method}

### Trying constant weights

The forward pass already produces a loss for every scored token. Average those losses within each domain and multiply the math term by a coefficient. A single backward pass on the resulting total loss adjusts how much math contributes to the update.

In the 1.5B Muon runs, 3.75B of the 30B tokens were math, giving a 7:1 knowledge-to-math mixture. All runs shared the first 20,000 warmup steps. Afterward the math-to-knowledge loss weight was fixed at 1, 2, 3, 4 or 7.

<!-- figure:remix-frontier -->

Moving from 1 to 2 raised GSM8K from 27.67% to 38.59% and MMLU from 31.40% to 32.27%. Both scores exceeded the highs reached during staged training (31.85% on MMLU and 37.91% on GSM8K).

At a weight of 7, GSM8K rose further to 48.98%, while MMLU fell to 31.19%. A weight near 2 looked attractive for a model that needed both skills. Finding it took a sweep for just one recipe and one optimizer. Could the losses already measured during training suggest a suitable weight in a single run?

### Where does the square root come from? {#inverse-square-root}

Let $x\sim\mathcal N(0,I_d)$ and choose a unit vector $u$. The sign of $u^\top x$ gives the true label $y_0=\operatorname{sign}(u^\top x)$. Independently flip each label with probability $\rho\in(0,1/2)$ to obtain the observed label $y$. The logistic loss and its gradient for one example are

$$
\begin{aligned}
\ell(w;x,y)&=\log\!\left(1+e^{-y w^\top x}\right),\\
g(w;x,y)&=-\frac{yx}{1+e^{y w^\top x}}.
\end{aligned}
$$

Vary the scale $r\geq 0$ along $w=ru$ until the population loss reaches its minimum $\ell_\rho^\star$. The per-example gradient $g$ then has mean zero. Its covariance $\Sigma_\rho$ tells us how much it fluctuates in each direction. For fixed $d\geq 2$, as $\rho\downarrow 0$, the optimal loss is $\ell_\rho^\star=\Theta(\sqrt{\rho})$. Along the classification direction $u$ and any orthogonal unit vector $v$, the respective variances are

$$
\begin{aligned}
u^\top\Sigma_\rho u &= \Theta\!\left((\ell_\rho^\star)^2\right),\\
v^\top\Sigma_\rho v &= \Theta\!\left(\ell_\rho^\star\right).
\end{aligned}
$$

At low loss, the linear term dominates the squared term, so most of the variance comes from the $d-1$ orthogonal directions. Summing the variances and taking the square root gives the root-mean-square norm of the per-example gradient,

$$
\sqrt{\mathbb E\lVert g\rVert^2}
=\sqrt{\operatorname{tr}\Sigma_\rho}
=\Theta\!\left(\sqrt{d\,\ell_\rho^\star}\right).
$$

Now multiply the loss of domain $i$ by a positive weight $w_i$. Writing $d_i$ for its effective dimension, how large is the weighted gradient?

$$
\operatorname{RMS}(w_i g_i)
=\Theta\!\left(w_i\sqrt{d_i\,\ell_i^\star}\right).
$$

If the domains have comparable effective dimensions and scaling constants, choosing $w_i\propto(\ell_i^\star)^{-1/2}$ cancels the square-root dependence on loss.

The optimal loss for each pretraining domain is unknown. LARE approximates it using the mean cross-entropy observed during training. During warmup the coefficients stay at one, while the controller tracks moving averages of each domain’s unweighted loss and count of scored targets. Afterward it takes the inverse square root of each smoothed loss and normalizes the coefficients so their target-share-weighted mean stays at one. The next step uses those weights with the same sampling recipe.

<!-- figure:weight-equation -->

We can now compare LARE with the fixed weights on the same 7:1 data stream.

<!-- figure:adaptive-history -->

From step 25,000 onward, the relative math weight averaged 2.30 and ended at 2.41. Final MMLU was 32.24% and GSM8K was 39.80%. Compared with the fixed weight of 2 found in the sweep, that was 0.03 points lower on MMLU and 1.21 points higher on GSM8K.

## Adding code and training for 240B tokens {#results}

A 30B-token experiment leaves a fairly obvious question open. Perhaps LARE helps the model learn math a little earlier. Would direct mixing catch up with more training? The first comparison used the same 1.5B model and the same seven-to-one knowledge–math mixture.

<!-- figure:long-scores -->

At 120B tokens, direct mixing reached 37.00% on GSM8K and LARE reached 50.57%. MATH-500 went from 17.20% to 25.60%, and MMLU from 33.97% to 34.36%. By four times the initial budget, there was still a clear gap on mathematics.

The next test added code. Knowledge still took seven shares of the data, while mathematics and code divided the remaining share equally. At 120B sampled tokens this comes to 105B for knowledge and 7.5B each for mathematics and code. The counts are before loss masking. The direct run and the LARE run used the same mixture, model, optimizer (ActGD) and budget. Only the loss weights changed. A separate pair of runs had a budget of 240B tokens. These two budgets correspond to 4× and 8× Chinchilla, taking 30B tokens as 1× for this model.

<!-- figure:long-curves -->

At 120B, MMLU was essentially tied at 33.52% and 33.53%. GSM8K gained 14.79 percentage points with LARE. On the code side, HumanEval rose from 15.85% to 21.34% and MBPP from 9.40% to 12.20%.

At 8×, the direct and LARE runs finished at 29.72% and 46.78% on GSM8K, and 34.13% and 34.96% on MMLU. All five final scores favored LARE. Giving each benchmark equal weight, the mean gain was 5.90 points at 4× and 7.84 at 8×.

These results show that LARE outperforms direct mixing and that the reweighting approach works.

<!-- figure:optimizer-grid -->

## Which data sources should share a weight? {#sources}

Until now, every math token contributing to the loss has shared a coefficient with every other math token. Splitting off code gave it a coefficient of its own. Why stop there? In practice, a training corpus can draw on thousands of sources, which makes it hard to group them by hand. Even within mathematics, different collections have different question formats and styles of solution. Keeping a running loss and a coefficient for each source gives LARE a chance to respond to those differences.

We used direct mixing as the baseline and tried two ways of weighting the same 32.71B-token stream. One run used a weight for each of the three domains, and another used a weight for each of the eighteen sources.

A source name identifies where a document came from. LARE takes the loss on its prediction targets as input. Two separately named datasets can look quite similar by that measure. That suggested a different experiment. Let the model measure the sources first, and use the measurements to decide which ones can share a coefficient.

### Six groups formed by calibration loss {#grouping}

At the end of warmup (step 20,000), we used the direct-mixture model to score held-out examples from each source. Each source got a single number, its mean cross-entropy over the same kinds of prediction targets that count toward the training loss. Sort the eighteen sources from highest loss to lowest and take three at a time. The training configuration labels the lowest-loss group as group 1, so the figure runs from group 6 down to group 1. During training, all valid targets in a group contribute to its mean loss, which feeds into LARE’s usual online weight update. Calibration fixes the membership just once. The weights continue to change.

<!-- figure:loss-groups -->

Look at the three lowest-loss cards. MetaMath scored 0.483, Swallow 0.543 and Swallow Code 0.556. Two math sources and a code source ended up sharing one weight. MathInstruct, also a math source, had a loss of 1.489 and landed in a different group.

<!-- figure:group-curves -->

With unit weights the model reached 14.25% on GSM8K. Three domain weights gave 22.97%, and eighteen source weights gave 22.67%. On MMLU the figures in the same order were 32.47%, 32.20% and 32.35%. Source-level weighting kept most of the math gain. Going from three weights to eighteen gained just 0.15 points on MMLU and cost 0.30 on GSM8K.

On the same 32.71B-token stream, grouping by loss reached 32.74% on MMLU and 24.03% on GSM8K. Those are gains of 0.54 and 1.06 percentage points over the three semantic domains. Six weights gave the best pair of scores among the four partitions tested.

## Extra: How does validation loss relate to accuracy? {#loss-accuracy}

Why did MMLU start to rise first when we trained on knowledge and math together? We can revisit that question with the two 240B-token runs. Each point pairs a domain’s validation loss with the benchmark score at the same training step, so we can see when each score began to pick up. Loss decreases to the right.

<!-- figure:loss-accuracy-240b -->

Take the direct-mixing run. By step 15,000, knowledge validation loss was 2.81 and MMLU had risen from 24.95% to 29.77%. At that same step, math validation loss was already down to 0.646, yet the model solved only 2.35% of GSM8K. By step 60,000, math loss had fallen further to 0.496 and the model solved 13.72%. This gives us one plausible explanation for the early run. We may already see gains on knowledge questions while math loss still has some way to fall before the model solves appreciably more problems.

Now take the point from each run closest to a math validation loss of 0.41. At step 144,000, LARE had a loss of 0.4102 and solved 31.84% of GSM8K. At step 338,000, direct mixing had a loss of 0.4101 and solved 28.51%. The two dashed lines show where the models ended up after 240B tokens. Direct mixing finished at a math loss of 0.4014. LARE reached 0.3592, by which point the gap on GSM8K was 17.06 percentage points.

For knowledge, the dashed lines almost coincide. Direct mixing finished with a slightly lower knowledge loss, 2.3625 against 2.3681 for LARE, yet LARE scored 0.83 percentage points higher on MMLU. Over the course of training, lower knowledge loss generally went along with more correct answers. If we had used validation loss alone to pick the better of the two final models for MMLU, we would have picked the wrong one.

## Conclusion {#conclusion}

When GSM8K barely moved in our first run, we wondered whether our 1.5B model could learn to solve math problems if it saw more of them. The math-heavy runs answered that question. Pretraining alone was enough for the model to solve a substantial share of the word problems. The harder part was improving math while retaining knowledge. Saving math for the last stage raised GSM8K, but MMLU fell. Mixing both domains throughout training left the model between the two stage orders on both benchmarks.

One comparison changed the question for us. The model saw the same examples in the same order. Just doubling the math loss weight improved both GSM8K and MMLU. Could we find a useful weight during training? LARE takes the inverse square root of each domain’s smoothed loss to set its weight, saving a separate training run for each candidate coefficient. With code added and the budget extended to 240B tokens, LARE still finished 17.06 percentage points ahead of direct mixing on GSM8K and 0.83 points ahead on MMLU at the same data ratio.

Our last experiment took this idea one step further. We used a model at the end of warmup to measure validation loss on eighteen sources, sorted them by loss, and gave each group of three neighbors a shared weight. Those six weights scored higher on both MMLU and GSM8K than a separate weight for each source. We started by counting how many math problems the model read. Even with exactly the same problems, changing how much they contributed to each update changed how many the model could solve.
