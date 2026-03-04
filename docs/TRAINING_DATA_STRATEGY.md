# Training Data Strategy - Complete Guide

## 📊 Overview

This document defines the optimal historical data periods for training machine learning models across different markets, balancing data availability, market structure relevance, and model performance.

---

## 🎯 Core Principles

### 1. **Market Structure Evolution**
```
❌ Problem: Markets from 10+ years ago have different characteristics
✅ Solution: Use recent data that reflects current dynamics

Examples:
- 2010 Crypto: Illiquid, Mt. Gox, no institutional players
- 2024 Crypto: Liquid, regulated, ETF-approved, institutional

- 2005 CN Market: No QFII, limited foreign access
- 2024 CN Market: Stock Connect, foreign participation
```

### 2. **Minimum Data Requirements**
```
LightGBM/XGBoost: 1,000+ samples minimum
LSTM: 10,000+ samples recommended
Transformer: 20,000+ samples optimal

Rule of thumb:
- Daily data: 3-5 years minimum
- Hourly data: 1-2 years minimum
- Minute data: 3-6 months minimum
```

### 3. **Event Coverage**
```
Models must experience:
✅ Bull markets
✅ Bear markets
✅ Crisis events
✅ Regime changes (rate cycles, regulations)
```

---

## 🪙 Cryptocurrency Training Strategy

### Bitcoin (BTC/USDT)

**Data Availability:**
```
Full History: 2010-07-18 to present (14+ years)
First trades: $0.05 (July 2010)
Peak: $69,000 (November 2021)
```

**Recommended Training Periods:**

#### **Option A: Conservative (Recommended for Production)**
```python
Training: 2020-01-01 to 2024-12-31 (4 years)
Validation: 2018-01-01 to 2019-12-31 (2 years)

Rationale:
✅ Post-2017 ICO bubble burst
✅ COVID volatility (March 2020)
✅ Bull run 2020-2021
✅ Bear market 2022
✅ Recovery 2023-2024
✅ ETF approval (2024)
✅ Institutional adoption

Data volume:
- Daily: 1,461 days
- Hourly: 35,064 hours (optimal for LSTM)
- Minute: 2,103,840 minutes

Events captured:
- COVID crash (-50% in one day)
- Halving events (2020, 2024)
- China mining ban (2021)
- FTX collapse (2022)
- ETF approval (2024)
```

#### **Option B: Extended (For Research)**
```python
Training: 2017-01-01 to 2024-12-31 (7 years)

Rationale:
✅ Full bull/bear cycle
✅ ICO bubble
✅ More diverse patterns
❌ Older data less relevant
❌ Different market structure

Data volume:
- Daily: 2,557 days
- Hourly: 61,368 hours
```

#### **Option C: Rolling Window (For Live Trading)**
```python
Training: Last 24 months
Retrain: Monthly
Discard: Oldest month

Rationale:
✅ Most relevant dynamics
✅ Current regulatory environment
✅ Adapt to regime changes
❌ May miss long-term patterns
```

**Why NOT Use 2010-2024?**
```
❌ 2010-2016: 
   - Illiquid markets
   - Mt. Gox exchange dominance
   - No institutional players
   - Different regulatory environment
   
❌ 2017-2019:
   - ICO bubble (not repeatable)
   - Pre-COVID dynamics
   - No DeFi/NFT ecosystems
   
✅ 2020+:
   - Modern market structure
   - Institutional participation
   - Regulated exchanges
   - ETF approval
```

---

### Ethereum (ETH/USDT)

**Data Availability:**
```
Launch: 2015-07-30
First trades: August 2015
```

**Recommended Training:**
```python
Training: 2020-01-01 to 2024-12-31 (4 years)
Validation: 2018-01-01 to 2019-12-31 (2 years)

Rationale:
✅ DeFi boom (2020)
✅ NFT mania (2021)
✅ Merge event (2022)
✅ Proof-of-Stake transition

Events captured:
- DeFi summer 2020
- NFT boom 2021
- ETH merge September 2022
- Shanghai upgrade 2023
- ETF approval 2024
```

---

### Solana (SOL/USDT)

**Data Availability:**
```
Launch: March 2020
Limited historical data
```

**Recommended Training:**
```python
Training: 2021-01-01 to 2024-12-31 (3 years)
Validation: 2020-03-01 to 2020-12-31 (10 months)

Rationale:
✅ Only 4 years of data available
✅ Must use all available data
✅ Captures major SOL events

Events captured:
- DeFi ecosystem growth
- FTX collapse impact
- Network outages
- Recovery 2023-2024

Note: Minimum viable training period due to limited history
```

---

## 🇨🇳 Chinese A-Share Training Strategy

