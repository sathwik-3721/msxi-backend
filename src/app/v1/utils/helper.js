import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import textToSpeech from '@google-cloud/text-to-speech';
import { Storage } from '@google-cloud/storage';
import { fileURLToPath } from 'url'; 
import path, { dirname } from 'path';
import { marked } from 'marked';
import { JSDOM } from 'jsdom'; 
import dotenv from 'dotenv';
import fs from 'fs';
const { TextToSpeechClient } = textToSpeech;

// load env variables
dotenv.config();

// get the bucket name from the env
const bucketName = process.env.BUCKET_NAME;

// Get the directory name from import.meta.url
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// initialize the client for text to speech service
const client = new textToSpeech.TextToSpeechClient();

// stotage initialize 
const storage = new Storage({
    projectId: process.env.PROJECT_ID,
});

// define a chatHistory variable to store all the chat
export let chatHistory = [];

// define a new surveyHistory
export let surveyHistory = {};

// store the username
export let username = '';

// declare a unique id variable for storing it
let uniqueId = '';

// function to set uniqueId
export function setUniqueId(id) {
    uniqueId = id;
}

// function to get the uniqueId
export function getUniqueId() {
    return uniqueId;
}

// function to set username
export function setUsername(user_name) {
    username = user_name;
}

// function to get the username
export function getUsername() {
    return username;
}

// function to set the chatHistiry
export function setChatHistory(questions, answer) {
    try {
        // Ensure questions and answers are provided
        if (!questions || !answer) {
            throw new Error('Questions and answer are required.');
        }

        // Create a new chat history entry without id (generated automatically)
        const newHistory = {
            id: surveyHistory.length + 1,  // Auto-generate unique ID based on length
            questions,
            answer
        };

        // Save the new chat history entry
        surveyHistory.push(newHistory);

        console.log('Chat history saved successfully.');
        return {
            success: true,
            message: 'Chat history saved successfully.',
        };
    } catch (error) {
        console.error('Error saving chat history:', error.message);
        return {
            success: false,
            message: error.message,
        };
    }
}

// function to get the chat history
export function getChatHistory() {
    try {
        // If chat history exists, return the array, else handle gracefully
        if (surveyHistory.length === 0) {
            return {
                success: false,
                message: 'No chat history available.',
                data: null,
            };
        }

        return {
            success: true,
            message: 'Chat history fetched successfully.',
            data: surveyHistory,
        };
    } catch (error) {
        console.error('Error fetching chat history:', error.message);
        return {
            success: false,
            message: error.message,
        };
    }
}

