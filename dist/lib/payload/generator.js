"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTemplate = generateTemplate;
const zod_1 = require("zod");
/**
 * Validation schema for template options
 */
const templateOptionsSchema = zod_1.z.record(zod_1.z.any());
/**
 * Generate a template for Payload CMS 3 based on the template type and options
 * @param templateType The type of template to generate
 * @param options Options for the template
 * @returns The generated code as a string
 */
function generateTemplate(templateType, options) {
    // Validate options
    const validationResult = templateOptionsSchema.safeParse(options);
    if (!validationResult.success) {
        throw new Error(`Invalid template options: ${JSON.stringify(validationResult.error.format())}`);
    }
    // Generate the template based on the type
    switch (templateType) {
        case 'collection':
            return generateCollectionTemplate(options);
        case 'field':
            return generateFieldTemplate(options);
        case 'global':
            return generateGlobalTemplate(options);
        case 'config':
            return generateConfigTemplate(options);
        case 'access-control':
            return generateAccessControlTemplate(options);
        case 'hook':
            return generateHookTemplate(options);
        case 'endpoint':
            return generateEndpointTemplate(options);
        case 'plugin':
            return generatePluginTemplate(options);
        case 'block':
            return generateBlockTemplate(options);
        case 'migration':
            return generateMigrationTemplate(options);
        default:
            throw new Error(`Unsupported template type: ${templateType}`);
    }
}
/**
 * Generate a collection template for Payload CMS 3
 * @param options Collection options
 * @returns The generated collection code
 */
function generateCollectionTemplate(options) {
    const { slug, fields = [], auth = false, timestamps = true, admin = {}, hooks = false, access = false, versions = false, } = options;
    if (!slug) {
        throw new Error('Collection slug is required');
    }
    // Generate fields code
    const fieldsCode = fields.length > 0
        ? fields.map((field) => {
            return generateFieldTemplate(field);
        }).join(',\n    ')
        : '';
    // Generate admin code
    const adminCode = Object.keys(admin).length > 0
        ? `\n  admin: {
    ${admin.useAsTitle ? `useAsTitle: '${admin.useAsTitle}',` : ''}
    ${admin.defaultColumns ? `defaultColumns: [${admin.defaultColumns.map((col) => `'${col}'`).join(', ')}],` : ''}
    ${admin.group ? `group: '${admin.group}',` : ''}
  },`
        : '';
    // Generate hooks code
    const hooksCode = hooks
        ? `\n  hooks: {
    beforeOperation: [
      // Add your hooks here
    ],
    afterOperation: [
      // Add your hooks here
    ],
  },`
        : '';
    // Generate access code
    const accessCode = access
        ? `\n  access: {
    read: () => true,
    update: () => true,
    create: () => true,
    delete: () => true,
  },`
        : '';
    // Generate auth code
    const authCode = auth
        ? `\n  auth: {
    useAPIKey: true,
    tokenExpiration: 7200,
  },`
        : '';
    // Generate versions code
    const versionsCode = versions
        ? `\n  versions: {
    drafts: true,
  },`
        : '';
    return `import { CollectionConfig } from 'payload/types';

const ${slug.charAt(0).toUpperCase() + slug.slice(1)}: CollectionConfig = {
  slug: '${slug}',${adminCode}${authCode}${accessCode}${hooksCode}${versionsCode}
  ${timestamps ? 'timestamps: true,' : ''}
  fields: [
    ${fieldsCode}
  ],
};

export default ${slug.charAt(0).toUpperCase() + slug.slice(1)};`;
}
/**
 * Generate a field template for Payload CMS 3
 * @param options Field options
 * @returns The generated field code
 */
