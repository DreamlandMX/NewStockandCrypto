const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function nowIso() {
    return new Date().toISOString();
}

function clampQuantity(value, fallback = 0) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return fallback;
    }
    return numeric;
}

function clampLimit(value, fallback = 100) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return fallback;
    }
    return Math.min(Math.floor(numeric), 500);
}

function normalizeSide(value) {
    const normalized = String(value || '').trim().toLowerCase();
    if (normalized === 'long' || normalized === 'short') {
        return normalized;
    }
    return 'long';
}

function normalizeMarket(value) {
    const normalized = String(value || '').trim();
    return normalized || 'Crypto';
}

function computeUnrealizedPnl(side, entryPrice, currentPrice, quantity) {
    if (side === 'short') {
        return (entryPrice - currentPrice) * quantity;
    }
    return (currentPrice - entryPrice) * quantity;
}

function mapPositionRow(row) {
    if (!row) {
        return null;
    }

    const entryPrice = Number(row.entry_price) || 0;
    const currentPrice = Number(row.current_price) || entryPrice;
    const remainingQty = Number(row.remaining_qty) || 0;
    const currentValue = row.status === 'open' ? currentPrice * remainingQty : 0;
    const activeCostBasis = entryPrice * remainingQty;
    const unrealizedPnl = row.status === 'open'
        ? computeUnrealizedPnl(row.side, entryPrice, currentPrice, remainingQty)
        : 0;
    const unrealizedPnlPct = activeCostBasis > 0 ? (unrealizedPnl / activeCostBasis) * 100 : 0;

    return {
        id: String(row.id),
        user_id: row.user_id,
        symbol: row.symbol,
        market: row.market,
        side: row.side,
        entry_price: entryPrice,
        current_price: currentPrice,
        quantity: Number(row.quantity) || 0,
        remaining_qty: remainingQty,
        cost_basis: Number(row.cost_basis) || entryPrice * (Number(row.quantity) || 0),
        current_value: currentValue,
        realized_pnl: Number(row.realized_pnl) || 0,
        unrealized_pnl: unrealizedPnl,
        unrealized_pnl_pct: unrealizedPnlPct,
        notes: row.notes || '',
        engine_version: row.engine_version || null,
        entry_policy_packet_json: row.entry_policy_packet_json || null,
        entry_policy_packet: row.entry_policy_packet_json ? safeJsonParse(row.entry_policy_packet_json) : null,
        entry_expected_net_edge_pct: row.entry_expected_net_edge_pct === null || row.entry_expected_net_edge_pct === undefined ? null : Number(row.entry_expected_net_edge_pct),
        entry_trade_quality_score: row.entry_trade_quality_score === null || row.entry_trade_quality_score === undefined ? null : Number(row.entry_trade_quality_score),
        entry_trade_quality_band: row.entry_trade_quality_band || null,
        entry_regime: row.entry_regime || null,
        entry_cost_pct: row.entry_cost_pct === null || row.entry_cost_pct === undefined ? null : Number(row.entry_cost_pct),
        status: row.status || 'open',
        opened_at: row.opened_at,
        closed_at: row.closed_at,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
}

function safeJsonParse(value) {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch (_) {
        return null;
    }
}

function mapStopOrderRow(row) {
    if (!row) {
        return null;
    }

    return {
        id: String(row.id),
        user_id: row.user_id,
        position_id: String(row.position_id),
        order_type: row.order_type,
        trigger_price: Number(row.trigger_price) || 0,
        trigger_type: row.trigger_type || 'price',
        trail_percent: row.trail_percent === null || row.trail_percent === undefined ? null : Number(row.trail_percent),
        highest_price: row.highest_price === null || row.highest_price === undefined ? null : Number(row.highest_price),
        lowest_price: row.lowest_price === null || row.lowest_price === undefined ? null : Number(row.lowest_price),
        quantity: Number(row.quantity) || 0,
        status: row.status || 'active',
        created_at: row.created_at,
        updated_at: row.updated_at,
        positions: row.position_id ? {
            id: String(row.position_id),
            symbol: row.symbol || null,
            side: row.side || null,
            current_price: row.position_current_price === null || row.position_current_price === undefined ? null : Number(row.position_current_price),
            remaining_qty: row.position_remaining_qty === null || row.position_remaining_qty === undefined ? null : Number(row.position_remaining_qty)
        } : null
    };
}

function createPositionsStore(options = {}) {
    const baseDir = options.baseDir || process.cwd();
    const dataDir = path.join(baseDir, 'data');
    const dbPath = path.join(dataDir, 'stockandcrypto.db');
    fs.mkdirSync(dataDir, { recursive: true });

    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    db.exec(`
        CREATE TABLE IF NOT EXISTS positions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            symbol TEXT NOT NULL,
            market TEXT NOT NULL DEFAULT 'Crypto',
            side TEXT NOT NULL DEFAULT 'long',
            entry_price REAL NOT NULL,
            current_price REAL NOT NULL,
            quantity REAL NOT NULL,
            remaining_qty REAL NOT NULL,
            cost_basis REAL NOT NULL,
            current_value REAL NOT NULL DEFAULT 0,
            realized_pnl REAL NOT NULL DEFAULT 0,
            notes TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'open',
            opened_at TEXT NOT NULL,
            closed_at TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS position_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            position_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            previous_qty REAL,
            new_qty REAL,
            price REAL NOT NULL,
            quantity REAL NOT NULL,
            realized_pnl REAL NOT NULL DEFAULT 0,
            reason TEXT NOT NULL DEFAULT 'manual',
            created_at TEXT NOT NULL,
            FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS stop_orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            position_id INTEGER NOT NULL,
            order_type TEXT NOT NULL,
            trigger_price REAL NOT NULL,
            trigger_type TEXT NOT NULL DEFAULT 'price',
            trail_percent REAL,
            highest_price REAL,
            lowest_price REAL,
            quantity REAL NOT NULL,
            status TEXT NOT NULL DEFAULT 'active',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_positions_user_status ON positions(user_id, status);
        CREATE INDEX IF NOT EXISTS idx_positions_opened_at ON positions(opened_at DESC);
        CREATE INDEX IF NOT EXISTS idx_position_history_position ON position_history(position_id);
        CREATE INDEX IF NOT EXISTS idx_stop_orders_user_status ON stop_orders(user_id, status);
    `);

    function ensureColumn(table, column, definition) {
        const columns = db.prepare(`PRAGMA table_info(${table})`).all();
        if (columns.some((item) => item.name === column)) {
            return;
        }
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }

    ensureColumn('positions', 'engine_version', 'TEXT');
    ensureColumn('positions', 'entry_policy_packet_json', 'TEXT');
    ensureColumn('positions', 'entry_expected_net_edge_pct', 'REAL');
    ensureColumn('positions', 'entry_trade_quality_score', 'REAL');
    ensureColumn('positions', 'entry_trade_quality_band', 'TEXT');
    ensureColumn('positions', 'entry_regime', 'TEXT');
    ensureColumn('positions', 'entry_cost_pct', 'REAL');
    ensureColumn('position_history', 'policy_snapshot_json', 'TEXT');
    ensureColumn('position_history', 'realized_slippage_pct', 'REAL');
    ensureColumn('position_history', 'realized_vs_expected_edge_pct', 'REAL');
    ensureColumn('position_history', 'exit_regime', 'TEXT');

    const getPositionStmt = db.prepare(`
        SELECT *
        FROM positions
        WHERE id = ? AND user_id = ?
        LIMIT 1
    `);

    const listPositionsStmt = db.prepare(`
        SELECT *
        FROM positions
        WHERE user_id = @user_id
          AND (@status IS NULL OR status = @status)
        ORDER BY
            CASE WHEN status = 'open' THEN opened_at ELSE COALESCE(closed_at, updated_at) END DESC
        LIMIT @limit
    `);

    const insertPositionStmt = db.prepare(`
        INSERT INTO positions (
            user_id,
            symbol,
            market,
            side,
            entry_price,
            current_price,
            quantity,
            remaining_qty,
            cost_basis,
            current_value,
            realized_pnl,
            notes,
            engine_version,
            entry_policy_packet_json,
            entry_expected_net_edge_pct,
            entry_trade_quality_score,
            entry_trade_quality_band,
            entry_regime,
            entry_cost_pct,
            status,
            opened_at,
            closed_at,
            created_at,
            updated_at
        ) VALUES (
            @user_id,
            @symbol,
            @market,
            @side,
            @entry_price,
            @current_price,
            @quantity,
            @remaining_qty,
            @cost_basis,
            @current_value,
            @realized_pnl,
            @notes,
            @engine_version,
            @entry_policy_packet_json,
            @entry_expected_net_edge_pct,
            @entry_trade_quality_score,
            @entry_trade_quality_band,
            @entry_regime,
            @entry_cost_pct,
            @status,
            @opened_at,
            @closed_at,
            @created_at,
            @updated_at
        )
    `);

    const insertHistoryStmt = db.prepare(`
        INSERT INTO position_history (
            position_id,
            action,
            previous_qty,
            new_qty,
            price,
            quantity,
            realized_pnl,
            policy_snapshot_json,
            realized_slippage_pct,
            realized_vs_expected_edge_pct,
            exit_regime,
            reason,
            created_at
        ) VALUES (
            @position_id,
            @action,
            @previous_qty,
            @new_qty,
            @price,
            @quantity,
            @realized_pnl,
            @policy_snapshot_json,
            @realized_slippage_pct,
            @realized_vs_expected_edge_pct,
            @exit_regime,
            @reason,
            @created_at
        )
    `);

    const updatePositionStmt = db.prepare(`
        UPDATE positions
        SET current_price = @current_price,
            remaining_qty = @remaining_qty,
            current_value = @current_value,
            realized_pnl = @realized_pnl,
            status = @status,
            closed_at = @closed_at,
            updated_at = @updated_at
        WHERE id = @id AND user_id = @user_id
    `);

    const listStopOrdersStmt = db.prepare(`
        SELECT
            stop_orders.*, 
            positions.symbol,
            positions.side,
            positions.current_price AS position_current_price,
            positions.remaining_qty AS position_remaining_qty
        FROM stop_orders
        LEFT JOIN positions ON positions.id = stop_orders.position_id
        WHERE stop_orders.user_id = @user_id
          AND (@status IS NULL OR stop_orders.status = @status)
        ORDER BY stop_orders.created_at DESC
    `);

    const insertStopOrderStmt = db.prepare(`
        INSERT INTO stop_orders (
            user_id,
            position_id,
            order_type,
            trigger_price,
            trigger_type,
            trail_percent,
            highest_price,
            lowest_price,
            quantity,
            status,
            created_at,
            updated_at
        ) VALUES (
            @user_id,
            @position_id,
            @order_type,
            @trigger_price,
            @trigger_type,
            @trail_percent,
            @highest_price,
            @lowest_price,
            @quantity,
            @status,
            @created_at,
            @updated_at
        )
    `);

    const getStopOrderStmt = db.prepare(`
        SELECT *
        FROM stop_orders
        WHERE id = ? AND user_id = ?
        LIMIT 1
    `);

    const cancelStopOrderStmt = db.prepare(`
        UPDATE stop_orders
        SET status = 'cancelled', updated_at = ?
        WHERE id = ? AND user_id = ?
    `);

    const cancelPositionStopOrdersStmt = db.prepare(`
        UPDATE stop_orders
        SET status = 'cancelled', updated_at = ?
        WHERE position_id = ? AND user_id = ? AND status = 'active'
    `);

    const listPositionHistoryStmt = db.prepare(`
        SELECT *
        FROM position_history
        WHERE position_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `);

    function normalizeCreatePayload(payload = {}) {
        const symbol = String(payload.symbol || '').trim().toUpperCase();
        const market = normalizeMarket(payload.market);
        const side = normalizeSide(payload.side);
        const entryPrice = Number(payload.entry_price);
        const quantity = Number(payload.quantity);
        const notes = String(payload.notes || '').trim();
        const policyPacket = payload.policy_packet && typeof payload.policy_packet === 'object' ? payload.policy_packet : null;

        if (!symbol) {
            throw new Error('Symbol is required.');
        }
        if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
            throw new Error('Entry price must be greater than zero.');
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error('Quantity must be greater than zero.');
        }

        return { symbol, market, side, entryPrice, quantity, notes, policyPacket };
    }

    function listPositions(userId, options = {}) {
        const rows = listPositionsStmt.all({
            user_id: userId,
            status: options.status ? String(options.status) : null,
            limit: clampLimit(options.limit, 200)
        });
        return rows.map(mapPositionRow);
    }

    function getPosition(userId, positionId) {
        return mapPositionRow(getPositionStmt.get(positionId, userId));
    }

    function createPosition(userId, payload = {}) {
        const normalized = normalizeCreatePayload(payload);
        const timestamp = nowIso();
        const record = {
            user_id: userId,
            symbol: normalized.symbol,
            market: normalized.market,
            side: normalized.side,
            entry_price: normalized.entryPrice,
            current_price: normalized.entryPrice,
            quantity: normalized.quantity,
            remaining_qty: normalized.quantity,
            cost_basis: normalized.entryPrice * normalized.quantity,
            current_value: normalized.entryPrice * normalized.quantity,
            realized_pnl: 0,
            notes: normalized.notes,
            engine_version: normalized.policyPacket?.engineVersion || null,
            entry_policy_packet_json: normalized.policyPacket ? JSON.stringify(normalized.policyPacket) : null,
            entry_expected_net_edge_pct: normalized.policyPacket?.expectedNetEdgePct ?? null,
            entry_trade_quality_score: normalized.policyPacket?.tradeQualityScore ?? null,
            entry_trade_quality_band: normalized.policyPacket?.tradeQualityBand ?? null,
            entry_regime: normalized.policyPacket?.regime ?? null,
            entry_cost_pct: normalized.policyPacket?.costPct ?? null,
            status: 'open',
            opened_at: timestamp,
            closed_at: null,
            created_at: timestamp,
            updated_at: timestamp
        };

        const transaction = db.transaction(() => {
            const result = insertPositionStmt.run(record);
            insertHistoryStmt.run({
                position_id: result.lastInsertRowid,
                action: 'open',
                previous_qty: null,
                new_qty: normalized.quantity,
                price: normalized.entryPrice,
                quantity: normalized.quantity,
                realized_pnl: 0,
                policy_snapshot_json: normalized.policyPacket ? JSON.stringify(normalized.policyPacket) : null,
                realized_slippage_pct: null,
                realized_vs_expected_edge_pct: null,
                exit_regime: null,
                reason: 'manual',
                created_at: timestamp
            });
            return Number(result.lastInsertRowid);
        });

        const positionId = transaction();
        return getPosition(userId, positionId);
    }

    function closePosition(userId, positionId, payload = {}) {
        const position = getPosition(userId, positionId);
        if (!position) {
            return null;
        }
        if (position.status !== 'open') {
            throw new Error('Position is already closed.');
        }

        const closePrice = Number(payload.price);
        if (!Number.isFinite(closePrice) || closePrice <= 0) {
            throw new Error('Close price must be greater than zero.');
        }

        const requestedQty = clampQuantity(payload.quantity, position.remaining_qty);
        const quantity = Math.min(requestedQty, position.remaining_qty);
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new Error('Quantity must be greater than zero.');
        }

        const timestamp = nowIso();
        const realizedPnl = computeUnrealizedPnl(position.side, position.entry_price, closePrice, quantity);
        const remainingQty = Math.max(0, position.remaining_qty - quantity);
        const isClosed = remainingQty <= 0.00000001;
        const nextStatus = isClosed ? 'closed' : 'open';
        const nextClosedAt = isClosed ? timestamp : null;
        const currentValue = isClosed ? 0 : closePrice * remainingQty;
        const totalRealizedPnl = (Number(position.realized_pnl) || 0) + realizedPnl;
        const entryPacket = position.entry_policy_packet || null;
        const realizedPnlPct = position.entry_price > 0 ? (closePrice - position.entry_price) / position.entry_price * 100 * (position.side === 'short' ? -1 : 1) : null;
        const realizedVsExpectedEdgePct = Number.isFinite(realizedPnlPct) && Number.isFinite(position.entry_expected_net_edge_pct)
            ? realizedPnlPct - Number(position.entry_expected_net_edge_pct)
            : null;

        const transaction = db.transaction(() => {
            updatePositionStmt.run({
                id: positionId,
                user_id: userId,
                current_price: closePrice,
                remaining_qty: remainingQty,
                current_value: currentValue,
                realized_pnl: totalRealizedPnl,
                status: nextStatus,
                closed_at: nextClosedAt,
                updated_at: timestamp
            });

            insertHistoryStmt.run({
                position_id: positionId,
                action: isClosed ? 'close' : 'reduce',
                previous_qty: position.remaining_qty,
                new_qty: remainingQty,
                price: closePrice,
                quantity,
                realized_pnl: realizedPnl,
                policy_snapshot_json: entryPacket ? JSON.stringify(entryPacket) : null,
                realized_slippage_pct: Number.isFinite(payload.realized_slippage_pct) ? Number(payload.realized_slippage_pct) : null,
                realized_vs_expected_edge_pct: Number.isFinite(realizedVsExpectedEdgePct) ? realizedVsExpectedEdgePct : null,
                exit_regime: payload.exit_regime ? String(payload.exit_regime) : null,
                reason: String(payload.reason || 'manual'),
                created_at: timestamp
            });

            if (isClosed) {
                cancelPositionStopOrdersStmt.run(timestamp, positionId, userId);
            }
        });

        transaction();
        return {
            position: getPosition(userId, positionId),
            realizedPnl,
            realizedVsExpectedEdgePct,
            isClosed
        };
    }

    function listPositionHistory(userId, positionId, limit = 100) {
        const position = getPosition(userId, positionId);
        if (!position) {
            return null;
        }
        return listPositionHistoryStmt.all(positionId, clampLimit(limit, 100)).map((row) => ({
            id: String(row.id),
            position_id: String(row.position_id),
            action: row.action,
            previous_qty: row.previous_qty,
            new_qty: row.new_qty,
            price: row.price,
            quantity: row.quantity,
            realized_pnl: row.realized_pnl,
            policy_snapshot_json: row.policy_snapshot_json || null,
            policy_snapshot: row.policy_snapshot_json ? safeJsonParse(row.policy_snapshot_json) : null,
            realized_slippage_pct: row.realized_slippage_pct === null || row.realized_slippage_pct === undefined ? null : Number(row.realized_slippage_pct),
            realized_vs_expected_edge_pct: row.realized_vs_expected_edge_pct === null || row.realized_vs_expected_edge_pct === undefined ? null : Number(row.realized_vs_expected_edge_pct),
            exit_regime: row.exit_regime || null,
            reason: row.reason,
            created_at: row.created_at
        }));
    }

    function listStopOrders(userId, options = {}) {
        const rows = listStopOrdersStmt.all({
            user_id: userId,
            status: options.status ? String(options.status) : null
        });
        return rows.map(mapStopOrderRow);
    }

    function createStopOrder(userId, payload = {}) {
        const position = getPosition(userId, payload.position_id);
        if (!position) {
            throw new Error('Position not found.');
        }
        if (position.status !== 'open') {
            throw new Error('Cannot create stop order for a closed position.');
        }

        const triggerPrice = Number(payload.trigger_price);
        if (!Number.isFinite(triggerPrice) || triggerPrice <= 0) {
            throw new Error('Trigger price must be greater than zero.');
        }

        const quantity = clampQuantity(payload.quantity, position.remaining_qty);
        const timestamp = nowIso();
        const result = insertStopOrderStmt.run({
            user_id: userId,
            position_id: Number(payload.position_id),
            order_type: String(payload.order_type || 'stop_loss'),
            trigger_price: triggerPrice,
            trigger_type: String(payload.trigger_type || 'price'),
            trail_percent: payload.trail_percent === null || payload.trail_percent === undefined ? null : Number(payload.trail_percent),
            highest_price: payload.highest_price === null || payload.highest_price === undefined ? null : Number(payload.highest_price),
            lowest_price: payload.lowest_price === null || payload.lowest_price === undefined ? null : Number(payload.lowest_price),
            quantity,
            status: 'active',
            created_at: timestamp,
            updated_at: timestamp
        });

        const created = getStopOrderStmt.get(result.lastInsertRowid, userId);
        return mapStopOrderRow({ ...created, symbol: position.symbol, side: position.side, position_current_price: position.current_price, position_remaining_qty: position.remaining_qty });
    }

    function cancelStopOrder(userId, stopOrderId) {
        const order = getStopOrderStmt.get(stopOrderId, userId);
        if (!order) {
            return false;
        }
        cancelStopOrderStmt.run(nowIso(), stopOrderId, userId);
        return true;
    }

    return {
        listPositions,
        getPosition,
        createPosition,
        closePosition,
        listPositionHistory,
        listStopOrders,
        createStopOrder,
        cancelStopOrder
    };
}

module.exports = {
    createPositionsStore
};