// function to add the user chat into a PDF
export async function appendChatToPDF(question, answer) {
    try {
        const sessionFolderPath = path.resolve(__dirname, '../session');
        const files = fs.readdirSync(sessionFolderPath);

        const pdfFiles = files.filter(file => file.endsWith('.pdf'));
        if (pdfFiles.length === 0) {
            throw new Error('No PDF files found in the session folder.');
        }

        const filePath = path.join(sessionFolderPath, pdfFiles[0]);
        const existingPdfBytes = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        const logoBytes = fs.readFileSync('./assets/MSXi_Logo_Final.png');
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const logoDims = logoImage.scale(0.15);

        let newPage = pdfDoc.addPage(); // Changed from `const` to `let`
        const { width, height } = newPage.getSize();

        // Draw border
        newPage.drawRectangle({
            x: 20,
            y: 20,
            width: width - 40,
            height: height - 40,
            borderColor: rgb(0, 0, 0),
            borderWidth: 2,
        });

        // Draw logo
        newPage.drawImage(logoImage, {
            x: 30,
            y: 30,
            width: logoDims.width,
            height: logoDims.height,
        });

        let y = height - 60; // Initial Y position for content
        const marginX = 40;
        const lineHeight = 20; // Height of each text line
        const fontSize = 14;

        // Function to handle adding text with line wrapping
        const addTextWithWrapping = (page, text, font, size, color) => {
            const words = text.split(' ');
            let line = '';
            const maxWidth = width - 2 * marginX;

            for (const word of words) {
                const testLine = line + word + ' ';
                const testWidth = font.widthOfTextAtSize(testLine, size);

                if (testWidth > maxWidth) {
                    if (y < 40) { // Check if we need a new page
                        page = pdfDoc.addPage(); // Update the `page` variable
                        y = height - 60;
                    }

                    page.drawText(line.trim(), { x: marginX, y, size, font, color });
                    y -= lineHeight; // Move to the next line
                    line = word + ' ';
                } else {
                    line = testLine;
                }
            }

            // Draw remaining text
            if (line.trim() !== '') {
                if (y < 40) {
                    page = pdfDoc.addPage(); // Update the `page` variable
                    y = height - 60;
                }
                page.drawText(line.trim(), { x: marginX, y, size, font, color });
                y -= lineHeight;
            }

            return page;
        };

        // Draw Question label (Bold)
        newPage.drawText('Question:', {
            x: marginX,
            y,
            size: fontSize,
            font: helveticaBoldFont,
            color: rgb(0, 0, 0),
        });

        y -= lineHeight; // Move down after the label

        // Draw Question text
        newPage = addTextWithWrapping(newPage, question.replace(/\n/g, ' ').trim(), helveticaFont, fontSize, rgb(0, 0, 0));

        // Draw Answer label (Bold)
        newPage.drawText('Answer:', {
            x: marginX,
            y,
            size: fontSize,
            font: helveticaBoldFont,
            color: rgb(0, 0, 0),
        });

        y -= lineHeight; // Move down after the label

        // Parse and draw Answer text
        const parsedAnswer = marked(answer);
        const dom = new JSDOM(parsedAnswer);
        const elements = dom.window.document.body.childNodes;

        for (const element of elements) {
            const text = element.textContent.trim();
            let font = helveticaFont;

            if (element.nodeName === 'STRONG' || element.nodeName === 'B') {
                font = helveticaBoldFont;
            }

            newPage = addTextWithWrapping(newPage, text.replace(/\n/g, ' '), font, fontSize, rgb(0, 0, 0)); // Replace \n with space
        }

        // Draw page numbers
        pdfDoc.getPages().forEach((page, index) => {
            page.drawText(`Page ${index + 1}`, {
                x: width / 2 - 20,
                y: 30,
                size: 12,
                font: helveticaFont,
                color: rgb(0, 0, 0),
            });
        });

        const modifiedPdfBytes = await pdfDoc.save();
        fs.writeFileSync(filePath, modifiedPdfBytes);
        console.log('Chat added to PDF successfully with markdown formatting and proper text wrapping.');
    } catch (error) {
        console.error('Error while appending chat to PDF:', error);
    }
}

// helper function to enable cors for it
export async function enableCORS() {
    try {
        const bucket = storage.bucket(bucketName);

        // define the cors config
        const corsConfig = [
            {
                origin: ['*'], // allow all origin requests
                method: ['GET', 'PUT', 'POST', 'DELETE'], // allowed methods
            },
        ];

        // set the cors configuration for the bucket
        await bucket.setCorsConfiguration(corsConfig);
        console.log('CORS configuration has been set for the bucket');
    } catch(error) {
        console.error('Error enabling CORS:', error.message);
    }
}

// function to delete the pdf contents
export async function clearAllFilesInSession() {
    try {
        // Define the path to the session folder
        const sessionFolderPath = path.resolve(__dirname, '../session');

        // Check if the session folder exists
        if (!fs.existsSync(sessionFolderPath)) {
            console.error("Session folder not found at path:", sessionFolderPath);
            return;
        }

        // Read all files in the session folder
        const files = fs.readdirSync(sessionFolderPath);

        // If no files are found
        if (files.length === 0) {
            console.log("No files found in the session folder.");
            return;
        }

        // Loop through each file in the session folder and delete it
        for (const file of files) {
            const filePath = path.join(sessionFolderPath, file);
            console.log('Deleting file:', filePath);

            // Check if the file exists and is not empty
            if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
                console.error("File not found or is empty at path:", filePath);
                continue;
            }

            // Delete the file
            fs.unlinkSync(filePath);
            console.log("File deleted from the session:", filePath);
        }
    } catch (error) {
        console.error('Error while deleting files from session:', error);
    }
}