function generateFieldTemplate(options) {
    const { name, type, required = false, unique = false, localized = false, access = false, admin = {}, validation = false, defaultValue, } = options;
    if (!name || !type) {
        throw new Error('Field name and type are required');
    }
    // Generate admin code
    const adminCode = Object.keys(admin).length > 0
        ? `\n    admin: {
      ${admin.description ? `description: '${admin.description}',` : ''}
      ${admin.readOnly ? 'readOnly: true,' : ''}
    },`
        : '';
    // Generate access code
    const accessCode = access
        ? `\n    access: {
      read: () => true,
      update: () => true,
    },`
        : '';
    // Generate validation code
    const validationCode = validation
        ? `\n    validate: (value) => {
      if (value === undefined || value === null) {
        return '${name} is required';
      }
      return true;
    },`
        : '';
    // Generate default value code
    const defaultValueCode = defaultValue !== undefined
        ? `\n    defaultValue: ${typeof defaultValue === 'string' ? `'${defaultValue}'` : defaultValue},`
        : '';
    // Generate field-specific options based on type
    let fieldSpecificOptions = '';
    switch (type) {
        case 'text':
        case 'textarea':
        case 'email':
        case 'code':
            fieldSpecificOptions = `\n    minLength: 1,
    maxLength: 255,`;
            break;
        case 'number':
            fieldSpecificOptions = `\n    min: 0,
    max: 1000,`;
            break;
        case 'select':
            fieldSpecificOptions = `\n    options: [
      { label: 'Option 1', value: 'option1' },
      { label: 'Option 2', value: 'option2' },
    ],
    hasMany: false,`;
            break;
        case 'relationship':
            fieldSpecificOptions = `\n    relationTo: 'collection-name',
    hasMany: false,`;
            break;
        case 'array':
            fieldSpecificOptions = `\n    minRows: 0,
    maxRows: 10,
    fields: [
      {
        name: 'subField',
        type: 'text',
        required: true,
      },
    ],`;
            break;
        case 'blocks':
            fieldSpecificOptions = `\n    blocks: [
      {
        slug: 'block-name',
        fields: [
          {
            name: 'blockField',
            type: 'text',
            required: true,
          },
        ],
      },
    ],`;
            break;
    }
    return `{
    name: '${name}',
    type: '${type}',${required ? '\n    required: true,' : ''}${unique ? '\n    unique: true,' : ''}${localized ? '\n    localized: true,' : ''}${adminCode}${accessCode}${validationCode}${defaultValueCode}${fieldSpecificOptions}
  }`;
}
/**
 * Generate a global template for Payload CMS 3
 * @param options Global options
 * @returns The generated global code
 */
function generateGlobalTemplate(options) {
    const { slug, fields = [], admin = {}, access = false, versions = false, } = options;
    if (!slug) {
        throw new Error('Global slug is required');
    }
    // Generate fields code
    const fieldsCode = fields.length > 0
        ? fields.map((field) => {
            return generateFieldTemplate(field);
        }).join(',\n    ')
        : '';
    // Generate admin code
    const adminCode = Object.keys(admin).length > 0
        ? `\n  admin: {
    ${admin.group ? `group: '${admin.group}',` : ''}
  },`
        : '';
    // Generate access code
    const accessCode = access
        ? `\n  access: {
    read: () => true,
    update: () => true,
  },`
        : '';
    // Generate versions code
    const versionsCode = versions
        ? `\n  versions: {
    drafts: true,
  },`
        : '';
    return `import { GlobalConfig } from 'payload/types';

const ${slug.charAt(0).toUpperCase() + slug.slice(1)}: GlobalConfig = {
  slug: '${slug}',${adminCode}${accessCode}${versionsCode}
  fields: [
    ${fieldsCode}
  ],
};

export default ${slug.charAt(0).toUpperCase() + slug.slice(1)};`;
}
/**
 * Generate a config template for Payload CMS 3
 * @param options Config options
 * @returns The generated config code
 */
