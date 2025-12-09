"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutputGuardrailTripwireTriggered = exports.InputGuardrailTripwireTriggered = exports.ToolCallError = exports.GuardrailExecutionError = exports.UserError = exports.ModelBehaviorError = exports.MaxTurnsExceededError = exports.SystemError = exports.AgentsError = void 0;
/**
 * Base class for all errors thrown by the library.
 */
class AgentsError extends Error {
    state;
    constructor(message, state) {
        super(message);
        this.state = state;
    }
}
exports.AgentsError = AgentsError;
/**
 * System error thrown when the library encounters an error that is not caused by the user's
 * misconfiguration.
 */
class SystemError extends AgentsError {
}
exports.SystemError = SystemError;
/**
 * Error thrown when the maximum number of turns is exceeded.
 */
class MaxTurnsExceededError extends AgentsError {
}
exports.MaxTurnsExceededError = MaxTurnsExceededError;
/**
 * Error thrown when a model behavior is unexpected.
 */
class ModelBehaviorError extends AgentsError {
}
exports.ModelBehaviorError = ModelBehaviorError;
/**
 * Error thrown when the error is caused by the library user's misconfiguration.
 */
class UserError extends AgentsError {
}
exports.UserError = UserError;
/**
 * Error thrown when a guardrail execution fails.
 */
class GuardrailExecutionError extends AgentsError {
    error;
    constructor(message, error, state) {
        super(message, state);
        this.error = error;
    }
}
exports.GuardrailExecutionError = GuardrailExecutionError;
/**
 * Error thrown when a tool call fails.
 */
class ToolCallError extends AgentsError {
    error;
    constructor(message, error, state) {
        super(message, state);
        this.error = error;
    }
}
exports.ToolCallError = ToolCallError;
/**
 * Error thrown when an input guardrail tripwire is triggered.
 */
class InputGuardrailTripwireTriggered extends AgentsError {
    result;
    constructor(message, result, state) {
        super(message, state);
        this.result = result;
    }
}
exports.InputGuardrailTripwireTriggered = InputGuardrailTripwireTriggered;
/**
 * Error thrown when an output guardrail tripwire is triggered.
 */
class OutputGuardrailTripwireTriggered extends AgentsError {
    result;
    constructor(message, result, state) {
        super(message, state);
        this.result = result;
    }
}
exports.OutputGuardrailTripwireTriggered = OutputGuardrailTripwireTriggered;
//# sourceMappingURL=errors.js.map