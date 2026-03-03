# Data Pipeline Documentation - Complete Technical Guide

## 📊 Overview

This document provides comprehensive guidance on the data pipeline architecture for the StockandCrypto platform, covering data ingestion, feature engineering, quality control, and incremental updates.

### Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    External Data Sources                     │
│  Binance | Yahoo Finance | Alpha Vantage | AkShare         │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Ingestion Layer                      │
│  API Clients | Rate Limiting | Error Handling | Caching    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Quality Control                      │
│  Validation | Cleaning | Gap Detection | Anomaly Detection │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Feature Engineering                       │
│  Technical Indicators | Rolling Stats | Session Features   │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                    Data Storage                              │
│  Raw Data | Processed Features | Model Artifacts            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📥 Data Ingestion

### 1. Incremental Data Updates

**Smart Update Strategy:**
```python
import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

class IncrementalUpdater:
    """Incremental data update system"""
    
    def __init__(self, data_dir="data"):
        self.data_dir = Path(data_dir)
        self.raw_dir = self.data_dir / "raw"
        self.processed_dir = self.data_dir / "processed"
        
        self.raw_dir.mkdir(parents=True, exist_ok=True)
        self.processed_dir.mkdir(parents=True, exist_ok=True)
    
    def get_last_timestamp(self, symbol, market):
        """Get last timestamp from existing data"""
        
        file_path = self.raw_dir / market / f"{symbol}.parquet"
        
        if not file_path.exists():
            return None
        
        df = pd.read_parquet(file_path)
        
        if 'datetime' in df.columns:
            df['datetime'] = pd.to_datetime(df['datetime'])
            return df['datetime'].max()
        elif df.index.name == 'datetime':
            return df.index.max()
        
        return None
    
    def fetch_incremental_data(self, symbol, market, api_client):
        """Fetch incremental data from last timestamp"""
        
        last_ts = self.get_last_timestamp(symbol, market)
        
        if last_ts is None:
            # No existing data, fetch full history
            print(f"No existing data for {symbol}, fetching full history...")
            return api_client.get_historical_data(symbol)
        
        # Calculate time gap
        now = datetime.now()
        gap_hours = (now - last_ts).total_seconds() / 3600
        
        if gap_hours < 1:
            print(f"Data for {symbol} is up to date (last: {last_ts})")
            return None
        
        print(f"Fetching {gap_hours:.1f} hours of new data for {symbol}...")
        
        # Fetch new data
        if market == "crypto":
            new_data = api_client.get_klines(
                symbol, 
                interval="1h",
                start_time=int(last_ts.timestamp() * 1000)
            )
        else:
            new_data = api_client.get_historical_data(
                symbol,
                start_date=last_ts + timedelta(hours=1)
            )
        
        return new_data
    
    def merge_and_save(self, symbol, market, new_data):
        """Merge new data with existing and save"""
        
        file_path = self.raw_dir / market / f"{symbol}.parquet"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        if file_path.exists():
            existing_df = pd.read_parquet(file_path)
            
            # Merge
            combined_df = pd.concat([existing_df, new_data], ignore_index=True)
            
            # Remove duplicates
            if 'datetime' in combined_df.columns:
                combined_df = combined_df.drop_duplicates(subset='datetime', keep='last')
            else:
                combined_df = combined_df[~combined_df.index.duplicated(keep='last')]
            
            # Sort
            if 'datetime' in combined_df.columns:
                combined_df = combined_df.sort_values('datetime')
            else:
                combined_df = combined_df.sort_index()
        else:
            combined_df = new_data
        
        # Save
        combined_df.to_parquet(file_path, index=False)
        
        print(f"Saved {len(combined_df)} rows to {file_path}")
        
        return combined_df
```

### 2. Scheduled Data Updates

