# Model Evaluation and Backtest Guide

## 📊 Overview

This document provides comprehensive guidance on evaluating model performance and conducting trading backtests for the StockandCrypto platform. Proper evaluation ensures models are production-ready and backtesting validates trading strategy profitability.

---

## 🎯 Evaluation Framework

### 1. Multi-Metric Evaluation

#### Direction Prediction Metrics

```python
import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    log_loss,
    brier_score_loss,
    confusion_matrix,
    classification_report
)

class DirectionEvaluator:
    """Comprehensive evaluation for direction prediction (UP/DOWN)"""
    
    def __init__(self, y_true: np.ndarray, y_pred_proba: np.ndarray, threshold: float = 0.5):
        """
        Initialize evaluator.
        
        Args:
            y_true: Ground truth labels (0 or 1)
            y_pred_proba: Predicted probabilities for UP direction
            threshold: Classification threshold (default 0.5)
        """
        self.y_true = y_true
        self.y_pred_proba = y_pred_proba
        self.y_pred = (y_pred_proba >= threshold).astype(int)
        self.threshold = threshold
        
    def compute_all_metrics(self) -> dict:
        """Compute all direction prediction metrics"""
        metrics = {}
        
        # Basic accuracy
        metrics['accuracy'] = accuracy_score(self.y_true, self.y_pred)
        
        # Precision, Recall, F1
        metrics['precision'] = precision_score(self.y_true, self.y_pred, zero_division=0)
        metrics['recall'] = recall_score(self.y_true, self.y_pred, zero_division=0)
        metrics['f1'] = f1_score(self.y_true, self.y_pred, zero_division=0)
        
        # Probability-based metrics
        metrics['auc_roc'] = roc_auc_score(self.y_true, self.y_pred_proba)
        metrics['log_loss'] = log_loss(self.y_true, self.y_pred_proba)
        metrics['brier_score'] = brier_score_loss(self.y_true, self.y_pred_proba)
        
        # Confusion matrix
        tn, fp, fn, tp = confusion_matrix(self.y_true, self.y_pred).ravel()
        metrics['true_positives'] = int(tp)
        metrics['true_negatives'] = int(tn)
        metrics['false_positives'] = int(fp)
        metrics['false_negatives'] = int(fn)
        
        # Additional metrics
        metrics['specificity'] = tn / (tn + fp) if (tn + fp) > 0 else 0
        metrics['npv'] = tn / (tn + fn) if (tn + fn) > 0 else 0  # Negative Predictive Value
        metrics['fpr'] = fp / (fp + tn) if (fp + tn) > 0 else 0  # False Positive Rate
        metrics['fnr'] = fn / (fn + tp) if (fn + tp) > 0 else 0  # False Negative Rate
        
        # Matthews Correlation Coefficient
        metrics['mcc'] = self._compute_mcc(tp, tn, fp, fn)
        
        # Cohen's Kappa
        metrics['kappa'] = self._compute_kappa(tp, tn, fp, fn)
        
        return metrics
    
    def _compute_mcc(self, tp: int, tn: int, fp: int, fn: int) -> float:
        """Compute Matthews Correlation Coefficient"""
        numerator = tp * tn - fp * fn
        denominator = np.sqrt((tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))
        return numerator / denominator if denominator > 0 else 0
    
    def _compute_kappa(self, tp: int, tn: int, fp: int, fn: int) -> float:
        """Compute Cohen's Kappa"""
        total = tp + tn + fp + fn
        observed = (tp + tn) / total
        expected = ((tp + fp) * (tp + fn) + (tn + fp) * (tn + fn)) / (total ** 2)
        return (observed - expected) / (1 - expected) if expected < 1 else 0
    
    def calibration_analysis(self, n_bins: int = 10) -> dict:
        """
        Analyze prediction calibration.
        
        Well-calibrated models have predicted probabilities that match actual frequencies.
        """
        bins = np.linspace(0, 1, n_bins + 1)
        bin_indices = np.digitize(self.y_pred_proba, bins) - 1
        bin_indices = np.clip(bin_indices, 0, n_bins - 1)
        
        calibration_data = []
        for i in range(n_bins):
            mask = bin_indices == i
            if mask.sum() > 0:
                mean_predicted = self.y_pred_proba[mask].mean()
                mean_actual = self.y_true[mask].mean()
                count = mask.sum()
                calibration_data.append({
                    'bin': i,
                    'bin_lower': bins[i],
                    'bin_upper': bins[i + 1],
                    'mean_predicted': mean_predicted,
                    'mean_actual': mean_actual,
                    'count': count,
                    'calibration_error': abs(mean_predicted - mean_actual)
                })
        
        # Expected Calibration Error (ECE)
        ece = sum(d['calibration_error'] * d['count'] for d in calibration_data) / len(self.y_true)
        
        # Maximum Calibration Error (MCE)
        mce = max(d['calibration_error'] for d in calibration_data)
        
        return {
            'bins': calibration_data,
            'expected_calibration_error': ece,
            'maximum_calibration_error': mce
        }
    
    def threshold_optimization(self, metric: str = 'f1') -> dict:
        """
        Find optimal classification threshold.
        
        Args:
            metric: Metric to optimize ('f1', 'accuracy', 'youden', 'cost_sensitive')
        
        Returns:
            Optimal threshold and corresponding metrics
        """
        thresholds = np.arange(0.05, 0.95, 0.01)
        results = []
        
        for thresh in thresholds:
            y_pred_thresh = (self.y_pred_proba >= thresh).astype(int)
            
            tn, fp, fn, tp = confusion_matrix(self.y_true, y_pred_thresh).ravel()
            
            accuracy = (tp + tn) / (tp + tn + fp + fn)
            precision = tp / (tp + fp) if (tp + fp) > 0 else 0
            recall = tp / (tp + fn) if (tp + fn) > 0 else 0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) > 0 else 0
            
            # Youden's J statistic
            specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
            youden_j = recall + specificity - 1
            
            results.append({
                'threshold': thresh,
                'accuracy': accuracy,
                'precision': precision,
                'recall': recall,
                'f1': f1,
                'youden_j': youden_j
            })
        
        results_df = pd.DataFrame(results)
        
        if metric == 'f1':
            best_idx = results_df['f1'].idxmax()
        elif metric == 'accuracy':
            best_idx = results_df['accuracy'].idxmax()
        elif metric == 'youden':
            best_idx = results_df['youden_j'].idxmax()
        else:
            best_idx = results_df['f1'].idxmax()
        
        return results_df.iloc[best_idx].to_dict()


# Usage Example
"""
evaluator = DirectionEvaluator(y_true, y_pred_proba)
metrics = evaluator.compute_all_metrics()
calibration = evaluator.calibration_analysis()
optimal_threshold = evaluator.threshold_optimization(metric='f1')

print(f"Accuracy: {metrics['accuracy']:.4f}")
print(f"AUC-ROC: {metrics['auc_roc']:.4f}")
print(f"Brier Score: {metrics['brier_score']:.4f}")
print(f"ECE: {calibration['expected_calibration_error']:.4f}")
print(f"Optimal Threshold: {optimal_threshold['threshold']:.2f}")
"""
```

