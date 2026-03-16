# Position Policy Engine Upgrade Proposal

**Project:** StockandCrypto  
**Date:** 2026-03-15  
**Status:** Quant Design Draft  
**Audience:** Strategy, Risk, Execution, and Product

---

## 1. Executive Summary

The current `Signal & Risk Packet` is already structurally useful, but it still behaves more like a presentation layer than a professional systematic decision engine.

A stronger quant-grade version should do three things well:

1. **Estimate edge** rather than direction only.
2. **Translate edge into bounded risk** through explicit sizing and stop logic.
3. **Close the research loop** by logging every packet and evaluating realized outcomes against ex-ante expectations.

The proposed upgrade turns the packet into a policy engine driven by:

- calibrated directional probability
- conditional return distribution (`q10`, `q50`, `q90`)
- volatility and liquidity regime classification
- explicit transaction cost and slippage modeling
- risk-budgeted position sizing
- stop/target logic derived from both market structure and volatility
- continuous evaluation through walk-forward analysis and attribution

The goal is not to maximize trade count. The goal is to maximize **risk-adjusted net expectancy** under realistic execution assumptions.

---

## 2. Target Design Principles

A professional quant policy engine for this product should satisfy the following principles.

### 2.1 Edge First
The decision variable must be **expected net edge**, not raw `P(UP)`.

### 2.2 Risk Budgeting Before Sizing
Size should be a consequence of allowed risk, not a cosmetic confidence multiplier.

### 2.3 Regime Awareness
Regime should not be informational only. It must directly alter:

- action thresholds
- stop width
- take-profit structure
- leverage allowance
- position size

### 2.4 Cost-Aware Execution
Signals that disappear after fees, spread, and slippage should be filtered out.

### 2.5 Calibration Over Raw Prediction
If probability forecasts are not calibrated, all downstream risk decisions are unstable.

### 2.6 Research Traceability
Every live packet must be reproducible and evaluable after the fact.

---

## 3. System Architecture

The upgraded engine should be modeled as five layers.

### Layer 1: Forecasting
Produces predictive statistics:

- `p_up`
- `p_down`
- `q10`, `q50`, `q90`
- confidence score
- forecast horizon metadata

### Layer 2: State Classification
Produces market-state variables:

- trend state
- realized volatility percentile
- ATR state
- liquidity state
- spread/slippage proxy
- session/context state

### Layer 3: Policy Engine
Transforms forecasts and state into a candidate trade packet:

- expected gross edge
- expected net edge
- regime-gated action
- candidate stop and target structure
- candidate leverage and position size

### Layer 4: Risk Overlay
Applies hard constraints:

- maximum loss per trade
- maximum gross exposure
- maximum symbol concentration
- portfolio correlation limits
- event and volatility gating

### Layer 5: Evaluation Layer
Compares forecast vs outcome:

- realized PnL
- realized slippage
- hit-rate by regime
- calibration drift
- target/stop efficiency
- score decay over time

---

## 4. Formal Objective

The engine should optimize for **expected net utility** under bounded risk.

A simple first-order objective is:

```text
Maximize: Expected Net Edge
Subject to: Position Risk <= Risk Budget
            Portfolio Exposure <= Exposure Limits
            Trade Cost <= Edge Tolerance
```

A stronger practical objective is:

```text
Maximize: Expected Net Edge / Marginal Risk
```

where marginal risk includes:

- stop-distance risk
- volatility-adjusted mark-to-market risk
- portfolio co-movement penalty
- execution cost uncertainty

This is much more robust than saying:

```text
If p_up > 0.55 => LONG
```

---

## 5. Forecasting Inputs

The current packet already contains the right high-level predictive fields. They should be treated as a conditional distribution, not isolated numbers.

### 5.1 Required Inputs

For every decision step:

- `p_up`: probability of favorable move over the target horizon
- `q10`: lower-tail conditional return estimate
- `q50`: conditional median return estimate
- `q90`: upper-tail conditional return estimate
- `confidence`: calibrated model confidence
- `forecast_horizon`
- `forecast_timestamp`

### 5.2 Interpretation

Professional decision logic should treat these as:

- `p_up` -> directional win probability proxy
- `q50` -> central tendency / base case return
- `q10` -> downside tail estimate
- `q90` -> upside tail estimate

That means the packet is already one step away from becoming a risk-adjusted expectancy engine.

---

## 6. Probability Calibration

This is one of the highest-impact upgrades.

If `p_up` is poorly calibrated, the entire engine will overtrade or undertrade.

### 6.1 Why Calibration Matters

Two models can both output `0.64`, but only one may actually realize a 64% hit rate.

If probability is not calibrated, then:

- edge estimates are wrong
- position size is wrong
- thresholding is unstable
- confidence UI is misleading

### 6.2 Recommended Calibration Methods

For classification outputs:

- isotonic regression
- Platt scaling
- beta calibration

For interval validation:

- empirical coverage of `q10/q90`
- conditional coverage by regime
- tail error monitoring

### 6.3 Required Monitoring Metrics

- Brier Score
- Log Loss
- Expected Calibration Error (ECE)
- reliability curve by horizon
- calibration drift by market regime

---

## 7. Expected Edge Model

A quant-grade engine should rank setups by **net expectancy**, not directional preference.

### 7.1 First-Order Formulation

```text
Raw Edge = p_up * max(q50, 0) - (1 - p_up) * abs(min(q10, 0))
Net Edge = Raw Edge - Trading Cost
```

### 7.2 More Robust Version

```text
Upside Estimate   = min(q90, target_return_cap)
Downside Estimate = max(abs(q10), stop_distance_proxy)
Cost Estimate     = fee_est + spread_est + slippage_est + latency_penalty

Expected Net Edge = p_up * Upside Estimate - (1 - p_up) * Downside Estimate - Cost Estimate
```

### 7.3 Action Mapping

