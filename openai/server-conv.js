import {Agent, run} from "@openai/agents"
import dotenv from "dotenv"
import {z} from "zod"
dotenv.config()



const execSQL = tool({
    name: "Execute SQL Query",
    description: "Executes a SQL query against the Postgres database and returns the results.",
    inputSchema: z.object({
        sql: z.string().describe("The SQL query to be executed"),
    }),
    execute: async function({sql}){
        console.log("Executing SQL Query:", sql)
        return 'done';
    }
})

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

}),
    tools: [execSQL]
})

async function main(q = ''){

    const res = await run(sqlAgent, q, {
        conversationId: "conv-1234",
    });
    console.log(res.finalOutput.sqlQuery);
}

// main("Find all comments made by the user with username 'john_doe'."); // total run turn will be 2 (1 for run function and 1 for tool execution)

main("Hi, My name is GG")