#### Magnitude Prediction Metrics

```python
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from scipy import stats

class MagnitudeEvaluator:
    """Evaluation for magnitude/quantile prediction"""
    
    def __init__(self, y_true: np.ndarray, y_pred: np.ndarray):
        """
        Initialize magnitude evaluator.
        
        Args:
            y_true: Actual returns (percentage)
            y_pred: Predicted returns (percentage)
        """
        self.y_true = y_true
        self.y_pred = y_pred
        
    def compute_all_metrics(self) -> dict:
        """Compute all magnitude prediction metrics"""
        metrics = {}
        
        # Basic metrics
        metrics['mae'] = mean_absolute_error(self.y_true, self.y_pred)
        metrics['mse'] = mean_squared_error(self.y_true, self.y_pred)
        metrics['rmse'] = np.sqrt(metrics['mse'])
        metrics['r2'] = r2_score(self.y_true, self.y_pred)
        
        # Mean Absolute Percentage Error
        mask = self.y_true != 0
        metrics['mape'] = np.mean(np.abs((self.y_true[mask] - self.y_pred[mask]) / self.y_true[mask])) if mask.any() else np.inf
        
        # Symmetric MAPE
        metrics['smape'] = np.mean(2 * np.abs(self.y_pred - self.y_true) / (np.abs(self.y_true) + np.abs(self.y_pred) + 1e-9))
        
        # Direction accuracy within magnitude prediction
        direction_match = ((self.y_true > 0) & (self.y_pred > 0)) | ((self.y_true < 0) & (self.y_pred < 0))
        metrics['direction_accuracy'] = direction_match.mean()
        
        # Correlation metrics
        metrics['pearson_r'] = stats.pearsonr(self.y_true, self.y_pred)[0]
        metrics['spearman_r'] = stats.spearmanr(self.y_true, self.y_pred)[0]
        
        # Prediction bias
        metrics['bias'] = np.mean(self.y_pred - self.y_true)
        metrics['relative_bias'] = metrics['bias'] / (np.mean(np.abs(self.y_true)) + 1e-9)
        
        return metrics
    
    def quantile_coverage_analysis(self, q10: np.ndarray, q50: np.ndarray, q90: np.ndarray) -> dict:
        """
        Analyze quantile prediction coverage.
        
        Well-calibrated quantiles should have:
        - 10% of observations below q10
        - 50% of observations below q50 (median)
        - 90% of observations below q90
        """
        coverage = {}
        
        coverage['q10_coverage'] = np.mean(self.y_true < q10)
        coverage['q50_coverage'] = np.mean(self.y_true < q50)
        coverage['q90_coverage'] = np.mean(self.y_true < q90)
        
        # 80% prediction interval coverage
        coverage['pi80_coverage'] = np.mean((self.y_true >= q10) & (self.y_true <= q90))
        
        # Interval width
        coverage['mean_interval_width'] = np.mean(q90 - q10)
        
        # Sharpness (narrower intervals are better if coverage is maintained)
        coverage['sharpness'] = np.std(q90 - q10)
        
        return coverage


# Usage Example
"""
mag_evaluator = MagnitudeEvaluator(actual_returns, predicted_returns)
metrics = mag_evaluator.compute_all_metrics()
coverage = mag_evaluator.quantile_coverage_analysis(q10, q50, q90)

print(f"RMSE: {metrics['rmse']:.4f}")
print(f"R²: {metrics['r2']:.4f}")
print(f"Direction Accuracy: {metrics['direction_accuracy']:.4f}")
print(f"80% PI Coverage: {coverage['pi80_coverage']:.4f}")
"""
```

