// router set-up for survey routes
import { beginSurvey, endSurvey, continueSurvey, getSurveys, getSurveyById } from "../controllers/survey.controller.js";
import express from 'express';

const router = express.Router();

router.route('/beginSurvey')
    .post(beginSurvey);

router.route('/endSurvey')
    .post(endSurvey);

router.route('/continueSurvey')
    .post(continueSurvey);

router.route('/getSurveys')
    .get(getSurveys)

router.route('/getSurveyById')
    .get(getSurveyById)

export default router;