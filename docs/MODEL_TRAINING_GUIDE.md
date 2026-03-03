# Model Training Guide - Hybrid Ensemble System

## 📊 Overview

This document provides comprehensive guidance on the **hybrid ensemble model architecture** for the StockandCrypto platform, combining LightGBM/XGBoost as primary models with Transformer/LSTM for temporal enhancement, unified through ensemble fusion.

### Model Architecture Philosophy

**Three-Layer Hybrid System:**
1. **Primary Layer**: LightGBM/XGBoost (gradient boosting trees)
2. **Enhancement Layer**: Transformer/LSTM (temporal & multimodal features)
3. **Fusion Layer**: Ensemble stacking & blending

```
┌─────────────────────────────────────────────────────────────┐
│                    INPUT FEATURES                            │
│  Technical Indicators | Price Data | Volume | Sentiment     │
└─────────────────────────────────────────────────────────────┘
                    ↓                                  ↓
    ┌──────────────────────────┐      ┌──────────────────────────┐
    │   PRIMARY MODELS (GBDT)   │      │  ENHANCEMENT MODELS      │
    │  ┌─────────────────────┐ │      │  ┌─────────────────────┐ │
    │  │  LightGBM           │ │      │  │  Transformer        │ │
    │  │  - Direction        │ │      │  │  - Temporal Pattern │ │
    │  │  - Quantile Reg     │ │      │  │  - Attention        │ │
    │  │  - Multiclass       │ │      │  └─────────────────────┘ │
    │  └─────────────────────┘ │      │  ┌─────────────────────┐ │
    │  ┌─────────────────────┐ │      │  │  LSTM+Attention     │ │
    │  │  XGBoost            │ │      │  │  - Sequence Pattern │ │
    │  │  - Feature Selection│ │      │  │  - Multi-head Attn  │ │
    │  │  - Alternative View │ │      │  └─────────────────────┘ │
    │  └─────────────────────┘ │      └──────────────────────────┘
    └──────────────────────────┘                  ↓
                    ↓                              ↓
    ┌──────────────────────────────────────────────────────────┐
    │                 ENSEMBLE FUSION LAYER                     │
    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
    │  │  Weighted Avg│  │  Stacking    │  │  Meta-Learner│  │
    │  │  Blending    │  │  Blending    │  │  (LogReg)    │  │
    │  └──────────────┘  └──────────────┘  └──────────────┘  │
    └──────────────────────────────────────────────────────────┘
                              ↓
    ┌──────────────────────────────────────────────────────────┐
    │                   FINAL PREDICTIONS                       │
    │  P(UP) | Quantiles (q10/q50/q90) | Start Window (W0-W3) │
    └──────────────────────────────────────────────────────────┘
```

---

## 🎯 Primary Layer: LightGBM/XGBoost

### 1. LightGBM as Primary Model

**Why LightGBM for Primary Layer:**
- Fast training speed (histogram-based)
- Handles categorical features natively
- Excellent performance on tabular data
- Built-in feature importance
- Robust to outliers

