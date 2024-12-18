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

    // static async getURLS()
}

export default Survey;
