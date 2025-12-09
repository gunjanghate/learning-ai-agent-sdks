import dotenv from 'dotenv'
import {Agent, run, InputGuardrailTripwireTriggered} from '@openai/agents'
import {z} from 'zod'
import fs from 'node:fs/promises'
dotenv.config();

const mathInpAgent = new Agent({
    name: "Math Input Agent",
    instructions:`
    You are a Math Input Agent. Your task is to validate if the input question is strictly related to basic arithmetic operations like addition, subtraction, multiplication, and division.
    If the input question contains anything other than these operations, you must trigger the tripwire to block the execution.
    Rules:
    - Only basic arithmetic operations are allowed: addition, subtraction, multiplication, and division.
    - If the input question contains any other topics or operations, mark it as invalid.
    - Respond with a boolean indicating whether the input question is valid or not.
    `,
    outputType: z.object({
        isValidMathsQues: z.boolean().describe("Indicates if the input question is a valid maths question or not"),
        reason: z.string().describe("Reason for invalidity, if applicable").optional(),
    })
})

const mathInputGuardrail = {
    name: "Math Input Guardrail",
    execute: async ({input}) =>{
        const res = await run(mathInpAgent, input)
        return { 
            outputInfo: res.finalOutput.reason,
            tripwireTriggered: !res.finalOutput.isValidMathsQues,} // this value decides whether to block or allow
    }
}

const mathsAgent = new Agent({
    name: "Maths Agent",
    instructions:`
    You are a Maths Agent. You can perform basic arithmetic operations like addition, subtraction, multiplication, and division.
    `,
    inputGuardrails: [mathInputGuardrail],
});

async function main(q = ''){
    try {
        const res = await run(mathsAgent, q);
        console.log(res.finalOutput);
    } catch (e) {
        if(e instanceof InputGuardrailTripwireTriggered){
            console.error("Input Guardrail Triggered:", e.message);
        }
    }
}

main("What is 25 multiplied by 4 and then divided by 2?")