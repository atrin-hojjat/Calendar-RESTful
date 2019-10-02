const express = require("express");
const { Pool } = require("pg");
const UserApp = require("./users.js").router;
const CaleApp = require("./cale.js").router;
const cors = require("cors");
const config = require('./config.json');
const bodyparser = require("body-parser");

var app = express();

var whitelist = ['http://localhost:3000']
var corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  }
}

app.use(cors(corsOptions));

app.use(bodyparser.urlencoded({extended: true}));

console.log("starting..");

app.use("/usr", UserApp);
app.use("/cal", CaleApp);

/*

app.put("/calendar/create/", (req, res) => {

});

app.get("/calendar/get/:cid/:sdate/:fdate", (req, res) => {

});

app.put("/calendar/add/:cid", (req, res) => {

});

app.delete("/calendar/delete/:id", (req, res) => {

});

app.delete("/calendar/delete-calendar/:cid", (req, res) => {

});

app.listen(config.port, () => {
  console.log("API Server is running on port " + config.port);
});*/

let port = config.port;

app.listen(port, () => { console.log("listening"); });

module.exports = app;
