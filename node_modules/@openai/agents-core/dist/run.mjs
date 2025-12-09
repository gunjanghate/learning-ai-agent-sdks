import { Agent } from "./agent.mjs";
import { defineInputGuardrail, defineOutputGuardrail, } from "./guardrail.mjs";
import { getDefaultModelProvider } from "./providers.mjs";
import { RunContext } from "./runContext.mjs";
import { RunResult, StreamedRunResult } from "./result.mjs";
import { RunHooks } from "./lifecycle.mjs";
import logger from "./logger.mjs";
import { serializeTool, serializeHandoff } from "./utils/serialize.mjs";
import { GuardrailExecutionError, InputGuardrailTripwireTriggered, MaxTurnsExceededError, ModelBehaviorError, OutputGuardrailTripwireTriggered, UserError, } from "./errors.mjs";
import { addStepToRunResult, executeInterruptedToolsAndSideEffects, executeToolsAndSideEffects, maybeResetToolChoice, processModelResponse, streamStepItemsToRunResult, } from "./runImplementation.mjs";
import { getOrCreateTrace, resetCurrentSpan, setCurrentSpan, withNewSpanContext, withTrace, } from "./tracing/context.mjs";
import { createAgentSpan, withGuardrailSpan } from "./tracing/index.mjs";
import { Usage } from "./usage.mjs";
import { RunAgentUpdatedStreamEvent, RunRawModelStreamEvent } from "./events.mjs";
import { RunState } from "./runState.mjs";
import { StreamEventResponseCompleted } from "./types/protocol.mjs";
import { convertAgentOutputTypeToSerializable } from "./utils/tools.mjs";
import { gpt5ReasoningSettingsRequired, isGpt5Default } from "./defaultModel.mjs";
const DEFAULT_MAX_TURNS = 10;
/**
 * @internal
 */
export function getTracing(tracingDisabled, traceIncludeSensitiveData) {
    if (tracingDisabled) {
        return false;
    }
    if (traceIncludeSensitiveData) {
        return true;
    }
    return 'enabled_without_data';
}
function toAgentInputList(originalInput) {
    if (typeof originalInput === 'string') {
        return [{ type: 'message', role: 'user', content: originalInput }];
    }
    return [...originalInput];
}
/**
 * Internal module for tracking the items in turns and ensuring that we don't send duplicate items.
 * This logic is vital for properly handling the items to send during multiple turns
 * when you use either `conversationId` or `previousResponseId`.
 * Both scenarios expect an agent loop to send only new items for each Responses API call.
 *
 * see also: https://platform.openai.com/docs/guides/conversation-state?api-mode=responses
 */