**Cron-based Automation:**
```python
from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.cron import CronTrigger
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DataUpdateScheduler:
    """Scheduled data update system"""
    
    def __init__(self):
        self.scheduler = BlockingScheduler()
        self.updater = IncrementalUpdater()
    
    def update_crypto_data(self):
        """Update cryptocurrency data (every hour)"""
        logger.info("Starting crypto data update...")
        
        crypto_symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT"]
        binance_client = BinanceAPI(api_key, api_secret)
        
        results = self.updater.update_all_symbols(crypto_symbols, "crypto", binance_client)
        
        logger.info(f"Crypto update complete: {len(results[results['status']=='success'])} symbols updated")
    
    def update_us_equity_data(self):
        """Update US equity data (daily after market close)"""
        logger.info("Starting US equity data update...")
        
        us_symbols = ["AAPL", "MSFT", "GOOGL"]
        yf_client = YahooFinanceAPI()
        
        results = self.updater.update_all_symbols(us_symbols, "us_equity", yf_client)
        
        logger.info(f"US equity update complete")
    
    def setup_schedules(self):
        """Setup update schedules"""
        
        # Crypto: Every hour
        self.scheduler.add_job(
            self.update_crypto_data,
            CronTrigger(minute=5),  # Run at :05 every hour
            id='crypto_update',
            name='Cryptocurrency Data Update'
        )
        
        # US Equity: Daily at 17:30 ET (after market close)
        self.scheduler.add_job(
            self.update_us_equity_data,
            CronTrigger(hour=17, minute=30, day_of_week='mon-fri'),
            id='us_equity_update',
            name='US Equity Data Update'
        )
        
        logger.info("Schedules configured:")
        for job in self.scheduler.get_jobs():
            logger.info(f"  - {job.name}: {job.next_run_time}")
    
    def start(self):
        """Start scheduler"""
        self.setup_schedules()
        logger.info("Starting data update scheduler...")
        self.scheduler.start()
```

---

## 🔧 Feature Engineering

### 1. Technical Indicators

**Comprehensive Indicator Library:**
```python
import pandas as pd
import numpy as np
from ta.trend import MACD, ADX, EMAIndicator
from ta.momentum import RSIIndicator
from ta.volatility import BollingerBands, AverageTrueRange

class FeatureEngineer:
    """Feature engineering for financial time series"""
    
    def __init__(self):
        self.feature_names = []
    
    def add_price_features(self, df):
        """Add price-based features"""
        
        # Returns
        df['return_1h'] = df['close'].pct_change(1)
        df['return_4h'] = df['close'].pct_change(4)
        df['return_24h'] = df['close'].pct_change(24)
        
        # Log returns
        df['log_return'] = np.log(df['close'] / df['close'].shift(1))
        
        # Price momentum
        df['momentum_1h'] = df['close'] - df['close'].shift(1)
        df['momentum_24h'] = df['close'] - df['close'].shift(24)
        
        # High/Low features
        df['high_low_ratio'] = df['high'] / df['low']
        df['close_to_high'] = df['close'] / df['high']
        df['close_to_low'] = df['close'] / df['low']
        
        return df
    
    def add_technical_indicators(self, df):
        """Add technical indicators using ta library"""
        
        # EMA
        for period in [8, 20, 55, 144, 233]:
            ema = EMAIndicator(close=df['close'], window=period)
            df[f'ema_{period}'] = ema.ema_indicator()
            df[f'close_to_ema_{period}'] = df['close'] / df[f'ema_{period}'] - 1
        
        # MACD
        macd = MACD(close=df['close'])
        df['macd'] = macd.macd()
        df['macd_signal'] = macd.macd_signal()
        df['macd_diff'] = macd.macd_diff()
        
        # RSI
        rsi = RSIIndicator(close=df['close'], window=14)
        df['rsi_14'] = rsi.rsi()
        
        # Bollinger Bands
        bb = BollingerBands(close=df['close'])
        df['bb_high'] = bb.bollinger_hband()
        df['bb_low'] = bb.bollinger_lband()
        df['bb_mid'] = bb.bollinger_mavg()
        df['bb_width'] = bb.bollinger_wband()
        
        # ATR
        atr = AverageTrueRange(high=df['high'], low=df['low'], close=df['close'])
        df['atr_14'] = atr.average_true_range()
        df['atr_ratio'] = df['atr_14'] / df['close']
        
        return df
    
    def add_rolling_statistics(self, df):
        """Add rolling statistical features"""
        
        windows = [7, 14, 30, 90]
        
        for window in windows:
            # Rolling mean
            df[f'return_mean_{window}'] = df['return_1h'].rolling(window).mean()
            
            # Rolling std
            df[f'return_std_{window}'] = df['return_1h'].rolling(window).std()
            
            # Rolling skew
            df[f'return_skew_{window}'] = df['return_1h'].rolling(window).skew()
            
            # Rolling min/max
            df[f'close_min_{window}'] = df['close'].rolling(window).min()
            df[f'close_max_{window}'] = df['close'].rolling(window).max()
            df[f'close_range_{window}'] = df[f'close_max_{window}'] - df[f'close_min_{window}']
        
        return df
    
    def generate_features(self, df, market="crypto"):
        """Generate all features"""
        
        print(f"Generating features for {market}...")
        print(f"Input shape: {df.shape}")
        
        # Price features
        df = self.add_price_features(df)
        
        # Technical indicators
        df = self.add_technical_indicators(df)
        
        # Rolling statistics
        df = self.add_rolling_statistics(df)
        
        # Drop NaN rows
        initial_len = len(df)
        df = df.dropna()
        final_len = len(df)
        
        print(f"Removed {initial_len - final_len} NaN rows")
        print(f"Output shape: {df.shape}")
        print(f"Features: {df.shape[1]}")
        
        return df
```

