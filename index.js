const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
var mysql = require("mysql");

// get config vars
dotenv.config();

const app = express();
const port = 3000;

var con = mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "",
    database: "sims",
});

con.connect((err) => {
    if (err) throw err;
    console.log("Connected to MySQL Server!");
});

// User class
class User {
    constructor(id, first_name, last_name, token, pin) {
        this.id = id;
        this.first_name = first_name;
        this.last_name = last_name;
        this.token = token;
        this.pin = pin;
    }
}

// Message class
class Message {
    constructor(id, user_id, message, created_at) {
        this.id = id;
        this.user_id = user_id;
        this.message = message;
        this.created_at = created_at;
    }
}

app.use(cors());

// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// server home page
app.get("/", (req, res) => res.send("SIMS Server"));

// generate jwt token
function generateAccessToken(key) {
    return jwt.sign(key, process.env.TOKEN_SECRET, { expiresIn: "1800s" });
}

// Generate 10 digit key for token
function generateTenDigitKey() {
    return Math.floor(1000000000 + Math.random() * 9000000000);
}

// AUTHENTICATION

// - token login
app.post("/registerKey", (req, res) => {
    const key = req.body.key;
    const sql = "SELECT * FROM users WHERE token = ?";

    console.log("Checking key...");
    con.query(sql, [key], (err, rows) => {
        if (err) throw err;

        if (rows.length > 0) {
            const user = new User(
                rows[0].id,
                rows[0].first_name,
                rows[0].last_name,
                rows[0].token,
                rows[0].pin
            );

            if (user.token === key) {
                console.log("Registering key: " + key);

                const jwt = generateAccessToken({ key: key });

                const newKey = generateTenDigitKey();
                const updateSql = "UPDATE users SET token = ? WHERE id = ?";
                const updateValues = [newKey, user.id];

                console.log("Updating New Key...");
                con.query(updateSql, updateValues, function (err, result) {
                    if (err) throw err;
                    console.log("1 record updated");
                });

                // Return the hashed token
                res.status(200).json({
                    token: jwt,
                    first_name: user.first_name,
                    last_name: user.last_name,
                    pin: user.pin,
                });
            } else {
                console.log("Key is invalid: " + key);
                res.status(400).send("Key is invalid");
            }
        } else {
            console.log("Key not found: " + key);
            res.status(404).send("Key not found");
        }
    });
});


// USER MANAGEMENT

// - get all users
app.get("/getUsers", authenticateToken, (req, res) => {
    const sql = "SELECT * FROM users";

    con.query(sql, (err, rows) => {
        if (err) throw err;
        res.status(200).json(rows);
    });
});

// - get user by id
app.get("/getUser/:id", authenticateToken, (req, res) => {
    const id = req.params.id;
    const sql = "SELECT * FROM users WHERE id = ?";
    con.query(sql, [id], (err, rows) => {
        if (err) throw err;
        res.status(200).json(rows);
    });
});

// - add user
app.post("/addUser", authenticateToken, (req, res) => {
    const first_name = req.body.first_name;
    const last_name = req.body.last_name;
    const pin = req.body.pin;
    const token = generateTenDigitKey();

    const sql = "INSERT INTO users (first_name, last_name, pin, token) VALUES (?, ?, ?, ?)";
    const values = [first_name, last_name, pin, token];

    con.query(sql, values, (err, result) => {
        if (err) throw err;
        console.log("1 record inserted");
        res.status(200).send("User added");
    });
});

// - update user
app.put("/updateUser/:id", authenticateToken, (req, res) => {
    const id = req.params.id;
    const first_name = req.body.first_name;
    const last_name = req.body.last_name;
    const pin = req.body.pin;
    
    const sql = "UPDATE users SET first_name = ?, last_name = ?, pin = ? WHERE id = ?";
    const values = [first_name, last_name, pin, id];

    con.query(sql, values, (err, result) => {
        if (err) throw err;
        console.log("1 record updated");
        res.status(200).send("User updated");
    });
});

// - delete user
app.delete("/deleteUser/:id", authenticateToken, (req, res) => {
    const id = req.params.id;
    const sql = "DELETE FROM users WHERE id = ?";
    con.query(sql, [id], (err, result) => {
        if (err) throw err;
        console.log("1 record deleted");
        res.status(200).send("User deleted");
    });
});

// JWT AUTHENTICATION
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        if (err) {
            console.log(err);
            return res.sendStatus(403);
        }

        req.user = user;

        next();
    });
}

// DEBUGGING

// - test token
app.get("/testToken", authenticateToken, (req, res) => {
    res.status(200).send("valid token");
});

app.listen(port, () => console.log(`SIMS Server listening on port ${port}!`));
