"""Extract the paper's plotted time series for the blog. Authoring dependency: pypdf.

Each point is an original PDF path vertex, read in axis units. Matplotlib may
simplify paths; these are the published curves, not a set of raw checkpoints.
No paths are smoothed, extrapolated, or extended to a table's endpoint.
"""

import json
from collections import defaultdict
from pathlib import Path

from pypdf import PdfReader


FIGURES = Path(__file__).resolve().parents[1] / "public" / "figures"
GRID = "#d5dce6"
MMLU_TICKS = [24, 26, 28, 30, 32]
GSM8K_TICKS = [0, 15, 30, 45, 60]
SHORT_X_TICKS = [0, 5, 10, 15, 20, 25, 30]

# RGB values and series names from the source legends. Some papers use the
# same pen for different methods, so each figure explicitly names its series.
PENS = {
    "knowledgeToMath": ("Knowledge → math", "知识 → 数学", "#168c82"),
    "mathToKnowledge": ("Math → knowledge", "数学 → 知识", "#3b6fb6"),
    "direct": ("Direct mixture", "直接混合", "#56616f", "#355a73"),
    "fixed2": ("Fixed 1:2", "固定权重 1∶2", "#d98932"),
    "fixed3": ("Fixed 1:3", "固定权重 1∶3", "#e2a03f"),
    "fixed4": ("Fixed 1:4", "固定权重 1∶4", "#d6b45a"),
    "fixed7": ("Fixed 1:7", "固定权重 1∶7", "#b9ab78"),
    "lare": ("LARE", "LARE", "#c74440"),
    "inverseLoss": ("Inverse loss", "相对降幅（Inverse loss）", "#ca7a26"),
    "approxInverseLoss": ("Approximate inverse loss", "残差能量", "#ca7a26"),
    "direct8x": ("Direct mixture · 240B", "直接混合 · 240B", "#355a73"),
    "lare8x": ("LARE · 240B", "LARE · 240B", "#b83d39"),
    "direct4x": ("Direct mixture · 120B", "直接混合 · 120B", "#879cad"),
    "lare4x": ("LARE · 120B", "LARE · 120B", "#d98276"),
    "lareDomain": ("LARE · 3 domains", "LARE · 3 个领域", "#c74440"),
    "lareGrouped": ("LARE · 6 loss groups", "LARE · 6 个 loss 组", "#ca7a26"),
    "lareSource": ("LARE · 18 sources", "LARE · 18 个来源", "#60837d"),
}


def rule_panels(key, ratios):
    return [(metric, (f"K:M = {ratio}", f"知识∶数学 = {ratio}"), ticks,
             (["lare", key] if ratio == "3:1" else ["direct", "lare", key]))
            for metric, ticks in (("MMLU", MMLU_TICKS), ("GSM8K", GSM8K_TICKS))
            for ratio in ratios]


# Tick values transcribed from the printed axes. For shared axes, the paper
# prints labels once. We still calibrate using each individual panel's grid.
STAGED = ("Staged schedules", "分阶段训练")
MIXED = ("Mixed schedules", "混合训练")
LONG = ("120B and 240B tokens", "120B 与 240B tokens")
GROUPING = ("Data-source partitions", "数据来源分组")
FIXED = ["direct", "fixed2", "fixed3", "fixed4", "fixed7", "lare"]
BUDGETS = ["direct8x", "lare8x", "direct4x", "lare4x"]
GROUPS = ["direct", "lareDomain", "lareGrouped", "lareSource"]
FIGURE_SPECS = {
    "matched-schedules": (30, SHORT_X_TICKS, [
        (metric, label, ticks, keys)
        for label, keys in ((STAGED, ["knowledgeToMath", "mathToKnowledge", "fixed2"]),
                            (MIXED, ["direct", "fixed2"]))
        for metric, ticks in (("MMLU", [24, 26, 28, 30, 32, 34]), ("GSM8K", [0, 10, 20, 30, 40]))
    ]),
    "lare-training": (30, SHORT_X_TICKS, [
        ("MMLU", ("Knowledge", "知识"), MMLU_TICKS, FIXED),
        ("GSM8K", ("Mathematics", "数学"), [0, 10, 20, 30, 40, 50], FIXED),
        ("weightRatio", ("Math-to-knowledge loss weight", "数学与知识的 loss 权重比"),
         [1, 1.5, 2, 2.5, 3], ["lare"]),
    ]),
    "alternative-loss-rules": (30, SHORT_X_TICKS, rule_panels("inverseLoss", ["7:1", "1:1"])),
    "residual-energy": (30, SHORT_X_TICKS, rule_panels("approxInverseLoss", ["7:1", "3:1", "1:1"])),
    "long-training": (240, [0, 60, 120, 180, 240], [
        ("MMLU", LONG, [26, 28, 30, 32, 34], BUDGETS),
        ("GSM8K", LONG, [0, 10, 20, 30, 40], BUDGETS),
        ("MBPP", LONG, [0, 2, 4, 6, 8, 10, 12], BUDGETS),
    ]),
    "grouping-trajectories": (32.71, [0, 10, 20, 30], [
        ("MMLU", GROUPING, MMLU_TICKS, GROUPS),
        ("GSM8K", GROUPING, [0, 5, 10, 15, 20, 25], GROUPS),
    ]),
}


