// ========================================
// StockandCrypto - Session Crypto (Strict API Mode)
// ========================================

(() => {
  const SESSION_ORDER = ['asia', 'europe', 'us'];
  const SESSION_META = {
    asia: { code: 'asia', label: 'Asia Session', hoursBjt: '08:00-15:59', startMinute: 8 * 60, endMinute: 16 * 60 },
    europe: { code: 'europe', label: 'Europe Session', hoursBjt: '16:00-23:59', startMinute: 16 * 60, endMinute: 24 * 60 },
    us: { code: 'us', label: 'US Session', hoursBjt: '00:00-07:59', startMinute: 0, endMinute: 8 * 60 }
  };

  const state = {
    symbol: 'BTCUSDT',
    leverage: 1,
    sortKey: 'pUp',
    sortDir: 'desc',
    sessionFilter: 'all',
    signalFilter: 'all',
    scope: 'all',
    vm: null,
    lastGood: null,
    radar: null,
    preview: null,
    loading: false
  };

  document.addEventListener('DOMContentLoaded', init);

  function init() {
    bind();
    renderSortState();
    refresh(true);
    setInterval(() => refresh(false), 10000);
    setInterval(updateCountdownOnly, 1000);
  }

  function bind() {
    const symbolSelector = document.getElementById('symbolSelector');
    symbolSelector.value = state.symbol;
    symbolSelector.addEventListener('change', () => {
      state.symbol = symbolSelector.value;
      refresh(true);
    });

    document.getElementById('refreshSessionBtn').addEventListener('click', () => refresh(true));
    document.getElementById('sessionFilter').addEventListener('change', (event) => {
      state.sessionFilter = event.target.value;
      renderHourly(state.vm);
    });
    document.getElementById('signalFilter').addEventListener('change', (event) => {
      state.signalFilter = event.target.value;
      renderHourly(state.vm);
    });
    document.getElementById('hourlyScope').addEventListener('change', (event) => {
      state.scope = event.target.value;
      renderHourly(state.vm);
    });

    document.querySelectorAll('.leverage-btn').forEach((button) => {
      button.addEventListener('click', () => {
        state.leverage = Number(button.dataset.leverage || 1);
        document.querySelectorAll('.leverage-btn').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        renderDecisionRisk(state.vm);
      });
    });

    document.querySelectorAll('th.sortable').forEach((header) => {
      header.addEventListener('click', () => {
        const key = header.dataset.sort;
        if (state.sortKey === key) {
          state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.sortKey = key;
          state.sortDir = key === 'hour' ? 'asc' : 'desc';
        }
        renderSortState();
        renderHourly(state.vm);
      });
    });

    document.getElementById('executeBtn').addEventListener('click', () => {
      const decision = state.vm?.decision;
      if (!decision) return;
      const action = String(decision.action || 'WAIT').toUpperCase();
      if (action === 'WAIT') return;
      const modalBody = document.getElementById('executeModalBody');
      const entry = Number.isFinite(decision.entry) ? utils.formatCurrency(decision.entry) : '--';
      const expected = fmtPct(decision.netEdgePct);
      modalBody.textContent = `Simulated ${action} at ${entry} | Expected PNL: ${expected} | Leverage ${state.leverage}x`;
      openModal();

      const hint = document.getElementById('executeHint');
      hint.textContent = `Mock execution submitted at ${new Date().toLocaleTimeString('en-US', { hour12: false })}.`;
      hint.className = 'warning-inline text-positive';
    });

    const modal = document.getElementById('executeModal');
    document.getElementById('executeModalClose').addEventListener('click', closeModal);
    modal.addEventListener('click', (event) => {
      if (event.target.id === 'executeModal') closeModal();
    });
  }

  function openModal() {
    const modal = document.getElementById('executeModal');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    const modal = document.getElementById('executeModal');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  async function refresh(force) {
    if (state.loading) return;
    state.loading = true;
    try {
      const vm = await buildVM(state.symbol);
      vm.meta.force = Boolean(force);
      state.vm = vm;
      state.lastGood = vm;
      renderAll(vm);
    } catch (error) {
      console.error('session-crypto refresh failed', error);
      if (state.lastGood) {
        state.vm = {
          ...state.lastGood,
          meta: {
            ...state.lastGood.meta,
            stale: true,
            warning: `Refresh failed: ${error.message}`
          }
        };
        renderAll(state.vm);
      } else {
        renderUnavailable(error.message);
      }
    } finally {
      state.loading = false;
    }
  }

  async function buildVM(symbol) {
    const payload = await api.getCryptoSessionForecast(symbol);
    return normalizeSessionPayload(payload, symbol);
  }

  function normalizeSessionPayload(payload, requestedSymbol) {
    const symbol = String(payload?.meta?.symbol || requestedSymbol || '').toUpperCase();
    if (!symbol || symbol !== String(requestedSymbol).toUpperCase()) {
      throw new Error(`Session payload symbol mismatch: ${symbol || 'unknown'}`);
    }

    const sessionsRaw = Array.isArray(payload?.sessions) ? payload.sessions : [];
    if (!sessionsRaw.length) throw new Error('Session payload missing sessions.');
    const sessionMap = new Map();
    sessionsRaw.forEach((row) => {
      const code = normSessionCode(row.code);
      if (!code) return;
      sessionMap.set(code, {
        code,
        label: row.label || SESSION_META[code].label,
        hoursBjt: row.hoursBjt || SESSION_META[code].hoursBjt,
        pUp: clamp(num(row.pUp, 0.5), 0, 1),
        pDown: clamp(1 - clamp(num(row.pUp, 0.5), 0, 1), 0, 1),
        confidence: clamp(num(row.confidence, 0.5), 0, 1),
        volatilityPct: Math.max(0, num(row.volatilityPct, 0)),
        riskLevel: normRisk(row.riskLevel),
        status: normStatus(row.status)
      });
    });

    const sessions = SESSION_ORDER.map((code) => {
      const row = sessionMap.get(code);
      if (!row) throw new Error(`Session payload missing required block: ${code}`);
      return row;
    });

    const currentRaw = payload?.currentSession || {};
    const timing = sessionTiming();
    const currentCode = normSessionCode(currentRaw.code) || timing.code;
    const remainingSec = Number.isFinite(Number(currentRaw.remainingSec)) ? Number(currentRaw.remainingSec) : timing.remainingSec;
    const elapsedRatio = Number.isFinite(Number(currentRaw.elapsedRatio)) ? Number(currentRaw.elapsedRatio) : timing.elapsedRatio;
    const transitionSoon = Boolean(currentRaw.transitionSoon) || remainingSec < 1800;
    const transitionText = String(currentRaw.transitionText || (transitionSoon ? transitionTextFor(currentCode) : ''));

    const currentPrice = payload?.currentPrice || {};
    const currentSessionRow = sessions.find((row) => row.code === currentCode) || sessions[0];
    const current = {
      symbol,
      price: num(currentPrice.price, NaN),
      priceChangePct: num(currentPrice.changePct, NaN),
      volume: num(currentPrice.volume, NaN),
      sessionCode: currentCode,
      sessionLabel: currentRaw.label || currentSessionRow.label,
      sessionHours: currentRaw.hoursBjt || currentSessionRow.hoursBjt,
      remainingSec,
      elapsedRatio: clamp(elapsedRatio, 0, 1),
      transitionSoon,
      transitionText,
      pUp: currentSessionRow.pUp,
      volatility: currentSessionRow.volatilityPct
    };

    const decisionRaw = payload?.decision;
    if (!decisionRaw) throw new Error('Session payload missing decision block.');
    const decision = {
      action: normAction(decisionRaw.action),
      confidence: clamp(num(decisionRaw.confidence, 0.5), 0, 1),
      entry: num(decisionRaw.entry, NaN),
      stopLoss: num(decisionRaw.stopLoss, NaN),
      takeProfit1: num(decisionRaw.takeProfit1, NaN),
      takeProfit2: num(decisionRaw.takeProfit2, NaN),
      grossReturnPct: num(decisionRaw.grossReturnPct, NaN),
      costPct: num(decisionRaw.costPct, NaN),
      netEdgePct: num(decisionRaw.netEdgePct, NaN),
      riskLevel: normRisk(decisionRaw.riskLevel || currentSessionRow.riskLevel),
      rr1: num(decisionRaw.rr1, NaN),
      rr2: num(decisionRaw.rr2, NaN),
      reason: String(decisionRaw.reason || 'Generated from live model session engine.'),
      leverage: 1,
      disableReason: ''
    };

    const decisionByLeverage = normalizeDecisionByLeverage(payload?.decisionByLeverage || {}, decision);

    const hourlyRaw = Array.isArray(payload?.hourly) ? payload.hourly : [];
    if (!hourlyRaw.length) throw new Error('Session payload missing hourly forecast rows.');
    const hourlyRows = hourlyRaw.map((row) => {
      const code = normSessionCode(row.sessionCode) || sessionFromHour(parseHour(row.hourLabel));
      const pUp = clamp(num(row.pUp, 0.5), 0, 1);
      const confidence = clamp(num(row.confidence, currentSessionRow.confidence), 0, 1);
      const volatilityForecast = Math.max(0, num(row.volatilityForecastPct, 0));
      return {
        hour: parseHour(row.hourLabel),
        hourLabel: row.hourLabel || `${String(parseHour(row.hourLabel)).padStart(2, '0')}:00`,
        sessionCode: code,
        sessionLabel: SESSION_META[code].label,
        pUp,
        q10: num(row.q10, 0),
        q50: num(row.q50, 0),
        q90: num(row.q90, 0),
        volatilityForecast,
        confidence,
        confidenceAdj: confidenceAdjusted(confidence, volatilityForecast),
        signal: normAction(row.signal || signalFrom(pUp, confidence)),
        sparkline: normalizeSparkline(row.sparkline, decision.entry)
      };
    });

    const tradeRaw = Array.isArray(payload?.tradeLog) ? payload.tradeLog : [];
    const tradeLog = tradeRaw.map((row) => ({
      sessionLabel: String(row.sessionLabel || '--'),
      predictedEdgePct: num(row.predictedEdgePct, NaN),
      realizedEdgePct: num(row.realizedEdgePct, NaN),
      edgeDeltaPct: num(row.edgeDeltaPct, NaN),
      deltaReason: String(row.deltaReason || 'No reason available.'),
      outcome: normOutcome(row.outcome)
    }));

    const healthRaw = payload?.health || {};
    const health = {
      status: normHealth(healthRaw.status),
      driftAlerts: Number.isFinite(Number(healthRaw.drift_alerts)) ? Number(healthRaw.drift_alerts) : 0,
      topDriftFactor: normalizeFeatureName(healthRaw?.top_drift_factor || healthRaw?.topFeature || 'volatility_proxy'),
      topDriftScore: num(healthRaw?.top_drift_score || healthRaw?.sharpe_stability, 0),
      dataFreshness: String(healthRaw.data_freshness || 'live'),
      lastTraining: String(healthRaw.last_training || 'N/A'),
      recommendation: healthRecommendation(normHealth(healthRaw.status), Number(healthRaw.drift_alerts || 0))
    };

    return {
      meta: {
        source: String(payload?.meta?.source || 'model_session_engine'),
        timestamp: String(payload?.meta?.timestamp || new Date().toISOString()),
        stale: Boolean(payload?.meta?.stale),
        warning: String(payload?.meta?.warning || ''),
        symbol
      },
      current,
      sessions: withStatuses(sessions, current.sessionCode),
      decision,
      decisionByLeverage,
      health,
      hourlyRows,
      tradeLog
    };
  }

  function normalizeDecisionByLeverage(map, baseDecision) {
    const result = {};
    [1, 5, 10].forEach((lev) => {
      const key = String(lev);
      const row = map[key] || {};
      result[key] = {
        netEdgePct: num(row.netEdgePct, baseDecision.netEdgePct),
        stopLoss: num(row.stopLoss, baseDecision.stopLoss),
        takeProfit1: num(row.takeProfit1, baseDecision.takeProfit1),
        takeProfit2: num(row.takeProfit2, baseDecision.takeProfit2)
      };
    });
    return result;
  }

  function renderAll(vm) {
    renderSource(vm.meta);
    renderCurrent(vm.current);
    renderSessionCards(vm.sessions);
    renderLiveCard(vm.current, vm.meta);
    renderHeatmap(vm.sessions);
    renderRadar(vm.sessions);
    renderDecisionRisk(vm);
    renderHealth(vm.health);
    renderHourly(vm);
    renderTradeLog(vm.tradeLog);
    renderFooter(vm.meta);
  }

  function renderSource(meta) {
    const note = document.getElementById('sessionSourceNote');
    note.className = 'session-note';
    if (meta.stale) note.classList.add('stale');
    if (meta.unavailable) note.classList.add('unavailable');
    note.textContent = `Source: ${meta.source} | Updated: ${fmtStamp(meta.timestamp)}${meta.stale ? ' | STALE' : ''}`;
    note.title = meta.warning || '';
  }

  function renderCurrent(current) {
    document.getElementById('currentSessionTitle').textContent = `Current: ${current.sessionLabel} (${current.sessionHours} BJT)`;
    document.getElementById('currentSessionRemaining').textContent = `Time Remaining: ${fmtRemainingSec(current.remainingSec)}`;
    document.getElementById('currentSessionPup').textContent = `P(UP): ${(current.pUp * 100).toFixed(1)}%`;
    document.getElementById('currentSessionVolatility').textContent = `Volatility: ${fmtPct(current.volatility)}`;

    const transition = document.getElementById('sessionTransitionAlert');
    if (current.transitionSoon && current.transitionText) {
      transition.classList.add('active');
      transition.textContent = current.transitionText;
    } else {
      transition.classList.remove('active');
      transition.textContent = '';
    }

    const elapsed = clamp(current.elapsedRatio * 100, 0, 100);
    document.getElementById('sessionProgressElapsed').style.width = `${elapsed.toFixed(2)}%`;
    document.getElementById('sessionProgressRemaining').style.width = `${(100 - elapsed).toFixed(2)}%`;

    const signal = signalFrom(current.pUp, 0.6);
    badge(document.getElementById('currentSignalBadge'), signalClass(signal), signal);
  }

  function renderSessionCards(rows) {
    const ids = {
      asia: { card: 'sessionCardAsia', p: 'asiaPup', c: 'asiaConfidence', v: 'asiaVolatility', s: 'asiaStatus', h: 'asiaHours' },
      europe: { card: 'sessionCardEurope', p: 'europePup', c: 'europeConfidence', v: 'europeVolatility', s: 'europeStatus', h: 'europeHours' },
      us: { card: 'sessionCardUs', p: 'usPup', c: 'usConfidence', v: 'usVolatility', s: 'usStatus', h: 'usHours' }
    };

    Object.values(ids).forEach((entry) => {
      document.getElementById(entry.card).classList.remove('active-session');
    });

    rows.forEach((row) => {
      const map = ids[row.code];
      document.getElementById(map.h).textContent = row.hoursBjt;
      document.getElementById(map.p).textContent = `${(row.pUp * 100).toFixed(1)}%`;
      document.getElementById(map.c).textContent = `Confidence: ${(row.confidence * 100).toFixed(1)}%`;
      const vol = document.getElementById(map.v);
      vol.textContent = `Volatility: ${fmtPct(row.volatilityPct)}`;
      vol.className = `metric-change ${row.volatilityPct >= 2.5 ? 'negative' : row.volatilityPct >= 1.6 ? 'text-neutral' : 'positive'}`;
      badge(document.getElementById(map.s), statusClass(row.status), row.status);
      if (row.status === 'ACTIVE') document.getElementById(map.card).classList.add('active-session');
    });
  }

  function renderLiveCard(current, meta) {
    document.getElementById('currentPrice').textContent = Number.isFinite(current.price) ? utils.formatCurrency(current.price) : '--';
    const changeNode = document.getElementById('currentPriceChange');
    changeNode.textContent = Number.isFinite(current.priceChangePct) ? fmtPctFromDecimal(current.priceChangePct) : '--';
    changeNode.className = `metric-change ${current.priceChangePct >= 0 ? 'positive' : 'negative'}`;
    document.getElementById('modeLabel').textContent = `Mode: ${meta.source}`;
    badge(document.getElementById('liveDataStatus'), meta.stale ? 'warning' : 'success', meta.stale ? 'STALE' : 'LIVE');
  }

  function renderHeatmap(rows) {
    const root = document.getElementById('sessionHeatmap');
    root.innerHTML = '';
    const columns = ['asia', 'europe', 'us'];
    const metrics = [
      {
        label: 'P(UP)',
        value: (row) => `${(row.pUp * 100).toFixed(1)}%`,
        score: (row) => (row.pUp - 0.5) * 2
      },
      {
        label: 'Confidence',
        value: (row) => `${(row.confidence * 100).toFixed(1)}%`,
        score: (row) => (row.confidence - 0.5) * 2
      },
      {
        label: 'Volatility',
        value: (row) => fmtPct(row.volatilityPct),
        score: (row) => clamp((3.5 - row.volatilityPct) / 3.5, -1, 1)
      },
      {
        label: 'Risk',
        value: (row) => row.riskLevel,
        score: (row) => riskScore(row.riskLevel)
      }
    ];

    root.appendChild(heatCell('heatmap-head', 'Metric'));
    columns.forEach((code) => root.appendChild(heatCell('heatmap-head', SESSION_META[code].label.replace(' Session', ''))));

    metrics.forEach((metric) => {
      root.appendChild(heatCell('heatmap-row-label', metric.label));
      columns.forEach((code) => {
        const row = rows.find((item) => item.code === code);
        const cell = heatCell('heatmap-cell', metric.value(row));
        cell.style.background = heatColor(metric.score(row));
        cell.title = `${SESSION_META[code].label} P(UP) ${(row.pUp * 100).toFixed(1)}% | Volatility ${fmtPct(row.volatilityPct)} | Risk ${row.riskLevel}`;
        root.appendChild(cell);
      });
    });
  }

  function renderRadar(rows) {
    const ctx = document.getElementById('sessionRadarChart').getContext('2d');
    if (state.radar) state.radar.destroy();
    state.radar = new Chart(ctx, {
      type: 'radar',
      data: {
        labels: rows.map((row) => row.label.replace(' Session', '')),
        datasets: [
          {
            label: 'P(UP)',
            data: rows.map((row) => Number((row.pUp * 100).toFixed(2))),
            borderColor: '#00ff88',
            backgroundColor: 'rgba(0,255,136,0.12)',
            borderWidth: 2
          },
          {
            label: 'Confidence',
            data: rows.map((row) => Number((row.confidence * 100).toFixed(2))),
            borderColor: '#00e5ff',
            backgroundColor: 'rgba(0,229,255,0.10)',
            borderWidth: 2
          },
          {
            label: 'Risk Score',
            data: rows.map((row) => Number(clamp((riskScore(row.riskLevel) + 1) * 50, 0, 100).toFixed(2))),
            borderColor: '#ff4d4f',
            backgroundColor: 'rgba(255,77,79,0.08)',
            borderWidth: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#94A3B8',
              font: { family: 'JetBrains Mono', size: 11 }
            }
          }
        },
        onClick: (_, elements) => {
          if (!elements?.length) return;
          const index = elements[0].index;
          const code = rows[index]?.code;
          if (!code) return;
          state.scope = 'all';
          state.sessionFilter = code;
          document.getElementById('hourlyScope').value = 'all';
          document.getElementById('sessionFilter').value = code;
          renderHourly(state.vm);
        },
        scales: {
          r: {
            min: 0,
            max: 100,
            grid: { color: 'rgba(148,163,184,0.18)' },
            angleLines: { color: 'rgba(148,163,184,0.18)' },
            pointLabels: { color: '#F8FAFC', font: { size: 11 } },
            ticks: { color: '#64748B', backdropColor: 'transparent', stepSize: 20 }
          }
        }
      }
    });
  }

  function renderDecisionRisk(vm) {
    const decision = vm?.decision;
    if (!decision) return;

    applyLeverage(decision, vm.decisionByLeverage, state.leverage);

    const action = String(decision.action || 'WAIT').toUpperCase();
    const actionNode = document.getElementById('decisionAction');
    actionNode.textContent = action;
    actionNode.className = action.includes('LONG') ? 'text-positive' : action.includes('SHORT') ? 'text-negative' : 'text-neutral';
    document.getElementById('decisionReason').textContent = decision.reason || 'No explanation available.';

    const confidencePct = clamp(decision.confidence * 100, 0, 100);
    const ring = document.getElementById('decisionConfidenceRing');
    ring.style.background = `conic-gradient(#00ff88 0deg, #00ff88 ${(confidencePct / 100) * 360}deg, rgba(255,255,255,0.12) ${(confidencePct / 100) * 360}deg)`;
    document.getElementById('decisionConfidenceText').textContent = `${confidencePct.toFixed(0)}%`;

    document.getElementById('decisionEntry').textContent = Number.isFinite(decision.entry) ? utils.formatCurrency(decision.entry) : '--';
    document.getElementById('decisionStopLoss').textContent = Number.isFinite(decision.stopLoss) ? utils.formatCurrency(decision.stopLoss) : '--';
    document.getElementById('decisionTakeProfit').textContent = Number.isFinite(decision.takeProfit1) ? utils.formatCurrency(decision.takeProfit1) : '--';
    document.getElementById('decisionTakeProfit2').textContent = Number.isFinite(decision.takeProfit2) ? utils.formatCurrency(decision.takeProfit2) : '--';

    badge(document.getElementById('decisionStatusBadge'), signalClass(action), action);

    const executeButton = document.getElementById('executeBtn');
    const blocked = action === 'WAIT' || vm.meta.unavailable;
    executeButton.disabled = blocked;
    executeButton.style.opacity = blocked ? '0.58' : '1';
    executeButton.style.cursor = blocked ? 'not-allowed' : 'pointer';

    const disclaimer = document.getElementById('executeDisclaimer');
    disclaimer.textContent = 'Simulation only. Not investment advice. Execute action does not place real trades.';
    disclaimer.className = 'warning-inline';
    disclaimer.style.color = 'var(--text-secondary)';

    const hint = document.getElementById('executeHint');
    const advisory = blocked ? ' | Advisory: WAIT signal - execution paused.' : '';
    hint.textContent = `Leverage ${decision.leverage}x | R:R(TP1/TP2): ${fmtRatio(decision.rr1)} / ${fmtRatio(decision.rr2)}${advisory}`;
    hint.className = blocked ? 'warning-inline text-neutral' : 'warning-inline';

    document.getElementById('grossReturnValue').textContent = fmtPct(decision.grossReturnPct);
    document.getElementById('costValue').textContent = fmtPct(-decision.costPct);
    const netNode = document.getElementById('netEdgeValue');
    netNode.textContent = fmtPct(decision.netEdgePct);
    netNode.className = decision.netEdgePct >= 0 ? 'text-positive' : 'text-negative';

    badge(document.getElementById('riskLevelBadge'), riskClass(decision.riskLevel), decision.riskLevel);
    const active = vm.sessions.find((row) => row.code === vm.current.sessionCode) || vm.sessions[0];
    document.getElementById('riskVolatilityValue').textContent = fmtPct(active.volatilityPct);
    const volatilityBar = document.getElementById('riskVolatilityBar');
    const volatilityWidth = clamp(active.volatilityPct * 14, 0, 100);
    volatilityBar.style.width = `${volatilityWidth.toFixed(2)}%`;
    volatilityBar.style.background = active.volatilityPct >= 2.6
      ? 'linear-gradient(90deg,#ff4d4f,#f97316)'
      : active.volatilityPct >= 1.5
        ? 'linear-gradient(90deg,#f59e0b,#f97316)'
        : 'linear-gradient(90deg,#00ff88,#10b981)';

    const adjustedConfidence = confidenceAdjusted(decision.confidence, active.volatilityPct);
    document.getElementById('riskConfidenceValue').textContent = `${(adjustedConfidence * 100).toFixed(1)}%`;
    const confidenceBar = document.getElementById('riskConfidenceBar');
    confidenceBar.style.width = `${(adjustedConfidence * 100).toFixed(1)}%`;
    confidenceBar.style.background = adjustedConfidence >= 0.55
      ? 'linear-gradient(90deg,#00ff88,#10b981)'
      : 'linear-gradient(90deg,#f59e0b,#ff4d4f)';
  }

  function applyLeverage(decision, leverageMap, leverage) {
    const key = String(leverage);
    const row = leverageMap[key];
    decision.leverage = leverage;
    if (!row) return;
    decision.netEdgePct = num(row.netEdgePct, decision.netEdgePct);
    decision.stopLoss = num(row.stopLoss, decision.stopLoss);
    decision.takeProfit1 = num(row.takeProfit1, decision.takeProfit1);
    decision.takeProfit2 = num(row.takeProfit2, decision.takeProfit2);
  }

  function renderHealth(health) {
    if (!health) return;
    badge(document.getElementById('healthStatusBadge'), healthClass(health.status), health.status.replace(/_/g, ' '));
    document.getElementById('healthDriftAlerts').textContent = String(health.driftAlerts ?? '--');
    document.getElementById('healthTopDrift').textContent = health.topDriftFactor || '--';
    document.getElementById('healthTopDriftScore').textContent = Number.isFinite(health.topDriftScore) ? health.topDriftScore.toFixed(3) : '--';
    document.getElementById('healthFreshness').textContent = health.dataFreshness || '--';
    document.getElementById('healthLastTraining').textContent = health.lastTraining || '--';
    document.getElementById('healthRecommendation').textContent = health.recommendation || '--';
  }

  function renderHourly(vm) {
    const body = document.getElementById('hourlyTableBody');
    if (!vm?.hourlyRows?.length) {
      body.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-muted);">No hourly forecast available.</td></tr>';
      return;
    }

    const filtered = vm.hourlyRows
      .filter((row) => state.scope === 'all' || row.sessionCode === vm.current.sessionCode)
      .filter((row) => state.sessionFilter === 'all' || row.sessionCode === state.sessionFilter)
      .filter((row) => state.signalFilter === 'all' || signalMatch(row.signal, state.signalFilter))
      .sort((left, right) => compareHourly(left, right, state.sortKey, state.sortDir));

    if (!filtered.length) {
      body.innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--text-muted);">No rows match current filters.</td></tr>';
      return;
    }

    body.innerHTML = filtered.map((row) => {
      const signalType = row.signal.includes('LONG') ? 'success' : row.signal.includes('SHORT') ? 'danger' : 'warning';
      const pClass = row.pUp >= 0.55 ? 'text-positive' : row.pUp <= 0.45 ? 'text-negative' : 'text-neutral';
      const vClass = row.volatilityForecast >= 2.5 ? 'text-negative' : row.volatilityForecast >= 1.5 ? 'text-neutral' : 'text-positive';
      const sparkline = sparklineSvg(row.sparkline);
      return `<tr class="hourly-row" data-hour="${row.hour}" data-session="${row.sessionCode}">
        <td><strong>${row.hourLabel}</strong></td>
        <td>${row.sessionLabel}</td>
        <td class="${pClass}">${row.pUp.toFixed(2)}</td>
        <td>${fmtPctFromDecimal(row.q10)}</td>
        <td>${fmtPctFromDecimal(row.q50)}</td>
        <td>${fmtPctFromDecimal(row.q90)}</td>
        <td class="${vClass}">${fmtPct(row.volatilityForecast)}</td>
        <td>${sparkline}</td>
        <td><span class="status-badge ${signalType}">${row.signal}</span></td>
      </tr>`;
    }).join('');

    bindPreview(filtered);
  }

  function renderTradeLog(rows) {
    const body = document.getElementById('tradeLogBody');
    if (!rows?.length) {
      body.innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No trade log available.</td></tr>';
      return;
    }

    body.innerHTML = rows.map((row) => {
      const deltaClass = row.edgeDeltaPct >= 0 ? 'text-positive' : 'text-negative';
      const outcomeClass = row.outcome === 'WIN' ? 'success' : row.outcome === 'LOSS' ? 'danger' : 'info';
      return `<tr>
        <td>${row.sessionLabel}</td>
        <td>${fmtPct(row.predictedEdgePct)}</td>
        <td>${fmtPct(row.realizedEdgePct)}</td>
        <td class="${deltaClass}">${fmtPct(row.edgeDeltaPct)}</td>
        <td>${escapeHtml(row.deltaReason)}</td>
        <td><span class="status-badge ${outcomeClass}">${row.outcome}</span></td>
      </tr>`;
    }).join('');
  }

  function renderFooter(meta) {
    const footer = document.getElementById('sessionFooterDisclaimer');
    const source = String(meta.source || '').toLowerCase();
    const mode = source.includes('mock') ? 'Mock Mode' : 'Live Mode';
    footer.textContent = `${mode} | Model-Derived Data | For Educational Use Only`;
  }

  function bindPreview(rows) {
    const tooltip = document.getElementById('hourlyPreview');
    document.querySelectorAll('.hourly-row').forEach((tr) => {
      const row = rows.find((item) => item.hour === Number(tr.dataset.hour) && item.sessionCode === tr.dataset.session);
      if (!row) return;
      tr.addEventListener('mouseenter', (event) => showPreview(row, event.clientX, event.clientY));
      tr.addEventListener('mousemove', (event) => placePreview(tooltip, event.clientX, event.clientY));
      tr.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });
  }

  function showPreview(row, x, y) {
    const tooltip = document.getElementById('hourlyPreview');
    const title = document.getElementById('hourlyPreviewTitle');
    const ctx = document.getElementById('hourlyPreviewCanvas').getContext('2d');
    title.textContent = `${row.hourLabel} ${row.sessionLabel} | P(UP) ${(row.pUp * 100).toFixed(1)}%`;
    if (state.preview) state.preview.destroy();

    const baseSeries = row.sparkline.length >= 2 ? row.sparkline : [row.sparkline[0] || 0, row.sparkline[0] || 0];
    const bandUpper = baseSeries.map((value) => value * (1 + Math.max(0, row.q90) * 0.25));
    const bandLower = baseSeries.map((value) => value * (1 + Math.min(0, row.q10) * 0.25));
    const labels = baseSeries.map((_, index) => `T+${index}`);

    state.preview = new Chart(ctx, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Actual path', data: baseSeries, borderColor: '#00e5ff', borderWidth: 2, pointRadius: 0, tension: 0.25 },
          { label: 'Upper band', data: bandUpper, borderColor: 'rgba(16,185,129,0.75)', borderWidth: 1, pointRadius: 0, tension: 0.2 },
          { label: 'Lower band', data: bandLower, borderColor: 'rgba(255,77,79,0.75)', borderWidth: 1, pointRadius: 0, tension: 0.2 }
        ]
      },
      options: {
        responsive: false,
        animation: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${context.dataset.label}: ${utils.formatCurrency(context.raw)}`
            }
          }
        },
        scales: {
          x: { ticks: { color: '#94A3B8', font: { size: 10 } }, grid: { color: 'rgba(148,163,184,0.12)' } },
          y: { ticks: { color: '#94A3B8', font: { size: 10 } }, grid: { color: 'rgba(148,163,184,0.12)' } }
        }
      }
    });

    tooltip.style.display = 'block';
    placePreview(tooltip, x, y);
  }

  function placePreview(tooltip, x, y) {
    const offset = 16;
    const width = tooltip.offsetWidth || 260;
    const height = tooltip.offsetHeight || 180;
    const left = Math.min(window.innerWidth - width - 8, x + offset);
    const top = Math.min(window.innerHeight - height - 8, y + offset);
    tooltip.style.left = `${Math.max(8, left)}px`;
    tooltip.style.top = `${Math.max(8, top)}px`;
  }

  function renderSortState() {
    document.querySelectorAll('th.sortable').forEach((header) => {
      const key = header.dataset.sort;
      const baseLabel = String(header.dataset.baseLabel || header.textContent.replace(/ [\^v]$/, ''));
      header.dataset.baseLabel = baseLabel;
      header.classList.toggle('active', key === state.sortKey);
      const marker = key === state.sortKey ? (state.sortDir === 'asc' ? ' ^' : ' v') : '';
      header.textContent = `${baseLabel}${marker}`;
    });
  }

  function updateCountdownOnly() {
    if (!state.vm?.current || !state.vm?.sessions) return;
    const timing = sessionTiming();
    const previousCode = state.vm.current.sessionCode;
    const activeSession = state.vm.sessions.find((row) => row.code === timing.code) || state.vm.sessions[0];
    state.vm.current.sessionCode = timing.code;
    state.vm.current.sessionLabel = activeSession.label;
    state.vm.current.sessionHours = activeSession.hoursBjt;
    state.vm.current.remainingSec = timing.remainingSec;
    state.vm.current.elapsedRatio = timing.elapsedRatio;
    state.vm.current.transitionSoon = timing.remainingSec < 1800;
    state.vm.current.transitionText = state.vm.current.transitionSoon ? transitionTextFor(timing.code) : '';
    state.vm.current.pUp = activeSession.pUp;
    state.vm.current.volatility = activeSession.volatilityPct;
    state.vm.sessions = withStatuses(state.vm.sessions, timing.code);
    renderCurrent(state.vm.current);
    renderSessionCards(state.vm.sessions);
    renderDecisionRisk(state.vm);
    if (previousCode !== timing.code || timing.remainingSec <= 0) {
      refresh(true);
    }
  }

  function renderUnavailable(detail = '') {
    const source = document.getElementById('sessionSourceNote');
    source.className = 'session-note unavailable';
    source.textContent = `Unavailable: live session API data could not be loaded.${detail ? ` (${detail})` : ''}`;

    document.getElementById('currentSessionTitle').textContent = 'Current: Unavailable';
    document.getElementById('currentSessionRemaining').textContent = 'Time Remaining: --';
    document.getElementById('currentSessionPup').textContent = 'P(UP): --';
    document.getElementById('currentSessionVolatility').textContent = 'Volatility: --';
    const transition = document.getElementById('sessionTransitionAlert');
    transition.classList.remove('active');
    transition.textContent = '';
    document.getElementById('sessionProgressElapsed').style.width = '0%';
    document.getElementById('sessionProgressRemaining').style.width = '100%';
    badge(document.getElementById('currentSignalBadge'), 'danger', 'UNAVAILABLE');

    ['asia', 'europe', 'us'].forEach((code) => {
      document.getElementById(`${code}Pup`).textContent = '--';
      document.getElementById(`${code}Confidence`).textContent = 'Confidence: --';
      document.getElementById(`${code}Volatility`).textContent = 'Volatility: --';
      badge(document.getElementById(`${code}Status`), 'danger', 'UNAVAILABLE');
    });

    document.getElementById('currentPrice').textContent = '--';
    document.getElementById('currentPriceChange').textContent = '--';
    document.getElementById('modeLabel').textContent = 'Mode: Unavailable';
    badge(document.getElementById('liveDataStatus'), 'danger', 'UNAVAILABLE');

    const executeButton = document.getElementById('executeBtn');
    executeButton.disabled = true;
    executeButton.style.opacity = '0.55';
    executeButton.style.cursor = 'not-allowed';
    const hint = document.getElementById('executeHint');
    hint.textContent = 'Execution unavailable until live data is restored.';
    hint.className = 'warning-inline text-negative';

    document.getElementById('hourlyTableBody').innerHTML = '<tr><td colspan="9" style="text-align:center; color:var(--danger);">Live forecast unavailable.</td></tr>';
    document.getElementById('tradeLogBody').innerHTML = '<tr><td colspan="6" style="text-align:center; color:var(--danger);">Trade log unavailable.</td></tr>';
  }

  function withStatuses(rows, currentCode) {
    const minute = minuteOfDayNow();
    return rows.map((row) => ({
      ...row,
      status: statusFromMinute(row.code, minute, currentCode)
    }));
  }

  function statusFromMinute(code, minute, currentCode) {
    if (code === currentCode) return 'ACTIVE';
    const meta = SESSION_META[code];
    if (code === 'us') return minute >= meta.endMinute ? 'COMPLETED' : 'PENDING';
    return minute >= meta.endMinute ? 'COMPLETED' : 'PENDING';
  }

  function minuteOfDayNow() {
    const now = shanghaiNow();
    return now.hour * 60 + now.minute;
  }

  function sessionTiming() {
    const now = shanghaiNow();
    const minute = now.hour * 60 + now.minute;
    const secondOfDay = minute * 60 + now.second;
    const code = sessionFromMinute(minute);
    const meta = SESSION_META[code];
    const startSec = meta.startMinute * 60;
    const endSec = meta.endMinute * 60;
    const totalSec = Math.max(1, endSec - startSec);
    const elapsedSec = clamp(secondOfDay - startSec, 0, totalSec);
    const remainingSec = Math.max(0, endSec - secondOfDay);
    return {
      code,
      elapsedRatio: clamp(elapsedSec / totalSec, 0, 1),
      remainingSec
    };
  }

  function shanghaiNow() {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Shanghai',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const map = {};
    formatter.formatToParts(new Date()).forEach((part) => {
      map[part.type] = part.value;
    });
    return {
      hour: Number(map.hour),
      minute: Number(map.minute),
      second: Number(map.second)
    };
  }

  function sessionFromMinute(minute) {
    if (minute >= SESSION_META.asia.startMinute && minute < SESSION_META.asia.endMinute) return 'asia';
    if (minute >= SESSION_META.europe.startMinute && minute < SESSION_META.europe.endMinute) return 'europe';
    return 'us';
  }

  function sessionFromHour(hour) {
    if (hour >= 8 && hour <= 15) return 'asia';
    if (hour >= 16) return 'europe';
    return 'us';
  }

  function transitionTextFor(code) {
    const next = code === 'asia' ? 'Europe Session' : code === 'europe' ? 'US Session' : 'Asia Session';
    return `${SESSION_META[code].label} Ending Soon - Prepare for ${next}`;
  }

  function signalFrom(pUp, confidence) {
    if (pUp >= 0.65 && confidence >= 0.58) return 'STRONG LONG';
    if (pUp >= 0.55) return 'LONG';
    if (pUp <= 0.35 && confidence >= 0.58) return 'STRONG SHORT';
    if (pUp <= 0.45) return 'SHORT';
    if (pUp <= 0.52 && pUp >= 0.48) return 'WAIT';
    return 'FLAT';
  }

  function signalMatch(signal, filter) {
    const normalized = String(signal || '').toLowerCase();
    if (filter === 'strong-long') return normalized === 'strong long';
    if (filter === 'long') return normalized === 'long' || normalized === 'strong long';
    if (filter === 'flat') return normalized === 'flat' || normalized === 'wait';
    if (filter === 'short') return normalized.includes('short');
    return true;
  }

  function compareHourly(left, right, key, dir) {
    const factor = dir === 'asc' ? 1 : -1;
    if (key === 'signal') return factor * String(left.signal).localeCompare(String(right.signal));
    let leftValue;
    let rightValue;
    if (key === 'hour') {
      leftValue = left.hour;
      rightValue = right.hour;
    } else if (key === 'session') {
      leftValue = SESSION_ORDER.indexOf(left.sessionCode);
      rightValue = SESSION_ORDER.indexOf(right.sessionCode);
    } else if (key === 'pUp') {
      leftValue = left.pUp;
      rightValue = right.pUp;
    } else if (key === 'q10') {
      leftValue = left.q10;
      rightValue = right.q10;
    } else if (key === 'q50') {
      leftValue = left.q50;
      rightValue = right.q50;
    } else if (key === 'q90') {
      leftValue = left.q90;
      rightValue = right.q90;
    } else if (key === 'volatility') {
      leftValue = left.volatilityForecast;
      rightValue = right.volatilityForecast;
    } else {
      leftValue = left.pUp;
      rightValue = right.pUp;
    }
    return factor * ((leftValue > rightValue) - (leftValue < rightValue));
  }

  function sparklineSvg(points) {
    if (!Array.isArray(points) || points.length < 2) return '--';
    const width = 96;
    const height = 28;
    const padding = 2;
    const minValue = Math.min(...points);
    const maxValue = Math.max(...points);
    const span = maxValue - minValue || 1;
    const coords = points.map((value, index) => {
      const x = padding + (index / (points.length - 1)) * (width - padding * 2);
      const y = height - padding - ((value - minValue) / span) * (height - padding * 2);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    }).join(' ');
    return `<svg class="sparkline-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"><polyline class="sparkline-line" points="${coords}"></polyline></svg>`;
  }

  function normalizeSparkline(values, anchor) {
    if (Array.isArray(values) && values.length >= 2) {
      return values
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value))
        .slice(-8);
    }
    const base = Number.isFinite(anchor) ? Number(anchor) : 0;
    if (!base) return [];
    return [base * 0.998, base * 1.001, base * 1.002, base * 1.003].map((value) => Number(value.toFixed(2)));
  }

  function normalizeFeatureName(value) {
    return String(value || '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase())
      .trim() || 'Unknown';
  }

  function healthRecommendation(status, driftAlerts) {
    if (status === 'NO_GO' || driftAlerts >= 8) {
      return 'Retraining recommended immediately. Estimated improvement: +6% to +10% direction accuracy.';
    }
    if (status === 'DRIFT_DETECTED' || driftAlerts >= 4) {
      return 'Retraining recommended within 24h. Estimated improvement: +4% to +8% direction accuracy.';
    }
    if (status === 'IN_REVIEW' || driftAlerts >= 2) {
      return 'Run focused recalibration on volatility features. Estimated improvement: +2% to +5%.';
    }
    return 'Model health is stable. Continue monitoring and retrain on scheduled cycle.';
  }

  function confidenceAdjusted(confidence, volatilityPct) {
    const penalty = clamp((volatilityPct - 1.2) * 0.07, 0, 0.22);
    return clamp(confidence - penalty, 0.05, 0.99);
  }

  function heatColor(score) {
    const intensity = Math.min(1, Math.max(0.2, Math.abs(score)));
    if (Math.abs(score) < 0.12) return `rgba(245,158,11,${0.28 + intensity * 0.2})`;
    if (score > 0) return `rgba(0,255,136,${0.18 + intensity * 0.45})`;
    return `rgba(255,77,79,${0.18 + intensity * 0.45})`;
  }

  function heatCell(className, text) {
    const node = document.createElement('div');
    node.className = className;
    node.textContent = text;
    return node;
  }

  function riskScore(level) {
    if (level === 'LOW') return 0.85;
    if (level === 'MEDIUM') return 0;
    return -0.85;
  }

  function riskClass(level) {
    if (level === 'HIGH') return 'danger';
    if (level === 'MEDIUM') return 'warning';
    return 'success';
  }

  function signalClass(signal) {
    const normalized = String(signal || '').toLowerCase();
    if (normalized.includes('long')) return 'success';
    if (normalized.includes('short')) return 'danger';
    return 'warning';
  }

  function healthClass(status) {
    if (status === 'HEALTHY') return 'success';
    if (status === 'MONITORED') return 'info';
    if (status === 'DRIFT_DETECTED') return 'warning';
    if (status === 'NO_GO' || status === 'IN_REVIEW') return 'danger';
    return 'warning';
  }

  function statusClass(status) {
    if (status === 'ACTIVE') return 'success';
    if (status === 'COMPLETED') return 'info';
    if (status === 'PENDING') return 'warning';
    return 'danger';
  }

  function badge(node, className, text) {
    node.className = `status-badge ${className}`;
    node.textContent = text;
  }

  function normAction(value) {
    const text = String(value || '').toUpperCase().trim();
    if (text.includes('STRONG LONG')) return 'STRONG LONG';
    if (text.includes('LONG')) return 'LONG';
    if (text.includes('STRONG SHORT')) return 'STRONG SHORT';
    if (text.includes('SHORT')) return 'SHORT';
    if (text.includes('WAIT')) return 'WAIT';
    return 'FLAT';
  }

  function normRisk(value) {
    const text = String(value || '').toUpperCase();
    if (text.includes('HIGH')) return 'HIGH';
    if (text.includes('MEDIUM') || text.includes('MID')) return 'MEDIUM';
    return 'LOW';
  }

  function normHealth(value) {
    const text = String(value || '').toUpperCase();
    if (!text) return 'IN_REVIEW';
    if (text.includes('NO_GO') || text.includes('NO-GO')) return 'NO_GO';
    if (text.includes('DRIFT')) return 'DRIFT_DETECTED';
    if (text.includes('REVIEW')) return 'IN_REVIEW';
    if (text.includes('MONITOR')) return 'MONITORED';
    if (text.includes('HEALTHY') || text.includes('OK')) return 'HEALTHY';
    return 'IN_REVIEW';
  }

  function normOutcome(value) {
    const text = String(value || '').toUpperCase();
    if (text.includes('WIN')) return 'WIN';
    if (text.includes('LOSS')) return 'LOSS';
    return 'BREAKEVEN';
  }

  function normStatus(value) {
    const text = String(value || '').toUpperCase();
    if (text.includes('ACTIVE')) return 'ACTIVE';
    if (text.includes('COMPLETE')) return 'COMPLETED';
    if (text.includes('PENDING')) return 'PENDING';
    return 'PENDING';
  }

  function normSessionCode(value) {
    const text = String(value || '').toLowerCase();
    if (text.includes('asia')) return 'asia';
    if (text.includes('europe')) return 'europe';
    if (text.includes('us')) return 'us';
    return null;
  }

  function parseHour(label) {
    const match = String(label || '').match(/^(\d{1,2})/);
    return match ? Number(match[1]) : 0;
  }

  function fmtPctFromDecimal(value) {
    if (!Number.isFinite(value)) return '--';
    return `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;
  }

  function fmtPct(value) {
    if (!Number.isFinite(value)) return '--';
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
  }

  function fmtRemainingSec(totalSec) {
    if (!Number.isFinite(totalSec) || totalSec < 0) return '--';
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = Math.floor(totalSec % 60);
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }

  function fmtStamp(timestamp) {
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleString('en-US', {
      hour12: false,
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function fmtRatio(value) {
    return Number.isFinite(value) ? value.toFixed(2) : '--';
  }

  function num(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
})();
