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
    constructor(id, name, price, isActive, pictureUrl) {
        this.id = id;
        this.name = name;
        this.price = price;
        this.isActive = isActive;
        this.pictureUrl = pictureUrl ? pictureUrl : null;
    }
}

class Size {
    constructor(id, size, quantity) {
        this.id = id;
        this.size = size;
        this.quantity = quantity;
    }
}

class Stock {
    constructor(id, name, quantity, sizes) {
        this.id = id;
        this.name = name;
        this.quantity = quantity;
        this.sizes = sizes;
    }
}

class Transaction {
    constructor(id, amount, pid, size) {
        this.id = id;
        this.amount = amount;
        this.sale_price = price;
        this.pid = pid;
    }
}

class InfoModel {
    constructor(
        totalProducts,
        totalStocks,
        totalSold,
        totalRevenue,
        monthlySold,
        monthlyRevenue,
        weeklySold,
        weeklyRevenue
    ) {
        this.totalProducts = totalProducts;
        this.totalStocks = totalStocks;
        this.totalSold = totalSold;
        this.totalRevenue = totalRevenue;
        this.monthlySold = monthlySold;
        this.monthlyRevenue = monthlyRevenue;
        this.weeklySold = weeklySold;
        this.weeklyRevenue = weeklyRevenue;
    }
}

app.use(cors());

// Configuring body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// server home page
app.get("/", (req, res) => {
    const sql = "SELECT * FROM users";
    con.query(sql, (err, rows) => {
        if (err) throw err;
        res.status(200).json(rows);
    });
});

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
                    id: user.id,
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

