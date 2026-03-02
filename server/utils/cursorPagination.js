/**
 * Cursor-based Pagination Utility
 * 
 * Replaces offset-based pagination for O(1) performance at any page depth.
 * Works by using a composite cursor (createdAt + id) instead of offset.
 * 
 * Usage:
 *   const { buildCursorQuery, formatCursorResponse } = require('./utils/cursorPagination');
 *   
 *   const query = buildCursorQuery(req.query, 'DESC');
 *   const results = await Model.findAll({ ...query, where: { ...existingWhere, ...query.where } });
 *   const response = formatCursorResponse(results, query.limit);
 */
const { Op } = require('sequelize');

/**
 * Build cursor query from request parameters
 * @param {Object} queryParams - req.query object
 * @param {string} sortDirection - 'ASC' or 'DESC' (default: 'DESC')
 * @returns {Object} { where, order, limit }
 */
function buildCursorQuery(queryParams, sortDirection = 'DESC') {
    const {
        cursor,        // Base64 encoded cursor from previous response
        pageSize = 50, // Items per page
        // Keep offset support for backward compatibility
        page,
        limit
    } = queryParams;

    const parsedLimit = Math.min(parseInt(pageSize || limit || 50), 500);

    // If page is provided (backward compat), use offset-based
    if (page && !cursor) {
        const parsedPage = Math.max(1, parseInt(page));
        return {
            offset: (parsedPage - 1) * parsedLimit,
            limit: parsedLimit,
            order: [['createdAt', sortDirection], ['id', sortDirection]],
            where: {},
            isCursor: false
        };
    }

    // Cursor-based pagination
    if (cursor) {
        try {
            const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8'));
            const { createdAt, id } = decoded;

            const cursorWhere = sortDirection === 'DESC'
                ? {
                    [Op.or]: [
                        { createdAt: { [Op.lt]: new Date(createdAt) } },
                        {
                            createdAt: new Date(createdAt),
                            id: { [Op.lt]: id }
                        }
                    ]
                }
                : {
                    [Op.or]: [
                        { createdAt: { [Op.gt]: new Date(createdAt) } },
                        {
                            createdAt: new Date(createdAt),
                            id: { [Op.gt]: id }
                        }
                    ]
                };

            return {
                where: cursorWhere,
                order: [['createdAt', sortDirection], ['id', sortDirection]],
                limit: parsedLimit + 1, // Fetch one extra to know if there's a next page
                isCursor: true
            };
        } catch (e) {
            // Invalid cursor, fall through to default
        }
    }

    // Default: first page with cursor support
    return {
        where: {},
        order: [['createdAt', sortDirection], ['id', sortDirection]],
        limit: parsedLimit + 1, // Fetch one extra to know if there's a next page
        isCursor: true
    };
}

/**
 * Format response with cursor information
 * @param {Array} results - Query results
 * @param {number} requestedLimit - The limit that was used (including +1 extra)
 * @param {number} totalCount - Optional total count (only include if cheap to compute)
 * @returns {Object} { data, pagination }
 */
function formatCursorResponse(results, requestedLimit, totalCount = null) {
    const actualLimit = requestedLimit - 1; // We fetched one extra
    const hasNextPage = results.length > actualLimit;
    const data = hasNextPage ? results.slice(0, actualLimit) : results;

    let nextCursor = null;
    if (hasNextPage && data.length > 0) {
        const lastItem = data[data.length - 1];
        const cursorData = {
            createdAt: lastItem.createdAt,
            id: lastItem.id
        };
        nextCursor = Buffer.from(JSON.stringify(cursorData)).toString('base64');
    }

    const pagination = {
        hasNextPage,
        nextCursor,
        pageSize: actualLimit,
        returnedCount: data.length
    };

    if (totalCount !== null) {
        pagination.totalCount = totalCount;
    }

    return { data, pagination };
}

module.exports = { buildCursorQuery, formatCursorResponse };