**Direction Model (LightGBM):**
```python
import lightgbm as lgb
import numpy as np
from sklearn.model_selection import TimeSeriesSplit

class LightGBMPrimary:
    """LightGBM as primary model for direction prediction"""
    
    def __init__(self):
        self.models = {
            'direction': None,
            'q10': None,
            'q50': None,
            'q90': None,
            'start_window': None
        }
        self.best_iterations = {}
    
    def get_direction_params(self):
        """Optimized parameters for direction prediction"""
        return {
            'objective': 'binary',
            'metric': 'binary_logloss',
            'boosting_type': 'gbdt',
            'num_leaves': 63,
            'learning_rate': 0.05,
            'feature_fraction': 0.8,
            'bagging_fraction': 0.8,
            'bagging_freq': 5,
            'min_child_samples': 20,
            'reg_alpha': 0.1,
            'reg_lambda': 0.1,
            'verbose': -1,
            'seed': 42,
            'n_jobs': -1
        }
    
    def get_quantile_params(self, alpha):
        """Parameters for quantile regression"""
        return {
            'objective': 'quantile',
            'alpha': alpha,
            'metric': 'quantile',
            'boosting_type': 'gbdt',
            'num_leaves': 63,
            'learning_rate': 0.05,
            'feature_fraction': 0.8,
            'bagging_fraction': 0.8,
            'bagging_freq': 5,
            'verbose': -1,
            'seed': 42,
            'n_jobs': -1
        }
    
    def get_multiclass_params(self):
        """Parameters for start window prediction"""
        return {
            'objective': 'multiclass',
            'num_class': 4,
            'metric': 'multi_logloss',
            'boosting_type': 'gbdt',
            'num_leaves': 63,
            'learning_rate': 0.05,
            'feature_fraction': 0.8,
            'bagging_fraction': 0.8,
            'bagging_freq': 5,
            'verbose': -1,
            'seed': 42,
            'n_jobs': -1
        }
    
    def train_direction(self, X_train, y_train, X_val, y_val, num_rounds=1000):
        """Train direction prediction model"""
        
        train_data = lgb.Dataset(X_train, label=y_train)
        val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
        
        params = self.get_direction_params()
        
        model = lgb.train(
            params,
            train_data,
            num_boost_round=num_rounds,
            valid_sets=[train_data, val_data],
            valid_names=['train', 'valid'],
            callbacks=[
                lgb.early_stopping(stopping_rounds=50, verbose=True),
                lgb.log_evaluation(period=100)
            ]
        )
        
        self.models['direction'] = model
        self.best_iterations['direction'] = model.best_iteration
        
        return model
    
    def train_quantile_models(self, X_train, y_train, X_val, y_val, num_rounds=1000):
        """Train quantile regression models for magnitude"""
        
        quantiles = [0.1, 0.5, 0.9]
        
        for q in quantiles:
            train_data = lgb.Dataset(X_train, label=y_train)
            val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
            
            params = self.get_quantile_params(q)
            
            model = lgb.train(
                params,
                train_data,
                num_boost_round=num_rounds,
                valid_sets=[val_data],
                valid_names=['valid'],
                callbacks=[
                    lgb.early_stopping(stopping_rounds=50, verbose=False)
                ]
            )
            
            key = f'q{int(q*100)}'
            self.models[key] = model
            self.best_iterations[key] = model.best_iteration
    
    def train_start_window(self, X_train, y_train, X_val, y_val, num_rounds=1000):
        """Train start window prediction model"""
        
        train_data = lgb.Dataset(X_train, label=y_train)
        val_data = lgb.Dataset(X_val, label=y_val, reference=train_data)
        
        params = self.get_multiclass_params()
        
        model = lgb.train(
            params,
            train_data,
            num_boost_round=num_rounds,
            valid_sets=[val_data],
            valid_names=['valid'],
            callbacks=[
                lgb.early_stopping(stopping_rounds=50, verbose=True)
            ]
        )
        
        self.models['start_window'] = model
        self.best_iterations['start_window'] = model.best_iteration
        
        return model
    
    def predict_all(self, X):
        """Generate all predictions"""
        
        predictions = {}
        
        # Direction
        predictions['p_up'] = self.models['direction'].predict(
            X, num_iteration=self.best_iterations['direction']
        )
        
        # Quantiles
        predictions['q10'] = self.models['q10'].predict(
            X, num_iteration=self.best_iterations['q10']
        )
        predictions['q50'] = self.models['q50'].predict(
            X, num_iteration=self.best_iterations['q50']
        )
        predictions['q90'] = self.models['q90'].predict(
            X, num_iteration=self.best_iterations['q90']
        )
        
        # Start window
        predictions['window_proba'] = self.models['start_window'].predict(
            X, num_iteration=self.best_iterations['start_window']
        )
        
        return predictions
```

### 2. XGBoost as Alternative Primary

**Why Include XGBoost:**
- Different regularization approach (L1+L2)
- Better feature selection capabilities
- Handles missing values differently
- Provides complementary predictions

