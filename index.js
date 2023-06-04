const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const multer = require("multer");

var mysql = require("mysql");

// get config vars
dotenv.config();

const app = express();
const port = 3000;
const imageUpload = multer({
    storage: multer.diskStorage({
        destination: "images/",
        filename: (req, file, cb) => {
            const randomString = generateRandomString(10);
            const filename =
                randomString + "." + file.originalname.split(".").pop();
            cb(null, filename);
        },
    }),
});

var con = mysql.createConnection({
    host: "localhost",
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
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

// Model class
class Model {
    constructor(id, name, price, stock, isActive, pictureUrl) {
        this.id = id;
        this.name = name;
        this.price = price;
        this.stock = stock;
        this.isActive = isActive;
        this.pictureUrl = pictureUrl ? pictureUrl : null;
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
    return jwt.sign(key, process.env.TOKEN_SECRET, { expiresIn: "14d" });
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

    const sql =
        "INSERT INTO users (first_name, last_name, pin, token) VALUES (?, ?, ?, ?)";
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

    const sql =
        "UPDATE users SET first_name = ?, last_name = ?, pin = ? WHERE id = ?";
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

// MODEL MANAGEMENT

// - get all models
app.get("/getModels", authenticateToken, (req, res) => {
    const sql = "SELECT * FROM models";

    con.query(sql, (err, rows) => {
        if (err) throw err;
        // change active from 0/1 to false/true
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].active === 0) {
                rows[i].active = false;
            } else {
                rows[i].active = true;
            }
        }
        res.status(200).json(rows);
    });
});

// - get model by id
app.get("/getModel/:id", authenticateToken, (req, res) => {
    const id = req.params.id;
    const sql = "SELECT * FROM models WHERE id = ?";
    con.query(sql, [id], (err, rows) => {
        if (err) throw err;
        res.status(200).json(rows);
    });
});

// - add model
app.post("/addModel", authenticateToken, (req, res) => {
    const name = req.body.name;
    const price = req.body.price;
    const stock = req.body.stock;
    const active = req.body.active;

    const sql =
        "INSERT INTO models (name, price, stock, active) VALUES (?, ?, ?, ?)";
    const values = [name, price, stock, active];

    con.query(sql, values, (err, result) => {
        if (err) throw err;
        console.log("1 record inserted");
        res.status(200).json({ message: "Model added" });
    });
});

// - update model
app.put("/updateModel", authenticateToken, (req, res) => {
    const id = req.body.id;
    const name = req.body.name;
    const price = req.body.price;
    const stock = req.body.stock;
    const active = req.body.active;

    const sql =
        "UPDATE models SET name = ?, price = ?, stock = ?, active = ? WHERE id = ?";
    const values = [name, price, stock, active, id];

    con.query(sql, values, (err, result) => {
        if (err) throw err;
        console.log("1 record updated");
        res.status(200).json({ message: "Model updated" });
    });
});

// - delete model by id
app.delete("/deleteModel", authenticateToken, (req, res) => {
    const id = req.query.id;
    const sql = "DELETE FROM models WHERE id = ?";
    con.query(sql, [id], (err, result) => {
        if (err) throw err;
        console.log("1 record deleted");
        res.status(200).json({ message: "Model deleted" });
    });
});

// image upload with authentication
app.post(
    "/uploadImage",
    authenticateToken,
    imageUpload.single("image"),
    (req, res) => {
        if (!req.file) {
            return res.status(400).send("No file uploaded.");
        }
        res.status(200).send("File uploaded!");

        // set the model picture_id to the id of the uploaded image
        const id = req.body.id;
        const sql = "UPDATE models SET picture_id = ? WHERE id = ?";
        const values = [req.file.filename, id];

        con.query(sql, values, (err, result) => {
            if (err) throw err;
            console.log("1 record updated");
        });
    }
);

// JWT AUTHENTICATION
function authenticateToken(req, res, next) {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    console.log("Authenticating token : " + token);

    if (token == null) {
        console.log("Token is empty");
        return res.sendStatus(401);
    }

    jwt.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        if (err) {
            console.log(err);
            res.status(200).json({ message: "Token is not valid" });
        }

        req.user = user;

        next();
    });
}

// DEBUGGING

// - test token
app.get("/testToken", authenticateToken, (req, res) => {
    // return json is token is valid
    console.log("Token is valid");
    res.status(200).json({ message: "Token is valid" });
});

app.listen(port, () => console.log(`SIMS Server listening on port ${port}!`));
