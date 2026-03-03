/**
 * UI Enhancements for StockandCrypto
 * Advanced visual effects and interactions
 */

// ==================== INITIALIZATION ====================

document.addEventListener('DOMContentLoaded', function() {
    initUIEnhancements();
    initAnimations();
    initTooltips();
    initLiveDataIndicators();
    initMetricCards();
    initProgressBars();
});

// ==================== LOAD ENHANCEMENT CSS ====================

(function() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'css/ui-enhancements.css';
    document.head.appendChild(link);
})();

// ==================== INITIALIZATION FUNCTIONS ====================

function initUIEnhancements() {
    // Add glassmorphism to cards
    document.querySelectorAll('.card').forEach(card => {
        card.classList.add('card-enhanced');
    });
    
    // Add trend indicators to metric cards
    document.querySelectorAll('.metric-card').forEach(card => {
        card.classList.add('metric-card-enhanced');
        addTrendIndicator(card);
    });
    
    // Enhance tables
    document.querySelectorAll('table').forEach(table => {
        if (!table.classList.contains('table-enhanced')) {
            table.classList.add('table-enhanced');
        }
    });
    
    // Add live indicators
    document.querySelectorAll('[data-live="true"]').forEach(el => {
        el.classList.add('live-indicator');
        addLiveDot(el);
    });
}

function initAnimations() {
    // Add entrance animations
    const animatedElements = document.querySelectorAll('.card, .metric-card, .chart-container');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate-fade-in-up');
                entry.target.style.animationDelay = `${index * 0.1}s`;
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '50px'
    });
    
    animatedElements.forEach(el => observer.observe(el));
}

function initTooltips() {
    // Add enhanced tooltips
    document.querySelectorAll('[data-tooltip]').forEach(el => {
        el.classList.add('tooltip-enhanced');
    });
}

function initLiveDataIndicators() {
    // Update live data indicators
    document.querySelectorAll('.live-indicator').forEach(indicator => {
        const dot = indicator.querySelector('.live-dot');
        if (dot) {
            // Pulse animation is handled by CSS
        }
    });
}

function initMetricCards() {
    // Add hover effects and trend detection
    document.querySelectorAll('.metric-card-enhanced').forEach(card => {
        const changeEl = card.querySelector('.metric-change');
        if (changeEl) {
            const changeText = changeEl.textContent;
            const changeValue = parseFloat(changeText);
            
            if (changeValue > 0) {
                changeEl.classList.add('positive');
                card.classList.add('positive-trend');
            } else if (changeValue < 0) {
                changeEl.classList.add('negative');
                card.classList.add('negative-trend');
            } else {
                changeEl.classList.add('neutral');
                card.classList.add('neutral-trend');
            }
        }
    });
}

function initProgressBars() {
    // Animate progress bars on scroll
    const progressBars = document.querySelectorAll('.progress-bar, .progress-bar-enhanced');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const fill = entry.target.querySelector('.progress-fill, .progress-fill-enhanced');
                if (fill) {
                    const targetWidth = fill.style.width || fill.dataset.width;
                    fill.style.width = '0%';
                    setTimeout(() => {
                        fill.style.width = targetWidth;
                    }, 100);
                }
                observer.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.5
    });
    
    progressBars.forEach(bar => observer.observe(bar));
}

// ==================== HELPER FUNCTIONS ====================

function addTrendIndicator(card) {
    const changeEl = card.querySelector('.metric-change');
    if (!changeEl) return;
    
    const changeText = changeEl.textContent;
    const changeValue = parseFloat(changeText.replace(/[^-\d.]/g, ''));
    
    let trendClass = 'neutral';
    let arrow = '→';
    
    if (changeValue > 1) {
        trendClass = 'bullish';
        arrow = '↑';
    } else if (changeValue < -1) {
        trendClass = 'bearish';
        arrow = '↓';
    } else if (changeValue > 0) {
        trendClass = 'bullish';
        arrow = '↗';
    } else if (changeValue < 0) {
        trendClass = 'bearish';
        arrow = '↘';
    }
    
    // Add trend indicator if not exists
    if (!card.querySelector('.trend-indicator')) {
        const trendEl = document.createElement('div');
        trendEl.className = `trend-indicator ${trendClass}`;
        trendEl.innerHTML = `<span class="trend-arrow">${arrow}</span><span>${changeText}</span>`;
        
        const valueEl = card.querySelector('.metric-value');
        if (valueEl && valueEl.nextSibling) {
            valueEl.parentNode.insertBefore(trendEl, valueEl.nextSibling);
        }
    }
}

function addLiveDot(element) {
    if (!element.querySelector('.live-dot')) {
        const dot = document.createElement('span');
        dot.className = 'live-dot';
        element.insertBefore(dot, element.firstChild);
    }
}

// ==================== CONFIDENCE RING ====================

