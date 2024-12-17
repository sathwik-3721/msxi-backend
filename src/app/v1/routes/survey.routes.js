// router set-up for survey routes
import { beginSurvey, endSurvey } from "../controllers/survey.controller.js";
import express from 'express';

const router = express.Router();

router.route('/beginSurvey')
    .post(beginSurvey);

router.route('/endSurvey')
    .post(endSurvey);

export default router;