def read_axes(pdf):
    """Group straight-segment strokes by the Matplotlib axes clipping box."""
    state = {"clip": None, "color": "#000000", "dashed": False}
    stack, vertices = [], []
    axes = defaultdict(list)
    moves = 0
    for args, operator in PdfReader(pdf).pages[0].get_contents().operations:
        if operator == b"q":
            stack.append(state.copy())
        elif operator == b"Q":
            state = stack.pop()
        elif operator == b"re":
            state["clip"] = tuple(map(float, args))
        elif operator == b"RG":
            state["color"] = "#" + "".join(f"{round(float(v) * 255):02x}" for v in args)
        elif operator == b"G":
            state["color"] = "#" + f"{round(float(args[0]) * 255):02x}" * 3
        elif operator == b"d":
            state["dashed"] = bool(args[0])
        elif operator in (b"m", b"l"):
            vertices.append(tuple(map(float, args)))
            moves += operator == b"m"
        elif operator in (b"S", b"B", b"f", b"n"):
            if operator == b"S" and state["clip"] and len(vertices) >= 2:
                if moves != 1:
                    raise ValueError("Discontinuous stroke must be exported in separate parts")
                axes[state["clip"]].append((state["color"], state["dashed"], vertices))
            vertices, moves = [], 0
    # The small endpoint scatterplot in lare-training has no training curve.
    return [(box, strokes) for box, strokes in sorted(axes.items(), key=lambda item: (-item[0][1], item[0][0]))
            if any(len(points) > 20 for _, _, points in strokes)]


def calibration(strokes, direction, values):
    # Vertical lines locate x ticks; horizontal lines locate y ticks.
    coordinates = sorted({points[0][direction] for color, _, points in strokes
                          if color == GRID and len(points) == 2 and
                          abs(points[0][direction] - points[-1][direction]) < 0.001})
    if len(coordinates) != len(values):
        raise ValueError(f"Expected grid ticks {values}, found {coordinates}")
    scale = (values[-1] - values[0]) / (coordinates[-1] - coordinates[0])

    def axis_value(coordinate):
        return values[0] + (coordinate - coordinates[0]) * scale

    if any(abs(axis_value(pos) - val) > 0.0001 for pos, val in zip(coordinates, values)):
        raise ValueError("Labeled ticks do not lie on a linear scale")
    return axis_value


def line_series(stroke, keys, read_x, read_y):
    color, dashed, vertices = stroke
    (key,) = [key for key in keys if color in PENS[key][2:]]
    en, zh, *_ = PENS[key]
    points = [[round(read_x(x), 5), round(read_y(y), 5)] for x, y in vertices]
    if any(left[0] > right[0] for left, right in zip(points, points[1:])):
        raise ValueError(f"Training tokens go backwards for {key}")
    return {"key": key, "label": {"en": en, "zh": zh}, "color": color,
            "dashed": dashed, "points": points}


def extract(slug, budget, x_ticks, specs):
    axes = read_axes(FIGURES / f"{slug}.pdf")
    panels = []
    for (box, strokes), (metric, label, y_ticks, keys) in zip(axes, specs, strict=True):
        _, bottom, _, height = box
        read_x = calibration(strokes, 0, x_ticks)
        read_y = calibration(strokes, 1, y_ticks)
        series = [line_series(stroke, keys, read_x, read_y)
                  for stroke in strokes if len(stroke[2]) > 20]
        if [line["key"] for line in series] != keys:
            raise ValueError(f"Unexpected series for {slug} · {label} · {metric}")
        panel = {"metric": metric, "label": {"en": label[0], "zh": label[1]},
                 "yTicks": y_ticks, "yDomain": [round(read_y(bottom), 5), round(read_y(bottom + height), 5)],
                 "series": series}
        if metric == "weightRatio":
            guides = [line_series(stroke, ["fixed2", "fixed3"], read_x, read_y)
                      for stroke in strokes if stroke[0] in (PENS["fixed2"][2], PENS["fixed3"][2])]
            if [guide["points"][0][1] for guide in guides] != [2, 3]:
                raise ValueError("Expected two fixed-weight guide lines")
            panel["guides"] = guides
        panels.append(panel)
    return {"tokensB": budget, "xTicks": x_ticks, "panels": panels}


def main():
    data = {slug: extract(slug, *spec) for slug, spec in FIGURE_SPECS.items()}
    output = FIGURES / "paper-series.json"
    output.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")


if __name__ == "__main__":
    main()
