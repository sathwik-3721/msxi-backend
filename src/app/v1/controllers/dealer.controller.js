import { appendDealerInfoToPDF, clearAllFilesInSession, setUniqueId } from '../utils/helper.js';
import Dealer from '../models/dealer.model.js';

export async function appendDealerInfo(req, res) {
    console.log("Hello")
    try {
        // clear the pdf before appending the dealer info
        await clearAllFilesInSession();        
        
        // get the dealer and other info
        const { dealerName, dealerId, brandName, date, location, visitType } = req.body;

        // check if complete data is given
        if(!dealerId || !dealerName || !brandName || !date || !location || !visitType) {
            return res.status(500).json({
                success: false,
                message: 'One or more fields are missing'
            });
        }

        // generate uniqueId
        const id = `${dealerId}${dealerName}${brandName}${date}`;
        setUniqueId(id);

        // insert data into table
        await Dealer.insertDealerInfo(id, dealerName, dealerId, brandName);

        // call the function to append the dealer data into pdf
        await appendDealerInfoToPDF(dealerName, dealerId, brandName, date, location, visitType);

        // return the success response
        return res.status(201).json({
            success: true,
            message: 'Dealer Information is stored successfully'
        })

    } catch(error) {
        console.error('Error occurred:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal Server Error', 
            error: error.response?.data || error.message 
        });
    }
}