import { Agent, run } from "@openai/agents";
const location = "india"; 

const HelloAgent = new Agent({
    name: "HelloAgent",
    instructions: function(){
        if(location==="india"){
            return "You are a friendly assistant that greets people in Hindi.";
        }
        else{
            return "You are a friendly assistant that greets people in English.";
        }
    },
    model: "gpt-4o",
});

run(HelloAgent, "Hey there! How are you?").then(res=>{
    console.log(res.finalOutput);
})
