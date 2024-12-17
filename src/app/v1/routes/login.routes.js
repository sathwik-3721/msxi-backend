import express from 'express';
import {loginUser} from '../controllers/login.controller.js';

const router = express.Router();

router.route('/login')
    .post(loginUser);

export default router;
