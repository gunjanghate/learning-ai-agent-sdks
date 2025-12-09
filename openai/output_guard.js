import dotenv from 'dotenv'
import {Agent, run, InputGuardrailTripwireTriggered} from '@openai/agents'
import {z} from 'zod'
import fs from 'node:fs/promises'
dotenv.config();


const sqlGuardrailAgent = new Agent({
    name: "SQL Guardrails Agent",
    instructions:`
    You are a SQL Guardrails Agent. Your task is to validate if the input question is strictly related to SQL queries and database operations.
    the query should be read only, not modifying any data.

    `,
    outputType: z.object({
        reason: z.string().optional().describe("Reason for triggering the tripwire, if applicable").optional(),
        isSafe: z.boolean().describe("Indicates if the input question is safe and related to SQL queries"),
    }),
    outputGuardrails: [sqlGuardrail]
})

const sqlGuardrail = {
    name: "SQL Guardrail",
    execute: async ({agentOutput})=>{
        const res = await run(sqlGuardrailAgent, agentOutput.sqlQuery)
        return {
            outputInfo: res.finalOutput.reason,
            tripwireTriggered: !res.finalOutput.isSafe,    
    }
}
}

const sqlAgent = new Agent({
    name: "SQL Agent",
    instructions:`
    You are a SQL Agent. Your task is to validate if the input question is strictly related to SQL queries and database operations.
    Postgres Schema:
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username TEXT NOT NULL UNIQUE,
        email TEXT NOT NULL UNIQUE,
        full_name TEXT,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        is_active BOOLEAN NOT NULL DEFAULT true
    );

    CREATE TABLE comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        target_type TEXT NOT NULL DEFAULT 'post', -- e.g., 'post', 'article'
        target_id UUID, -- optional id of the target resource
        parent_comment_id UUID REFERENCES comments(id) ON DELETE SET NULL,
        content TEXT NOT NULL,
        metadata JSONB, -- optional structured metadata
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ
    );

    CREATE INDEX idx_comments_user_id ON comments(user_id);
    CREATE INDEX idx_comments_target ON comments(target_type, target_id);
    CREATE INDEX idx_comments_created_at ON comments(created_at DESC);
    `,
    outputType: z.object({
        sqlQuery: z.string().optional().describe("The SQL query generated based on the input question"),
})
})


async function main(q = ''){
    // try {
        const res = await run(sqlAgent, q);
        console.log(res.finalOutput.sqlQuery);
    // } catch (e) {
    //     if(e instanceof InputGuardrailTripwireTriggered){
    //         console.error("Out Guardrail Triggered:", e.message);
    //     }
    // }  
}

main("Write a SQL query to fetch all comments made by a user with a specific email address.")