---

## 🔄 Walk-Forward Validation

### Time Series Cross-Validation

```python
from typing import Generator, Tuple
import pandas as pd
import numpy as np

class WalkForwardValidator:
    """
    Walk-forward validation for time series data.
    
    Prevents look-ahead bias by only training on past data.
    """
    
    def __init__(
        self,
        n_splits: int = 5,
        train_size: int = 252,  # ~1 year of daily data
        test_size: int = 63,    # ~3 months of daily data
        expanding: bool = False
    ):
        """
        Initialize walk-forward validator.
        
        Args:
            n_splits: Number of validation splits
            train_size: Number of samples for training
            test_size: Number of samples for testing
            expanding: If True, use expanding window; if False, use rolling window
        """
        self.n_splits = n_splits
        self.train_size = train_size
        self.test_size = test_size
        self.expanding = expanding
        
    def split(self, X: np.ndarray, y: np.ndarray = None) -> Generator[Tuple[np.ndarray, np.ndarray], None, None]:
        """
        Generate train/test indices.
        
        Yields:
            train_indices, test_indices
        """
        n_samples = len(X)
        
        # Calculate the starting point for the first test set
        initial_train_end = self.train_size
        
        for i in range(self.n_splits):
            # Test indices
            test_start = initial_train_end + i * self.test_size
            test_end = test_start + self.test_size
            
            if test_end > n_samples:
                break
            
            # Train indices
            if self.expanding:
                train_start = 0
                train_end = test_start
            else:
                train_start = test_start - self.train_size
                train_end = test_start
            
            train_indices = np.arange(train_start, train_end)
            test_indices = np.arange(test_start, test_end)
            
            yield train_indices, test_indices
    
    def validate_model(
        self,
        model_class,
        model_params: dict,
        X: np.ndarray,
        y: np.ndarray,
        fit_method: str = 'fit',
        predict_method: str = 'predict'
    ) -> dict:
        """
        Perform walk-forward validation on a model.
        
        Args:
            model_class: Model class to instantiate
            model_params: Parameters for model initialization
            X: Feature matrix
            y: Target vector
            fit_method: Name of fit method
            predict_method: Name of predict method
        
        Returns:
            Dictionary with validation results
        """
        all_predictions = []
        all_actuals = []
        fold_metrics = []
        
        for fold, (train_idx, test_idx) in enumerate(self.split(X, y)):
            X_train, X_test = X[train_idx], X[test_idx]
            y_train, y_test = y[train_idx], y[test_idx]
            
            # Initialize and train model
            model = model_class(**model_params)
            getattr(model, fit_method)(X_train, y_train)
            
            # Predict
            predictions = getattr(model, predict_method)(X_test)
            
            all_predictions.extend(predictions)
            all_actuals.extend(y_test)
            
            # Compute fold metrics
            fold_evaluator = DirectionEvaluator(y_test, predictions) if predictions.max() <= 1 else MagnitudeEvaluator(y_test, predictions)
            fold_metrics.append(fold_evaluator.compute_all_metrics())
        
        # Aggregate results
        all_predictions = np.array(all_predictions)
        all_actuals = np.array(all_actuals)
        
        overall_evaluator = DirectionEvaluator(all_actuals, all_predictions) if all_predictions.max() <= 1 else MagnitudeEvaluator(all_actuals, all_predictions)
        overall_metrics = overall_evaluator.compute_all_metrics()
        
        return {
            'overall_metrics': overall_metrics,
            'fold_metrics': fold_metrics,
            'predictions': all_predictions,
            'actuals': all_actuals,
            'n_folds': len(fold_metrics)
        }


class PurgedWalkForwardValidator(WalkForwardValidator):
    """
    Walk-forward validation with purging to prevent data leakage.
    
    Adds a gap between train and test sets to prevent leakage from
    overlapping data windows.
    """
    
    def __init__(
        self,
        n_splits: int = 5,
        train_size: int = 252,
        test_size: int = 63,
        purge_size: int = 5,  # Gap between train and test
        embargo_size: int = 5,  # Gap after test
        expanding: bool = False
    ):
        super().__init__(n_splits, train_size, test_size, expanding)
        self.purge_size = purge_size
        self.embargo_size = embargo_size
    
    def split(self, X: np.ndarray, y: np.ndarray = None) -> Generator[Tuple[np.ndarray, np.ndarray], None, None]:
        """Generate purged train/test indices"""
        n_samples = len(X)
        initial_train_end = self.train_size
        
        for i in range(self.n_splits):
            # Test indices
            test_start = initial_train_end + i * (self.test_size + self.embargo_size) + self.purge_size
            test_end = test_start + self.test_size
            
            if test_end > n_samples:
                break
            
            # Train indices (with purge gap)
            if self.expanding:
                train_start = 0
                train_end = test_start - self.purge_size
            else:
                train_start = test_start - self.purge_size - self.train_size
                train_end = test_start - self.purge_size
            
            train_indices = np.arange(train_start, train_end)
            test_indices = np.arange(test_start, test_end)
            
            yield train_indices, test_indices


# Usage Example
"""
# Walk-forward validation
validator = WalkForwardValidator(n_splits=5, train_size=252, test_size=63)
results = validator.validate_model(LGBMClassifier, {'n_estimators': 100, 'learning_rate': 0.05}, X, y)

print(f"Overall AUC-ROC: {results['overall_metrics']['auc_roc']:.4f}")
print(f"Number of folds: {results['n_folds']}")

# Purged walk-forward (for features with look-ahead bias risk)
purged_validator = PurgedWalkForwardValidator(n_splits=5, purge_size=5, embargo_size=5)
purged_results = purged_validator.validate_model(LGBMClassifier, {}, X, y)
"""
```