class ServerConversationTracker {
    // Conversation ID:
    // - https://platform.openai.com/docs/guides/conversation-state?api-mode=responses#using-the-conversations-api
    // - https://platform.openai.com/docs/api-reference/conversations/create
    conversationId;
    // Previous Response ID:
    // https://platform.openai.com/docs/guides/conversation-state?api-mode=responses#passing-context-from-the-previous-response
    previousResponseId;
    // Using this flag because WeakSet does not provide a way to check its size
    sentInitialInput = false;
    // The items already sent to the model; using WeakSet for memory efficiency
    sentItems = new WeakSet();
    // The items received from the server; using WeakSet for memory efficiency
    serverItems = new WeakSet();
    constructor({ conversationId, previousResponseId, }) {
        this.conversationId = conversationId ?? undefined;
        this.previousResponseId = previousResponseId ?? undefined;
    }
    /**
     * Pre-populates tracker caches from an existing RunState when resuming server-managed runs.
     */
    primeFromState({ originalInput, generatedItems, modelResponses, }) {
        if (this.sentInitialInput) {
            return;
        }
        for (const item of toAgentInputList(originalInput)) {
            if (item && typeof item === 'object') {
                this.sentItems.add(item);
            }
        }
        this.sentInitialInput = true;
        const latestResponse = modelResponses[modelResponses.length - 1];
        for (const response of modelResponses) {
            for (const item of response.output) {
                if (item && typeof item === 'object') {
                    this.serverItems.add(item);
                }
            }
        }
        if (!this.conversationId && latestResponse?.responseId) {
            this.previousResponseId = latestResponse.responseId;
        }
        for (const item of generatedItems) {
            const rawItem = item.rawItem;
            if (!rawItem || typeof rawItem !== 'object') {
                continue;
            }
            if (this.serverItems.has(rawItem)) {
                this.sentItems.add(rawItem);
            }
        }
    }
    trackServerItems(modelResponse) {
        if (!modelResponse) {
            return;
        }
        for (const item of modelResponse.output) {
            if (item && typeof item === 'object') {
                this.serverItems.add(item);
            }
        }
        if (!this.conversationId &&
            this.previousResponseId !== undefined &&
            modelResponse.responseId) {
            this.previousResponseId = modelResponse.responseId;
        }
    }
    prepareInput(originalInput, generatedItems) {
        const inputItems = [];
        if (!this.sentInitialInput) {
            const initialItems = toAgentInputList(originalInput);
            for (const item of initialItems) {
                inputItems.push(item);
                if (item && typeof item === 'object') {
                    this.sentItems.add(item);
                }
            }
            this.sentInitialInput = true;
        }
        for (const item of generatedItems) {
            if (item.type === 'tool_approval_item') {
                continue;
            }
            const rawItem = item.rawItem;
            if (!rawItem || typeof rawItem !== 'object') {
                continue;
            }
            if (this.sentItems.has(rawItem) || this.serverItems.has(rawItem)) {
                continue;
            }
            inputItems.push(rawItem);
            this.sentItems.add(rawItem);
        }
        return inputItems;
    }
}
export function getTurnInput(originalInput, generatedItems) {
    const rawItems = generatedItems
        .filter((item) => item.type !== 'tool_approval_item') // don't include approval items to avoid double function calls
        .map((item) => item.rawItem);
    return [...toAgentInputList(originalInput), ...rawItems];
}
/**
 * A Runner is responsible for running an agent workflow.
 */