**XGBoost Implementation:**
```python
import xgboost as xgb

class XGBoostPrimary:
    """XGBoost as alternative primary model"""
    
    def __init__(self):
        self.models = {}
    
    def get_direction_params(self):
        """XGBoost parameters for direction"""
        return {
            'objective': 'binary:logistic',
            'eval_metric': 'logloss',
            'max_depth': 6,
            'learning_rate': 0.05,
            'subsample': 0.8,
            'colsample_bytree': 0.8,
            'min_child_weight': 20,
            'reg_alpha': 0.1,
            'reg_lambda': 1.0,
            'random_state': 42,
            'n_jobs': -1,
            'tree_method': 'hist'  # Faster training
        }
    
    def train_direction(self, X_train, y_train, X_val, y_val, num_rounds=1000):
        """Train XGBoost direction model"""
        
        dtrain = xgb.DMatrix(X_train, label=y_train)
        dval = xgb.DMatrix(X_val, label=y_val)
        
        params = self.get_direction_params()
        
        evals_result = {}
        
        model = xgb.train(
            params,
            dtrain,
            num_boost_round=num_rounds,
            evals=[(dtrain, 'train'), (dval, 'valid')],
            early_stopping_rounds=50,
            evals_result=evals_result,
            verbose_eval=100
        )
        
        self.models['direction'] = model
        
        return model
    
    def train_quantile_models(self, X_train, y_train, X_val, y_val):
        """Train XGBoost quantile models"""
        
        quantiles = [0.1, 0.5, 0.9]
        
        for q in quantiles:
            params = {
                'objective': 'reg:quantileerror',
                'quantile_alpha': q,
                'max_depth': 6,
                'learning_rate': 0.05,
                'subsample': 0.8,
                'colsample_bytree': 0.8,
                'tree_method': 'hist',
                'random_state': 42
            }
            
            dtrain = xgb.DMatrix(X_train, label=y_train)
            dval = xgb.DMatrix(X_val, label=y_val)
            
            model = xgb.train(
                params,
                dtrain,
                num_boost_round=1000,
                evals=[(dval, 'valid')],
                early_stopping_rounds=50,
                verbose_eval=False
            )
            
            self.models[f'q{int(q*100)}'] = model
    
    def predict(self, X):
        """Generate predictions"""
        
        dtest = xgb.DMatrix(X)
        
        predictions = {
            'p_up': self.models['direction'].predict(dtest),
            'q10': self.models['q10'].predict(dtest),
            'q50': self.models['q50'].predict(dtest),
            'q90': self.models['q90'].predict(dtest)
        }
        
        return predictions
```

---

## 🧠 Enhancement Layer: Transformer/LSTM

### 1. Transformer for Temporal Enhancement

**Why Transformer:**
- Captures long-range dependencies
- Multi-head attention for multiple patterns
- Parallel processing of sequences
- Better at capturing market regime changes

**Transformer Architecture:**
```python
import tensorflow as tf
from tensorflow.keras.models import Model
from tensorflow.keras.layers import (
    Input, Dense, Dropout, LayerNormalization,
    MultiHeadAttention, GlobalAveragePooling1D,
    BatchNormalization
)

class TransformerEncoder:
    """Transformer for temporal pattern extraction"""
    
    def __init__(self, 
                 sequence_length=500,
                 n_features=68,
                 d_model=128,
                 n_heads=8,
                 n_layers=3,
                 dropout_rate=0.3):
        
        self.sequence_length = sequence_length
        self.n_features = n_features
        self.d_model = d_model
        self.n_heads = n_heads
        self.n_layers = n_layers
        self.dropout_rate = dropout_rate
        self.model = None
    
    def transformer_encoder_block(self, inputs, d_model, n_heads, dropout_rate):
        """Single transformer encoder block"""
        
        # Multi-head attention
        attention = MultiHeadAttention(
            num_heads=n_heads,
            key_dim=d_model // n_heads
        )(inputs, inputs)
        
        attention = Dropout(dropout_rate)(attention)
        
        # Add & Norm
        out1 = LayerNormalization(epsilon=1e-6)(inputs + attention)
        
        # Feed forward
        ffn = Dense(d_model * 4, activation='relu')(out1)
        ffn = Dense(d_model)(ffn)
        ffn = Dropout(dropout_rate)(ffn)
        
        # Add & Norm
        out2 = LayerNormalization(epsilon=1e-6)(out1 + ffn)
        
        return out2
    
    def build_model(self):
        """Build transformer model"""
        
        # Input
        inputs = Input(shape=(self.sequence_length, self.n_features))
        
        # Feature embedding
        x = Dense(self.d_model)(inputs)
        x = BatchNormalization()(x)
        
        # Positional encoding (simplified)
        positions = tf.range(start=0, limit=self.sequence_length, delta=1)
        position_embedding = tf.keras.layers.Embedding(
            input_dim=self.sequence_length,
            output_dim=self.d_model
        )(positions)
        
        x = x + position_embedding
        
        # Transformer blocks
        for _ in range(self.n_layers):
            x = self.transformer_encoder_block(
                x, self.d_model, self.n_heads, self.dropout_rate
            )
        
        # Global pooling
        x = GlobalAveragePooling1D()(x)
        
        # Output heads
        direction_output = Dense(1, activation='sigmoid', name='direction')(x)
        
        # Feature extractor output (for ensemble)
        feature_output = Dense(64, activation='relu', name='features')(x)
        
        # Create model
        self.model = Model(
            inputs=inputs,
            outputs=[direction_output, feature_output]
        )
        
        # Compile
        self.model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss={
                'direction': 'binary_crossentropy',
                'features': None  # No loss for feature extraction
            },
            metrics={'direction': ['accuracy', 'AUC']}
        )
        
        return self.model
    
    def extract_features(self, X):
        """Extract temporal features for ensemble"""
        
        features = self.model.predict(X)
        return features[1]  # Return feature output
    
    def predict_direction(self, X):
        """Predict direction probability"""
        
        predictions = self.model.predict(X)
        return predictions[0].flatten()

# Usage
transformer = TransformerEncoder(
    sequence_length=500,
    n_features=68,
    d_model=128,
    n_heads=8,
    n_layers=3,
    dropout_rate=0.3
)

model = transformer.build_model()
model.summary()
```