### 2. Label Generation

**Direction & Magnitude Labels:**
```python
class LabelGenerator:
    """Generate prediction labels"""
    
    @staticmethod
    def generate_direction_labels(df, horizons=[1, 3, 7]):
        """Generate direction labels for multiple horizons"""
        
        for h in horizons:
            # Future return
            df[f'future_return_{h}'] = df['close'].shift(-h) / df['close'] - 1
            
            # Direction label
            df[f'direction_{h}'] = (df[f'future_return_{h}'] > 0).astype(int)
        
        return df
    
    @staticmethod
    def generate_magnitude_labels(df, horizons=[1, 3, 7]):
        """Generate magnitude labels (actual returns)"""
        
        for h in horizons:
            df[f'magnitude_{h}'] = df['close'].shift(-h) / df['close'] - 1
        
        return df
    
    def generate_all_labels(self, df, horizons=[1, 3, 7]):
        """Generate all labels"""
        
        print("Generating labels...")
        
        # Direction
        df = self.generate_direction_labels(df, horizons)
        
        # Magnitude
        df = self.generate_magnitude_labels(df, horizons)
        
        # Remove future rows (where labels are NaN)
        max_horizon = max(horizons)
        df = df.iloc[:-max_horizon]
        
        print(f"Labels generated for horizons: {horizons}")
        print(f"Final shape: {df.shape}")
        
        return df
```

---

## ✅ Data Quality Control

### 1. Validation Checks