---

## 📈 Trading Backtest Framework

### Simple Backtest Engine

```python
from dataclasses import dataclass
from typing import List, Optional
import pandas as pd
import numpy as np

@dataclass
class Trade:
    """Represents a single trade"""
    entry_time: pd.Timestamp
    exit_time: Optional[pd.Timestamp]
    entry_price: float
    exit_price: Optional[float]
    direction: str  # 'LONG' or 'SHORT'
    size: float  # Position size
    entry_confidence: float
    pnl: Optional[float] = None
    pnl_pct: Optional[float] = None
    holding_period: Optional[int] = None
    status: str = 'OPEN'  # 'OPEN', 'CLOSED', 'STOPPED'

@dataclass
class BacktestResult:
    """Results from a backtest run"""
    trades: List[Trade]
    equity_curve: np.ndarray
    metrics: dict
    drawdown_curve: np.ndarray
    rolling_sharpe: np.ndarray


class SimpleBacktest:
    """
    Simple backtest engine for trading strategy validation.
    
    Supports:
    - Long/Short positions
    - Stop-loss and take-profit
    - Multiple position sizing methods
    - Transaction costs and slippage
    """
    
    def __init__(
        self,
        initial_capital: float = 100000,
        commission_rate: float = 0.001,  # 0.1%
        slippage_rate: float = 0.0005,   # 0.05%
        position_sizing: str = 'fixed_fraction',
        risk_per_trade: float = 0.02,    # 2% risk per trade
        max_position_size: float = 0.1,  # Max 10% of capital per position
    ):
        """
        Initialize backtest engine.
        
        Args:
            initial_capital: Starting capital
            commission_rate: Trading commission rate
            slippage_rate: Slippage rate
            position_sizing: 'fixed_fraction', 'volatility_adjusted', 'kelly'
            risk_per_trade: Risk per trade for position sizing
            max_position_size: Maximum position size as fraction of capital
        """
        self.initial_capital = initial_capital
        self.commission_rate = commission_rate
        self.slippage_rate = slippage_rate
        self.position_sizing = position_sizing
        self.risk_per_trade = risk_per_trade
        self.max_position_size = max_position_size
        
    def run_backtest(
        self,
        prices: pd.DataFrame,
        signals: pd.DataFrame,
        stop_loss_pct: float = 0.02,
        take_profit_pct: float = 0.04,
        take_profit_2_pct: float = 0.08,  # Second take profit level
        confidence_threshold: float = 0.55,
    ) -> BacktestResult:
        """
        Run backtest on historical data.
        
        Args:
            prices: DataFrame with 'open', 'high', 'low', 'close' columns
            signals: DataFrame with 'signal', 'confidence', 'entry', 'stop_loss', 'take_profit' columns
            stop_loss_pct: Default stop-loss percentage
            take_profit_pct: Default take-profit percentage
            take_profit_2_pct: Second take-profit percentage
            confidence_threshold: Minimum confidence to take a trade
        
        Returns:
            BacktestResult object
        """
        capital = self.initial_capital
        equity = [capital]
        trades = []
        open_positions = []
        
        for i in range(1, len(prices)):
            current_time = prices.index[i]
            current_price = prices['close'].iloc[i]
            
            # Check existing positions for stop-loss/take-profit
            open_positions = self._check_exits(
                open_positions,
                prices.iloc[i],
                current_time,
                trades
            )
            
            # Update equity
            position_value = sum(
                self._calculate_position_value(pos, current_price)
                for pos in open_positions
            )
            equity.append(capital + position_value)
            
            # Check for new signals
            if i < len(signals):
                signal = signals['signal'].iloc[i]
                confidence = signals['confidence'].iloc[i]
                
                if confidence >= confidence_threshold and signal in ['LONG', 'SHORT']:
                    trade = self._open_position(
                        prices.iloc[i],
                        signals.iloc[i],
                        capital,
                        current_time,
                        stop_loss_pct,
                        take_profit_pct,
                        take_profit_2_pct
                    )
                    if trade:
                        open_positions.append(trade)
        
        # Close remaining positions
        for pos in open_positions:
            pos.exit_time = prices.index[-1]
            pos.exit_price = prices['close'].iloc[-1]
            pos.pnl = self._calculate_pnl(pos)
            pos.pnl_pct = pos.pnl / (pos.entry_price * pos.size)
            pos.status = 'CLOSED'
            trades.append(pos)
        
        equity = np.array(equity)
        
        # Calculate metrics
        metrics = self._calculate_metrics(equity, trades)
        drawdown_curve = self._calculate_drawdown(equity)
        rolling_sharpe = self._calculate_rolling_sharpe(equity)
        
        return BacktestResult(
            trades=trades,
            equity_curve=equity,
            metrics=metrics,
            drawdown_curve=drawdown_curve,
            rolling_sharpe=rolling_sharpe
        )
    
    def _open_position(
        self,
        price_data: pd.Series,
        signal_data: pd.Series,
        capital: float,
        current_time: pd.Timestamp,
        default_sl: float,
        default_tp: float,
        default_tp2: float
    ) -> Optional[Trade]:
        """Open a new position"""
        signal = signal_data['signal']
        confidence = signal_data['confidence']
        
        # Get entry price with slippage
        entry_price = price_data['close'] * (1 + self.slippage_rate if signal == 'LONG' else -self.slippage_rate)
        
        # Calculate position size
        position_size = self._calculate_position_size(capital, entry_price, confidence)
        
        # Get stop-loss and take-profit levels
        stop_loss = signal_data.get('stop_loss', entry_price * (1 - default_sl if signal == 'LONG' else 1 + default_sl))
        take_profit = signal_data.get('take_profit', entry_price * (1 + default_tp if signal == 'LONG' else 1 - default_tp))
        
        return Trade(
            entry_time=current_time,
            exit_time=None,
            entry_price=entry_price,
            exit_price=None,
            direction=signal,
            size=position_size,
            entry_confidence=confidence,
            status='OPEN'
        )
    
    def _check_exits(
        self,
        open_positions: List[Trade],
        price_data: pd.Series,
        current_time: pd.Timestamp,
        closed_trades: List[Trade]
    ) -> List[Trade]:
        """Check and close positions that hit stop-loss or take-profit"""
        remaining_positions = []
        
        for pos in open_positions:
            if pos.direction == 'LONG':
                if price_data['low'] <= pos.entry_price * (1 - 0.02):  # Stop-loss hit
                    pos.exit_time = current_time
                    pos.exit_price = pos.entry_price * (1 - 0.02)
                    pos.status = 'STOPPED'
                    closed_trades.append(pos)
                elif price_data['high'] >= pos.entry_price * (1 + 0.04):  # Take-profit hit
                    pos.exit_time = current_time
                    pos.exit_price = pos.entry_price * (1 + 0.04)
                    pos.status = 'CLOSED'
                    closed_trades.append(pos)
                else:
                    remaining_positions.append(pos)
            else:  # SHORT
                if price_data['high'] >= pos.entry_price * (1 + 0.02):
                    pos.exit_time = current_time
                    pos.exit_price = pos.entry_price * (1 + 0.02)
                    pos.status = 'STOPPED'
                    closed_trades.append(pos)
                elif price_data['low'] <= pos.entry_price * (1 - 0.04):
                    pos.exit_time = current_time
                    pos.exit_price = pos.entry_price * (1 - 0.04)
                    pos.status = 'CLOSED'
                    closed_trades.append(pos)
                else:
                    remaining_positions.append(pos)
        
        return remaining_positions
    
    def _calculate_position_size(self, capital: float, entry_price: float, confidence: float) -> float:
        """Calculate position size based on sizing method"""
        if self.position_sizing == 'fixed_fraction':
            size = capital * self.risk_per_trade
        elif self.position_sizing == 'volatility_adjusted':
            # Would need volatility input
            size = capital * self.risk_per_trade
        elif self.position_sizing == 'kelly':
            # Kelly criterion: f = (p * b - q) / b
            # p = win probability, q = loss probability, b = win/loss ratio
            p = confidence
            q = 1 - p
            b = 2.0  # Assuming 2:1 reward/risk
            kelly_fraction = (p * b - q) / b if b > 0 else 0
            kelly_fraction = max(0, min(kelly_fraction, 0.25))  # Cap at 25%
            size = capital * kelly_fraction
        else:
            size = capital * self.risk_per_trade
        
        # Apply max position size limit
        max_size = capital * self.max_position_size
        size = min(size, max_size)
        
        return size / entry_price  # Convert to number of units
    
    def _calculate_position_value(self, pos: Trade, current_price: float) -> float:
        """Calculate current value of an open position"""
        if pos.direction == 'LONG':
            return (current_price - pos.entry_price) * pos.size
        else:
            return (pos.entry_price - current_price) * pos.size
    
    def _calculate_pnl(self, pos: Trade) -> float:
        """Calculate PnL for a closed trade"""
        if pos.direction == 'LONG':
            gross_pnl = (pos.exit_price - pos.entry_price) * pos.size
        else:
            gross_pnl = (pos.entry_price - pos.exit_price) * pos.size
        
        # Apply commission
        commission = (pos.entry_price * pos.size + pos.exit_price * pos.size) * self.commission_rate
        return gross_pnl - commission
    
    def _calculate_metrics(self, equity: np.ndarray, trades: List[Trade]) -> dict:
        """Calculate comprehensive backtest metrics"""
        returns = np.diff(equity) / equity[:-1]
        
        metrics = {}
        
        # Basic returns metrics
        metrics['total_return'] = (equity[-1] / equity[0]) - 1
        metrics['annualized_return'] = (1 + metrics['total_return']) ** (252 / len(returns)) - 1
        metrics['volatility'] = np.std(returns) * np.sqrt(252)
        
        # Risk-adjusted metrics
        if metrics['volatility'] > 0:
            metrics['sharpe_ratio'] = metrics['annualized_return'] / metrics['volatility']
        else:
            metrics['sharpe_ratio'] = 0
        
        # Sortino ratio (downside deviation)
        downside_returns = returns[returns < 0]
        if len(downside_returns) > 0:
            downside_std = np.std(downside_returns) * np.sqrt(252)
            metrics['sortino_ratio'] = metrics['annualized_return'] / downside_std if downside_std > 0 else 0
        else:
            metrics['sortino_ratio'] = np.inf
        
        # Drawdown metrics
        peak = np.maximum.accumulate(equity)
        drawdown = (peak - equity) / peak
        metrics['max_drawdown'] = np.max(drawdown)
        metrics['max_drawdown_duration'] = self._max_drawdown_duration(drawdown)
        
        # Calmar ratio
        if metrics['max_drawdown'] > 0:
            metrics['calmar_ratio'] = metrics['annualized_return'] / metrics['max_drawdown']
        else:
            metrics['calmar_ratio'] = np.inf
        
        # Trade metrics
        if trades:
            winning_trades = [t for t in trades if t.pnl and t.pnl > 0]
            losing_trades = [t for t in trades if t.pnl and t.pnl <= 0]
            
            metrics['total_trades'] = len(trades)
            metrics['winning_trades'] = len(winning_trades)
            metrics['losing_trades'] = len(losing_trades)
            metrics['win_rate'] = len(winning_trades) / len(trades) if trades else 0
            
            if winning_trades:
                metrics['avg_win'] = np.mean([t.pnl for t in winning_trades])
                metrics['largest_win'] = max(t.pnl for t in winning_trades)
            else:
                metrics['avg_win'] = 0
                metrics['largest_win'] = 0
            
            if losing_trades:
                metrics['avg_loss'] = np.mean([t.pnl for t in losing_trades])
                metrics['largest_loss'] = min(t.pnl for t in losing_trades)
            else:
                metrics['avg_loss'] = 0
                metrics['largest_loss'] = 0
            
            # Profit factor
            total_wins = sum(t.pnl for t in winning_trades) if winning_trades else 0
            total_losses = abs(sum(t.pnl for t in losing_trades)) if losing_trades else 0
            metrics['profit_factor'] = total_wins / total_losses if total_losses > 0 else np.inf
            
            # Expected value
            metrics['expected_value'] = (
                metrics['win_rate'] * metrics['avg_win'] +
                (1 - metrics['win_rate']) * metrics['avg_loss']
            ) if trades else 0
            
            # Average holding period
            holding_periods = [t.holding_period for t in trades if t.holding_period is not None]
            metrics['avg_holding_period'] = np.mean(holding_periods) if holding_periods else 0
        else:
            metrics['total_trades'] = 0
            metrics['win_rate'] = 0
        
        return metrics
    
    def _calculate_drawdown(self, equity: np.ndarray) -> np.ndarray:
        """Calculate drawdown curve"""
        peak = np.maximum.accumulate(equity)
        return (peak - equity) / peak
    
    def _max_drawdown_duration(self, drawdown: np.ndarray) -> int:
        """Calculate maximum drawdown duration"""
        in_drawdown = drawdown > 0
        if not in_drawdown.any():
            return 0
        
        durations = []
        current_duration = 0
        for dd in in_drawdown:
            if dd:
                current_duration += 1
            else:
                if current_duration > 0:
                    durations.append(current_duration)
                current_duration = 0
        
        if current_duration > 0:
            durations.append(current_duration)
        
        return max(durations) if durations else 0
    
    def _calculate_rolling_sharpe(self, equity: np.ndarray, window: int = 63) -> np.ndarray:
        """Calculate rolling Sharpe ratio"""
        returns = np.diff(equity) / equity[:-1]
        rolling_sharpe = np.full(len(returns), np.nan)
        
        for i in range(window, len(returns)):
            window_returns = returns[i-window:i]
            annualized_return = np.mean(window_returns) * 252
            annualized_std = np.std(window_returns) * np.sqrt(252)
            rolling_sharpe[i] = annualized_return / annualized_std if annualized_std > 0 else 0
        
        return rolling_sharpe


# Usage Example
"""
# Prepare data
prices = pd.DataFrame({
    'open': [...],
    'high': [...],
    'low': [...],
    'close': [...]
}, index=pd.date_range('2020-01-01', periods=1000))

signals = pd.DataFrame({
    'signal': ['LONG', 'FLAT', 'SHORT', ...],
    'confidence': [0.65, 0.52, 0.72, ...],
    'stop_loss': [...],
    'take_profit': [...]
}, index=prices.index)

# Run backtest
backtest = SimpleBacktest(
    initial_capital=100000,
    commission_rate=0.001,
    position_sizing='fixed_fraction',
    risk_per_trade=0.02
)

result = backtest.run_backtest(
    prices=prices,
    signals=signals,
    stop_loss_pct=0.02,
    take_profit_pct=0.04,
    confidence_threshold=0.55
)

# Print results
print(f"Total Return: {result.metrics['total_return']:.2%}")
print(f"Sharpe Ratio: {result.metrics['sharpe_ratio']:.2f}")
print(f"Max Drawdown: {result.metrics['max_drawdown']:.2%}")
print(f"Win Rate: {result.metrics['win_rate']:.2%}")
print(f"Profit Factor: {result.metrics['profit_factor']:.2f}")
"""
```