### 2. LSTM+Attention for Sequence Enhancement

**Why LSTM+Attention:**
- Captures sequential dependencies
- Attention mechanism for important time steps
- Complementary to Transformer patterns
- Good for short-term patterns

**LSTM+Attention Architecture:**
```python
from tensorflow.keras.layers import LSTM, Concatenate, Permute, Multiply, Softmax

class LSTMAttentionEnhancer:
    """LSTM with attention for sequence pattern extraction"""
    
    def __init__(self,
                 sequence_length=500,
                 n_features=68,
                 lstm_units=[128, 64],
                 attention_units=32,
                 dropout_rate=0.3):
        
        self.sequence_length = sequence_length
        self.n_features = n_features
        self.lstm_units = lstm_units
        self.attention_units = attention_units
        self.dropout_rate = dropout_rate
        self.model = None
    
    def attention_mechanism(self, lstm_output):
        """Attention mechanism for LSTM output"""
        
        # Attention weights
        attention = Dense(self.attention_units, activation='tanh')(lstm_output)
        attention = Dense(1)(attention)
        attention = Softmax(axis=1)(attention)
        
        # Apply attention
        context = Multiply()([lstm_output, attention])
        context = tf.reduce_sum(context, axis=1)
        
        return context
    
    def build_model(self):
        """Build LSTM+Attention model"""
        
        inputs = Input(shape=(self.sequence_length, self.n_features))
        
        # LSTM layers
        x = inputs
        
        for i, units in enumerate(self.lstm_units):
            return_sequences = (i < len(self.lstm_units) - 1)
            
            x = LSTM(
                units,
                return_sequences=True,
                name=f'lstm_{i+1}'
            )(x)
            
            x = BatchNormalization()(x)
            x = Dropout(self.dropout_rate)(x)
        
        # Attention
        attention_output = self.attention_mechanism(x)
        
        # Dense layers
        x = Dense(64, activation='relu')(attention_output)
        x = BatchNormalization()(x)
        x = Dropout(self.dropout_rate)(x)
        
        # Outputs
        direction_output = Dense(1, activation='sigmoid', name='direction')(x)
        feature_output = Dense(64, activation='relu', name='features')(x)
        
        # Create model
        self.model = Model(
            inputs=inputs,
            outputs=[direction_output, feature_output]
        )
        
        # Compile
        self.model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
            loss={'direction': 'binary_crossentropy'},
            metrics={'direction': ['accuracy', 'AUC']}
        )
        
        return self.model
    
    def extract_features(self, X):
        """Extract sequence features for ensemble"""
        
        predictions = self.model.predict(X)
        return predictions[1]  # Feature output
    
    def predict_direction(self, X):
        """Predict direction probability"""
        
        predictions = self.model.predict(X)
        return predictions[0].flatten()

# Usage
lstm_attention = LSTMAttentionEnhancer(
    sequence_length=500,
    n_features=68,
    lstm_units=[128, 64],
    attention_units=32,
    dropout_rate=0.3
)

model = lstm_attention.build_model()
model.summary()
```

---

## 🔄 Ensemble Fusion Layer

### 1. Weighted Average Ensemble

