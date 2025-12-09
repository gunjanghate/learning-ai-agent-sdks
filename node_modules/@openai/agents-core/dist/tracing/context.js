"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentTrace = getCurrentTrace;
exports.getCurrentSpan = getCurrentSpan;
exports.withTrace = withTrace;
exports.getOrCreateTrace = getOrCreateTrace;
exports.setCurrentSpan = setCurrentSpan;
exports.resetCurrentSpan = resetCurrentSpan;
exports.addErrorToCurrentSpan = addErrorToCurrentSpan;
exports.cloneCurrentContext = cloneCurrentContext;
exports.withNewSpanContext = withNewSpanContext;
const _shims_1 = require("@openai/agents-core/_shims");
const provider_1 = require("./provider.js");
const result_1 = require("../result.js");
let _contextAsyncLocalStorage;
function getContextAsyncLocalStorage() {
    _contextAsyncLocalStorage ??= new _shims_1.AsyncLocalStorage();
    return _contextAsyncLocalStorage;
}
/**
 * This function will get the current trace from the execution context.
 *
 * @returns The current trace or null if there is no trace.
 */
function getCurrentTrace() {
    const currentTrace = getContextAsyncLocalStorage().getStore();
    if (currentTrace?.trace) {
        return currentTrace.trace;
    }
    return null;
}
/**
 * This function will get the current span from the execution context.
 *
 * @returns The current span or null if there is no span.
 */
function getCurrentSpan() {
    const currentSpan = getContextAsyncLocalStorage().getStore();
    if (currentSpan?.span) {
        return currentSpan.span;
    }
    return null;
}
/**
 * This is an AsyncLocalStorage instance that stores the current trace.
 * It will automatically handle the execution context of different event loop executions.
 *
 * The functions below should be the only way that this context gets interfaced with.
 */
function _wrapFunctionWithTraceLifecycle(fn) {
    return async () => {
        const trace = getCurrentTrace();
        if (!trace) {
            throw new Error('No trace found');
        }
        await trace.start();
        const result = await fn(trace);
        // If result is a StreamedRunResult, defer trace end until stream loop completes
        if (result instanceof result_1.StreamedRunResult) {
            const streamLoopPromise = result._getStreamLoopPromise();
            if (streamLoopPromise) {
                streamLoopPromise.finally(() => trace.end());
                return result;
            }
        }
        // For non-streaming results, end trace synchronously
        await trace.end();
        return result;
    };
}
/**
 * This function will create a new trace and assign it to the execution context of the function
 * passed to it.
 *
 * @param fn - The function to run and assign the trace context to.
 * @param options - Options for the creation of the trace
 */
async function withTrace(trace, fn, options = {}) {
    const newTrace = typeof trace === 'string'
        ? (0, provider_1.getGlobalTraceProvider)().createTrace({
            ...options,
            name: trace,
        })
        : trace;
    return getContextAsyncLocalStorage().run({ trace: newTrace }, _wrapFunctionWithTraceLifecycle(fn));
}
/**
 * This function will check if there is an existing active trace in the execution context. If there
 * is, it will run the given function with the existing trace. If there is no trace, it will create
 * a new one and assign it to the execution context of the function.
 *
 * @param fn - The fzunction to run and assign the trace context to.
 * @param options - Options for the creation of the trace
 */
async function getOrCreateTrace(fn, options = {}) {
    const currentTrace = getCurrentTrace();
    if (currentTrace) {
        // if this execution context already has a trace instance in it we just continue
        return await fn();
    }
    const newTrace = (0, provider_1.getGlobalTraceProvider)().createTrace(options);
    return getContextAsyncLocalStorage().run({ trace: newTrace }, _wrapFunctionWithTraceLifecycle(fn));
}
/**
 * This function will set the current span in the execution context.
 *
 * @param span - The span to set as the current span.
 */
function setCurrentSpan(span) {
    const context = getContextAsyncLocalStorage().getStore();
    if (!context) {
        throw new Error('No existing trace found');
    }
    if (context.span) {
        context.span.previousSpan = context.previousSpan;
        context.previousSpan = context.span;
    }
    context.span = span;
    getContextAsyncLocalStorage().enterWith(context);
}
function resetCurrentSpan() {
    const context = getContextAsyncLocalStorage().getStore();
    if (context) {
        context.span = context.previousSpan;
        context.previousSpan = context.previousSpan?.previousSpan;
        getContextAsyncLocalStorage().enterWith(context);
    }
}
/**
 * This function will add an error to the current span.
 *
 * @param spanError - The error to add to the current span.
 */
function addErrorToCurrentSpan(spanError) {
    const currentSpan = getCurrentSpan();
    if (currentSpan) {
        currentSpan.setError(spanError);
    }
}
/**
 * This function will clone the current context by creating new instances of the trace, span, and
 * previous span.
 *
 * @param context - The context to clone.
 * @returns A clone of the context.
 */
function cloneCurrentContext(context) {
    return {
        trace: context.trace?.clone(),
        span: context.span?.clone(),
        previousSpan: context.previousSpan?.clone(),
    };
}
/**
 * This function will run the given function with a new span context.
 *
 * @param fn - The function to run with the new span context.
 */
function withNewSpanContext(fn) {
    const currentContext = getContextAsyncLocalStorage().getStore();
    if (!currentContext) {
        throw new Error('No existing trace found');
    }
    const copyOfContext = cloneCurrentContext(currentContext);
    return getContextAsyncLocalStorage().run(copyOfContext, fn);
}
//# sourceMappingURL=context.js.map