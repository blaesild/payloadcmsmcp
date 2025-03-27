"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeSqlQuery = executeSqlQuery;
const validator_1 = require("./validator");
/**
 * Execute a SQL-like query against the validation rules
 * @param sql The SQL-like query to execute
 * @returns The query results
 */
function executeSqlQuery(sql) {
    // Parse the SQL query
    const query = parseQuery(sql);
    // Execute the query
    if (query.type === 'SELECT') {
        return executeSelectQuery(query);
    }
    else if (query.type === 'DESCRIBE') {
        return executeDescribeQuery(query);
    }
    else {
        throw new Error(`Unsupported query type: ${query.type}`);
    }
}
/**
 * Parse a SQL-like query
 * @param sql The SQL-like query to parse
 * @returns The parsed query
 */
function parseQuery(sql) {
    // Simple SQL parser for SELECT and DESCRIBE queries
    const trimmedSql = sql.trim();
    if (trimmedSql.toUpperCase().startsWith('SELECT')) {
        // Parse SELECT query
        const match = trimmedSql.match(/SELECT\s+(.*?)\s+FROM\s+(.*?)(?:\s+WHERE\s+(.*?))?(?:\s+ORDER\s+BY\s+(.*?))?(?:\s+LIMIT\s+(\d+))?$/i);
        if (!match) {
            throw new Error('Invalid SELECT query format');
        }
        const [, columns, table, whereClause, orderByClause, limitClause] = match;
        return {
            type: 'SELECT',
            columns: columns.split(',').map(col => col.trim()),
            table: table.trim(),
            where: whereClause ? parseWhereClause(whereClause) : null,
            orderBy: orderByClause ? parseOrderByClause(orderByClause) : null,
            limit: limitClause ? parseInt(limitClause, 10) : null,
        };
    }
    else if (trimmedSql.toUpperCase().startsWith('DESCRIBE')) {
        // Parse DESCRIBE query
        const match = trimmedSql.match(/DESCRIBE\s+(.*?)$/i);
        if (!match) {
            throw new Error('Invalid DESCRIBE query format');
        }
        const [, table] = match;
        return {
            type: 'DESCRIBE',
            table: table.trim(),
        };
    }
    else {
        throw new Error('Unsupported query type. Only SELECT and DESCRIBE are supported.');
    }
}
/**
 * Parse a WHERE clause
 * @param whereClause The WHERE clause to parse
 * @returns The parsed WHERE clause
 */
function parseWhereClause(whereClause) {
    // Simple WHERE clause parser
    // This is a simplified implementation that supports basic conditions
    const conditions = [];
    // Split by AND
    const andParts = whereClause.split(/\s+AND\s+/i);
    andParts.forEach(part => {
        // Check for OR conditions
        const orParts = part.split(/\s+OR\s+/i);
        if (orParts.length > 1) {
            const orConditions = orParts.map(orPart => parseCondition(orPart));
            conditions.push({ type: 'OR', conditions: orConditions });
        }
        else {
            conditions.push(parseCondition(part));
        }
    });
    return conditions.length === 1 ? conditions[0] : { type: 'AND', conditions };
}
/**
 * Parse a single condition
 * @param condition The condition to parse
 * @returns The parsed condition
 */
function parseCondition(condition) {
    // Parse a single condition like "column = value"
    const match = condition.match(/\s*(.*?)\s*(=|!=|>|<|>=|<=|LIKE|IN)\s*(.*)\s*/i);
    if (!match) {
        throw new Error(`Invalid condition format: ${condition}`);
    }
    const [, column, operator, value] = match;
    // Handle IN operator
    if (operator.toUpperCase() === 'IN') {
        const values = value.replace(/^\(|\)$/g, '').split(',').map(v => parseValue(v.trim()));
        return { column: column.trim(), operator: 'IN', value: values };
    }
    // Handle other operators
    return { column: column.trim(), operator, value: parseValue(value.trim()) };
}
/**
 * Parse a value from a condition
 * @param value The value to parse
 * @returns The parsed value
 */
function parseValue(value) {
    // Remove quotes from string values
    if ((value.startsWith("'") && value.endsWith("'")) || (value.startsWith('"') && value.endsWith('"'))) {
        return value.substring(1, value.length - 1);
    }
    // Parse numbers
    if (!isNaN(Number(value))) {
        return Number(value);
    }
    // Handle boolean values
    if (value.toLowerCase() === 'true')
        return true;
    if (value.toLowerCase() === 'false')
        return false;
    // Handle NULL
    if (value.toLowerCase() === 'null')
        return null;
    // Default to string
    return value;
}
/**
 * Parse an ORDER BY clause
 * @param orderByClause The ORDER BY clause to parse
 * @returns The parsed ORDER BY clause
 */
