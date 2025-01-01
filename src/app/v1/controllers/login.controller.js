import { setUsername } from '../utils/helper.js';
import pkg from 'jsonwebtoken';
import express from 'express';
const { sign } = pkg;

// mock login details
const loginDetails = {
    userName: 'admin@msxi.com',
    password: 'password'
}

export async function loginUser(req, res) {
    try {
        // get the user details
        const { userName, password } = req.body;

        // set the username
        setUsername(userName);

        // check if authorized user or not
        if ((userName === loginDetails.userName) && (password === loginDetails.password)) {
            // create a JWT token
            const token = sign({ payload: "payload" }, 'superSecret', {
                expiresIn: "1d" // expires in 24 hours
            });
            if (!token) {
                throw { status: StatusCodes.INTERNAL_SERVER_ERROR, message: "Failed to generate token" };
            }
            return res.status(200).json({ 
                success: true, 
                message: 'Login Sucessful', 
                userName: 'Admin',
                token: token
            });
        } else {
            return res.status(500).json({
                success: false,
                message: 'Login failed'
            });
        }
    } catch(error) {
        console.error('Error occurred:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Internal Server Error', 
            error: error  
        });
    }
}