Example starting policy:

- `Net Edge <= 0` -> `FLAT`
- `Net Edge > 0` and `Confidence >= min_conf` -> candidate trade
- `Net Edge > strong_edge` and regime quality high -> `STRONG LONG` / `STRONG SHORT`
- otherwise -> `LONG` / `SHORT` / `WAIT`

### 7.4 Recommended Initial Thresholds

These are starting values only and should be optimized by walk-forward testing:

- `min_conf = 0.55`
- `base_edge = 0.20%`
- `strong_edge = 0.60%`
- `execution_uncertainty_buffer = 0.05% - 0.15%`

---

## 8. Regime Model

A professional engine should separate **forecast direction** from **market tradability**.

### 8.1 Proposed Regime Classes

Recommended initial states:

- `Trend Up`
- `Trend Down`
- `Balanced`
- `High Volatility`
- `Low Liquidity`
- `Event Risk`

### 8.2 Inputs to Regime Classifier

- rolling realized volatility percentile
- ATR percentile
- trend-strength measures (ADX / slope / momentum spread)
- range compression / expansion
- volume percentile
- spread proxy
- calendar/event proximity

### 8.3 Policy Effects by Regime

#### Trend Up / Trend Down
- lower entry threshold in trend direction
- wider TP2
- allow runner logic
- moderate size increase if volatility is controlled

#### Balanced
- normal thresholds
- normal size
- normal two-stage take-profit

#### High Volatility
- higher edge threshold
- smaller size
- wider stop only when risk budget supports it
- reduced leverage cap

#### Low Liquidity
- slippage penalty multiplier
- smaller size cap
- reject marginal trades

#### Event Risk
- reduce or block fresh entries
- disable aggressive leverage
- widen execution uncertainty buffer

---

## 9. Position Sizing Framework

### 9.1 Professional Principle

Position size should be derived from **risk budget divided by stop distance**, then adjusted by signal quality.

### 9.2 Base Formula

```text
Trade Risk Budget = Account Equity * Base Risk %
Raw Size = Trade Risk Budget / Stop Distance
```

### 9.3 Quality Adjustment

```text
Adjusted Risk Budget = Trade Risk Budget
                     * Confidence Multiplier
                     * Regime Multiplier
                     * Liquidity Multiplier
                     / Volatility Multiplier
```

### 9.4 Example Multiplier Grid

#### Confidence Multiplier
- `>= 0.80` -> `1.20`
- `0.70 - 0.79` -> `1.00`
- `0.60 - 0.69` -> `0.80`
- `< 0.60` -> `0.50`

#### Regime Multiplier
- `Trend` -> `1.10`
- `Balanced` -> `1.00`
- `High Vol` -> `0.60`
- `Low Liquidity` -> `0.50`
- `Event Risk` -> `0.25`

#### Volatility Multiplier
- `Low Vol` -> `0.90`
- `Normal Vol` -> `1.00`
- `High Vol` -> `1.30 - 1.60`

### 9.5 Kelly-Inspired Cap

A useful advanced guardrail is a capped Kelly-style overlay:

```text
Kelly Fraction Approximation = Edge / Variance Proxy
Final Size = min(Risk-Budget Size, Kelly-Cap Size)
```

The system should not use full Kelly. A capped or fractional Kelly ceiling is more appropriate.

---

## 10. Stop Loss Methodology

### 10.1 Professional Hierarchy

Stop loss should be built from three components:

1. structure stop
2. volatility stop
3. portfolio risk limit

### 10.2 Structure Stop

Examples:

- recent swing low/high
- support/resistance invalidation level
- breakout failure level
- session low/high invalidation

### 10.3 Volatility Stop

```text
ATR Stop = Entry +/- (ATR * k)
```

Starting range:

- `k = 1.2 to 2.0`

### 10.4 Final Stop Construction

Recommended rule:

```text
Final Stop = structure-aware stop constrained by ATR and max risk budget
```

Meaning:

- do not place a stop inside obvious noise
- do not place a stop so wide that allowed risk is violated

### 10.5 Tail-Risk Upgrade Path

Later versions can replace simple ATR logic with:

- expected shortfall proxy
- intraday jump-risk adjustment
- regime-scaled stop percentile

---

## 11. Take Profit Methodology

### 11.1 Multi-Target Logic

A professional packet should separate:

- `TP1`: de-risking target
- `TP2`: convexity / trend extension target

### 11.2 Suggested Construction

Option A: R-multiple based

```text
TP1 = Entry + 1.0R
TP2 = Entry + 2.5R
```

Option B: quantile-aware

```text
TP1 = min(q50 target, 1.2R)
TP2 = min(q90 target, 2.5R)
```

Option C: regime-aware hybrid

```text
Trending  -> wider TP2, optional runner
Balanced  -> standard TP1/TP2
High Vol  -> faster profit capture, tighter TP1
```

### 11.3 Partial Exit Design

Professional trade management should support:

- reduce `25% - 50%` at TP1
- trail the remaining size if regime remains favorable
- collapse TP2 distance if regime deteriorates

---

## 12. Transaction Cost Model

A strong signal can still be a bad trade after cost.

### 12.1 Required Components

```text
Trading Cost = Fee + Spread + Slippage + Latency Penalty + Impact Penalty
```

### 12.2 Why This Must Be Explicit

Without cost modeling, the system will systematically overestimate small edges.

This is especially important for:

- high-volatility crypto
- lower-liquidity symbols
- fast intraday horizons

### 12.3 UI Requirement

The packet should explicitly display:

- Gross Expected Return
- Estimated Fees / Slippage
- Net Edge

That is the correct professional framing.

---

## 13. Trade Quality Score

### 13.1 Purpose

The UI should expose not just direction, but setup quality.

### 13.2 Proposed Score

A first version can be a weighted composite score from 0 to 100.