**Simple Blending:**
```python
import numpy as np
from scipy.optimize import minimize

class WeightedEnsemble:
    """Weighted average ensemble for multiple models"""
    
    def __init__(self, n_models=5):
        self.n_models = n_models
        self.weights = np.ones(n_models) / n_models  # Equal weights initially
    
    def optimize_weights(self, predictions_list, y_true):
        """Optimize ensemble weights"""
        
        def objective(weights):
            # Normalize weights
            weights = weights / np.sum(weights)
            
            # Weighted average
            ensemble_pred = np.zeros_like(predictions_list[0])
            for i, pred in enumerate(predictions_list):
                ensemble_pred += weights[i] * pred
            
            # Minimize log loss
            from sklearn.metrics import log_loss
            loss = log_loss(y_true, ensemble_pred)
            
            return loss
        
        # Constraints: weights >= 0
        bounds = [(0, 1) for _ in range(self.n_models)]
        
        # Constraint: sum of weights = 1
        constraints = {'type': 'eq', 'fun': lambda w: np.sum(w) - 1}
        
        # Optimize
        result = minimize(
            objective,
            self.weights,
            method='SLSQP',
            bounds=bounds,
            constraints=constraints
        )
        
        self.weights = result.x / np.sum(result.x)
        
        print(f"Optimized weights: {self.weights}")
        
        return self.weights
    
    def predict(self, predictions_list):
        """Generate ensemble prediction"""
        
        ensemble_pred = np.zeros_like(predictions_list[0])
        
        for i, pred in enumerate(predictions_list):
            ensemble_pred += self.weights[i] * pred
        
        return ensemble_pred

# Usage
ensemble = WeightedEnsemble(n_models=5)

# Optimize weights on validation set
predictions_val = [
    lgb_predictions_val,
    xgb_predictions_val,
    transformer_predictions_val,
    lstm_predictions_val,
    meta_features_val
]

weights = ensemble.optimize_weights(predictions_val, y_val)

# Predict on test set
predictions_test = [
    lgb_predictions_test,
    xgb_predictions_test,
    transformer_predictions_test,
    lstm_predictions_test,
    meta_features_test
]

final_predictions = ensemble.predict(predictions_test)
```

### 2. Stacking Ensemble

**Meta-Learner Stacking:**
```python
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier
import numpy as np

class StackingEnsemble:
    """Stacking ensemble with meta-learner"""
    
    def __init__(self):
        self.meta_learner = None
        self.base_models = []
    
    def add_base_model(self, model_predictions):
        """Add base model predictions"""
        
        self.base_models.append(model_predictions)
    
    def prepare_meta_features(self, predictions_list):
        """Prepare meta-features for stacking"""
        
        # Stack predictions horizontally
        meta_features = np.column_stack(predictions_list)
        
        return meta_features
    
    def train_meta_learner(self, base_predictions, y_true):
        """Train meta-learner on base model predictions"""
        
        # Prepare meta-features
        meta_features = self.prepare_meta_features(base_predictions)
        
        # Train logistic regression as meta-learner
        self.meta_learner = LogisticRegression(
            C=1.0,
            max_iter=1000,
            random_state=42
        )
        
        self.meta_learner.fit(meta_features, y_true)
        
        print("Meta-learner trained successfully")
        
        return self.meta_learner
    
    def predict(self, base_predictions):
        """Generate ensemble prediction using meta-learner"""
        
        meta_features = self.prepare_meta_features(base_predictions)
        
        return self.meta_learner.predict_proba(meta_features)[:, 1]
    
    def get_feature_importance(self):
        """Get meta-learner feature importance"""
        
        if self.meta_learner is None:
            return None
        
        # Coefficients from logistic regression
        return {
            'coefficients': self.meta_learner.coef_[0],
            'intercept': self.meta_learner.intercept_[0]
        }

# Usage
stacking = StackingEnsemble()

# Prepare base model predictions (validation set)
base_preds_val = [
    lgb.predict_proba(X_val),
    xgb.predict_proba(X_val),
    transformer.predict_direction(X_val_seq),
    lstm.predict_direction(X_val_seq)
]

# Train meta-learner
stacking.train_meta_learner(base_preds_val, y_val)

# Predict (test set)
base_preds_test = [
    lgb.predict_proba(X_test),
    xgb.predict_proba(X_test),
    transformer.predict_direction(X_test_seq),
    lstm.predict_direction(X_test_seq)
]

final_predictions = stacking.predict(base_preds_test)
```

