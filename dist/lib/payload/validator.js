"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validatePayloadCode = exports.validateConfig = exports.validateGlobal = exports.validateField = exports.validateCollection = exports.validationRules = void 0;
const schemas_1 = require("./schemas");
const zod_1 = require("zod");
// Define validation rules that can be queried
exports.validationRules = [
    {
        id: 'naming-conventions',
        name: 'Naming Conventions',
        description: 'Names should follow consistent conventions (camelCase or snake_case)',
        category: 'best-practices',
        fileTypes: ['collection', 'field', 'global', 'config'],
        examples: {
            valid: ['myField', 'my_field'],
            invalid: ['my field', 'my-field', 'my_Field']
        }
    },
    {
        id: 'reserved-words',
        name: 'Reserved Words',
        description: 'Avoid using JavaScript reserved words for names',
        category: 'best-practices',
        fileTypes: ['collection', 'field', 'global', 'config'],
        examples: {
            valid: ['title', 'content', 'author'],
            invalid: ['constructor', 'prototype', '__proto__']
        }
    },
    {
        id: 'access-control',
        name: 'Access Control',
        description: 'Define access control for collections and fields',
        category: 'security',
        fileTypes: ['collection', 'field', 'global'],
        examples: {
            valid: ['access: { read: () => true, update: () => true }'],
            invalid: ['// No access control defined']
        }
    },
    {
        id: 'sensitive-fields',
        name: 'Sensitive Fields Protection',
        description: 'Sensitive fields should have explicit read access control',
        category: 'security',
        fileTypes: ['field'],
        examples: {
            valid: ['{ name: "password", type: "text", access: { read: () => false } }'],
            invalid: ['{ name: "password", type: "text" }']
        }
    },
    {
        id: 'indexed-fields',
        name: 'Indexed Fields',
        description: 'Fields used for searching or filtering should be indexed',
        category: 'performance',
        fileTypes: ['field'],
        examples: {
            valid: ['{ name: "email", type: "email", index: true }'],
            invalid: ['{ name: "email", type: "email" }']
        }
    },
    {
        id: 'relationship-depth',
        name: 'Relationship Depth',
        description: 'Relationship fields should have a maxDepth to prevent deep queries',
        category: 'performance',
        fileTypes: ['field'],
        examples: {
            valid: ['{ type: "relationship", relationTo: "posts", maxDepth: 1 }'],
            invalid: ['{ type: "relationship", relationTo: "posts" }']
        }
    },
    {
        id: 'field-validation',
        name: 'Field Validation',
        description: 'Required fields should have validation',
        category: 'data-integrity',
        fileTypes: ['field'],
        examples: {
            valid: ['{ name: "title", type: "text", required: true, validate: (value) => value ? true : "Required" }'],
            invalid: ['{ name: "title", type: "text", required: true }']
        }
    },
    {
        id: 'timestamps',
        name: 'Timestamps',
        description: 'Collections should have timestamps enabled',
        category: 'best-practices',
        fileTypes: ['collection'],
        examples: {
            valid: ['{ slug: "posts", timestamps: true }'],
            invalid: ['{ slug: "posts" }']
        }
    },
    {
        id: 'admin-ui',
        name: 'Admin UI Configuration',
        description: 'Collections should specify which field to use as title in admin UI',
        category: 'usability',
        fileTypes: ['collection'],
        examples: {
            valid: ['{ admin: { useAsTitle: "title" } }'],
            invalid: ['{ admin: {} }']
        }
    }
];
// Common validation rules
const commonValidationRules = {
    namingConventions: (name) => {
        const errors = [];
        if (name.includes(' ')) {
            errors.push(`Name "${name}" should not contain spaces. Use camelCase or snake_case instead.`);
        }
        if (name.match(/[A-Z]/) && name.match(/_/)) {
            errors.push(`Name "${name}" mixes camelCase and snake_case. Choose one convention.`);
        }
        return errors;
    },
    reservedWords: (name) => {
        const reserved = ['constructor', 'prototype', '__proto__', 'toString', 'toJSON', 'valueOf'];
        return reserved.includes(name)
            ? [`Name "${name}" is a reserved JavaScript word and should be avoided.`]
            : [];
    }
};
// Security validation rules
const securityValidationRules = {
    accessControl: (obj) => {
        const warnings = [];
        if (!obj.access) {
            warnings.push('No access control defined. This might expose data to unauthorized users.');
        }
        return warnings;
    },
    authFields: (fields) => {
        const warnings = [];
        const sensitiveFields = fields.filter(f => f.name?.toLowerCase().includes('password') ||
            f.name?.toLowerCase().includes('token') ||
            f.name?.toLowerCase().includes('secret'));
        for (const field of sensitiveFields) {
            if (!field.access || !field.access.read) {
                warnings.push(`Sensitive field "${field.name}" should have explicit read access control.`);
            }
        }
        return warnings;
    }
};
// Performance validation rules
const performanceValidationRules = {
    indexedFields: (fields) => {
        const warnings = [];
        const searchableFields = fields.filter(f => f.type === 'text' ||
            f.type === 'email' ||
            f.type === 'textarea');
        for (const field of searchableFields) {
            if (field.unique && !field.index) {
                warnings.push(`Field "${field.name}" is unique but not indexed. Consider adding 'index: true' for better performance.`);
            }
        }
        return warnings;
    }
};
/**
 * Validates a Payload CMS collection
 */