export class Runner extends RunHooks {
    config;
    inputGuardrailDefs;
    outputGuardrailDefs;
    constructor(config = {}) {
        super();
        this.config = {
            modelProvider: config.modelProvider ?? getDefaultModelProvider(),
            model: config.model,
            modelSettings: config.modelSettings,
            handoffInputFilter: config.handoffInputFilter,
            inputGuardrails: config.inputGuardrails,
            outputGuardrails: config.outputGuardrails,
            tracingDisabled: config.tracingDisabled ?? false,
            traceIncludeSensitiveData: config.traceIncludeSensitiveData ?? true,
            workflowName: config.workflowName ?? 'Agent workflow',
            traceId: config.traceId,
            groupId: config.groupId,
            traceMetadata: config.traceMetadata,
        };
        this.inputGuardrailDefs = (config.inputGuardrails ?? []).map(defineInputGuardrail);
        this.outputGuardrailDefs = (config.outputGuardrails ?? []).map(defineOutputGuardrail);
    }
    /**
     * @internal
     */
    async #runIndividualNonStream(startingAgent, input, options) {
        return withNewSpanContext(async () => {
            // if we have a saved state we use that one, otherwise we create a new one
            const isResumedState = input instanceof RunState;
            const state = isResumedState
                ? input
                : new RunState(options.context instanceof RunContext
                    ? options.context
                    : new RunContext(options.context), input, startingAgent, options.maxTurns ?? DEFAULT_MAX_TURNS);
            const serverConversationTracker = options.conversationId || options.previousResponseId
                ? new ServerConversationTracker({
                    conversationId: options.conversationId,
                    previousResponseId: options.previousResponseId,
                })
                : undefined;
            if (serverConversationTracker && isResumedState) {
                serverConversationTracker.primeFromState({
                    originalInput: state._originalInput,
                    generatedItems: state._generatedItems,
                    modelResponses: state._modelResponses,
                });
            }
            try {
                while (true) {
                    const explictlyModelSet = (state._currentAgent.model !== undefined &&
                        state._currentAgent.model !== '') ||
                        (this.config.model !== undefined && this.config.model !== '');
                    let model = selectModel(state._currentAgent.model, this.config.model);
                    if (typeof model === 'string') {
                        model = await this.config.modelProvider.getModel(model);
                    }
                    // if we don't have a current step, we treat this as a new run
                    state._currentStep = state._currentStep ?? {
                        type: 'next_step_run_again',
                    };
                    if (state._currentStep.type === 'next_step_interruption') {
                        logger.debug('Continuing from interruption');
                        if (!state._lastTurnResponse || !state._lastProcessedResponse) {
                            throw new UserError('No model response found in previous state', state);
                        }
                        const turnResult = await executeInterruptedToolsAndSideEffects(state._currentAgent, state._originalInput, state._generatedItems, state._lastTurnResponse, state._lastProcessedResponse, this, state);
                        state._toolUseTracker.addToolUse(state._currentAgent, state._lastProcessedResponse.toolsUsed);
                        state._originalInput = turnResult.originalInput;
                        state._generatedItems = turnResult.generatedItems;
                        state._currentStep = turnResult.nextStep;
                        if (turnResult.nextStep.type === 'next_step_interruption') {
                            // we are still in an interruption, so we need to avoid an infinite loop
                            return new RunResult(state);
                        }
                        continue;
                    }
                    if (state._currentStep.type === 'next_step_run_again') {
                        const handoffs = await state._currentAgent.getEnabledHandoffs(state._context);
                        if (!state._currentAgentSpan) {
                            const handoffNames = handoffs.map((h) => h.agentName);
                            state._currentAgentSpan = createAgentSpan({
                                data: {
                                    name: state._currentAgent.name,
                                    handoffs: handoffNames,
                                    output_type: state._currentAgent.outputSchemaName,
                                },
                            });
                            state._currentAgentSpan.start();
                            setCurrentSpan(state._currentAgentSpan);
                        }
                        const tools = await state._currentAgent.getAllTools(state._context);
                        const serializedTools = tools.map((t) => serializeTool(t));
                        const serializedHandoffs = handoffs.map((h) => serializeHandoff(h));
                        if (state._currentAgentSpan) {
                            state._currentAgentSpan.spanData.tools = tools.map((t) => t.name);
                        }
                        state._currentTurn++;
                        if (state._currentTurn > state._maxTurns) {
                            state._currentAgentSpan?.setError({
                                message: 'Max turns exceeded',
                                data: { max_turns: state._maxTurns },
                            });
                            throw new MaxTurnsExceededError(`Max turns (${state._maxTurns}) exceeded`, state);
                        }
                        logger.debug(`Running agent ${state._currentAgent.name} (turn ${state._currentTurn})`);
                        if (state._currentTurn === 1) {
                            await this.#runInputGuardrails(state);
                        }
                        const turnInput = serverConversationTracker
                            ? serverConversationTracker.prepareInput(state._originalInput, state._generatedItems)
                            : getTurnInput(state._originalInput, state._generatedItems);
                        if (state._noActiveAgentRun) {
                            state._currentAgent.emit('agent_start', state._context, state._currentAgent);
                            this.emit('agent_start', state._context, state._currentAgent);
                        }
                        let modelSettings = {
                            ...this.config.modelSettings,
                            ...state._currentAgent.modelSettings,
                        };
                        const agentModelSettings = state._currentAgent.modelSettings;
                        modelSettings = adjustModelSettingsForNonGPT5RunnerModel(explictlyModelSet, agentModelSettings, model, modelSettings);
                        modelSettings = maybeResetToolChoice(state._currentAgent, state._toolUseTracker, modelSettings);
                        const previousResponseId = serverConversationTracker?.previousResponseId ??
                            options.previousResponseId;
                        const conversationId = serverConversationTracker?.conversationId ??
                            options.conversationId;
                        state._lastTurnResponse = await model.getResponse({
                            systemInstructions: await state._currentAgent.getSystemPrompt(state._context),
                            prompt: await state._currentAgent.getPrompt(state._context),
                            // Explicit agent/run config models should take precedence over prompt defaults.
                            ...(explictlyModelSet ? { overridePromptModel: true } : {}),
                            input: turnInput,
                            previousResponseId,
                            conversationId,
                            modelSettings,
                            tools: serializedTools,
                            outputType: convertAgentOutputTypeToSerializable(state._currentAgent.outputType),
                            handoffs: serializedHandoffs,
                            tracing: getTracing(this.config.tracingDisabled, this.config.traceIncludeSensitiveData),
                            signal: options.signal,
                        });
                        state._modelResponses.push(state._lastTurnResponse);
                        state._context.usage.add(state._lastTurnResponse.usage);
                        state._noActiveAgentRun = false;
                        serverConversationTracker?.trackServerItems(state._lastTurnResponse);
                        const processedResponse = processModelResponse(state._lastTurnResponse, state._currentAgent, tools, handoffs);
                        state._lastProcessedResponse = processedResponse;
                        const turnResult = await executeToolsAndSideEffects(state._currentAgent, state._originalInput, state._generatedItems, state._lastTurnResponse, state._lastProcessedResponse, this, state);
                        state._toolUseTracker.addToolUse(state._currentAgent, state._lastProcessedResponse.toolsUsed);
                        state._originalInput = turnResult.originalInput;
                        state._generatedItems = turnResult.generatedItems;
                        state._currentStep = turnResult.nextStep;
                    }
                    if (state._currentStep &&
                        state._currentStep.type === 'next_step_final_output') {
                        await this.#runOutputGuardrails(state, state._currentStep.output);
                        this.emit('agent_end', state._context, state._currentAgent, state._currentStep.output);
                        state._currentAgent.emit('agent_end', state._context, state._currentStep.output);
                        return new RunResult(state);
                    }
                    else if (state._currentStep &&
                        state._currentStep.type === 'next_step_handoff') {
                        state._currentAgent = state._currentStep.newAgent;
                        if (state._currentAgentSpan) {
                            state._currentAgentSpan.end();
                            resetCurrentSpan();
                            state._currentAgentSpan = undefined;
                        }
                        state._noActiveAgentRun = true;
                        // we've processed the handoff, so we need to run the loop again
                        state._currentStep = { type: 'next_step_run_again' };
                    }
                    else if (state._currentStep &&
                        state._currentStep.type === 'next_step_interruption') {
                        // interrupted. Don't run any guardrails
                        return new RunResult(state);
                    }
                    else {
                        logger.debug('Running next loop');
                    }
                }
            }
            catch (err) {
                if (state._currentAgentSpan) {
                    state._currentAgentSpan.setError({
                        message: 'Error in agent run',
                        data: { error: String(err) },
                    });
                }
                throw err;
            }
            finally {
                if (state._currentAgentSpan) {
                    if (state._currentStep?.type !== 'next_step_interruption') {
                        // don't end the span if the run was interrupted
                        state._currentAgentSpan.end();
                    }
                    resetCurrentSpan();
                }
            }
        });
    }
    async #runInputGuardrails(state) {
        const guardrails = this.inputGuardrailDefs.concat(state._currentAgent.inputGuardrails.map(defineInputGuardrail));
        if (guardrails.length > 0) {
            const guardrailArgs = {
                agent: state._currentAgent,
                input: state._originalInput,
                context: state._context,
            };
            try {
                const results = await Promise.all(guardrails.map(async (guardrail) => {
                    return withGuardrailSpan(async (span) => {
                        const result = await guardrail.run(guardrailArgs);
                        span.spanData.triggered = result.output.tripwireTriggered;
                        return result;
                    }, { data: { name: guardrail.name } }, state._currentAgentSpan);
                }));
                for (const result of results) {
                    if (result.output.tripwireTriggered) {
                        if (state._currentAgentSpan) {
                            state._currentAgentSpan.setError({
                                message: 'Guardrail tripwire triggered',
                                data: { guardrail: result.guardrail.name },
                            });
                        }
                        throw new InputGuardrailTripwireTriggered(`Input guardrail triggered: ${JSON.stringify(result.output.outputInfo)}`, result, state);
                    }
                }
            }
            catch (e) {
                if (e instanceof InputGuardrailTripwireTriggered) {
                    throw e;
                }
                // roll back the current turn to enable reruns
                state._currentTurn--;
                throw new GuardrailExecutionError(`Input guardrail failed to complete: ${e}`, e, state);
            }
        }
    }
    async #runOutputGuardrails(state, output) {
        const guardrails = this.outputGuardrailDefs.concat(state._currentAgent.outputGuardrails.map(defineOutputGuardrail));
        if (guardrails.length > 0) {
            const agentOutput = state._currentAgent.processFinalOutput(output);
            const guardrailArgs = {
                agent: state._currentAgent,
                agentOutput,
                context: state._context,
                details: { modelResponse: state._lastTurnResponse },
            };
            try {
                const results = await Promise.all(guardrails.map(async (guardrail) => {
                    return withGuardrailSpan(async (span) => {
                        const result = await guardrail.run(guardrailArgs);
                        span.spanData.triggered = result.output.tripwireTriggered;
                        return result;
                    }, { data: { name: guardrail.name } }, state._currentAgentSpan);
                }));
                for (const result of results) {
                    if (result.output.tripwireTriggered) {
                        if (state._currentAgentSpan) {
                            state._currentAgentSpan.setError({
                                message: 'Guardrail tripwire triggered',
                                data: { guardrail: result.guardrail.name },
                            });
                        }
                        throw new OutputGuardrailTripwireTriggered(`Output guardrail triggered: ${JSON.stringify(result.output.outputInfo)}`, result, state);
                    }
                }
            }
            catch (e) {
                if (e instanceof OutputGuardrailTripwireTriggered) {
                    throw e;
                }
                throw new GuardrailExecutionError(`Output guardrail failed to complete: ${e}`, e, state);
            }
        }
    }
    /**
     * @internal
     */
    async #runStreamLoop(result, options, isResumedState) {
        const serverConversationTracker = options.conversationId || options.previousResponseId
            ? new ServerConversationTracker({
                conversationId: options.conversationId,
                previousResponseId: options.previousResponseId,
            })
            : undefined;
        if (serverConversationTracker && isResumedState) {
            serverConversationTracker.primeFromState({
                originalInput: result.state._originalInput,
                generatedItems: result.state._generatedItems,
                modelResponses: result.state._modelResponses,
            });
        }
        try {
            while (true) {
                const currentAgent = result.state._currentAgent;
                const handoffs = await currentAgent.getEnabledHandoffs(result.state._context);
                const tools = await currentAgent.getAllTools(result.state._context);
                const serializedTools = tools.map((t) => serializeTool(t));
                const serializedHandoffs = handoffs.map((h) => serializeHandoff(h));
                result.state._currentStep = result.state._currentStep ?? {
                    type: 'next_step_run_again',
                };
                if (result.state._currentStep.type === 'next_step_interruption') {
                    logger.debug('Continuing from interruption');
                    if (!result.state._lastTurnResponse ||
                        !result.state._lastProcessedResponse) {
                        throw new UserError('No model response found in previous state', result.state);
                    }
                    const turnResult = await executeInterruptedToolsAndSideEffects(result.state._currentAgent, result.state._originalInput, result.state._generatedItems, result.state._lastTurnResponse, result.state._lastProcessedResponse, this, result.state);
                    addStepToRunResult(result, turnResult);
                    result.state._toolUseTracker.addToolUse(result.state._currentAgent, result.state._lastProcessedResponse.toolsUsed);
                    result.state._originalInput = turnResult.originalInput;
                    result.state._generatedItems = turnResult.generatedItems;
                    result.state._currentStep = turnResult.nextStep;
                    if (turnResult.nextStep.type === 'next_step_interruption') {
                        // we are still in an interruption, so we need to avoid an infinite loop
                        return;
                    }
                    continue;
                }
                if (result.state._currentStep.type === 'next_step_run_again') {
                    if (!result.state._currentAgentSpan) {
                        const handoffNames = handoffs.map((h) => h.agentName);
                        result.state._currentAgentSpan = createAgentSpan({
                            data: {
                                name: currentAgent.name,
                                handoffs: handoffNames,
                                tools: tools.map((t) => t.name),
                                output_type: currentAgent.outputSchemaName,
                            },
                        });
                        result.state._currentAgentSpan.start();
                        setCurrentSpan(result.state._currentAgentSpan);
                    }
                    result.state._currentTurn++;
                    if (result.state._currentTurn > result.state._maxTurns) {
                        result.state._currentAgentSpan?.setError({
                            message: 'Max turns exceeded',
                            data: { max_turns: result.state._maxTurns },
                        });
                        throw new MaxTurnsExceededError(`Max turns (${result.state._maxTurns}) exceeded`, result.state);
                    }
                    logger.debug(`Running agent ${currentAgent.name} (turn ${result.state._currentTurn})`);
                    const explictlyModelSet = (currentAgent.model !== undefined && currentAgent.model !== '') ||
                        (this.config.model !== undefined && this.config.model !== '');
                    let model = selectModel(currentAgent.model, this.config.model);
                    if (typeof model === 'string') {
                        model = await this.config.modelProvider.getModel(model);
                    }
                    if (result.state._currentTurn === 1) {
                        await this.#runInputGuardrails(result.state);
                    }
                    let modelSettings = {
                        ...this.config.modelSettings,
                        ...currentAgent.modelSettings,
                    };
                    const agentModelSettings = currentAgent.modelSettings;
                    modelSettings = adjustModelSettingsForNonGPT5RunnerModel(explictlyModelSet, agentModelSettings, model, modelSettings);
                    modelSettings = maybeResetToolChoice(currentAgent, result.state._toolUseTracker, modelSettings);
                    const turnInput = serverConversationTracker
                        ? serverConversationTracker.prepareInput(result.input, result.newItems)
                        : getTurnInput(result.input, result.newItems);
                    if (result.state._noActiveAgentRun) {
                        currentAgent.emit('agent_start', result.state._context, currentAgent);
                        this.emit('agent_start', result.state._context, currentAgent);
                    }
                    let finalResponse = undefined;
                    const previousResponseId = serverConversationTracker?.previousResponseId ??
                        options.previousResponseId;
                    const conversationId = serverConversationTracker?.conversationId ?? options.conversationId;
                    for await (const event of model.getStreamedResponse({
                        systemInstructions: await currentAgent.getSystemPrompt(result.state._context),
                        prompt: await currentAgent.getPrompt(result.state._context),
                        // Streaming requests should also honor explicitly chosen models.
                        ...(explictlyModelSet ? { overridePromptModel: true } : {}),
                        input: turnInput,
                        previousResponseId,
                        conversationId,
                        modelSettings,
                        tools: serializedTools,
                        handoffs: serializedHandoffs,
                        outputType: convertAgentOutputTypeToSerializable(currentAgent.outputType),
                        tracing: getTracing(this.config.tracingDisabled, this.config.traceIncludeSensitiveData),
                        signal: options.signal,
                    })) {
                        if (event.type === 'response_done') {
                            const parsed = StreamEventResponseCompleted.parse(event);
                            finalResponse = {
                                usage: new Usage(parsed.response.usage),
                                output: parsed.response.output,
                                responseId: parsed.response.id,
                            };
                        }
                        if (result.cancelled) {
                            // When the user's code exits a loop to consume the stream, we need to break
                            // this loop to prevent internal false errors and unnecessary processing
                            return;
                        }
                        result._addItem(new RunRawModelStreamEvent(event));
                    }
                    result.state._noActiveAgentRun = false;
                    if (!finalResponse) {
                        throw new ModelBehaviorError('Model did not produce a final response!', result.state);
                    }
                    result.state._lastTurnResponse = finalResponse;
                    serverConversationTracker?.trackServerItems(finalResponse);
                    result.state._modelResponses.push(result.state._lastTurnResponse);
                    const processedResponse = processModelResponse(result.state._lastTurnResponse, currentAgent, tools, handoffs);
                    result.state._lastProcessedResponse = processedResponse;
                    // Record the items emitted directly from the model response so we do not
                    // stream them again after tools and other side effects finish.
                    const preToolItems = new Set(processedResponse.newItems);
                    if (preToolItems.size > 0) {
                        streamStepItemsToRunResult(result, processedResponse.newItems);
                    }
                    const turnResult = await executeToolsAndSideEffects(currentAgent, result.state._originalInput, result.state._generatedItems, result.state._lastTurnResponse, result.state._lastProcessedResponse, this, result.state);
                    addStepToRunResult(result, turnResult, {
                        skipItems: preToolItems,
                    });
                    result.state._toolUseTracker.addToolUse(currentAgent, processedResponse.toolsUsed);
                    result.state._originalInput = turnResult.originalInput;
                    result.state._generatedItems = turnResult.generatedItems;
                    result.state._currentStep = turnResult.nextStep;
                }
                if (result.state._currentStep.type === 'next_step_final_output') {
                    await this.#runOutputGuardrails(result.state, result.state._currentStep.output);
                    this.emit('agent_end', result.state._context, currentAgent, result.state._currentStep.output);
                    currentAgent.emit('agent_end', result.state._context, result.state._currentStep.output);
                    return;
                }
                else if (result.state._currentStep.type === 'next_step_interruption') {
                    // we are done for now. Don't run any output guardrails
                    return;
                }
                else if (result.state._currentStep.type === 'next_step_handoff') {
                    result.state._currentAgent = result.state._currentStep
                        ?.newAgent;
                    if (result.state._currentAgentSpan) {
                        result.state._currentAgentSpan.end();
                        resetCurrentSpan();
                    }
                    result.state._currentAgentSpan = undefined;
                    result._addItem(new RunAgentUpdatedStreamEvent(result.state._currentAgent));
                    result.state._noActiveAgentRun = true;
                    // we've processed the handoff, so we need to run the loop again
                    result.state._currentStep = {
                        type: 'next_step_run_again',
                    };
                }
                else {
                    logger.debug('Running next loop');
                }
            }
        }
        catch (error) {
            if (result.state._currentAgentSpan) {
                result.state._currentAgentSpan.setError({
                    message: 'Error in agent run',
                    data: { error: String(error) },
                });
            }
            throw error;
        }
        finally {
            if (result.state._currentAgentSpan) {
                if (result.state._currentStep?.type !== 'next_step_interruption') {
                    result.state._currentAgentSpan.end();
                }
                resetCurrentSpan();
            }
        }
    }
    /**
     * @internal
     */
    async #runIndividualStream(agent, input, options) {
        options = options ?? {};
        return withNewSpanContext(async () => {
            // Initialize or reuse existing state
            const isResumedState = input instanceof RunState;
            const state = isResumedState
                ? input
                : new RunState(options.context instanceof RunContext
                    ? options.context
                    : new RunContext(options.context), input, agent, options.maxTurns ?? DEFAULT_MAX_TURNS);
            // Initialize the streamed result with existing state
            const result = new StreamedRunResult({
                signal: options.signal,
                state,
            });
            // Setup defaults
            result.maxTurns = options.maxTurns ?? state._maxTurns;
            // Continue the stream loop without blocking
            const streamLoopPromise = this.#runStreamLoop(result, options, isResumedState).then(() => {
                result._done();
            }, (err) => {
                result._raiseError(err);
            });
            // Attach the stream loop promise so trace end waits for the loop to complete
            result._setStreamLoopPromise(streamLoopPromise);
            return result;
        });
    }
    run(agent, input, options = {
        stream: false,
        context: undefined,
    }) {
        if (input instanceof RunState && input._trace) {
            return withTrace(input._trace, async () => {
                if (input._currentAgentSpan) {
                    setCurrentSpan(input._currentAgentSpan);
                }
                if (options?.stream) {
                    return this.#runIndividualStream(agent, input, options);
                }
                else {
                    return this.#runIndividualNonStream(agent, input, options);
                }
            });
        }
        return getOrCreateTrace(async () => {
            if (options?.stream) {
                return this.#runIndividualStream(agent, input, options);
            }
            else {
                return this.#runIndividualNonStream(agent, input, options);
            }
        }, {
            traceId: this.config.traceId,
            name: this.config.workflowName,
            groupId: this.config.groupId,
            metadata: this.config.traceMetadata,
        });
    }
}
let _defaultRunner = undefined;
function getDefaultRunner() {
    if (_defaultRunner) {
        return _defaultRunner;
    }
    _defaultRunner = new Runner();
    return _defaultRunner;
}
export function selectModel(agentModel, runConfigModel) {
    // When initializing an agent without model name, the model property is set to an empty string. So,
    // * agentModel === '' & runConfigModel exists, runConfigModel will be used
    // * agentModel is set, the agentModel will be used over runConfigModel
    if ((typeof agentModel === 'string' &&
        agentModel !== Agent.DEFAULT_MODEL_PLACEHOLDER) ||
        agentModel // any truthy value
    ) {
        return agentModel;
    }
    return runConfigModel ?? agentModel ?? Agent.DEFAULT_MODEL_PLACEHOLDER;
}
export async function run(agent, input, options) {
    const runner = getDefaultRunner();
    if (options?.stream) {
        return await runner.run(agent, input, options);
    }
    else {
        return await runner.run(agent, input, options);
    }
}
/**
 * When the default model is a GPT-5 variant, agents may carry GPT-5-specific providerData
 * (e.g., reasoning effort, text verbosity). If a run resolves to a non-GPT-5 model and the
 * agent relied on the default model (i.e., no explicit model set), these GPT-5-only settings
 * are incompatible and should be stripped to avoid runtime errors.
 */
