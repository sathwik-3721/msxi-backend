import { appendChatToPDF, generateSpeechBuffer, downloadJSONFile, getPdfFileNames, chatHistory, storeChatSummary, getUniqueId, storeChatInJSON, clearAllFilesInSession, getJSONFileNames, getUsername, getChatHistory, surveyHistory } from "../utils/helper.js";
// import { poolPromise } from "../utils/dbConnection.js";
import { VertexAI } from '@google-cloud/vertexai';
import { Storage } from '@google-cloud/storage';
import Survey from "../models/survey.model.js";
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

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
        let surveyHistory = '';
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

        // get the base and system prompt
        const systemPrompt = process.env.SYSTEM_PROMPT;
        const basePrompt = process.env.BASE_PROMPT;

        surveyHistory = getChatHistory();
        console.log('sur', surveyHistory);

        // Get the previous chats
        if (surveyHistory.length === 0) {
            // Initial question from the model
            prompt = systemPrompt + basePrompt + "There is no previous chats from user since this is the initial response from the user" + userMessage;
            console.log('Initial Prompt:', prompt);
        } else {
            prompt = systemPrompt + basePrompt + "The current response from user is" + userMessage + "The Previous chats done are" + chatHistory;
            console.log('Done Prompt', prompt);
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
        // get the username
        const userName = getUsername();

        // Get the generative model
        const generativeModel = vertexAI.getGenerativeModel({
            model: process.env.MODEL,
        });

        // Generate the summary
        const result = await generativeModel.generateContent(process.env.SUMMARY_PROMPT + JSON.stringify(getChatHistory()));
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

        //  Fetch the JSON files too
        const sessionJSON = await getJSONFileNames();
        console.log('Session JSON:', sessionJSON)

        // Ensure sessionPDF is a string (or handle an array appropriately)
        if (!sessionPDF || typeof sessionPDF !== 'string') {
            throw new Error('Invalid sessionPDF: Expected a string.');
        }

        // Define the local file paths for PDF and JSON
        const sessionFolderPath = path.join(__dirname, `../session/`);
        const pdfPath = path.join(sessionFolderPath, sessionPDF);
        const jsonPath = path.join(sessionFolderPath, sessionJSON);

        console.log('PDF Path:', pdfPath);
        console.log('JSON Path:', jsonPath);

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
            fileUrls: {
                pdfUrl,
                jsonUrl
            }
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

// Controller to handle the survey continuation
export async function continueSurvey(req, res) {
    try {
        // Get the data from the body
        const { dealerName, dealerId, brandName, date } = req.body;
        console.log('Incoming data:', dealerName, dealerId, brandName, date);

        // Validate required parameters
        if (!dealerName || !dealerId || !brandName || !date) {
            return res.status(400).json({
                success: false,
                message: 'All details are required: dealer_name, dealer_code, brand_name, survey_date.',
            });
        }

        // Construct the session folder path
        const sessionFolder = path.resolve(__dirname, '../session');

        // Fetch URLs from the database
        const urlResponse = await Survey.getURLs(dealerName, dealerId, brandName, date);
        console.log('URLs fetched:', urlResponse);

        const { survey_json_url } = urlResponse; // Only using JSON file URL
        console.log('survey_json_url', survey_json_url);

        // Parse GCS bucket name and file path from the URL
        const match = survey_json_url.match(/^https:\/\/storage\.googleapis\.com\/([^\/]+)\/(.+)$/);
        if (!match) {
            return res.status(400).json({
                success: false,
                message: 'Invalid JSON file URL format.',
            });
        }

        const bucketName = match[1];
        const filePath = match[2];

        // Download JSON file using the helper function
        try {
            const downloadedFile = await downloadJSONFile(bucketName, filePath, sessionFolder);
            console.log('File downloaded successfully:', downloadedFile);

            // Respond with the file details
            return res.status(200).json({
                success: true,
                message: 'JSON file downloaded successfully.',
                file: downloadedFile,
            });
        } catch (err) {
            return res.status(500).json({
                success: false,
                message: 'Failed to download JSON file.',
                error: err.message,
            });
        }
    } catch (error) {
        console.error('Error occurred:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal Server Error',
            error: error.message,
        });
    }
}

// Controller to get all the previous surveys
export async function getSurveys(req, res) {
    try {
        // call the method to get the surveys
        const surveyResponse = await Survey.getSurveys();

        // if surveys are present
        if (surveyResponse.success) {
            return res.status(200).json({
                success: true,
                message: surveyResponse.message,
                data: surveyResponse.data,
            });
        } else {
            return res.status(404).json({
                success: false,
                message: surveyResponse.message,
                data: null,
            });
        }
    } catch (error) {
        console.error('Error while fetching previous surveys', error);
        throw error;
    }
}

// Controller to get surveys by id
export async function getSurveyById(req, res) {
    try {
        // Get the survey ID from query parameters or body
        const surveyId = req.body.surveyId;  // Assuming the ID might come from the params or the body

        // Validate that the surveyId is provided
        if (!surveyId) {
            return res.status(400).json({
                success: false,
                message: "Survey ID is required.",
                data: null,
            });
        }

        // Call the static method to get the survey by ID
        const surveyResponse = await Survey.getSurveyById(surveyId);

        // If survey fetched successfully
        if (surveyResponse.success) {
            return res.status(200).json({
                success: true,
                message: surveyResponse.message,
                data: surveyResponse.data,
            });
        } else {
            return res.status(404).json({
                success: false,
                message: surveyResponse.message,
                data: null,
            });
        }

    } catch (error) {
        console.error('Error while fetching survey by ID', error);
        return res.status(500).json({
            success: false,
            message: 'Error while fetching survey by ID.',
            error: error.message,
        });
    }
}