```text
TQS = 0.30 * confidence_score
    + 0.25 * edge_score
    + 0.20 * regime_score
    + 0.15 * volatility_score
    + 0.10 * liquidity_score
```

### 13.3 Interpretation

- `80 - 100` -> A setup
- `65 - 79`  -> B setup
- `50 - 64`  -> C setup
- `< 50`     -> Skip

### 13.4 Upgrade Path

Later versions can learn the score from realized outcomes rather than fixed weights.

---

## 14. Portfolio-Level Risk Overlay

This is where many strategy prototypes fail.

Even if a single trade looks attractive, it may be unacceptable at the portfolio level.

### 14.1 Required Constraints

- max loss per trade
- max gross exposure
- max net directional exposure
- max symbol concentration
- max sector/market concentration
- max correlated exposure
- max open risk in event windows

### 14.2 Correlation-Aware Sizing

If multiple trades point in the same direction on correlated instruments, marginal size should be reduced.

Examples:

- BTC and ETH same-direction exposure
- SPX and NDX same-direction exposure
- sector-correlated US equities

Recommended first implementation:

- simple correlation buckets
- same-bucket exposure multiplier
- total exposure cap

---

## 15. Evaluation and Research Loop

A professional quant system must evaluate:

- forecast quality
- decision quality
- execution quality
- realized trade quality

### 15.1 Required Logging per Packet

For each packet, store:

- timestamp
- symbol
- market
- action
- `p_up`, `q10`, `q50`, `q90`
- confidence
- regime
- volatility state
- cost estimate
- stop distance
- TP1/TP2 targets
- size
- trade quality score
- policy reason

### 15.2 Required Logging per Outcome

After close, store:

- realized PnL
- realized PnL %
- realized slippage
- holding period
- stop hit / TP1 hit / TP2 hit / manual exit
- max favorable excursion
- max adverse excursion
- regime at entry vs regime during exit

### 15.3 Required Evaluation Metrics

#### Forecast Metrics
- Brier Score
- ECE
- coverage of `q10/q90`
- horizon-specific calibration

#### Strategy Metrics
- hit rate
- average win / average loss
- expectancy
- Sharpe / Sortino
- Calmar
- max drawdown
- turnover-adjusted edge

#### Policy Metrics
- edge realized vs edge predicted
- action quality by regime
- stop efficiency
- target efficiency
- score bucket performance (`A/B/C setups`)

---

## 16. Validation Protocol

This is critical if the engine is meant to be trustworthy.

### 16.1 Minimum Standard

Use:

- train / validation / test split
- walk-forward evaluation
- regime-stratified performance breakdown
- realistic transaction cost assumptions

### 16.2 Recommended Backtest Protocol

1. Train on historical window
2. Calibrate on validation window
3. Freeze thresholds and policy settings
4. Evaluate on forward window
5. Roll forward and repeat

### 16.3 What to Avoid

- tuning thresholds on the final test set
- evaluating without costs
- mixing calibration and evaluation windows
- using the same regime labels to both train and assess edge without leakage controls

---

## 17. Example Decision Flow

```text
Forecast Layer
- p_up = 0.63
- q10 = -0.8%
- q50 = +1.4%
- q90 = +3.7%
- confidence = 0.74

State Layer
- regime = Trend Up
- realized vol = Normal
- liquidity = Good
- cost estimate = 0.12%

Policy Layer
- raw edge = 0.63 * 1.4% - 0.37 * 0.8% = 0.586%
- net edge = 0.586% - 0.12% = 0.466%
- action = LONG

Risk Layer
- stop = max(structure stop, ATR stop within risk budget)
- TP1 = 1.0R
- TP2 = 2.4R
- size = risk budget adjusted for confidence, regime, and volatility

Output Packet
- action = LONG
- position size = 0.82x
- trade quality score = 74
- policy reason = Positive edge in favorable regime with acceptable volatility and cost
```

---

## 18. Suggested Packet Schema

```json
{
  "action": "LONG",
  "positionSize": 0.82,
  "entry": 72782.01,
  "stopLoss": 72263.80,
  "takeProfit1": 73405.02,
  "takeProfit2": 74540.42,
  "rr_tp1": 1.20,
  "rr_tp2": 3.39,
  "regime": "Trend Up",
  "confidence": 0.74,
  "grossExpectedReturnPct": 1.42,
  "estimatedCostPct": 0.18,
  "netEdgePct": 0.46,
  "tradeQualityScore": 74,
  "policyReason": "Positive net edge in favorable trend regime with acceptable execution cost"
}
```

---

## 19. Recommended First Implementation Scope

To keep the upgrade practical, Phase 1 should include:

1. calibrated `p_up`
2. net edge decision rule
3. regime-aware position sizing
4. ATR + structure stop logic
5. TP1/TP2 regime-aware logic
6. trade quality score
7. packet + outcome logging

This is enough to make the packet meaningfully more professional without turning the system into an overfit research project.

---

## 20. Final Recommendation

If the goal is to make the Position Tracking engine look and behave like a professional quant system, the priorities should be:

1. elevate **net edge** above raw probability
2. make **regime** a true policy variable
3. size from **risk budget divided by stop distance**
4. derive stop/targets from **structure + volatility**
5. treat **cost** as a first-class decision input
6. evaluate with **walk-forward, calibration, and realized attribution**

That turns the current packet from a smart-looking UI module into a measurable and defensible trading policy framework.

---

## 21. Next Step

The next implementation document should lock down the exact formulas for:

- action thresholds
- regime multipliers
- volatility multipliers
- cost model
- stop loss construction
- TP1 / TP2 logic
- trade quality score
- portfolio risk caps

That formula document should be the direct bridge into backend implementation.

---

## 22. Phase 1 Delivery Specification

This section translates the research proposal into an implementation-ready Phase 1 plan for the current StockandCrypto codebase.

### 22.1 Phase 1 Objective

