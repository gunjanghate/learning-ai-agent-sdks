import { UsageData } from './types/protocol';
type UsageInput = Partial<UsageData & {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    input_tokens_details: object;
    output_tokens_details: object;
}> & {
    requests?: number;
};
/**
 * Tracks token usage and request counts for an agent run.
 */
export declare class Usage {
    /**
     * The number of requests made to the LLM API.
     */
    requests: number;
    /**
     * The number of input tokens used across all requests.
     */
    inputTokens: number;
    /**
     * The number of output tokens used across all requests.
     */
    outputTokens: number;
    /**
     * The total number of tokens sent and received, across all requests.
     */
    totalTokens: number;
    /**
     * Details about the input tokens used across all requests.
     */
    inputTokensDetails: Array<Record<string, number>>;
    /**
     * Details about the output tokens used across all requests.
     */
    outputTokensDetails: Array<Record<string, number>>;
    constructor(input?: UsageInput);
    add(newUsage: Usage): void;
}
export { UsageData };
