import { Agent, run, tool } from "@openai/agents";
import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const agent = new Agent({
    name: "Story teller",
    instructions:
    `You are s atpry.....`
})


async function* streamOutput(q: string){
    const res = await run(agent, q, {stream: true});
    const stream = res.toTextStream()

    for await (const val of stream){
        yield {isCompleted: false, value: val}
    }

    yield {isCompleted: true, value: res.finalOutput}
}

async function main(q : string =''){
    // const res = await run(agent, q, {stream: true});
    // // const stream = res.toTextStream()

    // // for await (const val of stream){
    // //     console.log(val)
    // // }

    // res.toTextStream({compatibleWithNodeStreams: true
    // }).pipe(process.stdout)
    // console.log(res.finalOutput)

    for await (const o of streamOutput(q)){
        console.log(o)
    }
}

main("Tell me a story")