Phase 1 should **upgrade the policy layer without replacing the current forecasting layer**.

That means:

- keep the current live heuristic forecast sources
- keep the current endpoint structure
- add one shared policy engine contract
- make UI surfaces consume the same packet semantics
- start logging enough information to evaluate the engine properly later

### 22.2 In Scope

Phase 1 covers:

- crypto live decision surfaces
- CN equity live decision surfaces
- US equity live decision surfaces
- session decision surfaces
- tracking dashboard ranking and action logic
- positions entry snapshot and realized attribution groundwork

### 22.3 Out of Scope

Phase 1 does **not** attempt to:

- retrain or replace the core prediction models
- fully solve ATR/structure stop extraction across every market
- build a complete backtest UI
- build a full portfolio optimizer
- introduce broker execution or real order routing

Those belong to later phases.

---

## 23. Implementation Architecture for the Current Repo

The current codebase already contains prediction-to-policy logic in several places. Phase 1 should consolidate it.

### 23.1 Shared Backend Module

Create one server-side module:

```text
server/policy-engine.js
```

This module should be the single place responsible for:

- normalizing upstream forecast inputs
- detecting regime and execution cost state
- computing expected raw and net edge
- computing trade action
- computing position size and leverage cap
- computing stop/target structure
- assigning trade quality score and band
- returning explanatory reasons and gates

### 23.2 Current Integration Targets

Phase 1 should replace local packet math in:

- `unified-server.js`
  - crypto prediction and session packet builders
  - CN prediction/policy helpers
  - US prediction/policy helpers
  - tracking aggregate/action ranking logic
- `server/positions-store.js`
  - position snapshot persistence
  - realized-vs-expected attribution groundwork
- frontend readers:
  - `web/js/crypto.js`
  - `web/js/us-equity.js`
  - `web/js/cn-equity.js` if applicable
  - session page scripts that render signal/risk cards
  - `web/js/tracking.js`
  - `web/js/position-tracker.js`

### 23.3 Design Rule

UI pages should not compute their own policy interpretation once the shared packet is available.

They may format values, but they should not re-decide:

- action
- size
- stop loss
- take profit
- regime
- quality score

Those must come from the engine.

---

## 24. Standardized Engine Input Contract

The engine should accept one normalized input object regardless of market.

### 24.1 Required Input Fields

```json
{
  "market": "crypto | cn_equity | us_equity | session",
  "symbol": "BTCUSDT",
  "price": 72782.01,
  "changePct": 1.24,
  "open": 72120.00,
  "high": 73180.55,
  "low": 71880.42,
  "volume": 1234567,
  "pUp": 0.63,
  "confidence": 0.74,
  "q10": -0.008,
  "q50": 0.014,
  "q90": 0.037,
  "forecastTimestamp": "ISO8601",
  "inputSource": "binance_us_derived",
  "sessionMeta": {},
  "regimeHints": {}
}
```

### 24.2 Normalization Rules

- `pUp`, `confidence` must be bounded to `[0, 1]`
- `q10`, `q50`, `q90` must be expressed as decimal returns
- `q10 <= q50 <= q90` should be enforced after normalization
- missing `volume`, `open/high/low` should reduce engine confidence and add a gate/reason
- missing non-critical fields must degrade gracefully rather than crash the engine

### 24.3 Input Quality Flags

The engine should internally create quality flags such as:

- `missing_volume`
- `missing_ohlc`
- `stale_forecast`
- `wide_tail_distribution`
- `low_confidence_forecast`

These should feed `reasons[]` and `gates[]`.

---

## 25. Standardized `policyPacket` Output Contract

The packet contract must be identical across all markets so tracking and positions can consume it without branching on market-specific logic.

### 25.1 Canonical Packet

```json
{
  "signal": "BULLISH",
  "action": "LONG",
  "expectedRawEdgePct": 0.59,
  "expectedNetEdgePct": 0.46,
  "costPct": 0.13,
  "tradeQualityScore": 74,
  "tradeQualityBand": "B",
  "regime": "Trend Up",
  "regimeScore": 0.76,
  "regimeAdjustments": {
    "edgeThresholdBps": -8,
    "sizeMultiplier": 1.1,
    "leverageCapMultiplier": 1.0,
    "tp2Multiplier": 1.2
  },
  "positionSize": 0.82,
  "leverageCap": 1.5,
  "riskBudgetPct": 0.75,
  "stopLoss": 72263.80,
  "stopLossPct": -0.71,
  "takeProfit1": 73405.02,
  "takeProfit1Pct": 0.86,
  "takeProfit2": 74540.42,
  "takeProfit2Pct": 2.42,
  "rewardRisk1": 1.20,
  "rewardRisk2": 3.39,
  "reasons": [
    "Positive net edge after transaction cost.",
    "Trend regime supports directional continuation."
  ],
  "gates": [
    "cost_ok",
    "confidence_ok",
    "regime_ok"
  ],
  "forecastTimestamp": "ISO8601",
  "inputSource": "binance_us_derived",
  "engineVersion": "policy-engine-v1"
}
```

### 25.2 Action Semantics

Recommended action set:

- `STRONG_LONG`
- `LONG`
- `FLAT`
- `SHORT`
- `STRONG_SHORT`
- `WAIT`

`WAIT` should be reserved for:

- borderline setups
- execution blocked by non-catastrophic gates
- cases where forecast direction exists but the packet should not yet promote an active trade

### 25.3 Compatibility Aliases

Phase 1 should keep legacy fields alive by deriving them from the packet:

- `policy.action` <- `policyPacket.action`
- `policy.positionSize` <- `policyPacket.positionSize`
- `policy.regime` <- `policyPacket.regime`
- `tpSl.stopLoss` <- `policyPacket.stopLoss`
- `tpSl.takeProfit1` <- `policyPacket.takeProfit1`
- `tpSl.takeProfit2` <- `policyPacket.takeProfit2`
- `tpSl.rewardRisk1` <- `policyPacket.rewardRisk1`
- `tpSl.rewardRisk2` <- `policyPacket.rewardRisk2`

