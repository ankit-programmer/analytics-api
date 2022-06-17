import express, { Application, Request, Response } from "express";
import dotenv from 'dotenv';
import analytics from './route/analytics';
import reports from './route/reports'
import responseTime from 'response-time';
dotenv.config();
const app: Application = express();
const port = process.env.PORT || 3000;
import bigquery from './database/big-query';

app.use(responseTime(function (req: Request, res: Response, time) {
    var stat = (req.method + req.url).toLowerCase()
        .replace(/[:.]/g, '')
        .replace(/\//g, '_')
    console.info(`${stat} ${time}`);
}));
// Body parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/analytics", analytics);
app.use("/reports", reports);
app.get("/", (req: Request, res: Response) => {
    bigquery.getDatasets().then(datasets => {
        console.log(datasets);
    }).catch(reason => {
        console.log(reason);
    })
    res.send({
        "healthy": true
    });
    return;
}
);

try {
    app.listen(port, (): void => {
        console.log(`Connected successfully on port ${port}`);
    });
} catch (error: any) {
    console.error(`Error occured: ${error?.message}`);
}