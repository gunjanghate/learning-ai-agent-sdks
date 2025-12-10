import dotenv from 'dotenv';
import { Agent, tool } from 'openai-agent-framework';
import {OpenAI} from 'openai';

dotenv.config();
const client = new OpenAI()

client.conversations.create({}).then((e)=>{
    console.log("Conv Thread created: ",e.id)
})