function parseOrderByClause(orderByClause) {
    // Parse ORDER BY clause
    return orderByClause.split(',').map(part => {
        const [column, direction] = part.trim().split(/\s+/);
        return {
            column: column.trim(),
            direction: direction && direction.toUpperCase() === 'DESC' ? 'DESC' : 'ASC',
        };
    });
}
/**
 * Execute a SELECT query
 * @param query The parsed SELECT query
 * @returns The query results
 */
function executeSelectQuery(query) {
    // Get the data source based on the table
    let data = [];
    if (query.table.toLowerCase() === 'validation_rules') {
        data = validator_1.validationRules;
    }
    else {
        throw new Error(`Unknown table: ${query.table}`);
    }
    // Apply WHERE clause if present
    if (query.where) {
        data = data.filter(item => evaluateWhereClause(item, query.where));
    }
    // Apply ORDER BY if present
    if (query.orderBy) {
        data = sortData(data, query.orderBy);
    }
    // Apply LIMIT if present
    if (query.limit !== null) {
        data = data.slice(0, query.limit);
    }
    // Select columns
    const isSelectAll = query.columns.includes('*');
    const rows = data.map(item => {
        if (isSelectAll) {
            return { ...item };
        }
        else {
            const row = {};
            query.columns.forEach((column) => {
                row[column] = item[column];
            });
            return row;
        }
    });
    // Get columns for the result
    const columns = isSelectAll && rows.length > 0
        ? Object.keys(rows[0])
        : query.columns;
    return {
        columns,
        rows,
    };
}
/**
 * Execute a DESCRIBE query
 * @param query The parsed DESCRIBE query
 * @returns The query results
 */
function executeDescribeQuery(query) {
    // Get the data source based on the table
    let data = [];
    if (query.table.toLowerCase() === 'validation_rules') {
        // Get a sample rule to extract columns
        const sampleRule = validator_1.validationRules[0];
        if (!sampleRule) {
            return { columns: [], rows: [] };
        }
        // Create a description of each column
        const columns = ['Field', 'Type', 'Description'];
        const rows = Object.keys(sampleRule).map(key => {
            const value = sampleRule[key];
            let type = typeof value;
            if (Array.isArray(value)) {
                type = 'object';
            }
            else if (value === null) {
                type = 'object';
            }
            return {
                Field: key,
                Type: type,
                Description: `Field ${key} of type ${type}`,
            };
        });
        return { columns, rows };
    }
    else {
        throw new Error(`Unknown table: ${query.table}`);
    }
}
/**
 * Evaluate a WHERE clause against an item
 * @param item The item to evaluate
 * @param whereClause The WHERE clause to evaluate
 * @returns Whether the item matches the WHERE clause
 */
function evaluateWhereClause(item, whereClause) {
    if (whereClause.type === 'AND') {
        return whereClause.conditions.every((condition) => evaluateWhereClause(item, condition));
    }
    else if (whereClause.type === 'OR') {
        return whereClause.conditions.some((condition) => evaluateWhereClause(item, condition));
    }
    else {
        return evaluateCondition(item, whereClause);
    }
}
/**
 * Evaluate a condition against an item
 * @param item The item to evaluate
 * @param condition The condition to evaluate
 * @returns Whether the item matches the condition
 */
function evaluateCondition(item, condition) {
    const { column, operator, value } = condition;
    const itemValue = item[column];
    switch (operator.toUpperCase()) {
        case '=':
            return itemValue === value;
        case '!=':
            return itemValue !== value;
        case '>':
            return itemValue > value;
        case '<':
            return itemValue < value;
        case '>=':
            return itemValue >= value;
        case '<=':
            return itemValue <= value;
        case 'LIKE':
            if (typeof itemValue !== 'string')
                return false;
            // Simple LIKE implementation with % as wildcard
            const pattern = value.replace(/%/g, '.*');
            const regex = new RegExp(`^${pattern}$`, 'i');
            return regex.test(itemValue);
        case 'IN':
            return Array.isArray(value) && value.includes(itemValue);
        default:
            throw new Error(`Unsupported operator: ${operator}`);
    }
}
/**
 * Sort data based on ORDER BY clause
 * @param data The data to sort
 * @param orderBy The ORDER BY clause
 * @returns The sorted data
 */
function sortData(data, orderBy) {
    return [...data].sort((a, b) => {
        for (const { column, direction } of orderBy) {
            if (a[column] < b[column])
                return direction === 'ASC' ? -1 : 1;
            if (a[column] > b[column])
                return direction === 'ASC' ? 1 : -1;
        }
        return 0;
    });
}