// - get info
app.get("/getInfo", authenticateToken, (req, res) => {
    let totalProducts = 0;
    let totalStocks = 0;
    let totalSold = 0;
    let totalRevenue = 0;
    let monthlySold = 0;
    let monthlyRevenue = 0;
    let weeklySold = 0;
    let weeklyRevenue = 0;

    const sql = "SELECT * FROM models";
    con.query(sql, (err, rows) => {
        if (err) throw err;
        totalProducts = rows.length;
        const sql2 = "SELECT * FROM sizes";
        con.query(sql2, (err, rows) => {
            if (err) throw err;
            rows.forEach((row) => {
                row.quantity = parseInt(row.quantity);
                totalStocks += row.quantity;
            });
            const sql3 = "SELECT * FROM transactions";
            con.query(sql3, (err, rows) => {
                if (err) throw err;
                totalSold = rows.length;
                rows.forEach((row) => {
                    totalRevenue += row.sale_price;
                });
                const sql4 =
                    "SELECT * FROM transactions WHERE MONTH(created_on) = MONTH(CURRENT_DATE())";
                con.query(sql4, (err, rows) => {
                    if (err) throw err;
                    monthlySold = rows.length;
                    rows.forEach((row) => {
                        monthlyRevenue += row.sale_price;
                    });
                    const sql5 =
                        "SELECT * FROM transactions WHERE WEEK(created_on) = WEEK(CURRENT_DATE())";
                    con.query(sql5, (err, rows) => {
                        if (err) throw err;
                        weeklySold = rows.length;
                        rows.forEach((row) => {
                            weeklyRevenue += row.sale_price;
                        });
                        const info = new InfoModel(
                            totalProducts,
                            totalStocks,
                            totalSold,
                            totalRevenue,
                            monthlySold,
                            monthlyRevenue,
                            weeklySold,
                            weeklyRevenue
                        );

                        res.status(200).json(info);
                    });
                });
            });
        });
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
app.get("/getUser", authenticateToken, (req, res) => {
    const id = req.query.id;
    const sql = "SELECT * FROM users WHERE id = ?";
    con.query(sql, [id], (err, rows) => {
        if (err) throw err;
        res.status(200).json(rows[0]);
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

// change user pin
app.put("/changePin", authenticateToken, (req, res) => {
    const id = req.query.id;
    const old_pin = req.query.old_pin;
    const new_pin = req.query.new_pin;

    const sql = "SELECT * FROM users WHERE id = ?";
    con.query(sql, [id], (err, rows) => {
        if (err) throw err;

        if (rows.length > 0) {
            const user = new User(
                rows[0].id,
                rows[0].first_name,
                rows[0].last_name,
                rows[0].token,
                rows[0].pin
            );

            if (user.pin === old_pin) {
                const updateSql = "UPDATE users SET pin = ? WHERE id = ?";
                const updateValues = [new_pin, user.id];

                con.query(updateSql, updateValues, function (err, result) {
                    if (err) throw err;
                    console.log("1 record updated");
                    res.status(200).json({ message: "Pin changed" });
                });
            } else {
                console.log("Old pin is invalid: " + old_pin);
                res.status(200).json({ message: "Old pin is invalid" });
            }
        } else {
            console.log("User not found: " + id);
            res.status(200).json({ message: "User not found" });
        }
    });
});

// MESSAGE MANAGEMENT

// - get all messages
app.get("/getMessages", authenticateToken, (req, res) => {
    // messages order by created_on desc
    const sql = "SELECT * FROM messages ORDER BY created_on DESC";
    con.query(sql, (err, rows) => {
        if (err) throw err;
        res.status(200).json(rows);
    });
});

// - add message
app.post("/addMessage", authenticateToken, (req, res) => {
    const message = req.query.message;
    const user_id = req.query.user_id;
    const sql = "INSERT INTO messages (user_id, message) VALUES (?, ?)";
    const values = [user_id, message];

    con.query(sql, values, (err, result) => {
        if (err) throw err;
        console.log("1 record inserted");
        res.status(200).json({ message: "Message added" });
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
app.get("/getModel", authenticateToken, (req, res) => {
    const id = req.query.id;
    const sql = "SELECT * FROM models WHERE id = ?";
    con.query(sql, [id], (err, rows) => {
        if (err) throw err;
        if (rows[0].active === 0) {
            rows[0].active = false;
        } else {
            rows[0].active = true;
        }
        res.status(200).json(rows[0]);
    });
});

// - add model
app.post("/addModel", authenticateToken, (req, res) => {
    const name = req.body.name;
    const price = req.body.price;
    const active = req.body.active;

    const sql = "INSERT INTO models (name, price, active) VALUES (?, ?, ?)";
    const values = [name, price, active];

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
    const active = req.body.active;

    const sql =
        "UPDATE models SET name = ?, price = ?, active = ? WHERE id = ?";
    const values = [name, price, active, id];

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

// STOCK MANAGEMENT
app.get("/getStocks", authenticateToken, (req, res) => {
    const sql = "SELECT * FROM models";

    con.query(sql, (err, models) => {
        if (err) throw err;
        const sql2 = "SELECT * FROM sizes";
        con.query(sql2, (err, sizes) => {
            if (err) throw err;
            // generate stock array
            const stock = [models.length];
            for (let i = 0; i < models.length; i++) {
                // get sizes for model
                const sizeArray = [];

                var totalStock = 0;

                for (let j = 0; j < sizes.length; j++) {
                    if (sizes[j].pid == models[i].id) {
                        totalStock += sizes[j].quantity;
                        sizeArray.push(
                            new Size(
                                sizes[j].id,
                                sizes[j].size,
                                sizes[j].quantity
                            )
                        );
                    }
                }

                stock[i] = new Stock(
                    models[i].id,
                    models[i].name,
                    totalStock,
                    sizeArray
                );
            }

            res.status(200).json(stock);
        });
    });
});

//get sizes for model
app.get("/getSizes", authenticateToken, (req, res) => {
    const pid = req.query.pid;
    const sql = "SELECT * FROM sizes WHERE pid = ?";
    con.query(sql, [pid], (err, rows) => {
        if (err) throw err;
        res.status(200).json(rows);
    });
});

// - update stock
app.put("/updateStock", authenticateToken, (req, res) => {
    const id = req.query.id;
    const stock = req.query.stock;

    const sql = "UPDATE sizes SET quantity = ? WHERE id = ?";
    const values = [stock, id];

    con.query(sql, values, (err, result) => {
        if (err) throw err;
        console.log("1 record updated");

        res.status(200).json({ message: "Updated stock for size" });
    });
});

// - add size
app.post("/addSize", authenticateToken, (req, res) => {
    const pid = req.body.id;
    const size = req.body.size;
    const quantity = req.body.quantity;

    const sql = "INSERT INTO sizes (pid, size, quantity) VALUES (?, ?, ?)";
    const values = [pid, size, quantity];

    con.query(sql, values, (err, result) => {
        if (err) throw err;
        console.log("1 record inserted");
        res.status(200).json({ message: "Size added" });
    });
});

// - delete size
app.delete("/deleteSize", authenticateToken, (req, res) => {
    const id = req.query.id;
    const sql = "DELETE FROM sizes WHERE id = ?";
    con.query(sql, [id], (err, result) => {
        if (err) throw err;
        console.log("1 record deleted");
        res.status(200).json({ message: "Size deleted" });
    });
});

// TRANSACTION MANAGEMENT

// - get all transactions
app.get("/getTransactions", authenticateToken, (req, res) => {
    const sql = `
    SELECT transactions.id, models.name, sizes.size, transactions.amount, transactions.sale_price, transactions.created_on
    FROM transactions
    JOIN models ON transactions.model_id = models.id
    JOIN sizes ON transactions.size_id = sizes.id;
    `;

    con.query(sql, (err, rows) => {
        if (err) throw err;
        res.status(200).json(rows);
    });
});

// - get transaction by id
app.get("/getTransaction", authenticateToken, (req, res) => {
    const id = req.query.id;
    const sql = "SELECT * FROM transactions WHERE id = ?";
    con.query(sql, [id], (err, rows) => {
        if (err) throw err;
        res.status(200).json(rows);
    });
});

// - add transaction
app.post("/addTransaction", authenticateToken, (req, res) => {
    const model_id = req.query.model_id;
    const size_id = req.query.size_id;
    const amount = req.query.amount;
    const sale_price = req.query.sale_price;

    const sql = `
    INSERT INTO transactions (model_id, size_id, amount, sale_price)
    VALUES (?, ?, ?, ?)
    `;

    const values = [model_id, size_id, amount, sale_price];

    con.query(sql, values, (err, result) => {
        if (err) throw err;
        console.log("1 record inserted");
        res.status(200).json({ message: "Transaction added" });
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