const validateCollection = (code) => {
    try {
        // Parse the code to get a JavaScript object
        // This is a simplified approach - in a real implementation, you'd need to safely evaluate the code
        const collection = eval(`(${code})`);
        // Validate against schema
        schemas_1.CollectionSchema.parse(collection);
        const errors = [];
        const warnings = [];
        const suggestions = [];
        // Check naming conventions
        if (collection.slug) {
            errors.push(...commonValidationRules.namingConventions(collection.slug));
            errors.push(...commonValidationRules.reservedWords(collection.slug));
        }
        // Check fields
        if (collection.fields) {
            for (const field of collection.fields) {
                if (field.name) {
                    errors.push(...commonValidationRules.namingConventions(field.name));
                    errors.push(...commonValidationRules.reservedWords(field.name));
                }
            }
            // Security checks
            warnings.push(...securityValidationRules.accessControl(collection));
            warnings.push(...securityValidationRules.authFields(collection.fields));
            // Performance checks
            warnings.push(...performanceValidationRules.indexedFields(collection.fields));
        }
        // Add suggestions
        if (!collection.admin?.useAsTitle) {
            suggestions.push({
                message: "Consider adding 'useAsTitle' to specify which field to use as the title in the admin UI.",
                code: `admin: { useAsTitle: 'title' }`
            });
        }
        if (!collection.timestamps) {
            suggestions.push({
                message: "Consider enabling timestamps to automatically track creation and update times.",
                code: `timestamps: true`
            });
        }
        return {
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
            suggestions: suggestions.length > 0 ? suggestions : undefined,
            references: [
                {
                    title: "Payload CMS Collections Documentation",
                    url: "https://payloadcms.com/docs/configuration/collections"
                }
            ]
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                isValid: false,
                errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
                references: [
                    {
                        title: "Payload CMS Collections Documentation",
                        url: "https://payloadcms.com/docs/configuration/collections"
                    }
                ]
            };
        }
        return {
            isValid: false,
            errors: [error.message],
            references: [
                {
                    title: "Payload CMS Collections Documentation",
                    url: "https://payloadcms.com/docs/configuration/collections"
                }
            ]
        };
    }
};
exports.validateCollection = validateCollection;
/**
 * Validates a Payload CMS field
 */
const validateField = (code) => {
    try {
        // Parse the code to get a JavaScript object
        const field = eval(`(${code})`);
        // Validate against schema
        schemas_1.FieldSchema.parse(field);
        const errors = [];
        const warnings = [];
        const suggestions = [];
        // Check naming conventions
        if (field.name) {
            errors.push(...commonValidationRules.namingConventions(field.name));
            errors.push(...commonValidationRules.reservedWords(field.name));
        }
        // Field-specific validations
        if (field.type === 'relationship' && !field.maxDepth) {
            warnings.push("Relationship field without maxDepth could lead to deep queries. Consider adding a maxDepth limit.");
            suggestions.push({
                message: "Add maxDepth to limit relationship depth",
                code: `maxDepth: 1`
            });
        }
        if (field.type === 'text' && field.required && !field.validate) {
            suggestions.push({
                message: "Consider adding validation for required text fields",
                code: `validate: (value) => {\n  if (!value || value.trim() === '') {\n    return 'This field is required';\n  }\n  return true;\n}`
            });
        }
        return {
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
            suggestions: suggestions.length > 0 ? suggestions : undefined,
            references: [
                {
                    title: "Payload CMS Fields Documentation",
                    url: "https://payloadcms.com/docs/fields/overview"
                }
            ]
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                isValid: false,
                errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
                references: [
                    {
                        title: "Payload CMS Fields Documentation",
                        url: "https://payloadcms.com/docs/fields/overview"
                    }
                ]
            };
        }
        return {
            isValid: false,
            errors: [error.message],
            references: [
                {
                    title: "Payload CMS Fields Documentation",
                    url: "https://payloadcms.com/docs/fields/overview"
                }
            ]
        };
    }
};
exports.validateField = validateField;
/**
 * Validates a Payload CMS global
 */
