import { Agent, run, tool } from "@openai/agents";
import { z } from "zod";
import axios from "axios";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

const getWeatherResultSchema = agent.object({
    city: z.string().describe("The city to get the weather for"),
    degree_c: z.number().describe("The temperature in degrees Celsius"),
    condition: z.string().optional.describe("The weather condition description"),
})
// Load environment variables from a .env file if present
dotenv.config();
const getWeatherTool = tool({
    name: "getWeather",
    description: "Get the current weather for a given location.",
    parameters: z.object({
        city: z.string().describe("The city to get the weather for"),
    }),
    execute: async function ({ city }) {
        // Mock weather data for demonstration purposes
        const url = `https://wttr.in/${city.toLowerCase()}?format=%C+%t+%h+%p`;
        const response = await axios.get(url, { responseType: 'text' });
        const data = response.data;

        return `Weather in ${city}: ${data}`;
    }
})
const sendEmailTool = tool({
    name: "sendEmail",
    description: "Send an email to a specified recipient.",
    parameters: z.object({
        recipient: z.string().describe("The email address of the recipient"),
        subject: z.string().describe("The subject of the email"),
        body: z.string().describe("The body content of the email"),
    }),
    execute: async function ({ recipient, subject, body }) {
        // Basic validation
        if (!recipient || typeof recipient !== 'string') {
            throw new Error('Invalid recipient');
        }
        if (!subject || typeof subject !== 'string') {
            throw new Error('Invalid subject');
        }
        if (!body || typeof body !== 'string') {
            throw new Error('Invalid body');
        }

        // Read SMTP configuration from environment variables
        const host = process.env.SMTP_HOST;
        const port = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : undefined;
        const user = process.env.SMTP_USER;
        const pass = process.env.SMTP_PASS;
        const from = process.env.FROM_EMAIL || user;

        if (!host || !port || !user || !pass) {
            throw new Error('Missing SMTP configuration. Please set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS environment variables. Optionally set FROM_EMAIL.');
        }

        // Create transporter
        const transporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465, // true for 465, false for other ports
            auth: {
                user,
                pass,
            },
        });

        // Verify connection (will throw if auth/connection fails)
        try {
            await transporter.verify();
        } catch (err) {
            throw new Error(`SMTP connection/verification failed: ${err.message}`);
        }

        // Send the message
        try {
            const result = await transporter.sendMail({
                from,
                to: recipient,
                subject,
                text: body,
                html: body.replace(/\n/g, '<br />'),
            });

            return {
                success: true,
                message: `Email queued/sent (messageId=${result.messageId})`,
                messageId: result.messageId,
                accepted: result.accepted || [],
                rejected: result.rejected || [],
            };
        } catch (err) {
            // Return a structured error so the agent can surface it
            return {
                success: false,
                error: `Failed to send email: ${err && err.message ? err.message : String(err)}`,
            };
        }
    }
})
const agent = new Agent({
    instructions: `
    You are an expert weather forecaster.
    Given a location, provide a detailed weather forecast including temperature, humidity, and chance of precipitation.
    `,
    model: "gpt-4o",
    tools: [getWeatherTool, sendEmailTool],
    outputType: getWeatherResultSchema,
})

async function main(query = '') {
    const res = await run(agent, query);
    console.log(res.finalOutput);
}

main("What's the weather like in New York City today?");