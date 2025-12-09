"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsageData = exports.Usage = void 0;
const protocol_1 = require("./types/protocol.js");
Object.defineProperty(exports, "UsageData", { enumerable: true, get: function () { return protocol_1.UsageData; } });
/**
 * Tracks token usage and request counts for an agent run.
 */
class Usage {
    /**
     * The number of requests made to the LLM API.
     */
    requests;
    /**
     * The number of input tokens used across all requests.
     */
    inputTokens;
    /**
     * The number of output tokens used across all requests.
     */
    outputTokens;
    /**
     * The total number of tokens sent and received, across all requests.
     */
    totalTokens;
    /**
     * Details about the input tokens used across all requests.
     */
    inputTokensDetails = [];
    /**
     * Details about the output tokens used across all requests.
     */
    outputTokensDetails = [];
    constructor(input) {
        if (typeof input === 'undefined') {
            this.requests = 0;
            this.inputTokens = 0;
            this.outputTokens = 0;
            this.totalTokens = 0;
            this.inputTokensDetails = [];
            this.outputTokensDetails = [];
        }
        else {
            this.requests = input?.requests ?? 1;
            this.inputTokens = input?.inputTokens ?? input?.input_tokens ?? 0;
            this.outputTokens = input?.outputTokens ?? input?.output_tokens ?? 0;
            this.totalTokens = input?.totalTokens ?? input?.total_tokens ?? 0;
            const inputTokensDetails = input?.inputTokensDetails ?? input?.input_tokens_details;
            this.inputTokensDetails = inputTokensDetails
                ? [inputTokensDetails]
                : [];
            const outputTokensDetails = input?.outputTokensDetails ?? input?.output_tokens_details;
            this.outputTokensDetails = outputTokensDetails
                ? [outputTokensDetails]
                : [];
        }
    }
    add(newUsage) {
        this.requests += newUsage.requests;
        this.inputTokens += newUsage.inputTokens;
        this.outputTokens += newUsage.outputTokens;
        this.totalTokens += newUsage.totalTokens;
        if (newUsage.inputTokensDetails) {
            // The type does not allow undefined, but it could happen runtime
            this.inputTokensDetails.push(...newUsage.inputTokensDetails);
        }
        if (newUsage.outputTokensDetails) {
            // The type does not allow undefined, but it could happen runtime
            this.outputTokensDetails.push(...newUsage.outputTokensDetails);
        }
    }
}
exports.Usage = Usage;
//# sourceMappingURL=usage.js.map