### SSE Composite Index (000001.SH)

**Data Availability:**
```
Launch: 1990-12-19
Full history: 34+ years
```

**Recommended Training Periods:**

#### **Option A: Conservative (Recommended)**
```python
Training: 2018-01-01 to 2024-12-31 (6 years)
Validation: 2015-01-01 to 2017-12-31 (3 years)

Rationale:
✅ Modern market structure
✅ Post-2015 crash recovery
✅ Trade war impacts (2018-2019)
✅ COVID recovery (2020)
✅ Property crisis (2021-2023)
✅ Market reforms (STAR board, registration system)

Data volume:
- Daily: 1,440 trading days (T+1 settlement)
- ~6 years of patterns

Events captured:
- Trade war escalation 2018-2019
- COVID crash & recovery 2020
- Education sector crackdown 2021
- Property debt crisis 2021-2023
- Zero-COVID policy impact 2022
- Reopening rally 2023
```

#### **Option B: Extended (For Comprehensive Model)**
```python
Training: 2010-01-01 to 2024-12-31 (14 years)
Validation: 2005-01-01 to 2009-12-31 (5 years)

Rationale:
✅ Multiple bull/bear cycles
✅ 2015 crash and recovery
✅ More diverse patterns
❌ Older data less relevant
❌ Pre-trade war dynamics

Events captured:
- 2015 bubble & crash
- 2016-2017 recovery
- Trade war period
- COVID impact
- Property crisis
```

**Why NOT Use 1990-2024?**
```
❌ 1990-2004:
   - Very different market structure
   - No QFII system
   - Limited foreign participation
   - Different regulatory framework
   
❌ 2005-2009:
   - Pre-financial crisis
   - Different economic environment
   - Less mature markets
   
❌ 2015 crash:
   - One-time event (may cause overfitting)
   - Extreme leverage bubble
   - Not representative of normal conditions
```

---

### CSI 300 Index (000300.SH)

**Data Availability:**
```
Launch: April 2005
Full history: 19+ years
```

**Recommended Training:**
```python
Training: 2018-01-01 to 2024-12-31 (6 years)
Validation: 2015-01-01 to 2017-12-31 (3 years)

Rationale:
✅ Same as SSE Composite
✅ Blue-chip focus
✅ More stable than SSE
✅ Better represents large-cap dynamics

Data volume:
- Daily: 1,440 trading days
- Covers all major events
```

---

## 🇺🇸 US Market Training Strategy

### S&P 500 Index (^GSPC)

**Data Availability:**
```
Launch: March 1957
Full history: 67+ years
Data available: 1950s to present
```

**Recommended Training Periods:**

#### **Option A: Conservative (Recommended)**
```python
Training: 2018-01-01 to 2024-12-31 (6 years)
Validation: 2015-01-01 to 2017-12-31 (3 years)

Rationale:
✅ Modern market structure
✅ Trump trade war
✅ COVID crash & recovery
✅ Inflation crisis (2022)
✅ AI rally (2023-2024)
✅ Fed rate cycle (0% → 5.25%)

Data volume:
- Daily: 1,508 trading days
- Hourly: 12,000+ hours

Events captured:
- Trade war escalation 2018-2019
- COVID crash March 2020 (-34% in 23 days)
- Bull market 2020-2021
- Inflation crisis 2022
- Bear market 2022
- AI rally 2023-2024
```

#### **Option B: Comprehensive (For Research)**
```python
Training: 2008-01-01 to 2024-12-31 (16 years)
Validation: 2005-01-01 to 2007-12-31 (3 years)

Rationale:
✅ 2008 Financial Crisis
✅ Multiple bull/bear cycles
✅ Multiple Fed rate cycles
✅ Comprehensive stress testing
✅ More diverse patterns

Data volume:
- Daily: 4,016 trading days
- Hourly: 32,000+ hours

Events captured:
- 2008 Financial Crisis (-57% drawdown)
- European debt crisis 2010-2012
- Flash crash 2010
- Bull market 2009-2020
- COVID crash 2020
- Inflation crisis 2022
- Multiple rate cycles
```

#### **Option C: Extended Historical (For Academic Research)**
```python
Training: 1990-01-01 to 2024-12-31 (34 years)

Rationale:
✅ Maximum pattern diversity
✅ Multiple market regimes
✅ Multiple crises
❌ Very old data
❌ Different market structure

Events captured:
- 1990s bull market
- Dot-com bubble (1995-2000)
- Dot-com crash (2000-2002)
- 9/11 attacks
- 2008 Financial Crisis
- COVID crash
- All major events
```