```python
class DataQualityChecker:
    """Comprehensive data quality validation"""
    
    def __init__(self, df):
        self.df = df
        self.issues = []
    
    def check_missing_values(self):
        """Check for missing values"""
        
        missing = self.df.isnull().sum()
        missing_pct = missing / len(self.df) * 100
        
        if missing.any():
            for col, count in missing[missing > 0].items():
                self.issues.append({
                    'type': 'missing_values',
                    'column': col,
                    'count': count,
                    'percentage': missing_pct[col]
                })
        
        return missing[missing > 0].to_dict()
    
    def check_duplicates(self):
        """Check for duplicate rows"""
        
        if 'datetime' in self.df.columns:
            duplicates = self.df['datetime'].duplicated().sum()
        else:
            duplicates = self.df.index.duplicated().sum()
        
        if duplicates > 0:
            self.issues.append({
                'type': 'duplicates',
                'count': duplicates
            })
        
        return duplicates
    
    def check_price_consistency(self):
        """Check OHLC price consistency"""
        
        issues = []
        
        # High should be >= Low
        invalid_high_low = self.df[self.df['high'] < self.df['low']]
        if len(invalid_high_low) > 0:
            issues.append({
                'type': 'high_below_low',
                'count': len(invalid_high_low)
            })
        
        # Close should be between High and Low
        invalid_close = self.df[
            (self.df['close'] > self.df['high']) | 
            (self.df['close'] < self.df['low'])
        ]
        if len(invalid_close) > 0:
            issues.append({
                'type': 'close_outside_range',
                'count': len(invalid_close)
            })
        
        self.issues.extend(issues)
        
        return issues
    
    def check_price_spikes(self, threshold=0.3):
        """Check for price spikes (potential errors)"""
        
        returns = self.df['close'].pct_change()
        spikes = self.df[returns.abs() > threshold]
        
        if len(spikes) > 0:
            self.issues.append({
                'type': 'price_spikes',
                'count': len(spikes),
                'threshold': threshold
            })
        
        return spikes
    
    def generate_quality_report(self):
        """Generate comprehensive quality report"""
        
        print("Running data quality checks...")
        
        # Run all checks
        missing = self.check_missing_values()
        duplicates = self.check_duplicates()
        price_issues = self.check_price_consistency()
        spikes = self.check_price_spikes()
        
        # Generate report
        report = {
            'total_rows': len(self.df),
            'total_columns': len(self.df.columns),
            'date_range': f"{self.df.index.min()} to {self.df.index.max()}",
            'missing_values': missing,
            'duplicates': duplicates,
            'price_issues': price_issues,
            'price_spikes': len(spikes),
            'issues': self.issues
        }
        
        # Print summary
        print("\n" + "="*60)
        print("DATA QUALITY REPORT")
        print("="*60)
        print(f"Total rows: {report['total_rows']}")
        print(f"Total columns: {report['total_columns']}")
        print(f"Date range: {report['date_range']}")
        print(f"\nIssues found: {len(self.issues)}")
        
        for issue in self.issues:
            print(f"  - {issue['type']}: {issue.get('count', 'N/A')}")
        
        if len(self.issues) == 0:
            print("  ✅ No issues found!")
        
        return report

# Usage
checker = DataQualityChecker(df)
report = checker.generate_quality_report()
```

### 2. Data Cleaning

```python
class DataCleaner:
    """Clean and fix data issues"""
    
    @staticmethod
    def remove_duplicates(df):
        """Remove duplicate rows"""
        
        initial_len = len(df)
        
        if 'datetime' in df.columns:
            df = df.drop_duplicates(subset='datetime', keep='last')
        else:
            df = df[~df.index.duplicated(keep='last')]
        
        removed = initial_len - len(df)
        
        if removed > 0:
            print(f"Removed {removed} duplicate rows")
        
        return df
    
    @staticmethod
    def fix_price_anomalies(df):
        """Fix price anomalies"""
        
        # Fix high < low
        mask = df['high'] < df['low']
        if mask.any():
            print(f"Fixing {mask.sum()} rows with high < low")
            df.loc[mask, 'high'], df.loc[mask, 'low'] = (
                df.loc[mask, 'low'].values, df.loc[mask, 'high'].values
            )
        
        # Fix close outside [low, high]
        df['close'] = df['close'].clip(lower=df['low'], upper=df['high'])
        
        return df
    
    @staticmethod
    def remove_price_spikes(df, threshold=0.3):
        """Remove extreme price spikes"""
        
        returns = df['close'].pct_change()
        mask = returns.abs() <= threshold
        
        removed = (~mask).sum()
        if removed > 0:
            print(f"Removing {removed} price spike rows")
        
        return df[mask]
    
    @staticmethod
    def clean_data(df):
        """Apply all cleaning steps"""
        
        print("Cleaning data...")
        print(f"Input shape: {df.shape}")
        
        # Remove duplicates
        df = DataCleaner.remove_duplicates(df)
        
        # Fix price anomalies
        df = DataCleaner.fix_price_anomalies(df)
        
        # Remove price spikes
        df = DataCleaner.remove_price_spikes(df, threshold=0.3)
        
        # Drop remaining NaN
        initial_len = len(df)
        df = df.dropna()
        final_len = len(df)
        
        print(f"Removed {initial_len - final_len} rows with NaN")
        print(f"Output shape: {df.shape}")
        
        return df

# Usage
df_clean = DataCleaner.clean_data(df)
```

---

## 💾 Data Storage

### Parquet Storage