This keeps existing pages working while they are rewired.

---

## 26. Phase 1 Formula Specification

Phase 1 formulas must be simple, auditable, and stable enough for cross-market use.

### 26.1 Raw Edge

```text
UpsideEstimatePct   = max(q50, 0)
DownsideEstimatePct = max(abs(min(q10, 0)), StopProxyPct)

ExpectedRawEdgePct = pUp * UpsideEstimatePct
                   - (1 - pUp) * DownsideEstimatePct
```

Where:

- `StopProxyPct` is a volatility-aware proxy floor to avoid underestimating downside on overly narrow `q10`
- initial value can be derived from intraday range or a bounded percentage of current price

### 26.2 Cost Model

Phase 1 should estimate cost using:

```text
CostPct = FeePct + SpreadPct + SlippagePct + UncertaintyBufferPct
```

#### Suggested Initial Components

- `FeePct`
  - crypto: explicit exchange fee assumption
  - equities: conservative retail fill estimate
- `SpreadPct`
  - derived from intraday range proxy when true spread is unavailable
- `SlippagePct`
  - scaled by volatility state and liquidity state
- `UncertaintyBufferPct`
  - regime/event-risk penalty

### 26.3 Net Edge

```text
ExpectedNetEdgePct = ExpectedRawEdgePct - CostPct
```

### 26.4 Regime Score

Phase 1 should use a bounded score in `[0, 1]` from:

- trend quality
- volatility penalty
- liquidity quality
- session/context suitability

Example:

```text
RegimeScore = 0.40 * TrendComponent
            + 0.25 * LiquidityComponent
            + 0.20 * SessionComponent
            + 0.15 * (1 - VolatilityPenalty)
```

### 26.5 Trade Quality Score

Use a 0-100 score:

```text
TQS = 100 * (
      0.30 * ConfidenceScore
    + 0.30 * EdgeScore
    + 0.20 * RegimeScore
    + 0.10 * LiquidityScore
    + 0.10 * (1 - CostPenaltyScore)
)
```

#### Recommended Bands

- `>= 80` -> `A`
- `65 - 79` -> `B`
- `50 - 64` -> `C`
- `< 50` -> `SKIP`

### 26.6 Action Rule

Recommended initial mapping:

```text
If ExpectedNetEdgePct <= 0               => FLAT
If Confidence < MinConfidence            => WAIT
If TradeQualityScore < 50                => WAIT
If ExpectedNetEdgePct >= StrongEdgePct   => STRONG_LONG / STRONG_SHORT
Else                                     => LONG / SHORT
```

Direction can be inferred from:

- `pUp >= 0.5` -> long-side orientation
- `pUp < 0.5` -> short-side orientation

### 26.7 Position Size Rule

```text
BaseRiskBudgetPct = 0.50% to 1.00%
RawRiskBudgetPct  = BaseRiskBudgetPct
                  * ConfidenceMultiplier
                  * RegimeMultiplier
                  * LiquidityMultiplier
                  / VolatilityMultiplier

PositionSize = clamp(
  RawRiskBudgetPct / max(StopLossPctAbs, StopProxyPct),
  MinSize,
  LeverageCap
)
```

### 26.8 Stop and Target Rule

Phase 1 stop/target logic should be distribution-driven with a later upgrade path to true ATR/structure stops.

Recommended starting rules:

```text
StopLossPct    = min(q10, -StopProxyPct)
TakeProfit1Pct = min(max(q50, 0), Target1CapPct)
TakeProfit2Pct = min(max(q90, TakeProfit1Pct), Target2CapPct)
```

Then convert to absolute price:

```text
StopLoss    = Price * (1 + StopLossPct)
TakeProfit1 = Price * (1 + TakeProfit1Pct)
TakeProfit2 = Price * (1 + TakeProfit2Pct)
```

And compute:

```text
RewardRisk1 = abs(TakeProfit1Pct / StopLossPct)
RewardRisk2 = abs(TakeProfit2Pct / StopLossPct)
```

---

## 27. Endpoint Upgrade Matrix

Phase 1 should be additive. Existing endpoints stay in place.

### 27.1 Crypto

Add `policyPacket` to:

- live prediction responses
- session payloads
- any signal/risk card response currently emitted for crypto pages

### 27.2 CN Equity

Add `policyPacket` to:

- index prediction responses
- stock prediction responses where already available
- session or decision surfaces exposed on CN pages

### 27.3 US Equity

Add `policyPacket` to:

- index prediction responses
- stock prediction responses where already available
- any signal/risk surfaces already shown on US pages

### 27.4 Sessions

Session payloads should emit:

- session-level forecast stats
- session-level `policyPacket`
- compatibility aliases to preserve the current UI

### 27.5 Tracking

Tracking aggregate rows should expose:

- `policyPacket`
- `expectedNetEdgePct`
- `tradeQualityScore`
- `tradeQualityBand`
- `regime`
- `costPct`
- `rewardRisk2`

The action feed should be packet-driven and include why a setup passed or failed.

---

## 28. Tracking Dashboard Upgrade Specification

Tracking should become the primary cross-market policy surface in Phase 1.

### 28.1 New Ranking Semantics

Rank by a packet-first metric, for example:

```text
RankScore = 0.45 * normalized(TradeQualityScore)
          + 0.35 * normalized(ExpectedNetEdgePct)
          + 0.10 * normalized(RewardRisk2)
          + 0.10 * normalized(RegimeScore)
```

This is materially better than ranking only on ad hoc heuristics or directional scores.

### 28.2 New Columns / Tiles

Tracking should expose:

- `Net Edge`
- `Trade Quality`
- `Regime`
- `Cost`
- `R:R`
- `Action`

