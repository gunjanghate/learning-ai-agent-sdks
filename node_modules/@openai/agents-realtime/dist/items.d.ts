import { z } from 'zod';
export declare const baseItemSchema: z.ZodObject<{
    itemId: z.ZodString;
}, "strip", z.ZodTypeAny, {
    itemId: string;
}, {
    itemId: string;
}>;
export declare const realtimeMessageItemSchema: z.ZodDiscriminatedUnion<"role", [z.ZodObject<{
    itemId: z.ZodString;
    previousItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodLiteral<"message">;
    role: z.ZodLiteral<"system">;
    content: z.ZodArray<z.ZodObject<{
        type: z.ZodLiteral<"input_text">;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "input_text";
        text: string;
    }, {
        type: "input_text";
        text: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "message";
    itemId: string;
    role: "system";
    content: {
        type: "input_text";
        text: string;
    }[];
    previousItemId?: string | null | undefined;
}, {
    type: "message";
    itemId: string;
    role: "system";
    content: {
        type: "input_text";
        text: string;
    }[];
    previousItemId?: string | null | undefined;
}>, z.ZodObject<{
    itemId: z.ZodString;
    previousItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodLiteral<"message">;
    role: z.ZodLiteral<"user">;
    status: z.ZodEnum<["in_progress", "completed"]>;
    content: z.ZodArray<z.ZodUnion<[z.ZodObject<{
        type: z.ZodLiteral<"input_text">;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "input_text";
        text: string;
    }, {
        type: "input_text";
        text: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"input_audio">;
        audio: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        transcript: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        type: "input_audio";
        transcript: string | null;
        audio?: string | null | undefined;
    }, {
        type: "input_audio";
        transcript: string | null;
        audio?: string | null | undefined;
    }>]>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "message";
    itemId: string;
    status: "in_progress" | "completed";
    role: "user";
    content: ({
        type: "input_text";
        text: string;
    } | {
        type: "input_audio";
        transcript: string | null;
        audio?: string | null | undefined;
    })[];
    previousItemId?: string | null | undefined;
}, {
    type: "message";
    itemId: string;
    status: "in_progress" | "completed";
    role: "user";
    content: ({
        type: "input_text";
        text: string;
    } | {
        type: "input_audio";
        transcript: string | null;
        audio?: string | null | undefined;
    })[];
    previousItemId?: string | null | undefined;
}>, z.ZodObject<{
    itemId: z.ZodString;
    previousItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodLiteral<"message">;
    role: z.ZodLiteral<"assistant">;
    status: z.ZodEnum<["in_progress", "completed", "incomplete"]>;
    content: z.ZodArray<z.ZodUnion<[z.ZodObject<{
        type: z.ZodLiteral<"output_text">;
        text: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        type: "output_text";
        text: string;
    }, {
        type: "output_text";
        text: string;
    }>, z.ZodObject<{
        type: z.ZodLiteral<"output_audio">;
        audio: z.ZodOptional<z.ZodNullable<z.ZodString>>;
        transcript: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    }, "strip", z.ZodTypeAny, {
        type: "output_audio";
        audio?: string | null | undefined;
        transcript?: string | null | undefined;
    }, {
        type: "output_audio";
        audio?: string | null | undefined;
        transcript?: string | null | undefined;
    }>]>, "many">;
}, "strip", z.ZodTypeAny, {
    type: "message";
    itemId: string;
    status: "in_progress" | "completed" | "incomplete";
    role: "assistant";
    content: ({
        type: "output_text";
        text: string;
    } | {
        type: "output_audio";
        audio?: string | null | undefined;
        transcript?: string | null | undefined;
    })[];
    previousItemId?: string | null | undefined;
}, {
    type: "message";
    itemId: string;
    status: "in_progress" | "completed" | "incomplete";
    role: "assistant";
    content: ({
        type: "output_text";
        text: string;
    } | {
        type: "output_audio";
        audio?: string | null | undefined;
        transcript?: string | null | undefined;
    })[];
    previousItemId?: string | null | undefined;
}>]>;
export declare const realtimeToolCallItem: z.ZodObject<{
    itemId: z.ZodString;
    previousItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodLiteral<"function_call">;
    status: z.ZodEnum<["in_progress", "completed", "incomplete"]>;
    arguments: z.ZodString;
    name: z.ZodString;
    output: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "function_call";
    output: string | null;
    name: string;
    itemId: string;
    status: "in_progress" | "completed" | "incomplete";
    arguments: string;
    previousItemId?: string | null | undefined;
}, {
    type: "function_call";
    output: string | null;
    name: string;
    itemId: string;
    status: "in_progress" | "completed" | "incomplete";
    arguments: string;
    previousItemId?: string | null | undefined;
}>;
export declare const realtimeMcpCallItem: z.ZodObject<{
    itemId: z.ZodString;
    previousItemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodEnum<["mcp_call", "mcp_tool_call"]>;
    status: z.ZodEnum<["in_progress", "completed", "incomplete"]>;
    arguments: z.ZodString;
    name: z.ZodString;
    output: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    type: "mcp_call" | "mcp_tool_call";
    output: string | null;
    name: string;
    itemId: string;
    status: "in_progress" | "completed" | "incomplete";
    arguments: string;
    previousItemId?: string | null | undefined;
}, {
    type: "mcp_call" | "mcp_tool_call";
    output: string | null;
    name: string;
    itemId: string;
    status: "in_progress" | "completed" | "incomplete";
    arguments: string;
    previousItemId?: string | null | undefined;
}>;
export declare const realtimeMcpCallApprovalRequestItem: z.ZodObject<{
    itemId: z.ZodString;
    type: z.ZodLiteral<"mcp_approval_request">;
    serverLabel: z.ZodString;
    name: z.ZodString;
    arguments: z.ZodRecord<z.ZodString, z.ZodAny>;
    approved: z.ZodNullable<z.ZodOptional<z.ZodBoolean>>;
}, "strip", z.ZodTypeAny, {
    type: "mcp_approval_request";
    name: string;
    itemId: string;
    arguments: Record<string, any>;
    serverLabel: string;
    approved?: boolean | null | undefined;
}, {
    type: "mcp_approval_request";
    name: string;
    itemId: string;
    arguments: Record<string, any>;
    serverLabel: string;
    approved?: boolean | null | undefined;
}>;
export type RealtimeBaseItem = z.infer<typeof baseItemSchema>;
export type RealtimeMessageItem = z.infer<typeof realtimeMessageItemSchema>;
export type RealtimeToolCallItem = z.infer<typeof realtimeToolCallItem>;
export type RealtimeMcpCallItem = z.infer<typeof realtimeMcpCallItem>;
export type RealtimeMcpCallApprovalRequestItem = z.infer<typeof realtimeMcpCallApprovalRequestItem>;
export type RealtimeItem = RealtimeMessageItem | RealtimeToolCallItem | RealtimeMcpCallItem | RealtimeMcpCallApprovalRequestItem;
