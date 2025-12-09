import dotenv from 'dotenv'
import {Agent, tool} from '@openai/agents'
import {z} from 'zod'
import fs from'node:fs/promises'
dotenv.config();


const fetchAvailablePlans = tool({
    name: "fetchAvailablePlans",
    description:"Feteches available plans from internet",
    parameters: z.object({}),
    execute: async function(){
        return [{
            plan_id: '1',
            price_attr: 409,
            speed: '30mb/s'
        },{
            plan_id: '2',
            price_attr: 509,
            speed: '50mb/s'
        },{
            plan_id: '3',
            price_attr: 609,
            speed: '60mb/s'
        }
    ]
    }
})

const processRefund = tool({
    name:"processFund",
    description: " This toll processes refund",
    parameters: z.object({
        cust_id: z.string().describe(""),
        reason: z.string().describe("")
    }),
    execute: async function({cust_id, reason}){
        await fs.appendFile('./refunds.txt', `Refund for ${cust_id} for ${reason}`,
            'utf-8'
        )

        return {refundIssued: true}
    }
})

const refundAgent = new Agent({
    name : "Refund Agent",
    instructions: `You are a Refund Agent...`,
    tools: [processRefund]
})

const salesAgent = new Agent({
    name: "Sales Agent",
    instructions: `
    You are a Sales Agent. Be professional, concise, and helpful. Your goals:
    - Rapidly qualify leads by asking targeted questions (budget, timeline, decision-maker, primary use-case, number of users, current solution).
    - Recommend the most suitable plan or configuration and explain benefits in plain language.
    - Provide clear pricing guidance (exact if known, otherwise a reasonable range) and state assumptions.
    - Handle common objections with concise rebuttals and alternatives.
    - Produce a clear next-step and a short follow-up message or demo invitation.

    Behavior and constraints:
    - If required information is missing, ask one concise clarifying question at a time.
    - Do not fabricate facts, features, or exact contractual terms. If you don’t know pricing or policy, say so and provide how to get an accurate quote.
    - Avoid legal, medical, or regulatory advice; recommend consulting an appropriate expert when needed.
    - Keep replies short (3–6 sentences) unless the user requests a full proposal.
    - Always end with a single clear call-to-action (schedule demo, request budget, confirm timeline, provide contact email).

    Response format (use this structure):
    Summary: 1–2 sentence recap of customer need.
    Recommendation: short recommended plan/configuration and 3 key benefits (bulleted).
    Pricing estimate: exact price or range + assumptions.
    Objections & responses: 1–2 likely objections and one-sentence handling.
    Next steps: 1–2 concrete actions and scheduling suggestion.
    Follow-up email: 2–3 sentence template to send the lead.

    Example:
    Summary: You need a hosted analytics solution for 200 users with near-real-time dashboards.
    Recommendation: Pro Plan — scalable dashboards, SSO, 99.9% SLA.
    Pricing estimate: $X–$Y/month (assumes 200 MAUs, basic support).
    Objections & responses: "Too expensive" → highlight ROI and phased rollout.
    Next steps: Confirm budget and availability for a 30-minute demo.
    Follow-up email: "Thanks — can we schedule a 30-minute demo this week to review requirements and pricing?"

    Always tailor details to the user's inputs and ask for missing information before finalizing proposals.
    `,
    tools: [fetchAvailablePlans, refundAgent.asTool({
        toolName: "refund expert",
        toolDescription: "Handkes refund questions and requests."

    })]
})


async function runaAgent(query = ''){
    const result = await runaAgent(salesAgent, query)
    console.log(result.finalOutput);

}

runaAgent("I want to buy internet plan for my office")