function generateConfigTemplate(options) {
    const { serverURL = 'http://localhost:3000', collections = [], globals = [], admin = {}, db = 'mongodb', plugins = [], typescript = true, } = options;
    // Generate collections code
    const collectionsCode = collections.length > 0
        ? collections.map((collection) => `import ${collection.charAt(0).toUpperCase() + collection.slice(1)} from './collections/${collection}';`).join('\n')
        : '';
    // Generate globals code
    const globalsCode = globals.length > 0
        ? globals.map((global) => `import ${global.charAt(0).toUpperCase() + global.slice(1)} from './globals/${global}';`).join('\n')
        : '';
    // Generate plugins code
    const pluginsCode = plugins.length > 0
        ? plugins.map((plugin) => {
            if (plugin === 'form-builder') {
                return `import formBuilder from '@payloadcms/plugin-form-builder';`;
            }
            else if (plugin === 'seo') {
                return `import seoPlugin from '@payloadcms/plugin-seo';`;
            }
            else if (plugin === 'nested-docs') {
                return `import nestedDocs from '@payloadcms/plugin-nested-docs';`;
            }
            else {
                return `import ${plugin} from '@payloadcms/plugin-${plugin}';`;
            }
        }).join('\n')
        : '';
    // Generate plugins initialization code
    const pluginsInitCode = plugins.length > 0
        ? `\n  plugins: [
    ${plugins.map((plugin) => {
            if (plugin === 'form-builder') {
                return `formBuilder({
      formOverrides: {
        admin: {
          group: 'Content',
        },
      },
      formSubmissionOverrides: {
        admin: {
          group: 'Content',
        },
      },
      redirectRelationships: ['pages'],
    }),`;
            }
            else if (plugin === 'seo') {
                return `seoPlugin(),`;
            }
            else if (plugin === 'nested-docs') {
                return `nestedDocs({
      collections: ['pages'],
    }),`;
            }
            else {
                return `${plugin}(),`;
            }
        }).join('\n    ')}
  ],`
        : '';
    // Generate admin code
    const adminInitCode = Object.keys(admin).length > 0
        ? `\n  admin: {
    user: '${admin.user || 'users'}',
    bundler: ${admin.bundler === 'vite' ? 'viteBundler()' : 'webpackBundler()'},
    meta: {
      titleSuffix: '- Payload CMS',
      favicon: '/assets/favicon.ico',
      ogImage: '/assets/og-image.jpg',
    },
  },`
        : '';
    // Generate database code
    const dbCode = db === 'postgres'
        ? `\n  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URI,
    },
  }),`
        : `\n  db: mongooseAdapter({
    url: process.env.MONGODB_URI,
  }),`;
    // Generate collections and globals initialization
    const collectionsInitCode = collections.length > 0
        ? `\n  collections: [
    ${collections.map((collection) => `${collection.charAt(0).toUpperCase() + collection.slice(1)},`).join('\n    ')}
  ],`
        : '';
    const globalsInitCode = globals.length > 0
        ? `\n  globals: [
    ${globals.map((global) => `${global.charAt(0).toUpperCase() + global.slice(1)},`).join('\n    ')}
  ],`
        : '';
    // Generate imports for database adapters
    const dbImports = db === 'postgres'
        ? `import { postgresAdapter } from '@payloadcms/db-postgres';`
        : `import { mongooseAdapter } from '@payloadcms/db-mongoose';`;
    // Generate bundler imports
    const bundlerImports = admin.bundler === 'vite'
        ? `import { viteBundler } from '@payloadcms/bundler-vite';`
        : `import { webpackBundler } from '@payloadcms/bundler-webpack';`;
    return `import path from 'path';
import { buildConfig } from 'payload/config';
${dbImports}
${bundlerImports}
${collectionsCode ? `\n${collectionsCode}` : ''}
${globalsCode ? `\n${globalsCode}` : ''}
${pluginsCode ? `\n${pluginsCode}` : ''}

export default buildConfig({
  serverURL: '${serverURL}',${adminInitCode}${dbCode}${pluginsInitCode}${collectionsInitCode}${globalsInitCode}
  typescript: {
    outputFile: path.resolve(__dirname, 'payload-types.ts'),
  },
  graphQL: {
    schemaOutputFile: path.resolve(__dirname, 'generated-schema.graphql'),
  },
  cors: ['http://localhost:3000'],
  csrf: [
    'http://localhost:3000',
  ],
});`;
}
/**
 * Generate an access control template for Payload CMS 3
 * @param options Access control options
 * @returns The generated access control code
 */
