function translateSectorToEnglish(rawSector) {
    const text = String(rawSector || '').trim();
    if (!text) return 'Other';

    if (/(\u94f6\u884c|bank)/i.test(text)) return 'Banking';
    if (/(\u4fdd\u9669|insurance)/i.test(text)) return 'Insurance';
    if (/(\u767d\u9152|\u98df\u54c1|\u996e\u6599|\u6d88\u8d39|consumer)/i.test(text)) return 'Consumer Staples';
    if (/(\u534a\u5bfc\u4f53|\u7535\u5b50|\u8f6f\u4ef6|\u901a\u4fe1|tech)/i.test(text)) return 'Technology';
    if (/(\u7535\u529b|\u80fd\u6e90|\u7164\u70ad|\u77f3\u6cb9|\u5929\u7136\u6c14|energy)/i.test(text)) return 'Energy';
    if (/(\u533b\u836f|\u533b\u7597|\u751f\u7269|health)/i.test(text)) return 'Healthcare';
    if (/(\u8bc1\u5238|\u91d1\u878d|financial)/i.test(text)) return 'Financials';
    if (/(\u5730\u4ea7|\u623f\u5730\u4ea7|real estate)/i.test(text)) return 'Real Estate';
    if (/(\u6709\u8272|\u94a2\u94c1|\u6750\u6599|\u5316\u5de5|material)/i.test(text)) return 'Materials';
    if (/(\u6c7d\u8f66|\u673a\u68b0|\u5236\u9020|\u519b\u5de5|industrial)/i.test(text)) return 'Industrials';
    if (/(\u5bb6\u7535|\u7eba\u7ec7|\u96f6\u552e|retail|discretionary)/i.test(text)) return 'Consumer Discretionary';
    if (/(\u516c\u7528|utility)/i.test(text)) return 'Utilities';

    return 'Other';
}

function detectBoardType(code) {
    const stockCode = String(code || '');
    if (stockCode.startsWith('688')) return 'STAR';
    if (stockCode.startsWith('300')) return 'CHINEXT';
    return 'MAIN';
}

function detectStFlag(name) {
    return String(name || '').toUpperCase().includes('ST');
}

function resolveLimitPct(boardType, isSt) {
    if (isSt) return 0.05;
    if (boardType === 'STAR' || boardType === 'CHINEXT') return 0.20;
    return 0.10;
}

function computeLimitStatus(changePct, limitPct) {
    if (!Number.isFinite(changePct)) return 'NORMAL';

    const limitUpTrigger = limitPct * 100 - 0.1;
    const limitDownTrigger = -limitPct * 100 + 0.1;
    if (changePct >= limitUpTrigger) return 'LIMIT_UP';
    if (changePct <= limitDownTrigger) return 'LIMIT_DOWN';
    return 'NORMAL';
}

module.exports = {
    computeLimitStatus,
    detectBoardType,
    detectStFlag,
    resolveLimitPct,
    translateSectorToEnglish
};
