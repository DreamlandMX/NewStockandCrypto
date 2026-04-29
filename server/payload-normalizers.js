function normalizeNotePayload(body = {}) {
    return {
        notebook_id: body.notebook_id ?? body.notebookId ?? null,
        title: body.title,
        content: body.content,
        market: body.market,
        tags: body.tags,
        is_pinned: body.is_pinned,
        is_favorite: body.is_favorite,
        is_public: body.is_public
    };
}

function normalizeNotebookPayload(body = {}) {
    return {
        name: body.name,
        color: body.color,
        icon: body.icon,
        sort_order: body.sort_order ?? body.sortOrder ?? 0
    };
}

function normalizeProfilePayload(body = {}) {
    return {
        username: body.username,
        bio: body.bio,
        website: body.website,
        location: body.location
    };
}

function normalizePositionPayload(body = {}) {
    return {
        symbol: body.symbol,
        market: body.market,
        side: body.side,
        entry_price: body.entry_price,
        quantity: body.quantity,
        notes: body.notes
    };
}

function normalizeStopOrderPayload(body = {}) {
    return {
        position_id: body.position_id,
        order_type: body.order_type,
        trigger_price: body.trigger_price,
        trigger_type: body.trigger_type,
        trail_percent: body.trail_percent,
        highest_price: body.highest_price,
        lowest_price: body.lowest_price,
        quantity: body.quantity
    };
}

function normalizeChatBoardPayload(body = {}) {
    return {
        name: body.name,
        topic: body.topic,
        is_public: body.is_public
    };
}

function normalizeChatMessagePayload(body = {}) {
    return {
        content: body.content,
        reply_to: body.reply_to ?? body.replyTo ?? null,
        attachment_url: body.attachment_url ?? body.attachmentUrl ?? null,
        attachment_type: body.attachment_type ?? body.attachmentType ?? null,
        attachment_name: body.attachment_name ?? body.attachmentName ?? null
    };
}

module.exports = {
    normalizeChatBoardPayload,
    normalizeChatMessagePayload,
    normalizeNotebookPayload,
    normalizeNotePayload,
    normalizePositionPayload,
    normalizeProfilePayload,
    normalizeStopOrderPayload
};