function generateAccessControlTemplate(options) {
    const { type = 'collection', name = 'default', roles = ['admin', 'editor', 'user'], } = options;
    return `import { Access } from 'payload/types';

// Define user roles type
type Role = ${roles.map(role => `'${role}'`).join(' | ')};

// Access control for ${type} ${name}
export const ${name}Access: Access = ({ req }) => {
  // If there's no user, deny access
  if (!req.user) {
    return false;
  }

  // Admin users can do anything
  if (req.user.role === 'admin') {
    return true;
  }

  // Editor users can read and update but not delete
  if (req.user.role === 'editor') {
    return {
      read: true,
      update: true,
      create: true,
      delete: false,
    };
  }

  // Regular users can only read their own documents
  if (req.user.role === 'user') {
    return {
      read: {
        and: [
          {
            createdBy: {
              equals: req.user.id,
            },
          },
        ],
      },
      update: {
        createdBy: {
          equals: req.user.id,
        },
      },
      create: true,
      delete: {
        createdBy: {
          equals: req.user.id,
        },
      },
    };
  }

  // Default deny
  return false;
};`;
}
/**
 * Generate a hook template for Payload CMS 3
 * @param options Hook options
 * @returns The generated hook code
 */
function generateHookTemplate(options) {
    const { type = 'collection', name = 'default', operation = 'create', timing = 'before', } = options;
    return `import { ${timing === 'before' ? 'BeforeOperation' : 'AfterOperation'} } from 'payload/types';

// ${timing}${operation.charAt(0).toUpperCase() + operation.slice(1)} hook for ${type} ${name}
export const ${timing}${operation.charAt(0).toUpperCase() + operation.slice(1)}Hook: ${timing === 'before' ? 'BeforeOperation' : 'AfterOperation'} = async ({ 
  req, 
  data, 
  operation,
  ${timing === 'after' ? 'doc,' : ''}
  ${timing === 'after' ? 'previousDoc,' : ''}
}) => {
  // Your hook logic here
  console.log(\`${timing} ${operation} operation on ${type} ${name}\`);
  
  ${timing === 'before'
        ? `// You can modify the data before it's saved
  return data;`
        : `// You can perform actions after the operation
  return doc;`}
};`;
}
/**
 * Generate an endpoint template for Payload CMS 3
 * @param options Endpoint options
 * @returns The generated endpoint code
 */
function generateEndpointTemplate(options) {
    const { path = '/api/custom', method = 'get', auth = true, } = options;
    return `import { Payload } from 'payload';
import { Request, Response } from 'express';

// Custom endpoint handler
export const ${method}${path.replace(/\//g, '_').replace(/^_/, '').replace(/_$/, '')} = async (req: Request, res: Response, payload: Payload) => {
  try {
    ${auth ? `// Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({
        message: 'Unauthorized',
      });
    }` : ''}

    // Your endpoint logic here
    const result = {
      message: 'Success',
      timestamp: new Date().toISOString(),
    };

    // Return successful response
    return res.status(200).json(result);
  } catch (error) {
    // Handle errors
    console.error(\`Error in ${path} endpoint:\`, error);
    return res.status(500).json({
      message: 'Internal Server Error',
      error: error.message,
    });
  }
};

// Endpoint configuration
export default {
  path: '${path}',
  method: '${method}',
  handler: ${method}${path.replace(/\//g, '_').replace(/^_/, '').replace(/_$/, '')},
};`;
}
/**
 * Generate a plugin template for Payload CMS 3
 * @param options Plugin options
 * @returns The generated plugin code
 */