### 28.3 Packet-Aware Context

Tracking should also surface:

- pass/fail gates
- size reductions
- cost penalties
- regime penalties

That turns tracking from “signal list” into a real policy monitor.

---

## 29. Positions Upgrade Specification

Positions should become the execution and attribution surface for the packet.

### 29.1 Entry-Time Snapshot

When a new position is opened, store the packet snapshot used at entry.

Required fields:

- `engineVersion`
- `action`
- `signal`
- `expectedRawEdgePct`
- `expectedNetEdgePct`
- `costPct`
- `tradeQualityScore`
- `tradeQualityBand`
- `regime`
- `regimeScore`
- `positionSize`
- `leverageCap`
- `riskBudgetPct`
- `stopLoss`
- `takeProfit1`
- `takeProfit2`
- `rewardRisk1`
- `rewardRisk2`
- `reasons`
- `gates`
- `forecastTimestamp`
- `inputSource`

### 29.2 Close-Time Attribution

When a position is closed, record:

- realized PnL
- realized PnL %
- realized hold time
- realized exit reason
- realized slippage estimate
- max favorable excursion if available later
- max adverse excursion if available later
- realized regime drift flag

### 29.3 UI Requirements

`positions.html` should show:

- current regime
- expected net edge at entry
- current vs recommended size
- stop loss and TP plan
- reward/risk metrics
- trade quality band
- gate reasons

This lets the user compare what the engine recommended versus what is actually in the book.

---

## 30. Storage and Schema Additions

Phase 1 should remain additive.

### 30.1 Position Record Additions

Additive fields on local `positions` records can include:

- `engine_version`
- `entry_policy_packet_json`
- `entry_expected_net_edge_pct`
- `entry_trade_quality_score`
- `entry_trade_quality_band`
- `entry_regime`
- `entry_cost_pct`

### 30.2 Position History Additions

Additive fields on `position_history` can include:

- `policy_snapshot_json`
- `realized_slippage_pct`
- `realized_vs_expected_edge_pct`
- `exit_regime`

### 30.3 Storage Design Rule

Store both:

- a structured subset for analytics/sorting
- the full packet JSON for forensic replay

The structured fields make evaluation queries easy. The raw packet preserves auditability.

---

## 31. Evaluation Hooks for Phase 1

Phase 1 should not wait for a separate backtest UI before logging evaluable fields.

### 31.1 Minimum Evaluation Summary

A lightweight summary layer should support:

- average predicted net edge by market
- average realized edge by market
- score-band hit rate
- regime-stratified win rate
- cost drag by market

### 31.2 Why This Matters

Without this, the team cannot answer:

- whether the engine is too conservative or too aggressive
- whether quality bands are meaningful
- whether cost assumptions are too optimistic
- whether one regime systematically breaks the packet

---

## 32. Rollout Plan

Phase 1 should be implemented in the following order.

### Step 1: Shared Engine

- build `server/policy-engine.js`
- write normalization helpers
- lock `policyPacket` contract

### Step 2: Market Endpoint Integration

- crypto
- CN
- US
- session routes

At this stage, endpoints emit the new packet additively while existing pages remain compatible.

### Step 3: Tracking Upgrade

- switch ranking/sorting to packet-derived metrics
- add packet-aware context
- keep old fields temporarily

### Step 4: Positions Upgrade

- persist packet snapshot on entry
- add realized-vs-expected attribution fields
- surface packet data in `positions.html`

### Step 5: Legacy UI Alignment

- update signal/risk cards across market pages
- use packet semantics rather than local math

### Step 6: Validation

- endpoint consistency checks
- regression checks
- ranking sanity checks
- stored snapshot verification

---

## 33. Rollback and Compatibility Strategy

Because this touches many surfaces, rollback must be simple.

### 33.1 Additive Change Rule

Do not remove current payload fields in Phase 1.

### 33.2 Safe Rollback Path

If the new engine misbehaves:

- keep endpoints serving legacy fields
- hide packet-first UI columns behind defensive rendering
- fall back to old ranking fields in tracking

### 33.3 Version Tagging

Every packet should carry:

- `engineVersion`

This lets logs and saved positions distinguish old vs new engine behavior.

---

## 34. Test and Validation Matrix

### 34.1 Structural Tests

- every market prediction-bearing response includes `policyPacket`
- packet shape is identical across markets
- compatibility aliases remain populated

### 34.2 Behavioral Tests

- positive directional probability with negative net edge does not produce an aggressive action
- high quality setups rank above low quality setups even if raw `p_up` is similar
- high cost / low liquidity setups are penalized consistently

### 34.3 Tracking Tests

- sort by `Net Edge`
- sort by `Trade Quality`
- filter by `Regime`
- verify action feed comes from packet output

### 34.4 Positions Tests

- opening a position stores packet snapshot
- closing a position preserves realized attribution fields
- UI renders entry packet details correctly

### 34.5 Regression Checks

- `node --check unified-server.js`
- `node --check web/js/tracking.js`
- `node --check web/js/position-tracker.js`
- market pages still load without breaking existing legacy fields
- auth/session behavior for portfolio pages remains intact

---

## 35. Final Phase 1 Recommendation

The right Phase 1 is not a flashy rewrite. It is a disciplined policy-layer consolidation.

The highest-value outputs are:

1. one shared packet contract
2. edge-first action selection
3. risk-budgeted sizing
4. cost-aware filtering
5. regime-aware packet semantics
6. packet snapshot persistence
7. tracking and positions upgraded to consume the same engine

If those seven pieces are implemented cleanly, the system will already behave much more like a professional quant policy framework, while preserving current live forecast infrastructure and minimizing migration risk.

---

## 36. Quant Policy Engine Phase 1 Implementation Blueprint

This section converts the research proposal and delivery specification above into a directly executable implementation plan for the current codebase.