// function to delete the existing file in the bucket
export async function deletePDF() {
    try {
        // get all files
        const [ files ] = await storage.bucket(bucketName).getFiles();

        // delete all files
        await Promise.all(files.map(file => file.delete()));

        console.log('Delete all files in the bucket');
        const [ files_after ] = await storage.bucket(bucketName).getFiles();
        console.log('Delete after', files_after);
    } catch(error) {
        console.error('Error while deleting the objects in the bucket', error.message);
    }
}

// add dealer info to pdf
export async function appendDealerInfoToPDF(dealerName, dealerId, brandName, date, location, visitType) {
    try {
        const timestamp = Date.now();
        const pdfFilename = `userSession_${timestamp}.pdf`;
        const jsonFilename = `userSession_${timestamp}.json`;
        const sessionFolderPath = path.resolve(__dirname, '../session'); // Ensure this path resolves correctly
        const pdfPath = path.join(sessionFolderPath, pdfFilename);
        const jsonPath = path.join(sessionFolderPath, jsonFilename);

        console.log('pdf path:', pdfPath);
        console.log('json path:', jsonPath);
        console.log('dirname:', __dirname);

        // Check if the session folder exists, if not, create it
        if (!fs.existsSync(sessionFolderPath)) {
            fs.mkdirSync(sessionFolderPath, { recursive: true });
        }

        // ----------------------- PDF Creation -----------------------
        const pdfDoc = await PDFDocument.create();
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const logoBytes = fs.readFileSync('assets/MSXi_Logo_Final.png');
        const logoImage = await pdfDoc.embedPng(logoBytes);

        const page = pdfDoc.addPage();
        const { width, height } = page.getSize();

        // Draw border
        page.drawRectangle({
            x: 20,
            y: 20,
            width: width - 40,
            height: height - 40,
            borderColor: rgb(0, 0, 0),
            borderWidth: 2,
        });

        // Add date and time
        const currentDateTime = new Date().toLocaleString();

        // Draw center main heading
        const headingText = "Chat Report";
        const headingFontSize = 18;
        const headingWidth = helveticaBoldFont.widthOfTextAtSize(headingText, headingFontSize);

        page.drawText(headingText, {
            x: (width - headingWidth) / 2,
            y: height - 50,
            size: headingFontSize,
            font: helveticaBoldFont,
            color: rgb(0, 0, 0),
        });

        // Add date and time below heading
        const dateTimeFontSize = 14;
        const dateTimeWidth = helveticaFont.widthOfTextAtSize(currentDateTime, dateTimeFontSize);

        page.drawText(currentDateTime, {
            x: (width - dateTimeWidth) / 2,
            y: height - 75,
            size: dateTimeFontSize,
            font: helveticaFont,
            color: rgb(0, 0, 0),
        });

        // Add logo bottom left
        const logoDims = logoImage.scale(0.15);
        page.drawImage(logoImage, {
            x: 30,
            y: 30,
            width: logoDims.width,
            height: logoDims.height,
        });

        // Add dealer info
        const dealerInfoLines = [
            { label: 'Dealer Name:', value: dealerName },
            { label: 'Dealer ID:', value: dealerId },
            { label: 'Brand Name:', value: brandName },
            { label: 'Date of Visit:', value: date },
            { label: 'Location:', value: location },
            { label: 'Visit Type:', value: visitType },
        ];

        let y = height - 120; // Start 120 units below the top border

        dealerInfoLines.forEach(({ label, value }) => {
            // Draw bold label (heading)
            page.drawText(label, {
                x: 40, // Align text with left border
                y,
                size: 14,
                font: helveticaBoldFont, // Use bold font for headings
                color: rgb(0, 0, 0),
            });

            // Draw regular value
            page.drawText(value, {
                x: 160, // Position value to the right of the label
                y,
                size: 14,
                font: helveticaFont, // Use regular font for values
                color: rgb(0, 0, 0),
            });

            y -= 20; // Move to the next line
        });

        // Draw page number
        page.drawText('Page 1', {
            x: width / 2 - 20, // Center-align the page number
            y: 30, // Place above the bottom border
            size: 12,
            font: helveticaFont,
            color: rgb(0, 0, 0),
        });

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(pdfPath, pdfBytes);
        console.log('Dealer Info PDF saved to:', pdfFilename);

        // ----------------------- JSON Modification -----------------------
        // Prepare the custom ID
        const dealerInfoId = `${dealerId}${dealerName}${brandName}${date}`;
        const dealerInfo = {
            dealerName,
            dealerId,
            brandName,
            date,
            location,
            visitType
        };

        let finalJsonData = {};

        // If the file exists, read and parse its content
        if (fs.existsSync(jsonPath)) {
            const fileContent = fs.readFileSync(jsonPath, 'utf-8');
            try {
                finalJsonData = JSON.parse(fileContent);
            } catch (err) {
                console.error('Failed to parse JSON file. Reinitializing.', err);
            }
        }

        // Add the new dealer information under the custom ID
        finalJsonData[dealerInfoId] = dealerInfo;

        // Save the updated JSON back to the file
        fs.writeFileSync(jsonPath, JSON.stringify(finalJsonData, null, 2));
        console.log('Dealer Info JSON saved to:', jsonFilename);

        return { pdfPath, jsonPath };
    } catch (error) {
        console.error('Error creating PDF and JSON:', error);
        throw error;
    }
}