function createConfidenceRing(container, confidence, size = 80) {
    const radius = size / 2 - 6;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (confidence / 100) * circumference;
    
    const svg = `
        <div class="confidence-ring-enhanced" style="width: ${size}px; height: ${size}px;">
            <svg width="${size}" height="${size}">
                <circle class="ring-bg" cx="${size/2}" cy="${size/2}" r="${radius}"/>
                <circle class="ring-fill" cx="${size/2}" cy="${size/2}" r="${radius}" 
                    style="stroke-dashoffset: ${offset};"/>
            </svg>
            <div class="ring-text">
                <div class="ring-value">${confidence}%</div>
                <div class="ring-label">Conf</div>
            </div>
        </div>
    `;
    
    if (container) {
        container.innerHTML = svg;
    }
    
    return svg;
}

// ==================== PRICE ANIMATION ====================

function animatePrice(element, newValue) {
    const currentValue = parseFloat(element.textContent.replace(/[^-\d.]/g, ''));
    const diff = newValue - currentValue;
    const steps = 20;
    const stepValue = diff / steps;
    let current = currentValue;
    let step = 0;
    
    const interval = setInterval(() => {
        current += stepValue;
        element.textContent = formatPrice(current);
        step++;
        
        if (step >= steps) {
            clearInterval(interval);
            element.textContent = formatPrice(newValue);
            
            // Flash effect
            element.classList.add(diff > 0 ? 'positive' : 'negative');
            setTimeout(() => {
                element.classList.remove('positive', 'negative');
            }, 500);
        }
    }, 30);
}

function formatPrice(value) {
    const prefix = value >= 0 ? '+' : '';
    return prefix + value.toFixed(2) + '%';
}

// ==================== NOTIFICATION BADGE ====================

function showNotificationBadge(element, type = 'success') {
    const badge = document.createElement('div');
    badge.className = `notification-badge ${type}`;
    badge.innerHTML = type === 'success' ? '✓' : type === 'warning' ? '!' : '×';
    
    element.style.position = 'relative';
    element.appendChild(badge);
    
    setTimeout(() => {
        badge.classList.add('fade-out');
        setTimeout(() => badge.remove(), 300);
    }, 2000);
}

// ==================== CHART ENHANCEMENT ====================

function enhanceChart(container) {
    container.classList.add('chart-container-enhanced');
    
    // Add header if not exists
    if (!container.querySelector('.chart-header')) {
        const header = document.createElement('div');
        header.className = 'chart-header';
        
        const title = container.querySelector('h3, .card-title');
        if (title) {
            header.innerHTML = `
                <div>
                    <div class="chart-title">${title.textContent}</div>
                </div>
            `;
            title.remove();
        }
        
        container.insertBefore(header, container.firstChild);
    }
}

// ==================== PREDICTION CARD ====================

function createPredictionCard(data) {
    return `
        <div class="prediction-card">
            <div class="prediction-header">
                <div class="prediction-title">${data.symbol}</div>
                <span class="status-badge model-tag">${data.model}</span>
            </div>
            
            <div class="prediction-direction">
                <span class="direction-label">P(UP)</span>
                <span class="direction-value">${data.pUp.toFixed(2)}</span>
            </div>
            
            <div style="margin: 1rem 0;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <span style="color: var(--text-muted); font-size: 0.85rem;">Signal Strength</span>
                    <span class="mono" style="font-weight: 600;">${data.signal}</span>
                </div>
                <div class="progress-bar-enhanced">
                    <div class="progress-fill-enhanced ${data.signalClass}" style="width: ${data.signalWidth};"></div>
                </div>
            </div>
            
            <div class="quantile-display">
                <div class="quantile-item">
                    <div class="quantile-label">10th %ile</div>
                    <div class="quantile-value ${data.q10 >= 0 ? 'positive' : 'negative'}">${data.q10 >= 0 ? '+' : ''}${data.q10.toFixed(2)}%</div>
                </div>
                <div class="quantile-item">
                    <div class="quantile-label">Median</div>
                    <div class="quantile-value ${data.q50 >= 0 ? 'positive' : 'negative'}">${data.q50 >= 0 ? '+' : ''}${data.q50.toFixed(2)}%</div>
                </div>
                <div class="quantile-item">
                    <div class="quantile-label">90th %ile</div>
                    <div class="quantile-value ${data.q90 >= 0 ? 'positive' : 'negative'}">${data.q90 >= 0 ? '+' : ''}${data.q90.toFixed(2)}%</div>
                </div>
            </div>
            
            <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.06);">
                <div class="live-indicator">
                    <span class="live-dot"></span>
                    <span>Data Fresh</span>
                    <span style="color: var(--text-muted); margin-left: auto;">${data.timestamp}</span>
                </div>
            </div>
        </div>
    `;
}

// ==================== EXPORT FUNCTIONS ====================

window.UIEnhancements = {
    createConfidenceRing,
    animatePrice,
    showNotificationBadge,
    enhanceChart,
    createPredictionCard
};

console.log('UI Enhancements loaded successfully');
