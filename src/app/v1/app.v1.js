import express from 'express';
import passport from 'passport';
import passportJWT from 'passport-jwt';
import dealerRoutes from '../v1/routes/dealer.routes.js';
import surveyRoutes from '../v1/routes/survey.routes.js';
import { loginUser } from '../v1/controllers/login.controller.js';
import { pingTest, test } from '../v1/controllers/test.controller.js';
import testRouter from '../v1/routes/test.routes.js';
// import { poolPromise } from './utils/dbConnection.js';

// JWT Passport Strategy
const { Strategy: JwtStrategy, ExtractJwt } = passportJWT;
const app = express();

// Define your JWT strategy for Passport
const passportStrategy = new JwtStrategy({
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: 'superSecret',  // secret key 
}, (jwt_payload, next) => {
    console.log(jwt_payload)
    next(null, jwt_payload)
});

// Init Passport strategy
passport.use(passportStrategy);

// Handle browser OPTIONS request (CORS support)
const handleOptionsReq = (req, res, next) => {
    if (req.method === 'OPTIONS') { 
        res.send(200); // handle OPTIONS requests (e.g. preflight for CORS)
    } else { 
        next();
    }
}

// Define the `/` route first
app.get("/", (req, res) => {
    console.log('ji');
    return res.status(200).json({ message: "Hello" });
});

// Other routes like login
app.post('/login', loginUser);

// Test Routes
app.get('/test', test);
app.get('/test/ping', pingTest);

// Secured API routes - authentication using JWT
app.use('/api', handleOptionsReq, passport.authenticate('jwt', { session: false }));

// API routers (test, dealer, survey, etc.)
app.use('/api', testRouter);
app.use('/api/dealer', dealerRoutes);
app.use('/api/survey', surveyRoutes);

// Start the server
// const PORT = process.env.PORT || 3000;
// app.listen(PORT, () => {
//     console.log(`Server is running on port ${PORT}`);
// });

export default app;