import { appendChatToPDF, generateSpeechBuffer, getPdfFileNames, chatHistory, storeChatSummary, getUniqueId, storeChatInJSON, clearAllFilesInSession } from "../utils/helper.js";
// import { poolPromise } from "../utils/dbConnection.js";
import { VertexAI } from '@google-cloud/vertexai';
import { Storage } from '@google-cloud/storage';
import Survey from "../models/survey.model.js";
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Get the bucket name from env
const bucketName = process.env.BUCKET_NAME;

// Get the directory name from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
console.log('Directory:', __dirname, typeof __dirname);

// Initialize Vertex AI
const vertexAI = new VertexAI({
    project: process.env.PROJECT_ID,
    location: process.env.LOCATION,
});

// Controller to handle response from bot
export async function beginSurvey(req, res) {
    try {
        // const connection = await poolPromise;
        // const query = "select * from survey_details";
        // connection.execSql(new Request(query, (err, rowCount, rows) => {
        //     if (err) {
        //         console.error('Query execution failed:', err);
        //     } else {
        //         console.log(`Query executed successfully. Rows: ${rowCount}`, rows);
        //     }
        // }));
        // console.log('con,', connect);
        const unid = getUniqueId();
        console.log('uniq', unid);
        // Initialize the empty prompt variable
        let prompt = "";

        // Get the user message from body
        const userMessage = req.body.userMessage;
        if (!userMessage) {
            return res.status(400).json({
                success: false,
                message: 'User message is required.',
            });
        }

        // Initialize generative model
        const generativeModel = vertexAI.getGenerativeModel({
            model: process.env.MODEL,
        });

        // Get the previous chats
        if (chatHistory.length === 0) {
            // Initial question from the model
            prompt = process.env.BASE_PROMPT + "There is no previous chats from user since this is the initial response from the user" + userMessage;
            // console.log('Prompt:', prompt);
        } else {
            prompt = process.env.BASE_PROMPT + chatHistory + "The current response from user is" + userMessage;
        }

        // Generate content
        const result = await generativeModel.generateContent(prompt);
        const botResponse = result.response.candidates[0].content.parts[0].text;

        // Add survey data to PDF
        await appendChatToPDF(userMessage, botResponse);

        // Store the user chat into JSON format
        await storeChatInJSON(userMessage, botResponse);

        // Get speech buffer for the text
        const audioBuffer = await generateSpeechBuffer(botResponse);

        // Send the response
        return res.status(200).json({
            success: true,
            botResponse,
            audioContent: audioBuffer
        });
    } catch (err) {
        console.error('Error occurred:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: err,
        });
    }
}

// Controller to handle the survey report upload
export async function endSurvey(req, res) {
    try {
        // get the userName from body
        const { userName } = req.body;
        console.log('user', userName);

        // Get the generative model
        const generativeModel = vertexAI.getGenerativeModel({
            model: process.env.MODEL,
        });

        // Generate the summary
        const result = await generativeModel.generateContent(process.env.SUMMARY_PROMPT + JSON.stringify(chatHistory));
        const summary = result.response.candidates[0].content.parts[0].text;

        console.log('Summary:', summary);

        // Function to store the summary of the report
        await storeChatSummary(summary);

        if (!bucketName || typeof bucketName !== 'string') {
            throw new Error('GCP_BUCKET_NAME environment variable is not set or is not a string.');
        }

        // Fetch the PDF name (based on the most recent session or similar logic)
        const sessionPDF = await getPdfFileNames();
        console.log('Session PDF:', sessionPDF, typeof sessionPDF);

        // Ensure sessionPDF is a string (or handle an array appropriately)
        if (!sessionPDF || typeof sessionPDF !== 'string') {
            throw new Error('Invalid sessionPDF: Expected a string.');
        }

        // Define the local file paths for PDF and JSON
        const sessionFolderPath = path.join(__dirname, `../session/`);
        const pdfPath = path.join(sessionFolderPath, sessionPDF);
        const jsonPath = path.join(sessionFolderPath, `userSession_${sessionPDF.split('_')[1].replace('.pdf', '.json')}`);

        console.log('PDF Path:', pdfPath);
        console.log('JSON Path:', jsonPath);

        // Verify the files exist before uploading
        try {
            // Check if both PDF and JSON files exist
            await fs.promises.access(pdfPath); // Ensure PDF exists
            await fs.promises.access(jsonPath); // Ensure JSON exists
            console.log('Files exist:', { pdfPath, jsonPath }); // Confirm files exist
        } catch (accessError) {
            console.error('Access error:', accessError); // Log the exact access error
            throw new Error(`One or both files do not exist: ${pdfPath}, ${jsonPath}`);
        }

        // GCP bucket destination - Restructuring URL
        const pdfDestination = `${userName}/session/pdf/${sessionPDF}`;
        const jsonDestination = `${userName}/session/json/${path.basename(jsonPath)}`;

        console.log('PDF Destination:', pdfDestination);
        console.log('JSON Destination:', jsonDestination);

        // Initialize the Google Cloud Storage
        const storage = new Storage({
            projectId: process.env.PROJECT_ID,
        });  

        // Upload the PDF file to GCP
        await storage.bucket(bucketName).upload(pdfPath, {
            destination: pdfDestination,
            gzip: true,
            metadata: {
                cacheControl: 'public, max-age=31536000',
            },
        });

        // Upload the JSON file to GCP
        await storage.bucket(bucketName).upload(jsonPath, {
            destination: jsonDestination,
            gzip: true,
            metadata: {
                cacheControl: 'public, max-age=31536000',
            },
        });

        console.log('Files uploaded successfully');

        // Construct the public URLs for both PDF and JSON
        const pdfUrl = `https://storage.googleapis.com/${bucketName}/${pdfDestination}`;
        const jsonUrl = `https://storage.googleapis.com/${bucketName}/${jsonDestination}`;

        console.log('PDF URL:', pdfUrl);
        console.log('JSON URL:', jsonUrl);

        // add the urls into table
        await Survey.insertURLs(pdfUrl, jsonUrl);

        // Clear existing PDF content (if required by the business logic)
        await clearAllFilesInSession();

        // Optional: Clear the chatHistory after completion if needed
        // chatHistory = null;

        return res.status(201).json({
            success: true,
            message: 'Files successfully uploaded',
            pdfUrl,
            jsonUrl,
            surveyHistory: chatHistory,
        });
    } catch (error) {
        console.error('Error occurred:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message,
        });
    }
}