function adjustModelSettingsForNonGPT5RunnerModel(explictlyModelSet, agentModelSettings, runnerModel, modelSettings) {
    if (
    // gpt-5 is enabled for the default model for agents
    isGpt5Default() &&
        // explicitly set model for the agent
        explictlyModelSet &&
        // this runner uses a non-gpt-5 model
        (typeof runnerModel !== 'string' ||
            !gpt5ReasoningSettingsRequired(runnerModel)) &&
        (agentModelSettings.providerData?.reasoning ||
            agentModelSettings.providerData?.text?.verbosity ||
            agentModelSettings.providerData?.reasoning_effort)) {
        const copiedModelSettings = { ...modelSettings };
        // the incompatible parameters should be removed to avoid runtime errors
        delete copiedModelSettings.providerData?.reasoning;
        delete copiedModelSettings.providerData?.text?.verbosity;
        delete copiedModelSettings.providerData?.reasoning_effort;
        if (copiedModelSettings.reasoning) {
            delete copiedModelSettings.reasoning.effort;
            delete copiedModelSettings.reasoning.summary;
        }
        if (copiedModelSettings.text) {
            delete copiedModelSettings.text.verbosity;
        }
        return copiedModelSettings;
    }
    return modelSettings;
}
//# sourceMappingURL=run.mjs.map