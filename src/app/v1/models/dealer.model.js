import { poolPromise } from "../utils/dbConnection.js";

class Dealer {
    static async insertDealerInfo(unqId, dealerCode, brandName) {
        try {
            // Create a database pool connection
            const pool = await poolPromise;

            // Generate current date for survey_date
            const surveyDate = new Date().toISOString().split('T')[0]; // Format as YYYY-MM-DD

            // Execute the INSERT query
            const result = await pool.request()
                .input('unqId', unqId)
                .input('dealer_code', dealerCode)
                .input('brand_name', brandName)
                .input('survey_date', surveyDate)
                .input('survey_pdf_url', null)  // Placeholder for survey_pdf_url
                .input('survey_json_url', null) // Placeholder for survey_json_url
                .query(`
                    INSERT INTO survey_details 
                    (unqId, survey_pdf_url, dealer_code, brand_name, survey_date, survey_json_url)
                    VALUES (@unqId, @survey_pdf_url, @dealer_code, @brand_name, @survey_date, @survey_json_url);
                `);

            console.log(`Insert successful for unqId: ${unqId}`);
            return {
                success: true,
                message: `Dealer information inserted successfully with unqId: ${unqId}`
            };

        } catch (error) {
            console.error("Error occurred while inserting dealer information:", error.message);
            return {
                success: false,
                message: "Error occurred while inserting dealer information.",
                error: error.message
            };
        }
    }
}

export default Dealer;