const validateGlobal = (code) => {
    try {
        // Parse the code to get a JavaScript object
        const global = eval(`(${code})`);
        // Validate against schema
        schemas_1.GlobalSchema.parse(global);
        const errors = [];
        const warnings = [];
        const suggestions = [];
        // Check naming conventions
        if (global.slug) {
            errors.push(...commonValidationRules.namingConventions(global.slug));
            errors.push(...commonValidationRules.reservedWords(global.slug));
        }
        // Check fields
        if (global.fields) {
            for (const field of global.fields) {
                if (field.name) {
                    errors.push(...commonValidationRules.namingConventions(field.name));
                    errors.push(...commonValidationRules.reservedWords(field.name));
                }
            }
            // Security checks
            warnings.push(...securityValidationRules.accessControl(global));
            warnings.push(...securityValidationRules.authFields(global.fields));
        }
        return {
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
            suggestions: suggestions.length > 0 ? suggestions : undefined,
            references: [
                {
                    title: "Payload CMS Globals Documentation",
                    url: "https://payloadcms.com/docs/configuration/globals"
                }
            ]
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                isValid: false,
                errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
                references: [
                    {
                        title: "Payload CMS Globals Documentation",
                        url: "https://payloadcms.com/docs/configuration/globals"
                    }
                ]
            };
        }
        return {
            isValid: false,
            errors: [error.message],
            references: [
                {
                    title: "Payload CMS Globals Documentation",
                    url: "https://payloadcms.com/docs/configuration/globals"
                }
            ]
        };
    }
};
exports.validateGlobal = validateGlobal;
/**
 * Validates a Payload CMS config
 */
const validateConfig = (code) => {
    try {
        // Parse the code to get a JavaScript object
        const config = eval(`(${code})`);
        // Validate against schema
        schemas_1.ConfigSchema.parse(config);
        const errors = [];
        const warnings = [];
        const suggestions = [];
        // Config-specific validations
        if (!config.serverURL) {
            warnings.push("Missing serverURL in config. This is required for proper URL generation.");
            suggestions.push({
                message: "Add serverURL to your config",
                code: `serverURL: 'http://localhost:3000'`
            });
        }
        if (!config.admin) {
            suggestions.push({
                message: "Consider configuring the admin panel",
                code: `admin: {\n  user: 'users',\n  meta: {\n    titleSuffix: '- My Payload App',\n    favicon: '/favicon.ico',\n  }\n}`
            });
        }
        return {
            isValid: errors.length === 0,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
            suggestions: suggestions.length > 0 ? suggestions : undefined,
            references: [
                {
                    title: "Payload CMS Configuration Documentation",
                    url: "https://payloadcms.com/docs/configuration/overview"
                }
            ]
        };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return {
                isValid: false,
                errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
                references: [
                    {
                        title: "Payload CMS Configuration Documentation",
                        url: "https://payloadcms.com/docs/configuration/overview"
                    }
                ]
            };
        }
        return {
            isValid: false,
            errors: [error.message],
            references: [
                {
                    title: "Payload CMS Configuration Documentation",
                    url: "https://payloadcms.com/docs/configuration/overview"
                }
            ]
        };
    }
};
exports.validateConfig = validateConfig;
/**
 * Validates Payload CMS code based on the file type
 */
const validatePayloadCode = (code, fileType) => {
    switch (fileType) {
        case 'collection':
            return (0, exports.validateCollection)(code);
        case 'field':
            return (0, exports.validateField)(code);
        case 'global':
            return (0, exports.validateGlobal)(code);
        case 'config':
            return (0, exports.validateConfig)(code);
        default:
            return {
                isValid: false,
                errors: [`Unknown file type: ${fileType}`],
            };
    }
};
exports.validatePayloadCode = validatePayloadCode;
