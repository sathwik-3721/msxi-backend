//packages
import express, { json, urlencoded, static as static_ } from 'express';
import cookieParser from 'cookie-parser';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import cors from 'cors'
//file imports
// import config from "./config.js";
import logger from './logger.js';
import appv1 from './src/app/v1/app.v1.js';
const __dirname = dirname( fileURLToPath(import.meta.url));
const app = express();
// const environmant = config.ENV;
//port setup - app start declaration
const port = process.env.PORT || 8000;
const requestLoggerMiddleware = (req, res, next) => {
  const startTime = Date.now();
  res.on('finish', () => {
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    const status = res.statusCode >= 400 ? 'failed' : 'success';
    logger.info({
      message: 'HTTP Request',
      method: req.method,
      path: req.path,
      query: req.query,
      body: req.body,
      ip: req.ip,
      userAgent: req.get('user-agent'),
      status: status,
      responseTime: responseTime
    });
  });

  next();
};

app.use(cors())
//CORS setup
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

app.use(requestLoggerMiddleware);

//bodyparser
app.use(json());
app.use(urlencoded({ extended: false }));
app.use(cookieParser());
app.use(static_(join(__dirname, 'public')));

//V1
app.use('/v1', appv1);

// logger.info("Application Environment : " + environmant);
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server started on port: " + PORT);
})

export default app;