function generatePluginTemplate(options) {
    const { name = 'custom-plugin', collections = [], globals = [], fields = [], endpoints = [], } = options;
    return `import { Config, Plugin } from 'payload/config';

// Define the plugin options type
export interface ${name.replace(/-/g, '_').charAt(0).toUpperCase() + name.replace(/-/g, '_').slice(1)}PluginOptions {
  // Add your plugin options here
  enabled?: boolean;
}

// Define the plugin
export const ${name.replace(/-/g, '_')}Plugin = (options: ${name.replace(/-/g, '_').charAt(0).toUpperCase() + name.replace(/-/g, '_').slice(1)}PluginOptions = {}): Plugin => {
  return {
    // Plugin name
    name: '${name}',
    
    // Plugin configuration function
    config: (incomingConfig: Config): Config => {
      // Default options
      const { enabled = true } = options;
      
      if (!enabled) {
        return incomingConfig;
      }
      
      // Create a new config to modify
      const config = { ...incomingConfig };
      
      // Add collections
      ${collections.length > 0 ? `
      // Add plugin collections
      const collections = [
        // Define your collections here
        ${collections.map((collection) => `{
          slug: '${collection}',
          // Add collection configuration
        }`).join(',\n        ')}
      ];
      
      config.collections = [
        ...(config.collections || []),
        ...collections,
      ];` : '// No collections to add'}
      
      // Add globals
      ${globals.length > 0 ? `
      // Add plugin globals
      const globals = [
        // Define your globals here
        ${globals.map((global) => `{
          slug: '${global}',
          // Add global configuration
        }`).join(',\n        ')}
      ];
      
      config.globals = [
        ...(config.globals || []),
        ...globals,
      ];` : '// No globals to add'}
      
      // Add endpoints
      ${endpoints.length > 0 ? `
      // Add plugin endpoints
      const endpoints = [
        // Define your endpoints here
        ${endpoints.map((endpoint) => `{
          path: '/${endpoint}',
          method: 'get',
          handler: async (req, res) => {
            res.status(200).json({ message: '${endpoint} endpoint' });
          },
        }`).join(',\n        ')}
      ];
      
      config.endpoints = [
        ...(config.endpoints || []),
        ...endpoints,
      ];` : '// No endpoints to add'}
      
      // Return the modified config
      return config;
    },
  };
};

export default ${name.replace(/-/g, '_')}Plugin;`;
}
/**
 * Generate a block template for Payload CMS 3
 * @param options Block options
 * @returns The generated block code
 */
function generateBlockTemplate(options) {
    const { name = 'custom-block', fields = [], imageField = true, contentField = true, } = options;
    // Generate fields code
    const fieldsCode = fields.length > 0
        ? fields.map((field) => {
            return generateFieldTemplate(field);
        }).join(',\n    ')
        : '';
    // Generate image field
    const imageFieldCode = imageField
        ? `{
    name: 'image',
    type: 'upload',
    relationTo: 'media',
    required: true,
    admin: {
      description: 'Add an image to this block',
    },
  },`
        : '';
    // Generate content field
    const contentFieldCode = contentField
        ? `{
    name: 'content',
    type: 'richText',
    required: true,
    admin: {
      description: 'Add content to this block',
    },
  },`
        : '';
    return `import { Block } from 'payload/types';

// Define the ${name} block
export const ${name.replace(/-/g, '_')}Block: Block = {
  slug: '${name}',
  labels: {
    singular: '${name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ')}',
    plural: '${name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ')}s',
  },
  fields: [
    ${imageFieldCode}
    ${contentFieldCode}
    ${fieldsCode}
  ],
};

export default ${name.replace(/-/g, '_')}Block;`;
}
/**
 * Generate a migration template for Payload CMS 3
 * @param options Migration options
 * @returns The generated migration code
 */
function generateMigrationTemplate(options) {
    const { name = 'custom-migration', collection = '', operation = 'update', } = options;
    return `import { Payload } from 'payload';

// Migration: ${name}
export const ${name.replace(/-/g, '_')}Migration = async (payload: Payload) => {
  try {
    console.log('Starting migration: ${name}');
    
    ${collection ? `// Get the collection
    const collection = '${collection}';
    
    // Find documents to migrate
    const docs = await payload.find({
      collection,
      limit: 100,
    });
    
    console.log(\`Found \${docs.docs.length} documents to migrate\`);
    
    // Process each document
    for (const doc of docs.docs) {
      ${operation === 'update' ? `// Update the document
      await payload.update({
        collection,
        id: doc.id,
        data: {
          // Add your migration changes here
          migratedAt: new Date().toISOString(),
        },
      });` : operation === 'delete' ? `// Delete the document
      await payload.delete({
        collection,
        id: doc.id,
      });` : `// Custom operation
      // Add your custom migration logic here`}
    }` : `// Add your migration logic here
    // This could be schema changes, data transformations, etc.`}
    
    console.log('Migration completed successfully: ${name}');
    return { success: true };
  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error: error.message };
  }
};

export default ${name.replace(/-/g, '_')}Migration;`;
}
