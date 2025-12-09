"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.computerTool = computerTool;
exports.hostedMcpTool = hostedMcpTool;
exports.tool = tool;
const safeExecute_1 = require("./utils/safeExecute.js");
const tools_1 = require("./utils/tools.js");
const tools_2 = require("./utils/tools.js");
const typeGuards_1 = require("./utils/typeGuards.js");
const errors_1 = require("./errors.js");
const logger_1 = __importDefault(require("./logger.js"));
const tracing_1 = require("./tracing/index.js");
const smartString_1 = require("./utils/smartString.js");
/**
 * Exposes a computer to the agent as a tool to be called
 *
 * @param options Additional configuration for the computer tool like specifying the location of your agent
 * @returns a computer tool definition
 */
function computerTool(options) {
    return {
        type: 'computer',
        name: options.name ?? 'computer_use_preview',
        computer: options.computer,
    };
}
/**
 * Creates a hosted MCP tool definition.
 *
 * @param options - Configuration for the hosted MCP tool, including server connection details
 * and approval requirements.
 */
function hostedMcpTool(options) {
    if ('serverUrl' in options) {
        // the MCP servers comaptible with the specification
        const providerData = typeof options.requireApproval === 'undefined' ||
            options.requireApproval === 'never'
            ? {
                type: 'mcp',
                server_label: options.serverLabel,
                server_url: options.serverUrl,
                authorization: options.authorization,
                require_approval: 'never',
                allowed_tools: toMcpAllowedToolsFilter(options.allowedTools),
                headers: options.headers,
            }
            : {
                type: 'mcp',
                server_label: options.serverLabel,
                server_url: options.serverUrl,
                authorization: options.authorization,
                allowed_tools: toMcpAllowedToolsFilter(options.allowedTools),
                headers: options.headers,
                require_approval: typeof options.requireApproval === 'string'
                    ? 'always'
                    : buildRequireApproval(options.requireApproval),
                on_approval: options.onApproval,
            };
        return {
            type: 'hosted_tool',
            name: 'hosted_mcp',
            providerData,
        };
    }
    else if ('connectorId' in options) {
        // OpenAI's connectors
        const providerData = typeof options.requireApproval === 'undefined' ||
            options.requireApproval === 'never'
            ? {
                type: 'mcp',
                server_label: options.serverLabel,
                connector_id: options.connectorId,
                authorization: options.authorization,
                require_approval: 'never',
                allowed_tools: toMcpAllowedToolsFilter(options.allowedTools),
                headers: options.headers,
            }
            : {
                type: 'mcp',
                server_label: options.serverLabel,
                connector_id: options.connectorId,
                authorization: options.authorization,
                allowed_tools: toMcpAllowedToolsFilter(options.allowedTools),
                headers: options.headers,
                require_approval: typeof options.requireApproval === 'string'
                    ? 'always'
                    : buildRequireApproval(options.requireApproval),
                on_approval: options.onApproval,
            };
        return {
            type: 'hosted_tool',
            name: 'hosted_mcp',
            providerData,
        };
    }
    else {
        // the MCP servers comaptible with the specification
        const providerData = typeof options.requireApproval === 'undefined' ||
            options.requireApproval === 'never'
            ? {
                type: 'mcp',
                server_label: options.serverLabel,
                require_approval: 'never',
                allowed_tools: toMcpAllowedToolsFilter(options.allowedTools),
            }
            : {
                type: 'mcp',
                server_label: options.serverLabel,
                allowed_tools: toMcpAllowedToolsFilter(options.allowedTools),
                require_approval: typeof options.requireApproval === 'string'
                    ? 'always'
                    : buildRequireApproval(options.requireApproval),
                on_approval: options.onApproval,
            };
        return {
            type: 'hosted_tool',
            name: 'hosted_mcp',
            providerData,
        };
    }
}
/**
 * The default function to invoke when an error occurs while running the tool.
 *
 * Always returns `An error occurred while running the tool. Please try again. Error: <error details>`
 *
 * @param context An instance of the current RunContext
 * @param error The error that occurred
 */