The design goal is not to rebuild forecasting. The design goal is to make the current forecast layer feed one shared, auditable, cost-aware policy engine that becomes the single source of truth for all execution-facing surfaces.

### 36.1 Phase 1 Scope and Non-Goals

#### In Scope

- one shared backend `policyPacket` generator
- additive packet integration into crypto, CN, US, and session payloads
- packet-driven ranking and filtering in tracking
- packet snapshot persistence in positions and position history
- packet-backed signal/risk rendering on current market pages
- traceability fields for later realized-vs-expected evaluation

#### Out of Scope

- replacing the current forecast heuristics or model outputs
- introducing a full ATR or market-structure stop engine
- introducing a full realized-performance dashboard or backtest UI
- redesigning all market pages from scratch

### 36.2 Required Backend Work Breakdown

#### 36.2.1 Shared Engine Module

Create a dedicated module:

- `server/policy-engine.js`

This module must:

- normalize cross-market inputs
- classify regime
- estimate transaction cost
- compute raw and net edge
- compute action and sizing
- build stop/target structure
- emit one canonical `policyPacket`
- derive legacy compatibility fields when needed

The engine must be deterministic for identical inputs.

#### 36.2.2 Unified Server Integration

Update:

- `unified-server.js`

The server should call the shared engine from:

- crypto prediction builders
- CN prediction helpers
- US prediction helpers
- session payload builders
- tracking row builders

Implementation rule:

- every prediction-bearing payload gets `policyPacket`
- old `policy`, `tpSl`, and decision aliases remain additive
- those old fields should be derived from `policyPacket`, not recomputed separately

#### 36.2.3 Position Storage Upgrade

Update:

- `server/positions-store.js`

Add additive entry fields:

- `engine_version`
- `entry_policy_packet_json`
- `entry_expected_net_edge_pct`
- `entry_trade_quality_score`
- `entry_trade_quality_band`
- `entry_regime`
- `entry_cost_pct`

Add additive history fields:

- `policy_snapshot_json`
- `realized_slippage_pct`
- `realized_vs_expected_edge_pct`
- `exit_regime`

Storage rule:

- keep structured numeric columns for sorting, analytics, and filtering
- keep the full packet JSON for forensic replay and future evaluation

### 36.3 Canonical `policyPacket` Contract

The shared engine output should use this canonical contract.

```json
{
  "signal": "BULLISH|BEARISH|NEUTRAL",
  "action": "STRONG_LONG|LONG|WAIT|FLAT|SHORT|STRONG_SHORT",
  "expectedRawEdgePct": 0.42,
  "expectedNetEdgePct": 0.21,
  "costPct": 0.18,
  "tradeQualityScore": 67.5,
  "tradeQualityBand": "B",
  "regime": "Balanced",
  "regimeScore": 0.63,
  "regimeAdjustments": {
    "edgeThresholdPct": 0.0,
    "sizeMultiplier": 1.0,
    "leverageCapMultiplier": 1.0,
    "tp2Multiplier": 1.0
  },
  "positionSize": 0.71,
  "leverageCap": 1.5,
  "riskBudgetPct": 0.6,
  "stopLoss": 72263.8,
  "stopLossPct": 0.71,
  "takeProfit1": 73405.02,
  "takeProfit1Pct": 0.86,
  "takeProfit2": 74540.42,
  "takeProfit2Pct": 2.42,
  "rewardRisk1": 1.2,
  "rewardRisk2": 3.39,
  "reasons": [
    "Positive net edge remains after cost.",
    "Balanced regime keeps thresholds neutral."
  ],
  "gates": [
    "cost_ok",
    "confidence_ok",
    "regime_ok"
  ],
  "forecastTimestamp": "2026-03-15T12:00:00.000Z",
  "inputSource": "tracking-live",
  "engineVersion": "policy-engine-v1"
}
```

Contract rules:

- percentage fields use human percentage units, not raw ratios
- `tradeQualityScore` is a bounded `0-100` score
- `engineVersion` is mandatory
- `reasons` explain why the engine likes or dislikes a setup
- `gates` expose pass/fail state for execution criteria

### 36.4 Locked Phase 1 Formula Rules

The implementation should use the following Phase 1 formulas.

#### 36.4.1 Raw and Net Edge

```text
Upside Estimate   = max(q50, 0)
Stop Proxy Pct    = max(abs(min(q10, 0)), quantile_band_floor, volatility_floor)
Expected Raw Edge = p_up * Upside Estimate - (1 - p_up) * Stop Proxy Pct
Expected Net Edge = Expected Raw Edge - CostPct
```

Where:

- `quantile_band_floor` is derived from the width of `q10-q90`
- `volatility_floor` is derived from current price change and intraday range
- `CostPct = FeePct + SpreadPct + SlippagePct + UncertaintyBufferPct`

#### 36.4.2 Action Mapping

Action must be driven by **net edge first**, then filtered by confidence and regime quality.

Recommended Phase 1 mapping:

- `ExpectedNetEdgePct <= 0` -> `FLAT`
- `ExpectedNetEdgePct > 0` and weak confidence/regime -> `WAIT`
- `ExpectedNetEdgePct >= base_edge` -> directional action
- `ExpectedNetEdgePct >= strong_edge` -> strong directional action
- if shorting is not allowed in that market, downgrade short actions to `WAIT` or `FLAT`

#### 36.4.3 Position Size

```text
Raw Risk Size = RiskBudgetPct / StopLossPct
Final Size = Raw Risk Size
           * ConfidenceMultiplier
           * RegimeMultiplier
           * LiquidityMultiplier
           / VolatilityMultiplier
```

Constraints:

- clamp to market-specific leverage caps
- clamp to sane UI limits for retail-style presentation
- downgrade size aggressively under low-liquidity or event-risk regimes

#### 36.4.4 Stops and Targets

Phase 1 stop/target logic remains distribution-driven:

