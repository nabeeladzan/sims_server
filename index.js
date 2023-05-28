const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");

// get config vars
dotenv.config();

const app = express();
const port = 3000;

// Dummy data for testing
let otk = ["123456", "654321", "567890", "098765"];

app.use(cors());

// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.get("/", (req, res) => res.send("SIMS Server"));

function generateAccessToken(key) {
    return jwt.sign(key, process.env.TOKEN_SECRET, { expiresIn: "1800s" });
}

app.post("/registerKey", (req, res) => {
    const key = req.body.key;

    // check if the key is already registered
    if (otk.includes(key)) {
        console.log("Registering key: " + key);

        const token = generateAccessToken({ key: key });

        otk = otk.filter((item) => item !== key);

        // return the hashed token
        res.status(200).json({ token });
    } else {
        console.log("Key is invalid: " + key);
        res.status(400).send("Key is invalid");
    }
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        console.log(err);

        if (err) return res.sendStatus(403);

        req.user = user;

        next();
    });
}

app.get("/testToken", authenticateToken, (req, res) => {
    res.status(200).send("Token is valid");
});

app.listen(port, () => console.log(`SIMS Server listening on port ${port}!`));
