"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigSchema = exports.GlobalSchema = exports.CollectionSchema = exports.FieldSchema = exports.RichTextFieldSchema = exports.TabsFieldSchema = exports.GroupFieldSchema = exports.ArrayFieldSchema = exports.RelationshipFieldSchema = exports.SelectFieldSchema = exports.NumberFieldSchema = exports.TextFieldSchema = exports.BaseFieldSchema = exports.FieldTypes = void 0;
const zod_1 = require("zod");
// Field types supported by Payload CMS 3.0
exports.FieldTypes = [
    'text',
    'textarea',
    'email',
    'code',
    'number',
    'date',
    'checkbox',
    'select',
    'relationship',
    'upload',
    'array',
    'blocks',
    'group',
    'row',
    'collapsible',
    'tabs',
    'richText',
    'json',
    'radio',
    'point',
];
// Base field schema that all field types extend
exports.BaseFieldSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    label: zod_1.z.string().optional(),
    required: zod_1.z.boolean().optional(),
    unique: zod_1.z.boolean().optional(),
    index: zod_1.z.boolean().optional(),
    defaultValue: zod_1.z.any().optional(),
    hidden: zod_1.z.boolean().optional(),
    saveToJWT: zod_1.z.boolean().optional(),
    localized: zod_1.z.boolean().optional(),
    validate: zod_1.z.function().optional(),
    hooks: zod_1.z.object({
        beforeValidate: zod_1.z.function().optional(),
        beforeChange: zod_1.z.function().optional(),
        afterChange: zod_1.z.function().optional(),
        afterRead: zod_1.z.function().optional(),
    }).optional(),
    admin: zod_1.z.object({
        position: zod_1.z.string().optional(),
        width: zod_1.z.string().optional(),
        style: zod_1.z.record(zod_1.z.any()).optional(),
        className: zod_1.z.string().optional(),
        readOnly: zod_1.z.boolean().optional(),
        hidden: zod_1.z.boolean().optional(),
        description: zod_1.z.string().optional(),
        condition: zod_1.z.function().optional(),
        components: zod_1.z.record(zod_1.z.any()).optional(),
    }).optional(),
    access: zod_1.z.object({
        read: zod_1.z.union([zod_1.z.function(), zod_1.z.boolean()]).optional(),
        create: zod_1.z.union([zod_1.z.function(), zod_1.z.boolean()]).optional(),
        update: zod_1.z.union([zod_1.z.function(), zod_1.z.boolean()]).optional(),
    }).optional(),
});
// Text field schema
exports.TextFieldSchema = exports.BaseFieldSchema.extend({
    type: zod_1.z.literal('text'),
    minLength: zod_1.z.number().optional(),
    maxLength: zod_1.z.number().optional(),
    hasMany: zod_1.z.boolean().optional(),
});
// Number field schema
exports.NumberFieldSchema = exports.BaseFieldSchema.extend({
    type: zod_1.z.literal('number'),
    min: zod_1.z.number().optional(),
    max: zod_1.z.number().optional(),
    hasMany: zod_1.z.boolean().optional(),
});
// Select field schema
exports.SelectFieldSchema = exports.BaseFieldSchema.extend({
    type: zod_1.z.literal('select'),
    options: zod_1.z.array(zod_1.z.union([
        zod_1.z.string(),
        zod_1.z.object({
            label: zod_1.z.string(),
            value: zod_1.z.union([zod_1.z.string(), zod_1.z.number(), zod_1.z.boolean()]),
        }),
    ])),
    hasMany: zod_1.z.boolean().optional(),
});
// Relationship field schema
exports.RelationshipFieldSchema = exports.BaseFieldSchema.extend({
    type: zod_1.z.literal('relationship'),
    relationTo: zod_1.z.union([zod_1.z.string(), zod_1.z.array(zod_1.z.string())]),
    hasMany: zod_1.z.boolean().optional(),
    filterOptions: zod_1.z.function().optional(),
    maxDepth: zod_1.z.number().optional(),
});
// Array field schema
exports.ArrayFieldSchema = exports.BaseFieldSchema.extend({
    type: zod_1.z.literal('array'),
    minRows: zod_1.z.number().optional(),
    maxRows: zod_1.z.number().optional(),
    fields: zod_1.z.lazy(() => zod_1.z.array(exports.FieldSchema)),
});
// Group field schema
exports.GroupFieldSchema = exports.BaseFieldSchema.extend({
    type: zod_1.z.literal('group'),
    fields: zod_1.z.lazy(() => zod_1.z.array(exports.FieldSchema)),
});
// Tabs field schema
exports.TabsFieldSchema = exports.BaseFieldSchema.extend({
    type: zod_1.z.literal('tabs'),
    tabs: zod_1.z.array(zod_1.z.object({
        label: zod_1.z.string(),
        name: zod_1.z.string().optional(),
        fields: zod_1.z.lazy(() => zod_1.z.array(exports.FieldSchema)),
    })),
});
// Rich text field schema
exports.RichTextFieldSchema = exports.BaseFieldSchema.extend({
    type: zod_1.z.literal('richText'),
    admin: zod_1.z.object({
        elements: zod_1.z.array(zod_1.z.string()).optional(),
        leaves: zod_1.z.array(zod_1.z.string()).optional(),
        hideGutter: zod_1.z.boolean().optional(),
        placeholder: zod_1.z.string().optional(),
    }).optional(),
});
// Union of all field schemas
exports.FieldSchema = zod_1.z.union([
    exports.TextFieldSchema,
    exports.NumberFieldSchema,
    exports.SelectFieldSchema,
    exports.RelationshipFieldSchema,
    exports.ArrayFieldSchema,
    exports.GroupFieldSchema,
    exports.TabsFieldSchema,
    exports.RichTextFieldSchema,
    // Add other field schemas as needed
    exports.BaseFieldSchema.extend({ type: zod_1.z.enum(exports.FieldTypes) }),
]);
// Collection schema
exports.CollectionSchema = zod_1.z.object({
    slug: zod_1.z.string().min(1),
    labels: zod_1.z.object({
        singular: zod_1.z.string().optional(),
        plural: zod_1.z.string().optional(),
    }).optional(),
    admin: zod_1.z.object({
        useAsTitle: zod_1.z.string().optional(),
        defaultColumns: zod_1.z.array(zod_1.z.string()).optional(),
        listSearchableFields: zod_1.z.array(zod_1.z.string()).optional(),
        group: zod_1.z.string().optional(),
        description: zod_1.z.string().optional(),
        hideAPIURL: zod_1.z.boolean().optional(),
        disableDuplicate: zod_1.z.boolean().optional(),
        preview: zod_1.z.function().optional(),
    }).optional(),
    access: zod_1.z.object({
        read: zod_1.z.union([zod_1.z.function(), zod_1.z.boolean()]).optional(),
        create: zod_1.z.union([zod_1.z.function(), zod_1.z.boolean()]).optional(),
        update: zod_1.z.union([zod_1.z.function(), zod_1.z.boolean()]).optional(),
        delete: zod_1.z.union([zod_1.z.function(), zod_1.z.boolean()]).optional(),
        admin: zod_1.z.union([zod_1.z.function(), zod_1.z.boolean()]).optional(),
    }).optional(),
    fields: zod_1.z.array(exports.FieldSchema),
    hooks: zod_1.z.object({
        beforeOperation: zod_1.z.function().optional(),
        beforeValidate: zod_1.z.function().optional(),
        beforeChange: zod_1.z.function().optional(),
        afterChange: zod_1.z.function().optional(),
        beforeRead: zod_1.z.function().optional(),
        afterRead: zod_1.z.function().optional(),
        beforeDelete: zod_1.z.function().optional(),
        afterDelete: zod_1.z.function().optional(),
    }).optional(),
    endpoints: zod_1.z.array(zod_1.z.object({
        path: zod_1.z.string(),
        method: zod_1.z.enum(['get', 'post', 'put', 'patch', 'delete']),
        handler: zod_1.z.function(),
    })).optional(),
    versions: zod_1.z.object({
        drafts: zod_1.z.boolean().optional(),
        max: zod_1.z.number().optional(),
    }).optional(),
    timestamps: zod_1.z.boolean().optional(),
    auth: zod_1.z.boolean().optional(),
    upload: zod_1.z.object({
        staticDir: zod_1.z.string(),
        staticURL: zod_1.z.string(),
        mimeTypes: zod_1.z.array(zod_1.z.string()).optional(),
        filesizeLimit: zod_1.z.number().optional(),
        imageSizes: zod_1.z.array(zod_1.z.object({
            name: zod_1.z.string(),
            width: zod_1.z.number().optional(),
            height: zod_1.z.number().optional(),
            crop: zod_1.z.string().optional(),
        })).optional(),
    }).optional(),
});
// Global schema
exports.GlobalSchema = zod_1.z.object({
    slug: zod_1.z.string().min(1),
    label: zod_1.z.string().optional(),
    admin: zod_1.z.object({
        description: zod_1.z.string().optional(),
        group: zod_1.z.string().optional(),
    }).optional(),
    access: zod_1.z.object({
        read: zod_1.z.union([zod_1.z.function(), zod_1.z.boolean()]).optional(),
        update: zod_1.z.union([zod_1.z.function(), zod_1.z.boolean()]).optional(),
    }).optional(),
    fields: zod_1.z.array(exports.FieldSchema),
    hooks: zod_1.z.object({
        beforeValidate: zod_1.z.function().optional(),
        beforeChange: zod_1.z.function().optional(),
        afterChange: zod_1.z.function().optional(),
        beforeRead: zod_1.z.function().optional(),
        afterRead: zod_1.z.function().optional(),
    }).optional(),
    versions: zod_1.z.object({
        drafts: zod_1.z.boolean().optional(),
        max: zod_1.z.number().optional(),
    }).optional(),
});
// Config schema
exports.ConfigSchema = zod_1.z.object({
    collections: zod_1.z.array(exports.CollectionSchema).optional(),
    globals: zod_1.z.array(exports.GlobalSchema).optional(),
    admin: zod_1.z.object({
        user: zod_1.z.string().optional(),
        meta: zod_1.z.object({
            titleSuffix: zod_1.z.string().optional(),
            favicon: zod_1.z.string().optional(),
            ogImage: zod_1.z.string().optional(),
        }).optional(),
        components: zod_1.z.record(zod_1.z.any()).optional(),
        css: zod_1.z.string().optional(),
        dateFormat: zod_1.z.string().optional(),
    }).optional(),
    serverURL: zod_1.z.string().optional(),
    cors: zod_1.z.array(zod_1.z.string()).optional(),
    csrf: zod_1.z.array(zod_1.z.string()).optional(),
    routes: zod_1.z.object({
        admin: zod_1.z.string().optional(),
        api: zod_1.z.string().optional(),
        graphQL: zod_1.z.string().optional(),
        graphQLPlayground: zod_1.z.string().optional(),
    }).optional(),
    defaultDepth: zod_1.z.number().optional(),
    maxDepth: zod_1.z.number().optional(),
    rateLimit: zod_1.z.object({
        window: zod_1.z.number().optional(),
        max: zod_1.z.number().optional(),
        trustProxy: zod_1.z.boolean().optional(),
        skip: zod_1.z.function().optional(),
    }).optional(),
    upload: zod_1.z.object({
        limits: zod_1.z.object({
            fileSize: zod_1.z.number().optional(),
        }).optional(),
    }).optional(),
    plugins: zod_1.z.array(zod_1.z.any()).optional(),
    typescript: zod_1.z.object({
        outputFile: zod_1.z.string().optional(),
    }).optional(),
    graphQL: zod_1.z.object({
        schemaOutputFile: zod_1.z.string().optional(),
        disablePlaygroundInProduction: zod_1.z.boolean().optional(),
    }).optional(),
    telemetry: zod_1.z.boolean().optional(),
    debug: zod_1.z.boolean().optional(),
});