// get the existing session pdf name
export async function getPdfFileNames() {
    try {
        const sessionFolderPath = path.resolve(__dirname, '../session');
        console.log('sess', sessionFolderPath);
        
        // Read all files in the session folder asynchronously
        const files = await fs.promises.readdir(sessionFolderPath);
        
        // Filter out PDF files
        const pdfFiles = files.filter(file => file.endsWith('.pdf'));
        
        // Return the PDF file names
        console.log('PDF files in the session folder:', pdfFiles);
        return pdfFiles.toString();
    } catch (error) {
        console.error('Error reading PDF files:', error);
        return [];
    }
}

// get the existing session pdf name
export async function getJSONFileNames() {
    try {
        const sessionFolderPath = path.resolve(__dirname, '../session');
        console.log('sess', sessionFolderPath);
        
        // Read all files in the session folder asynchronously
        const files = await fs.promises.readdir(sessionFolderPath);
        
        // Filter out PDF files
        const jsonFiles = files.filter(file => file.endsWith('.json'));
        
        // Return the PDF file names
        console.log('JSON files in the session folder:', jsonFiles);
        return jsonFiles.toString();
    } catch (error) {
        console.error('Error reading JSON files:', error);
        return [];
    }
}

// helper function to convert the text into buffer to play it into UI frontend
export async function generateSpeechBuffer(text) {
    try {
        // construct the request for API
        const request = {
            // passing text as input
            input: { text: text },
            // get the language code and model from env
            voice: { languageCode: process.env.LANGUAGE_CODE, name: process.env.MODEL_NAME, ssmlGender: process.env.SSML_GENDER },
            // select the audio configuration
            audioConfig: {audioEncoding: process.env.AUDIO_ENCODING},
        };

        // perform the request
        const [response] = await client.synthesizeSpeech(request);

        // return the binary audio content
        return response.audioContent;

    } catch(error) {
        console.error('Error while parsing the text into speech content:', error);
    }
}

