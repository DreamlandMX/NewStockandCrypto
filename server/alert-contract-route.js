function buildAlertContract() {
    return {
        route: '/api/alerts',
        status: 'not_implemented',
        storage: 'planned_server_storage',
        current_mode: 'client_local_storage',
        schema: {
            id: 'string',
            symbol: 'BTCUSDT|ETHUSDT|SOLUSDT|...',
            type: 'move_gt_pct_24h',
            thresholdPct: 'number',
            enabled: 'boolean',
            lastTriggeredAt: 'ISO8601|null',
            createdAt: 'ISO8601'
        }
    };
}

function createAlertContractRoute({ sendJson }) {
    return function handleAlertContract(req, res) {
        if (req.method === 'OPTIONS') {
            sendJson(res, 200, { ok: true });
            return;
        }

        const contract = buildAlertContract();

        if (req.method === 'GET') {
            sendJson(res, 501, {
                ...contract,
                message: 'Use localStorage key "crypto_alerts_v1" for this phase.'
            });
            return;
        }

        if (req.method === 'POST') {
            sendJson(res, 501, {
                ...contract,
                expected_request: {
                    symbol: 'BTCUSDT',
                    type: 'move_gt_pct_24h',
                    thresholdPct: 5,
                    enabled: true
                }
            });
            return;
        }

        sendJson(res, 405, { error: 'Method not allowed' });
    };
}

module.exports = {
    buildAlertContract,
    createAlertContractRoute
};
