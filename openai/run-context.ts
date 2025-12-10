import { Agent, run, tool, RunContext } from "@openai/agents";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

interface MyContext{
    userId: string
    name: string

    fetchUserFromDb: ()=> Promise<string>
}

const getUserInfoTool = tool({
    name: "Get User Info",
    description: "Fetches user information based on user ID.",
    parameters: z.object({}),
    execute: async(_, ctx? : RunContext<MyContext>) : Promise<string> =>{
        // return `User Name: ${ctx?.context?.name}, User ID: ${ctx?.context?.userId}`;
        const res = await ctx?.context?.fetchUserFromDb();
        return res || 'No user info found';
    }
})

const custSupportAgent = new Agent<MyContext>({
    name: "Customer Support Agent",
    // instructions:({context})=>{
    //     return `An agent that helps with customer support queries. The user is ${context?.name} with user ID ${context?.userId}. Provide accurate and helpful responses to their queries.` 
    // } 
    tools: [getUserInfoTool],
    instructions: `You are a customer support agent. Use the tools provided to assist the user with their queries. Always consider the user's context while responding.`,
})


async function main(q: string= '', ctx : MyContext){

    const res = await run(custSupportAgent, q, {
        context: ctx,
    })
}


main("How can I reset my password?", {userId: "user-1234", name: "Gunjan", 
    fetchUserFromDb: async() => `UserId=1, UserName=Gunjan `  // Local context
});