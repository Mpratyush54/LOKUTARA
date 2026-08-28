// ─── Socket Emit Helper ──────────────────────────────────────────
// Centralizes all socket emissions with consistent payloads.
// Every event includes `tags[]` and `_ts` for frontend multi-tag filtering.

/**
 * Build tag-based Socket.IO room names from a tags array.
 * @param {string[]} tags
 * @returns {string[]} e.g. ['tag:javascript', 'tag:react']
 */
function buildTagRooms(tags) {
    if (!Array.isArray(tags)) return [];
    return tags.filter(t => typeof t === 'string' && t.length > 0).map(t => `tag:${t}`);
}

/**
 * Emit a socket event to one or more rooms with a standardized payload.
 *
 * @param {import('socket.io').Server} io   - Socket.IO server instance
 * @param {Object}  opts
 * @param {string[]} opts.rooms             - Room names to target (union)
 * @param {string}   opts.event             - Event name, e.g. 'new_question'
 * @param {Object}   opts.data              - Event payload (entity data)
 * @param {string[]} [opts.tags]            - Tags array (auto-merged into payload)
 */
function emitToRooms(io, { rooms, event, data, tags }) {
    if (!io || !rooms || rooms.length === 0) return;

    let emitter = null;
    for (const room of rooms) {
        emitter = emitter ? emitter.to(room) : io.to(room);
    }

    if (emitter) {
        emitter.emit(event, {
            ...data,
            tags: Array.isArray(tags) ? tags : (data.tags || []),
            _ts: Date.now(),
        });
    }
}

module.exports = { emitToRooms, buildTagRooms };
