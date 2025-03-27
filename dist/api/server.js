"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const zod_1 = require("zod");
const mcp_api_handler_1 = require("../lib/mcp-api-handler");
const payload_1 = require("../lib/payload");
const redis_connection_1 = require("../lib/redis-connection");
const handler = (0, mcp_api_handler_1.initializeMcpApiHandler)((server) => {
    // Echo tool for testing
    server.tool("echo", { message: zod_1.z.string() }, async ({ message }) => ({
        content: [{ type: "text", text: `Tool echo: ${message}` }],
    }));
    // Validate Payload CMS code
    server.tool("validate", {
        code: zod_1.z.string(),
        fileType: zod_1.z.enum(["collection", "field", "global", "config"]),
    }, async ({ code, fileType }) => {
        const result = (0, payload_1.validatePayloadCode)(code, fileType);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify(result, null, 2),
                },
            ],
        };
    });
    // Query validation rules
    server.tool("query", {
        query: zod_1.z.string(),
        fileType: zod_1.z.enum(["collection", "field", "global", "config"]).optional(),
    }, async ({ query, fileType }) => {
        const rules = (0, payload_1.queryValidationRules)(query, fileType);
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({ rules }, null, 2),
                },
            ],
        };
    });
    // Execute SQL-like query
    server.tool("mcp_query", {
        sql: zod_1.z.string(),
    }, async ({ sql }) => {
        try {
            const results = (0, payload_1.executeSqlQuery)(sql);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ results }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: error.message }, null, 2),
                    },
                ],
            };
        }
    });
    // Generate Payload CMS 3 code templates
    server.tool("generate_template", {
        templateType: zod_1.z.enum([
            "collection",
            "field",
            "global",
            "config",
            "access-control",
            "hook",
            "endpoint",
            "plugin",
            "block",
            "migration"
        ]),
        options: zod_1.z.record(zod_1.z.any()),
    }, async ({ templateType, options }) => {
        try {
            const code = (0, payload_1.generateTemplate)(templateType, options);
            return {
                content: [
                    {
                        type: "text",
                        text: code,
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: error.message }, null, 2),
                    },
                ],
            };
        }
    });
    // Generate a complete Payload CMS 3 collection
    server.tool("generate_collection", {
        slug: zod_1.z.string(),
        fields: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            type: zod_1.z.string(),
            required: zod_1.z.boolean().optional(),
            unique: zod_1.z.boolean().optional(),
        })).optional(),
        auth: zod_1.z.boolean().optional(),
        timestamps: zod_1.z.boolean().optional(),
        admin: zod_1.z.object({
            useAsTitle: zod_1.z.string().optional(),
            defaultColumns: zod_1.z.array(zod_1.z.string()).optional(),
            group: zod_1.z.string().optional(),
        }).optional(),
        hooks: zod_1.z.boolean().optional(),
        access: zod_1.z.boolean().optional(),
        versions: zod_1.z.boolean().optional(),
    }, async (options) => {
        try {
            const code = (0, payload_1.generateTemplate)('collection', options);
            return {
                content: [
                    {
                        type: "text",
                        text: code,
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: error.message }, null, 2),
                    },
                ],
            };
        }
    });
    // Generate a Payload CMS 3 field
    server.tool("generate_field", {
        name: zod_1.z.string(),
        type: zod_1.z.string(),
        required: zod_1.z.boolean().optional(),
        unique: zod_1.z.boolean().optional(),
        localized: zod_1.z.boolean().optional(),
        access: zod_1.z.boolean().optional(),
        admin: zod_1.z.object({
            description: zod_1.z.string().optional(),
            readOnly: zod_1.z.boolean().optional(),
        }).optional(),
        validation: zod_1.z.boolean().optional(),
        defaultValue: zod_1.z.any().optional(),
    }, async (options) => {
        try {
            const code = (0, payload_1.generateTemplate)('field', options);
            return {
                content: [
                    {
                        type: "text",
                        text: code,
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: error.message }, null, 2),
                    },
                ],
            };
        }
    });
    // Scaffold a complete Payload CMS 3 project
    server.tool("scaffold_project", {
        projectName: zod_1.z.string(),
        description: zod_1.z.string().optional(),
        serverUrl: zod_1.z.string().optional(),
        database: zod_1.z.enum(['mongodb', 'postgres']).optional(),
        auth: zod_1.z.boolean().optional(),
        admin: zod_1.z.object({
            user: zod_1.z.string().optional(),
            bundler: zod_1.z.enum(['webpack', 'vite']).optional(),
        }).optional(),
        collections: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            fields: zod_1.z.array(zod_1.z.object({
                name: zod_1.z.string(),
                type: zod_1.z.string(),
                required: zod_1.z.boolean().optional(),
                unique: zod_1.z.boolean().optional(),
            })).optional(),
            auth: zod_1.z.boolean().optional(),
            timestamps: zod_1.z.boolean().optional(),
            admin: zod_1.z.object({
                useAsTitle: zod_1.z.string().optional(),
                group: zod_1.z.string().optional(),
            }).optional(),
            versions: zod_1.z.boolean().optional(),
        })).optional(),
        globals: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            fields: zod_1.z.array(zod_1.z.object({
                name: zod_1.z.string(),
                type: zod_1.z.string(),
            })).optional(),
            versions: zod_1.z.boolean().optional(),
        })).optional(),
        blocks: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            fields: zod_1.z.array(zod_1.z.object({
                name: zod_1.z.string(),
                type: zod_1.z.string(),
            })).optional(),
            imageField: zod_1.z.boolean().optional(),
            contentField: zod_1.z.boolean().optional(),
        })).optional(),
        plugins: zod_1.z.array(zod_1.z.string()).optional(),
        typescript: zod_1.z.boolean().optional(),
    }, async (options) => {
        try {
            // Validate options
            const validation = (0, payload_1.validateScaffoldOptions)(options);
            if (!validation.isValid) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                error: "Invalid scaffold options",
                                details: validation.errors
                            }, null, 2),
                        },
                    ],
                };
            }
            // Generate project scaffold
            const fileStructure = (0, payload_1.scaffoldProject)(options);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            message: `Successfully scaffolded Payload CMS 3 project: ${options.projectName}`,
                            fileStructure
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({ error: error.message }, null, 2),
                    },
                ],
            };
        }
    });
}, {
    capabilities: {
        tools: {
            echo: {
                description: "Echo a message",
            },
            validate: {
                description: "Validate Payload CMS code",
            },
            query: {
                description: "Query validation rules for Payload CMS",
            },
            mcp_query: {
                description: "Execute SQL-like query against validation rules",
            },
            generate_template: {
                description: "Generate Payload CMS 3 code templates",
            },
            generate_collection: {
                description: "Generate a complete Payload CMS 3 collection",
            },
            generate_field: {
                description: "Generate a Payload CMS 3 field",
            },
            scaffold_project: {
                description: "Scaffold a complete Payload CMS 3 project structure",
            },
        },
    },
});
// Ensure Redis connection is established before handling requests
(0, redis_connection_1.ensureRedisConnection)().catch(error => {
    console.error("Failed to ensure Redis connection in server.ts:", error);
});
exports.default = handler;