### 3. Complete Hybrid Pipeline

**Full Hybrid System:**
```python
class HybridEnsemblePipeline:
    """Complete hybrid ensemble pipeline"""
    
    def __init__(self):
        # Primary models
        self.lgb_model = LightGBMPrimary()
        self.xgb_model = XGBoostPrimary()
        
        # Enhancement models
        self.transformer = None
        self.lstm = None
        
        # Ensemble
        self.ensemble = WeightedEnsemble(n_models=6)
    
    def prepare_sequence_data(self, X, sequence_length=500):
        """Prepare data for sequence models"""
        
        X_seq = []
        
        for i in range(sequence_length, len(X)):
            X_seq.append(X[i-sequence_length:i])
        
        return np.array(X_seq)
    
    def train_primary_models(self, X_train, y_train, X_val, y_val):
        """Train primary GBDT models"""
        
        print("Training LightGBM...")
        self.lgb_model.train_direction(X_train, y_train, X_val, y_val)
        self.lgb_model.train_quantile_models(X_train, y_train, X_val, y_val)
        
        print("Training XGBoost...")
        self.xgb_model.train_direction(X_train, y_train, X_val, y_val)
        self.xgb_model.train_quantile_models(X_train, y_train, X_val, y_val)
    
    def train_enhancement_models(self, X_train_seq, y_train, X_val_seq, y_val):
        """Train enhancement models"""
        
        print("Training Transformer...")
        self.transformer = TransformerEncoder()
        self.transformer.build_model()
        self.transformer.model.fit(
            X_train_seq, y_train[500:],  # Adjust for sequence offset
            validation_data=(X_val_seq, y_val[500:]),
            epochs=50,
            batch_size=32,
            callbacks=[
                tf.keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True)
            ]
        )
        
        print("Training LSTM+Attention...")
        self.lstm = LSTMAttentionEnhancer()
        self.lstm.build_model()
        self.lstm.model.fit(
            X_train_seq, y_train[500:],
            validation_data=(X_val_seq, y_val[500:]),
            epochs=50,
            batch_size=32,
            callbacks=[
                tf.keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True)
            ]
        )
    
    def optimize_ensemble(self, X_val, X_val_seq, y_val):
        """Optimize ensemble weights"""
        
        # Get predictions from all models
        lgb_pred = self.lgb_model.models['direction'].predict(X_val)
        xgb_pred = self.xgb_model.models['direction'].predict(xgb.DMatrix(X_val))
        transformer_pred = self.transformer.predict_direction(X_val_seq)
        lstm_pred = self.lstm.predict_direction(X_val_seq)
        
        # Adjust lengths (sequence models have offset)
        y_val_adj = y_val[500:]
        
        predictions_list = [
            lgb_pred[500:],
            xgb_pred[500:],
            transformer_pred,
            lstm_pred
        ]
        
        # Optimize weights
        self.ensemble.optimize_weights(predictions_list, y_val_adj)
    
    def predict(self, X, X_seq):
        """Generate final ensemble predictions"""
        
        # Primary models
        lgb_pred = self.lgb_model.models['direction'].predict(X)
        xgb_pred = self.xgb_model.models['direction'].predict(xgb.DMatrix(X))
        
        # Enhancement models
        transformer_pred = self.transformer.predict_direction(X_seq)
        lstm_pred = self.lstm.predict_direction(X_seq)
        
        # Combine predictions
        predictions_list = [
            lgb_pred[500:],
            xgb_pred[500:],
            transformer_pred,
            lstm_pred
        ]
        
        # Ensemble
        final_pred = self.ensemble.predict(predictions_list)
        
        return final_pred

# Usage
pipeline = HybridEnsemblePipeline()

# Train
pipeline.train_primary_models(X_train, y_train, X_val, y_val)

# Prepare sequence data
X_train_seq = pipeline.prepare_sequence_data(X_train, sequence_length=500)
X_val_seq = pipeline.prepare_sequence_data(X_val, sequence_length=500)

pipeline.train_enhancement_models(X_train_seq, y_train, X_val_seq, y_val)

# Optimize ensemble
pipeline.optimize_ensemble(X_val, X_val_seq, y_val)

# Predict
X_test_seq = pipeline.prepare_sequence_data(X_test, sequence_length=500)
final_predictions = pipeline.predict(X_test, X_test_seq)
```