---

## 📊 Performance Benchmarks

### Expected Performance Ranges

| Metric | Poor | Acceptable | Good | Excellent |
|--------|------|------------|------|-----------|
| **Direction Accuracy** | <52% | 52-55% | 55-58% | >58% |
| **AUC-ROC** | <0.52 | 0.52-0.55 | 0.55-0.60 | >0.60 |
| **Brier Score** | >0.25 | 0.20-0.25 | 0.15-0.20 | <0.15 |
| **Sharpe Ratio** | <0.5 | 0.5-1.0 | 1.0-2.0 | >2.0 |
| **Max Drawdown** | >30% | 20-30% | 10-20% | <10% |
| **Win Rate** | <45% | 45-50% | 50-55% | >55% |
| **Profit Factor** | <1.0 | 1.0-1.3 | 1.3-1.5 | >1.5 |

---

## 📝 Evaluation Checklist

### Pre-Production Checklist

- [ ] Walk-forward validation completed (≥5 folds)
- [ ] Out-of-sample test performance acceptable
- [ ] Calibration analysis shows well-calibrated probabilities (ECE < 0.05)
- [ ] Threshold optimization completed
- [ ] Backtest shows positive expected value
- [ ] Maximum drawdown within risk tolerance
- [ ] Sharpe ratio > 1.0 on out-of-sample data
- [ ] Profit factor > 1.0 on out-of-sample data
- [ ] No significant overfitting (train/test gap < 5%)
-