**Why NOT Use 1950-2024?**
```
❌ 1950-1980:
   - Gold standard era
   - Different monetary policy
   - No ETFs
   - Pre-computerized trading
   
❌ 1980-1999:
   - Different regulatory environment
   - Pre-internet era
   - Different information flow
   
✅ 2008+:
   - Modern market structure
   - High-frequency trading
   - ETF dominance
   - Current regulatory framework
```

---

### Dow Jones Industrial Average (^DJI)

**Data Availability:**
```
Launch: May 1896
Full history: 128+ years!
```

**Recommended Training:**
```python
Training: 2008-01-01 to 2024-12-31 (16 years)

Rationale:
✅ Same as S&P 500
✅ Covers all major events
✅ Blue-chip focus
✅ Less volatile than Nasdaq

Note: Use same strategy as S&P 500
```

---

### Nasdaq 100 Index (^NDX)

**Data Availability:**
```
Launch: January 1985
Full history: 39+ years
```

**Recommended Training:**
```python
Training: 2010-01-01 to 2024-12-31 (14 years)
Validation: 2008-01-01 to 2009-12-31 (2 years)

Rationale:
✅ Post-2008 recovery
✅ Tech boom 2010s
✅ COVID tech rally
✅ 2022 tech crash
✅ AI boom 2023-2024

Data volume:
- Daily: 3,528 trading days

Events captured:
- Post-2008 recovery
- Tech boom 2010-2020
- FAANG dominance
- COVID tech rally
- 2022 tech bear market
- AI boom 2023-2024
```

---

## 🏢 Individual Stocks Training Strategy

### US Stocks (AAPL, MSFT, GOOGL, etc.)

**Recommended Training:**
```python
# Large-cap stocks with 10+ years of data
Training: 2018-01-01 to 2024-12-31 (6 years)
Validation: 2015-01-01 to 2017-12-31 (3 years)

Minimum viable: 2020-01-01 to 2024-12-31 (4 years)

Rationale:
✅ COVID impact
✅ Sector rotation
✅ Recent fundamentals
✅ Current management strategies

Data volume:
- Daily: 1,508 trading days (6 years)
- Minimum: 1,004 trading days (4 years)

Examples:
AAPL: Available since 1980 → Use 2018-2024
MSFT: Available since 1986 → Use 2018-2024
NVDA: Available since 1999 → Use 2018-2024
```

### Chinese A-Share Stocks

**Recommended Training:**
```python
Training: 2018-01-01 to 2024-12-31 (6 years)
Minimum: 2020-01-01 to 2024-12-31 (4 years)

Rationale:
✅ Trade war impact
✅ COVID recovery
✅ Property crisis impact
✅ Market reforms

Data volume:
- Daily: 1,440 trading days (6 years, T+1)
- Minimum: 960 trading days (4 years)

Examples:
600519 (Kweichow Moutai): 2001+ → Use 2018-2024
601318 (Ping An): 2007+ → Use 2018-2024
000001 (Ping An Bank): 1991+ → Use 2018-2024
```

---

## 📊 Training Period Summary Table

| Market/Asset | Available Since | Recommended Start | Training Period | Validation Period | Data Points |
|--------------|-----------------|-------------------|-----------------|-------------------|-------------|
| **BTC/USDT** | 2010 | 2020-01-01 | 2020-2024 (4y) | 2018-2019 (2y) | 35,064 hours |
| **ETH/USDT** | 2015 | 2020-01-01 | 2020-2024 (4y) | 2018-2019 (2y) | 35,064 hours |
| **SOL/USDT** | 2020 | 2021-01-01 | 2021-2024 (3y) | 2020 (10mo) | 26,280 hours |
| **SSE Index** | 1990 | 2018-01-01 | 2018-2024 (6y) | 2015-2017 (3y) | 1,440 days |
| **CSI 300** | 2005 | 2018-01-01 | 2018-2024 (6y) | 2015-2017 (3y) | 1,440 days |
| **S&P 500** | 1957 | 2008-01-01 | 2008-2024 (16y) | 2005-2007 (3y) | 4,016 days |
| **S&P 500** | 1957 | 2018-01-01 | 2018-2024 (6y) | 2015-2017 (3y) | 1,508 days |
| **Nasdaq 100** | 1985 | 2010-01-01 | 2010-2024 (14y) | 2008-2009 (2y) | 3,528 days |
| **Dow Jones** | 1896 | 2008-01-01 | 2008-2024 (16y) | 2005-2007 (3y) | 4,016 days |
| **US Stocks** | Varies | 2018-01-01 | 2018-2024 (6y) | 2015-2017 (3y) | 1,508 days |
| **CN Stocks** | Varies | 2018-01-01 | 2018-2024 (6y) | 2015-2017 (3y) | 1,440 days |