// function to store the summarized content
export async function storeChatSummary(summary) {
    try {
        console.log('Received summary:', summary);

        // Ensure summary is a string
        if (typeof summary !== 'string') {
            throw new Error('Summary must be a string.');
        }

        // Get session folder path and check for PDFs
        const sessionFolderPath = path.resolve(__dirname, '../session');
        const files = fs.readdirSync(sessionFolderPath);

        const pdfFiles = files.filter(file => file.endsWith('.pdf'));
        if (pdfFiles.length === 0) {
            throw new Error('No PDF files found in the session folder.');
        }

        const filePath = path.join(sessionFolderPath, pdfFiles[0]);
        const existingPdfBytes = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        // Embed Fonts
        const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const helveticaBoldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

        // Embed Logo
        const logoBytes = fs.readFileSync('./assets/MSXi_Logo_Final.png');
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const logoDims = logoImage.scale(0.15);

        // Add a new page
        const newPage = pdfDoc.addPage();
        const { width, height } = newPage.getSize();

        // Draw a border
        newPage.drawRectangle({
            x: 20,
            y: 20,
            width: width - 40,
            height: height - 40,
            borderColor: rgb(0, 0, 0),
            borderWidth: 2,
        });

        // Draw logo
        newPage.drawImage(logoImage, {
            x: 30,
            y: height - 60, // Top margin
            width: logoDims.width,
            height: logoDims.height,
        });

        let y = height - 100; // Initial Y position for content

        // Add Title
        newPage.drawText('Summarized report of the survey done by the user', {
            x: 40,
            y,
            size: 16,
            font: helveticaBoldFont,
            color: rgb(0, 0, 0),
        });

        y -= 40;

        // Process the summary text to fit within line length and pages
        const sanitizedSummary = summary.replace(/\n/g, ' ').trim();
        const summaryLines = sanitizedSummary.split(/(.{80})/).filter(Boolean); // Break text into lines of 80 chars max

        // Write each line to the PDF, moving Y position
        for (const line of summaryLines) {
            if (y < 60) { // Add new page if out of space
                const newPage = pdfDoc.addPage();
                y = height - 60;
            }

            newPage.drawText(line, {
                x: 40,
                y,
                size: 14,
                font: helveticaFont,
                color: rgb(0, 0, 0),
            });

            y -= 20; // Move cursor down
        }

        // Add page numbers
        const totalPages = pdfDoc.getPageCount();
        pdfDoc.getPages().forEach((page, index) => {
            page.drawText(`Page ${index + 1} of ${totalPages}`, {
                x: width / 2 - 20,
                y: 30,
                size: 12,
                font: helveticaFont,
                color: rgb(0, 0, 0),
            });
        });

        // Save updated PDF
        const modifiedPdfBytes = await pdfDoc.save();
        fs.writeFileSync(filePath, modifiedPdfBytes);

        console.log('Chat summary added to PDF successfully.');
    } catch (error) {
        console.error('Error while storing chat summary:', error);
    }
}

// function to store a chat in the array with a unique ID
export async function storeChatInJSON(userMessage, botResponse) {
    try {
        const sessionFolderPath = path.resolve(__dirname, '../session');

        // Get all JSON files in the session folder
        const files = fs.readdirSync(sessionFolderPath).filter(file => file.endsWith('.json'));

        if (files.length === 0) {
            throw new Error('No session JSON files found.');
        }

        // Get the most recent session file
        const mostRecentFile = files[0];
        const chatFilePath = path.join(sessionFolderPath, mostRecentFile);

        // Initialize session data with default structure
        let sessionData = { dealerInfo: {}, chatHistory: [] };

        if (fs.existsSync(chatFilePath)) {
            const data = fs.readFileSync(chatFilePath, 'utf-8');

            try {
                sessionData = JSON.parse(data); // Parse the existing session file data
            } catch (err) {
                console.error('Error parsing the JSON file. Using default structure.');
            }
        }

        // Ensure chatHistory is always initialized as an array
        let chatHistory = sessionData.chatHistory || [];

        // Generate the next unique chat ID
        const id = chatHistory.length + 1;

        // Create new chat entry
        const newChat = {
            id: id,
            question: userMessage,
            answer: botResponse,
        };

        // Add new chat entry to the chatHistory array
        chatHistory.push(newChat);

        // Update sessionData with the updated chatHistory
        sessionData.chatHistory = chatHistory;

        // Log the updated session data (debugging purposes)
        console.log('Updated session data before saving:', JSON.stringify(sessionData, null, 2));

        // Write the combined data (existing dealerInfo + updated chatHistory) back to the JSON file
        fs.writeFileSync(chatFilePath, JSON.stringify(sessionData, null, 2));

        console.log(`Chat stored successfully with ID: ${id} in file: ${mostRecentFile}`);
    } catch (err) {
        console.error('Error occurred while storing the chat details:', err);
    }
}

// function to download the files 
export async function downloadJSONFile(bucketName, filePath, localFolder) {
    try {
        // get the filename
        const fileName = path.basename(filePath);

        // define the local file path
        const localPath = path.join(localFolder, fileName);

        // get the file content from GCS
        const file = storage.bucket(bucketName).file(filePath);

        // download the file to local dir
        await file.download({ destination: localPath });
        console.log('File dowbloaded sucessfully');

        return { fileName, filePath: localPath };
    } catch (err) {
        console.error('Error while downloading files', err);
        throw err;
    }
}

// function to complete the end form
// export as