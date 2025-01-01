import { poolPromise } from "../utils/dbConnection.js";
import { getUniqueId } from "../utils/helper.js";

class Survey {
    static async insertURLs(survey_pdf_url, survey_json_url) {
        try {
            // Get the uniqueId from the helper
            const uniqueId = getUniqueId();

            // Validate URLs and uniqueId
            if (!uniqueId) {
                throw new Error("Unique ID is missing or invalid.");
            }

            if (!survey_pdf_url || !survey_json_url) {
                throw new Error("Survey PDF URL and JSON URL must be provided.");
            }

            // Create a connection pool
            const pool = await poolPromise;

            // Update query for the survey_details table
            const query = `
                UPDATE survey_details
                SET 
                    survey_pdf_url = @pdfUrl, 
                    survey_json_url = @jsonUrl
                WHERE 
                    unqId = @uniqueId;
            `;

            // Execute the query with parameterized inputs
            const result = await pool.request()
                .input('pdfUrl', survey_pdf_url)
                .input('jsonUrl', survey_json_url)
                .input('uniqueId', uniqueId)
                .query(query);

            // Handle the result
            if (result.rowsAffected && result.rowsAffected[0] > 0) {
                console.log(`Successfully updated URLs for unqId: ${uniqueId}`);
                return true;
            } else {
                console.log(`No record found for unqId: ${uniqueId}`);
                return false;
            }

        } catch (error) {
            console.error("Error updating URLs in database:", error.message);
            throw {
                success: false,
                message: "Error updating survey details URLs.",
                error: error.message,
            };
        }
    }

    static async getURLs(dealer_name, dealer_code, brand_name, survey_date) {
        try {
            // check if all data is given
            if(!dealer_name || !dealer_code || !brand_name || !survey_date) {
                throw new Error("All details are required to fetch the existing chat");
            }

            // create the connection object
            const pool = await poolPromise;

            // construct the query to execute
            const query = `SELECT survey_json_url, survey_pdf_url
                FROM survey_details
                WHERE dealer_name = @dealer_name 
                  AND dealer_code = @dealer_code
                  AND brand_name = @brand_name
                  AND survey_date = @survey_date;`
                
            // query the database
            const result = await pool.request()
                .input('dealer_name', dealer_name)
                .input('dealer_code', dealer_code)
                .input('brand_name', brand_name)
                .input('survey_date', survey_date)
                .query(query);
            
             // Check if the query returned any rows
            if (result.recordset.length === 0) {
                return {
                    success: false,
                    message: "No matching session URLs found for the given details.",
                    data: null,
                };
            }

            // return the URLs
            return result.recordset[0];

        } catch (error) {
            console.error("Error updating URLs in database:", error.message);
            throw {
                success: false,
                message: "Error updating survey details URLs.",
                error: error.message,
            };
        }
    }

    static async getSurveys() {
        try {
            // Create the connection object
            const pool = await poolPromise;
    
            // Construct the query to fetch all surveys (or specify more filtering criteria if needed)
            const query = `SELECT unqId, dealer_name, dealer_code, brand_name, survey_date, survey_pdf_url, survey_json_url
                           FROM survey_details;`;
            
            // Query the database
            const result = await pool.request().query(query);
            
            // Check if any surveys were found
            if (result.recordset.length === 0) {
                return {
                    success: false,
                    message: "No surveys found.",
                    data: null,
                };
            }
    
            // Return the surveys
            return {
                success: true,
                message: "Surveys fetched successfully.",
                data: result.recordset,
            };
    
        } catch (error) {
            console.error("Error fetching surveys from database:", error.message);
            throw {
                success: false,
                message: "Error fetching surveys from database.",
                error: error.message,
            };
        }
    }
    
    static async getSurveyById(surveyId) {
        try {
            // Check if surveyId is provided
            if (!surveyId) {
                throw new Error("Survey ID is required.");
            }
    
            // Create the connection object
            const pool = await poolPromise;
    
            // Construct the query to fetch the survey by its ID
            const query = `SELECT unqId, dealer_name, dealer_code, brand_name, survey_date, survey_pdf_url, survey_json_url
                           FROM survey_details
                           WHERE unqId = @surveyId;`;
    
            // Query the database
            const result = await pool.request()
                .input('surveyId', surveyId)
                .query(query);
    
            // Check if the survey was found
            if (result.recordset.length === 0) {
                return {
                    success: false,
                    message: `No survey found with ID: ${surveyId}.`,
                    data: null,
                };
            }
    
            // Return the found survey
            return {
                success: true,
                message: "Survey fetched successfully.",
                data: result.recordset[0],
            };
    
        } catch (error) {
            console.error("Error fetching survey by ID:", error.message);
            throw {
                success: false,
                message: "Error fetching survey by ID.",
                error: error.message,
            };
        }
    }    
}

export default Survey;