function defaultToolErrorFunction(context, error) {
    const details = error instanceof Error ? error.toString() : String(error);
    return `An error occurred while running the tool. Please try again. Error: ${details}`;
}
/**
 * Exposes a function to the agent as a tool to be called
 *
 * @param options The options for the tool
 * @returns A new tool
 */
function tool(options) {
    const name = options.name
        ? (0, tools_1.toFunctionToolName)(options.name)
        : (0, tools_1.toFunctionToolName)(options.execute.name);
    const toolErrorFunction = typeof options.errorFunction === 'undefined'
        ? defaultToolErrorFunction
        : options.errorFunction;
    if (!name) {
        throw new Error('Tool name cannot be empty. Either name your function or provide a name in the options.');
    }
    const strictMode = options.strict ?? true;
    if (!strictMode && (0, typeGuards_1.isZodObject)(options.parameters)) {
        throw new errors_1.UserError('Strict mode is required for Zod parameters');
    }
    const { parser, schema: parameters } = (0, tools_2.getSchemaAndParserFromInputType)(options.parameters, name);
    async function _invoke(runContext, input, details) {
        const [error, parsed] = await (0, safeExecute_1.safeExecute)(() => parser(input));
        if (error !== null) {
            if (logger_1.default.dontLogToolData) {
                logger_1.default.debug(`Invalid JSON input for tool ${name}`);
            }
            else {
                logger_1.default.debug(`Invalid JSON input for tool ${name}: ${input}`);
            }
            throw new errors_1.ModelBehaviorError('Invalid JSON input for tool');
        }
        if (logger_1.default.dontLogToolData) {
            logger_1.default.debug(`Invoking tool ${name}`);
        }
        else {
            logger_1.default.debug(`Invoking tool ${name} with input ${input}`);
        }
        const result = await options.execute(parsed, runContext, details);
        const stringResult = (0, smartString_1.toSmartString)(result);
        if (logger_1.default.dontLogToolData) {
            logger_1.default.debug(`Tool ${name} completed`);
        }
        else {
            logger_1.default.debug(`Tool ${name} returned: ${stringResult}`);
        }
        return result;
    }
    async function invoke(runContext, input, details) {
        return _invoke(runContext, input, details).catch((error) => {
            if (toolErrorFunction) {
                const currentSpan = (0, tracing_1.getCurrentSpan)();
                currentSpan?.setError({
                    message: 'Error running tool (non-fatal)',
                    data: {
                        tool_name: name,
                        error: error.toString(),
                    },
                });
                return toolErrorFunction(runContext, error);
            }
            throw error;
        });
    }
    const needsApproval = typeof options.needsApproval === 'function'
        ? options.needsApproval
        : async () => typeof options.needsApproval === 'boolean'
            ? options.needsApproval
            : false;
    const isEnabled = typeof options.isEnabled === 'function'
        ? async (runContext, agent) => {
            const predicate = options.isEnabled;
            const result = await predicate({ runContext, agent });
            return Boolean(result);
        }
        : async () => typeof options.isEnabled === 'boolean' ? options.isEnabled : true;
    return {
        type: 'function',
        name,
        description: options.description,
        parameters,
        strict: strictMode,
        invoke,
        needsApproval,
        isEnabled,
    };
}
function buildRequireApproval(requireApproval) {
    const result = {};
    if (requireApproval.always) {
        result.always = { tool_names: requireApproval.always.toolNames };
    }
    if (requireApproval.never) {
        result.never = { tool_names: requireApproval.never.toolNames };
    }
    return result;
}
function toMcpAllowedToolsFilter(allowedTools) {
    if (typeof allowedTools === 'undefined') {
        return undefined;
    }
    if (Array.isArray(allowedTools)) {
        return { tool_names: allowedTools };
    }
    return { tool_names: allowedTools?.toolNames ?? [] };
}
//# sourceMappingURL=tool.js.map