```python
import pyarrow.parquet as pq
import pyarrow as pa

class DataStorage:
    """Efficient data storage using Parquet"""
    
    def __init__(self, base_path="data"):
        self.base_path = Path(base_path)
        self.raw_path = self.base_path / "raw"
        self.processed_path = self.base_path / "processed"
        self.features_path = self.base_path / "features"
        
        for path in [self.raw_path, self.processed_path, self.features_path]:
            path.mkdir(parents=True, exist_ok=True)
    
    def save_raw_data(self, df, symbol, market):
        """Save raw data"""
        
        file_path = self.raw_path / market / f"{symbol}.parquet"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        df.to_parquet(
            file_path,
            compression='snappy',
            index=False
        )
        
        print(f"Saved raw data to {file_path}")
        
        return file_path
    
    def save_features(self, df, symbol, market):
        """Save processed features"""
        
        file_path = self.features_path / market / f"{symbol}_features.parquet"
        file_path.parent.mkdir(parents=True, exist_ok=True)
        
        df.to_parquet(
            file_path,
            compression='snappy',
            index=False
        )
        
        print(f"Saved features to {file_path}")
        
        return file_path
    
    def load_features(self, symbol, market):
        """Load processed features"""
        
        file_path = self.features_path / market / f"{symbol}_features.parquet"
        
        if not file_path.exists():
            raise FileNotFoundError(f"No features found for {symbol} in {market}")
        
        df = pd.read_parquet(file_path)
        
        print(f"Loaded {len(df)} rows from {file_path}")
        
        return df

# Usage
storage = DataStorage()

# Save features
storage.save_features(df_features, "BTCUSDT", "crypto")

# Load features
df_loaded = storage.load_features("BTCUSDT", "crypto")
```

---

## 📊 Pipeline Monitoring

### Data Pipeline Health Dashboard

```python
class PipelineMonitor:
    """Monitor data pipeline health"""
    
    def __init__(self):
        self.metrics = {
            'updates': [],
            'errors': [],
            'quality_scores': []
        }
    
    def log_update(self, symbol, market, rows_added, status):
        """Log data update"""
        
        self.metrics['updates'].append({
            'symbol': symbol,
            'market': market,
            'rows_added': rows_added,
            'status': status,
            'timestamp': datetime.now()
        })
    
    def log_error(self, symbol, market, error):
        """Log error"""
        
        self.metrics['errors'].append({
            'symbol': symbol,
            'market': market,
            'error': str(error),
            'timestamp': datetime.now()
        })
    
    def get_update_summary(self, hours=24):
        """Get update summary for last N hours"""
        
        cutoff = datetime.now() - timedelta(hours=hours)
        
        recent_updates = [
            u for u in self.metrics['updates']
            if u['timestamp'] > cutoff
        ]
        
        return {
            'total_updates': len(recent_updates),
            'successful': len([u for u in recent_updates if u['status'] == 'success']),
            'failed': len([u for u in recent_updates if u['status'] == 'error']),
            'total_rows_added': sum(u['rows_added'] for u in recent_updates)
        }
    
    def generate_health_report(self):
        """Generate pipeline health report"""
        
        summary = self.get_update_summary(24)
        
        report = f"""
# Data Pipeline Health Report

## Last 24 Hours

- Total Updates: {summary['total_updates']}
- Successful: {summary['successful']}
- Failed: {summary['failed']}
- Total Rows Added: {summary['total_rows_added']}

## Recent Errors

"""
        
        for error in self.metrics['errors'][-10:]:
            report += f"- {error['timestamp']}: {error['symbol']} - {error['error']}\n"
        
        return report
```

---

## 🚀 Production Checklist

- [ ] Configure API clients with proper authentication
- [ ] Set up incremental data update system
- [ ] Implement scheduled updates for each market
- [ ] Add data quality validation checks
- [ ] Configure data cleaning pipeline
- [ ] Set up Parquet storage with compression
- [ ] Implement data versioning
- [ ] Add pipeline monitoring
- [ ] Set up error alerting
- [ ] Test end-to-end pipeline

---

**Last Updated:** 2026-03-03  
**Version:** 1.0  
**Status:** Production Ready  
**Next Review:** 2026-03-10