"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeSqlQuery = void 0;
exports.queryValidationRules = queryValidationRules;
exports.getValidationRuleById = getValidationRuleById;
exports.getValidationRulesByCategory = getValidationRulesByCategory;
exports.getValidationRulesByFileType = getValidationRulesByFileType;
exports.getCategories = getCategories;
exports.getValidationRulesWithExamples = getValidationRulesWithExamples;
const validator_1 = require("./validator");
/**
 * Query validation rules based on a search term
 * @param query The search query
 * @param fileType Optional file type to filter by
 * @returns Matching validation rules
 */
function queryValidationRules(query, fileType) {
    // Normalize the query
    const normalizedQuery = query.toLowerCase().trim();
    // If the query is empty, return all rules (filtered by fileType if provided)
    if (!normalizedQuery) {
        return fileType
            ? validator_1.validationRules.filter(rule => rule.fileTypes.includes(fileType))
            : validator_1.validationRules;
    }
    // Search for matching rules
    return validator_1.validationRules.filter(rule => {
        // Filter by fileType if provided
        if (fileType && !rule.fileTypes.includes(fileType)) {
            return false;
        }
        // Check if the query matches any of the rule's properties
        return (rule.id.toLowerCase().includes(normalizedQuery) ||
            rule.name.toLowerCase().includes(normalizedQuery) ||
            rule.description.toLowerCase().includes(normalizedQuery) ||
            rule.category.toLowerCase().includes(normalizedQuery));
    });
}
/**
 * Get a validation rule by ID
 * @param id The rule ID
 * @returns The validation rule or undefined if not found
 */
function getValidationRuleById(id) {
    return validator_1.validationRules.find(rule => rule.id === id);
}
/**
 * Get validation rules by category
 * @param category The category to filter by
 * @returns Validation rules in the specified category
 */
function getValidationRulesByCategory(category) {
    return validator_1.validationRules.filter(rule => rule.category === category);
}
/**
 * Get validation rules by file type
 * @param fileType The file type to filter by
 * @returns Validation rules applicable to the specified file type
 */
function getValidationRulesByFileType(fileType) {
    return validator_1.validationRules.filter(rule => rule.fileTypes.includes(fileType));
}
/**
 * Get all available categories
 * @returns Array of unique categories
 */
function getCategories() {
    const categories = new Set();
    validator_1.validationRules.forEach(rule => categories.add(rule.category));
    return Array.from(categories);
}
/**
 * Get validation rules with examples
 * @param query Optional search query
 * @param fileType Optional file type to filter by
 * @returns Validation rules with examples
 */
function getValidationRulesWithExamples(query, fileType) {
    return query ? queryValidationRules(query, fileType) :
        fileType ? getValidationRulesByFileType(fileType) : validator_1.validationRules;
}
/**
 * Execute an SQL-like query against validation rules
 */
const executeSqlQuery = (sqlQuery) => {
    // This is a very simplified SQL parser
    // In a real implementation, you'd use a proper SQL parser
    const selectMatch = sqlQuery.match(/SELECT\s+(.*?)\s+FROM\s+(.*?)(?:\s+WHERE\s+(.*?))?(?:\s+ORDER\s+BY\s+(.*?))?(?:\s+LIMIT\s+(\d+))?$/i);
    if (!selectMatch) {
        throw new Error('Invalid SQL query format');
    }
    const [, selectClause, fromClause, whereClause, orderByClause, limitClause] = selectMatch;
    // Check if we're querying validation_rules
    if (fromClause.trim().toLowerCase() !== 'validation_rules') {
        throw new Error('Only validation_rules table is supported');
    }
    // Process SELECT clause
    const selectAll = selectClause.trim() === '*';
    const selectedFields = selectAll
        ? ['id', 'description', 'type', 'category', 'severity', 'documentation']
        : selectClause.split(',').map(f => f.trim());
    // Process WHERE clause
    let filteredRules = [...validator_1.validationRules];
    if (whereClause) {
        // Very simple WHERE parser that handles basic conditions
        const conditions = whereClause.split(/\s+AND\s+/i);
        filteredRules = filteredRules.filter(rule => {
            return conditions.every(condition => {
                const equalityMatch = condition.match(/(\w+)\s*=\s*['"]?(.*?)['"]?$/i);
                const likeMatch = condition.match(/(\w+)\s+LIKE\s+['"]%(.*?)%['"]/i);
                if (equalityMatch) {
                    const [, field, value] = equalityMatch;
                    return rule[field]?.toString().toLowerCase() === value.toLowerCase();
                }
                else if (likeMatch) {
                    const [, field, value] = likeMatch;
                    return rule[field]?.toString().toLowerCase().includes(value.toLowerCase());
                }
                return true;
            });
        });
    }
    // Process ORDER BY clause
    if (orderByClause) {
        const [field, direction] = orderByClause.split(/\s+/);
        const isDesc = direction?.toUpperCase() === 'DESC';
        filteredRules.sort((a, b) => {
            const aValue = a[field.trim()];
            const bValue = b[field.trim()];
            if (aValue < bValue)
                return isDesc ? 1 : -1;
            if (aValue > bValue)
                return isDesc ? -1 : 1;
            return 0;
        });
    }
    // Process LIMIT clause
    if (limitClause) {
        filteredRules = filteredRules.slice(0, parseInt(limitClause, 10));
    }
    // Project selected fields
    return filteredRules.map(rule => {
        const result = {};
        selectedFields.forEach(field => {
            result[field] = rule[field];
        });
        return result;
    });
};
exports.executeSqlQuery = executeSqlQuery;