---

## 📊 Model Evaluation & Comparison

### Performance Comparison

```python
class ModelComparator:
    """Compare performance of different models"""
    
    @staticmethod
    def compare_models(predictions_dict, y_true):
        """Compare all models"""
        
        from sklearn.metrics import accuracy_score, log_loss, roc_auc_score
        
        results = []
        
        for model_name, predictions in predictions_dict.items():
            metrics = {
                'model': model_name,
                'accuracy': accuracy_score(y_true, (predictions >= 0.5).astype(int)),
                'log_loss': log_loss(y_true, predictions),
                'auc_roc': roc_auc_score(y_true, predictions)
            }
            results.append(metrics)
        
        return pd.DataFrame(results).sort_values('auc_roc', ascending=False)

# Usage
predictions_dict = {
    'LightGBM': lgb_predictions,
    'XGBoost': xgb_predictions,
    'Transformer': transformer_predictions,
    'LSTM+Attention': lstm_predictions,
    'Weighted Ensemble': ensemble_predictions,
    'Stacking Ensemble': stacking_predictions
}

comparison = ModelComparator.compare_models(predictions_dict, y_test)
print(comparison)
```

---

## 🚀 Production Deployment

### Model Serving Architecture

```python
import pickle
from datetime import datetime

class HybridModelServer:
    """Production model server for hybrid ensemble"""
    
    def __init__(self):
        self.models = {}
        self.ensemble_weights = None
        self.model_version = None
        self.load_time = None
    
    def load_models(self, model_dir):
        """Load all models"""
        
        # Load LightGBM
        self.models['lgb'] = lgb.Booster(model_file=f"{model_dir}/lgb_model.txt")
        
        # Load XGBoost
        self.models['xgb'] = xgb.Booster()
        self.models['xgb'].load_model(f"{model_dir}/xgb_model.json")
        
        # Load Transformer
        self.models['transformer'] = tf.keras.models.load_model(
            f"{model_dir}/transformer_model.h5"
        )
        
        # Load LSTM
        self.models['lstm'] = tf.keras.models.load_model(
            f"{model_dir}/lstm_model.h5"
        )
        
        # Load ensemble weights
        with open(f"{model_dir}/ensemble_weights.pkl", 'rb') as f:
            self.ensemble_weights = pickle.load(f)
        
        self.load_time = datetime.now()
        
        print("All models loaded successfully")
    
    def predict(self, X, X_seq):
        """Generate predictions"""
        
        # Primary models
        lgb_pred = self.models['lgb'].predict(X)
        xgb_pred = self.models['xgb'].predict(xgb.DMatrix(X))
        
        # Enhancement models
        transformer_pred = self.models['transformer'].predict(X_seq)[0].flatten()
        lstm_pred = self.models['lstm'].predict(X_seq)[0].flatten()
        
        # Ensemble
        predictions = np.column_stack([
            lgb_pred,
            xgb_pred,
            transformer_pred,
            lstm_pred
        ])
        
        final_pred = np.dot(predictions, self.ensemble_weights)
        
        return {
            'p_up': final_pred,
            'lgb_pred': lgb_pred,
            'xgb_pred': xgb_pred,
            'transformer_pred': transformer_pred,
            'lstm_pred': lstm_pred
        }

# Usage
server = HybridModelServer()
server.load_models("models/hybrid_ensemble_v1.0")

predictions = server.predict(X_test, X_test_seq)
```

---

## 📝 Summary

### Hybrid Ensemble Advantages

1. **Diverse Model Types**
   - GBDT (LightGBM/XGBoost) for tabular features
   - Transformer for long-range temporal patterns
   - LSTM+Attention for sequential patterns

2. **Complementary Strengths**
   - LightGBM: Fast, handles categorical features
   - XGBoost: Different regularization, feature selection
   - Transformer: Long-term dependencies, attention
   - LSTM: Short-term sequential patterns

3. **Robust Predictions**
   - Reduces overfitting through diversity
   - More stable predictions
   - Better generalization

4. **Production Ready**
   - Parallel model training
   - Independent model serving
   - Easy model updates
   - Version control

---

**Last Updated:** 2026-03-03  
**Version:** 2.0 - Hybrid Ensemble Architecture  
**Status:** Production Ready  
**Next Review:** 2026-03-10