- `stopLossPct` derived from downside tail and volatility floor
- `takeProfit1Pct` anchored to the central scenario
- `takeProfit2Pct` anchored to the upside scenario and regime multiplier

Design rule:

- do not pretend ATR/structure is fully solved in Phase 1
- keep a clear later upgrade path to ATR and structure-aware stops

#### 36.4.5 Trade Quality Score

`TradeQualityScore` should be a weighted bounded score:

```text
Quality Score =
  0.30 * ConfidenceComponent
  0.30 * EdgeComponent
  0.15 * RegimeComponent
  0.15 * LiquidityComponent
  0.10 * CostDragComponent
```

Output bands:

- `A` -> `>= 80`
- `B` -> `65 - 79.99`
- `C` -> `50 - 64.99`
- `D` -> `< 50`

### 36.5 Endpoint Integration Matrix

#### Crypto

Prediction-bearing crypto endpoints should include:

- `prediction`
- `policyPacket`
- compatibility `policy`
- compatibility `tpSl`

#### CN Equity

CN endpoints should expose `policyPacket` on:

- index prediction payloads
- stock detail prediction payloads
- any universe/tracking row that already emits action or probability data

#### US Equity

US endpoints should expose `policyPacket` on:

- index prediction payloads
- stock detail prediction payloads
- any ranking row used in table/tracking surfaces

#### Sessions

Session endpoints should expose:

- current forecast stats
- session-level `policyPacket`
- compatibility aliases for existing UI cards

#### Tracking

Tracking rows must expose:

- `policyPacket`
- `expectedNetEdgePct`
- `tradeQualityScore`
- `tradeQualityBand`
- `regime`
- `costPct`
- `rewardRisk2`

### 36.6 Tracking Dashboard Upgrade Requirements

Tracking becomes the packet-first market monitor.

Required ranking fields:

- `expectedNetEdgePct`
- `tradeQualityScore`
- `tradeQualityBand`
- `regime`
- `costPct`
- `rewardRisk2`

Required UI behavior:

- users can sort by `Net Edge`, `Trade Quality`, `Regime`, `Cost`, and `R:R`
- action feed uses packet `action`, `reasons`, and `gates`
- factor and coverage views show why a setup was promoted or downgraded

Ranking rule:

- top opportunities are defined by packet quality, not just directional score

### 36.7 Positions Upgrade Requirements

Positions become the execution record for the packet.

At entry:

- store full packet snapshot
- store core packet metrics in structured columns
- store engine version

At close:

- compute realized PnL and realized PnL %
- estimate realized slippage
- compute realized-vs-expected edge delta
- persist exit regime when available

`positions.html` should surface:

- regime
- expected net edge
- trade quality band
- entry cost assumptions
- current vs recommended size
- stop/target plan
- reward/risk metrics
- packet reasons and gates

### 36.8 Market Page Consumption Rules

The market pages may keep their current layout in Phase 1, but their decision semantics must be packet-backed.

Pages in scope:

- `crypto.html`
- `cn-equity.html`
- `us-equity.html`
- session pages with signal/risk cards

Frontend rule:

- page JS may format `policyPacket`
- page JS must not re-decide action, size, stop, target, regime, or quality once packet data exists

Legacy logic to remove or bypass:

- local action-threshold rules
- local position-size rules
- local stop/TP math
- local edge formulas that conflict with server packet output

### 36.9 Traceability and Evaluation Hooks

Phase 1 should log enough data for future evaluation without waiting for a full backtest UI.

Required ex-ante logging:

- symbol
- market
- forecast timestamp
- `pUp`, `confidence`, `q10`, `q50`, `q90`
- regime
- cost estimate
- size
- stops/targets
- quality score
- reasons/gates
- engine version

Required ex-post logging:

- realized PnL
- realized PnL %
- realized slippage
- hold duration
- stop/TP/manual exit classification
- realized-vs-expected edge delta
- exit regime

Minimum future evaluation summary:

- average expected net edge by market
- average realized edge by market
- quality-band hit rate
- regime-stratified win rate
- cost drag by market

### 36.10 Delivery Checklist

The implementation should not be considered done until all of the following are true.

#### Backend

- `server/policy-engine.js` exists and is the only policy source of truth
- all major prediction-bearing endpoints emit additive `policyPacket`
- compatibility fields remain populated
- positions/history persistence stores packet snapshots and structured key fields

#### Frontend

- tracking sorts and filters on packet-derived metrics
- positions surfaces packet-backed edge, size, regime, and stop/target data
- market signal/risk cards read packet semantics instead of local rules

#### Validation

- packet shape is consistent across crypto, CN, US, and sessions
- positive directional setups with negative net edge do not produce aggressive actions
- high-cost / low-liquidity setups are visibly penalized
- ranking reflects packet quality rather than old ad hoc heuristic totals
- `engineVersion` is present in all emitted and stored packets

### 36.11 Rollout and Risk Controls

To keep migration safe:

- keep the change additive in Phase 1
- do not remove existing payload fields
- allow tracking UI to fall back gracefully if packet fields are absent
- tag all packet output with `engineVersion`
- maintain a clear rollback path to legacy ranking/display fields

Recommended rollout order:

1. ship the shared engine
2. integrate packet emission into endpoints
3. upgrade tracking
4. upgrade positions persistence
5. align market pages
6. validate ranking, attribution, and compatibility

### 36.12 Final Implementation Recommendation

The most effective Phase 1 is not a flashy UI rewrite. It is a controlled consolidation of policy semantics.

If the implementation achieves the following, Phase 1 is successful:

1. one shared backend engine
2. one canonical packet contract
3. edge-first action selection
4. regime-aware and cost-aware sizing
5. additive endpoint compatibility
6. packet-backed tracking and positions
7. enough logging to evaluate realized performance later

That is the right foundation for a more sophisticated quant execution layer in Phase 2.