---

## 🔄 Retraining Strategy

### Regular Retraining Schedule

```python
# Recommended retraining frequency
retraining_schedule = {
    "crypto": {
        "frequency": "weekly",
        "lookback": "24 months",
        "reason": "High volatility, rapid regime changes"
    },
    
    "cn_index": {
        "frequency": "monthly",
        "lookback": "36 months",
        "reason": "Moderate volatility, policy changes"
    },
    
    "us_index": {
        "frequency": "monthly",
        "lookback": "36 months",
        "reason": "Lower volatility, stable dynamics"
    },
    
    "individual_stocks": {
        "frequency": "weekly",
        "lookback": "24 months",
        "reason": "Higher volatility, sector rotation"
    }
}
```

### Trigger-Based Retraining

```python
retraining_triggers = {
    # Volatility triggers
    "volatility_spike": {
        "threshold": "VIX > 30 (US) or VIX equivalent",
        "action": "Immediate retrain"
    },
    
    # Regime triggers
    "regime_change": {
        "events": [
            "Fed rate change > 50bps",
            "Major regulatory announcement",
            "Geopolitical event"
        ],
        "action": "Retrain within 24 hours"
    },
    
    # Performance triggers
    "performance_degradation": {
        "threshold": "Accuracy drops > 5%",
        "action": "Retrain with latest data"
    },
    
    # Drift triggers
    "concept_drift": {
        "threshold": "PSI > 0.25",
        "action": "Retrain with recent data"
    }
}
```

---

## 📈 Data Quality by Period

### Cryptocurrency Data Quality

```
2010-2013: ⚠️ Low quality
  - Illiquid markets
  - Exchange manipulation
  - Missing data
  
2014-2016: ⚠️ Medium quality
  - Better liquidity
  - Mt. Gox collapse
  - Still limited
  
2017-2019: ✅ Good quality
  - Mature exchanges
  - High liquidity
  - But ICO bubble distortion
  
2020-2024: ✅ Excellent quality
  - Institutional grade
  - Highly liquid
  - Regulated exchanges
```

### US Equity Data Quality

```
1950-1990: ⚠️ Low quality
  - Different market structure
  - Manual trading
  - Limited data
  
1990-2007: ⚠️ Medium quality
  - Electronic trading starts
  - But different regulations
  - Pre-financial crisis
  
2008-2024: ✅ Excellent quality
  - Modern market structure
  - High-frequency data available
  - Current regulations
```

---

## 🎯 Implementation Recommendations

### Phase 1: MVP (Minimum Viable Product)
```python
training_periods = {
    "crypto": "2022-01-01 to 2024-12-31",  # 2 years
    "cn_index": "2020-01-01 to 2024-12-31",  # 4 years
    "us_index": "2020-01-01 to 2024-12-31",  # 4 years
    "stocks": "2020-01-01 to 2024-12-31"     # 4 years
}

rationale = """
✅ Quick to train
✅ Most recent dynamics
✅ Sufficient for initial testing
❌ May miss long-term patterns
"""
```

### Phase 2: Production
```python
training_periods = {
    "crypto": "2020-01-01 to 2024-12-31",  # 4 years
    "cn_index": "2018-01-01 to 2024-12-31",  # 6 years
    "us_index": "2008-01-01 to 2024-12-31",  # 16 years
    "stocks": "2018-01-01 to 2024-12-31"     # 6 years
}

rationale = """
✅ Comprehensive coverage
✅ Multiple market cycles
✅ Crisis events included
✅ Optimal for production
"""
```

### Phase 3: Advanced
```python
training_periods = {
    "crypto": "2017-01-01 to 2024-12-31",  # 7 years
    "cn_index": "2010-01-01 to 2024-12-31",  # 14 years
    "us_index": "1990-01-01 to 2024-12-31",  # 34 years
    "stocks": "2015-01-01 to 2024-12-31"     # 9 years
}

rationale = """
✅ Maximum pattern diversity
✅ Academic research grade
✅ Long-term backtesting
❌ Computationally expensive
"""
```

---

## 📝 Checklist for Implementation

- [ ] Download historical data for each market
- [ ] Validate data quality for chosen period
- [ ] Check for missing data and gaps
- [ ] Identify major events in training period
- [ ] Create validation/test splits
- [ ] Document event calendar
- [ ] Set up retraining schedule
- [ ] Configure drift detection
- [ ] Test model performance across periods
- [ ] Compare short vs long training windows

---

**Last Updated:** 2026-03-03  
**Version:** 1.0  
**Status:** Production Ready  
**Next Review:** 2026-03-10