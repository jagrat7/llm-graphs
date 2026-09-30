# Model comparison

Models are compared using benchmark results and published token prices. These measurements describe different aspects of model performance and expense.

## Language

**Score**:
A performance result for a model configuration on a specific benchmark. Its meaning depends on the benchmark and evaluation method.

**Task cost**:
The average expense in dollars for one task in a benchmark evaluation. It describes the evaluated configuration and workload.
_Avoid_: Token price, cost per million tokens

**Token price**:
The price in dollars per million tokens. A blended token price assumes a stated mix of cached input, fresh input, and output tokens.
_Avoid_: Task cost

**Reasoning level**:
A model configuration's stated reasoning effort, such as low, high, or max.

**Task horizon**:
The human-expert duration of a task that a model and its scaffold can complete at a stated success rate. It measures task difficulty, not the model's elapsed runtime.
_Avoid_: Runtime, duration

**Preference rating**:
A rating derived from blind human comparisons of model responses under a stated category and adjustment. Rating points are not a percentage of correct answers.
_Avoid_: Pass rate, accuracy percentage

**Meaningful graph**:
A comparison of at least two models with compatible measurements and variation on every selected axis. Constant values on an axis do not support a comparison along that axis.

**Context length**:
The provider's listed maximum token window. This is model metadata, not an evaluated long-context capability score.

**Vote count**:
The number of human comparisons supporting an Arena configuration's preference rating. It describes evidence volume, not model quality.

**Average task score**:
METR's published average score across its benchmark tasks. It is separate from the 50% or 80% success threshold used to estimate task horizon.
