"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NoopTrace = exports.Trace = void 0;
const processor_1 = require("./processor.js");
const utils_1 = require("./utils.js");
class Trace {
    type = 'trace';
    traceId;
    name;
    groupId = null;
    metadata;
    #processor;
    #started;
    constructor(options, processor) {
        this.traceId = options.traceId ?? (0, utils_1.generateTraceId)();
        this.name = options.name ?? 'Agent workflow';
        this.groupId = options.groupId ?? null;
        this.metadata = options.metadata ?? {};
        this.#processor = processor ?? (0, processor_1.defaultProcessor)();
        this.#started = options.started ?? false;
    }
    async start() {
        if (this.#started) {
            return;
        }
        this.#started = true;
        await this.#processor.onTraceStart(this);
    }
    async end() {
        if (!this.#started) {
            return;
        }
        this.#started = false;
        await this.#processor.onTraceEnd(this);
    }
    clone() {
        return new Trace({
            traceId: this.traceId,
            name: this.name,
            groupId: this.groupId ?? undefined,
            metadata: this.metadata,
            started: this.#started,
        });
    }
    toJSON() {
        return {
            object: this.type,
            id: this.traceId,
            workflow_name: this.name,
            group_id: this.groupId,
            metadata: this.metadata,
        };
    }
}
exports.Trace = Trace;
class NoopTrace extends Trace {
    constructor() {
        super({});
    }
    async start() {
        return;
    }
    async end() {
        return;
    }
    toJSON() {
        return null;
    }
}
exports.NoopTrace = NoopTrace;
//# sourceMappingURL=traces.js.map